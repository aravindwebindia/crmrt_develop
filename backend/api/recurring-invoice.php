<?php
/**
 * Recurring Invoice API
 * Shows:
 * - ALL overdue records (regardless of how old they are)
 * - Upcoming records within 30 days of due date
 */
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get JWT token from header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No token provided']);
        exit();
    }

    // Verify token
    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    $user_id = $decoded['user_id'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 10;
        $offset = ($page - 1) * $limit;

        // Get search and filter parameters
        $search = $_GET['search'] ?? '';
        $sortBy = $_GET['sortBy'] ?? 'pid.bill_to_date';
        $sortOrder = strtoupper($_GET['sortOrder'] ?? 'ASC');

        // Validate sort order
        $sortOrder = in_array($sortOrder, ['ASC', 'DESC']) ? $sortOrder : 'ASC';
        
        // Map sort fields for grouped query (use aliases or grouped columns)
        $allowedSortFields = [
            'pid.bill_to_date' => 'pid.bill_to_date',
            'pi.invoice_no' => 'pi.invoice_no',
            'so.saleorder_no' => 'so.saleorder_no',
            'c.company' => 'c.company',
            'bc.bc_name' => 'bc.bc_name',
            'grand_total' => 'SUM(pid.inv_total_amount)'
        ];
        $sortByField = $allowedSortFields[$sortBy] ?? 'pid.bill_to_date';

        // Build WHERE conditions
        $whereConditions = [];
        $params = [];

        // Only show non-deleted proforma invoices
        $whereConditions[] = "pi.is_deleted = 0";

        // Date condition: show all overdue records OR upcoming records within 30 days
        $whereConditions[] = "(pid.bill_to_date < CURDATE() OR pid.bill_to_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))";

        // Search condition
        if (!empty($search)) {
            $whereConditions[] = "(pi.invoice_no LIKE ? OR so.saleorder_no LIKE ? OR c.company LIKE ? OR bc.bc_name LIKE ?)";
            $searchParam = "%{$search}%";
            $params = array_merge($params, [$searchParam, $searchParam, $searchParam, $searchParam]);
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

        // Count total records grouped by sale_order_id and bill_to_date (not pi.id)
        // This groups services from same sale order with same end date together
        $countQuery = "SELECT COUNT(DISTINCT CONCAT(so.id, '-', pid.bill_to_date)) as total
                      FROM proforma_invoices pi
                      LEFT JOIN proforma_invoice_details pid ON pi.id = pid.p_inv_id
                      LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                      LEFT JOIN contacts c ON so.contact_id = c.ld_id
                      LEFT JOIN bill_company bc ON pi.bc_id = bc.bc_id
                      LEFT JOIN bill_cycles bcy ON pid.bill_cycle_id = bcy.id
                      $whereClause
                      AND pid.status = 'invoiced' AND pid.bill_cycle_id IN (2, 3, 4)";

        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        $totalPages = ceil($totalItems / $limit);

        // Main query to get recurring invoice data - GROUPED by sale_order_id and bill_to_date
        // This ensures same Sale Order + same end date = ONE row (even if different PI numbers)
        $query = "SELECT 
                    MIN(pid.id) as detail_id,  -- Use MIN to get a representative detail_id
                    MIN(pi.id) as invoice_id,  -- Use MIN for representative invoice_id (for backward compatibility)
                    GROUP_CONCAT(DISTINCT pi.invoice_no ORDER BY pi.invoice_no SEPARATOR ', ') as pi_number,  -- Show all invoice numbers
                    MIN(pi.inv_date) as pi_date,  -- Use MIN for representative invoice date
                    so.id as sale_order_id,
                    so.saleorder_no,
                    c.company as company_name,
                    bc.bc_name as billing_company,
                    pid.bill_to_date,
                    DATE_ADD(pid.bill_to_date, INTERVAL 1 DAY) as bill_to_date_plus_one,
                    SUM(pid.inv_total_amount) as grand_total,  -- SUM all services with same sale order + due date
                    COUNT(pid.id) as service_count,  -- Count of services in this group
                    MIN(pid.bill_followup) as bill_followup,  -- Use MIN for representative value
                    GROUP_CONCAT(DISTINCT bcy.cycle_name SEPARATOR ', ') as cycle_name,  -- Show all cycle names
                    CASE 
                        WHEN pid.bill_to_date = CURDATE() THEN 'Due'
                        WHEN pid.bill_to_date < CURDATE() THEN 'Overdue'
                        WHEN pid.bill_to_date > CURDATE() THEN 'Upcoming Due'
                        ELSE 'Unknown'
                    END as due_status,
                    CASE 
                        WHEN pid.bill_to_date < CURDATE() THEN DATEDIFF(pid.bill_to_date, CURDATE())
                        ELSE DATEDIFF(pid.bill_to_date, CURDATE())
                    END as days_until_due,
                    CASE 
                        WHEN pid.bill_to_date < CURDATE() THEN DATEDIFF(CURDATE(), pid.bill_to_date)
                        ELSE 0
                    END as overdue_days
                  FROM proforma_invoices pi
                  LEFT JOIN proforma_invoice_details pid ON pi.id = pid.p_inv_id
                  LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN bill_company bc ON pi.bc_id = bc.bc_id
                  LEFT JOIN bill_cycles bcy ON pid.bill_cycle_id = bcy.id
                  $whereClause
                  AND pid.status = 'invoiced' AND pid.bill_cycle_id IN (2, 3, 4)
                  GROUP BY so.id, so.saleorder_no, c.company, bc.bc_name, pid.bill_to_date
                  ORDER BY $sortByField $sortOrder
                  LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $recurringInvoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $recurringInvoices,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $totalItems,
                'items_per_page' => $limit
            ]
        ]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>

