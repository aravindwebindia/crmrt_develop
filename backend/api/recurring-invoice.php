<?php
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

    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        exit;
    }

    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 10;
    $offset = ($page - 1) * $limit;

    $search = $_GET['search'] ?? '';
    $sortBy = $_GET['sortBy'] ?? 'bill_to_date';
    $sortOrder = strtoupper($_GET['sortOrder'] ?? 'ASC');
    $sortOrder = in_array($sortOrder, ['ASC', 'DESC']) ? $sortOrder : 'ASC';

    $allowedSortFields = [
        'pi_number' => 'lpi.invoice_no',
        'company_name' => 'c.company',
        'saleorder_no' => 'so.saleorder_no',
        'billing_company' => 'bc.bc_name',
        'bill_to_date' => 'sa.next_due_date',
        'grand_total' => 'sa.grand_total'
    ];
    $sortByField = $allowedSortFields[$sortBy] ?? 'sa.next_due_date';

    $serviceAggregateSubquery = "SELECT
                                    latest_detail.sale_order_id,
                                    COUNT(*) as service_count,
                                    SUM(pid.inv_total_amount) as grand_total,
                                    MIN(DATE_ADD(pid.bill_to_date, INTERVAL 1 DAY)) as next_due_date
                                 FROM (
                                    SELECT
                                        pi.sale_order_id,
                                        CASE
                                            WHEN pid.sale_order_detail_id IS NULL OR pid.sale_order_detail_id = 0
                                                THEN CONCAT('PID-', pid.id)
                                            ELSE CONCAT('SOD-', pid.sale_order_detail_id)
                                        END as service_stream_key,
                                        MAX(pid.id) as latest_detail_id
                                    FROM proforma_invoice_details pid
                                    INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                                    LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                                    WHERE pid.status = 'invoiced'
                                      AND pi.is_deleted = 0
                                      AND (bc.cycle_terms IS NULL OR pid.bill_followup < bc.cycle_terms)
                                    GROUP BY pi.sale_order_id, service_stream_key
                                 ) latest_detail
                                 INNER JOIN proforma_invoice_details pid ON pid.id = latest_detail.latest_detail_id
                                 GROUP BY latest_detail.sale_order_id";

    $latestInvoiceSubquery = "SELECT sale_order_id, MAX(id) as latest_invoice_id
                              FROM proforma_invoices
                              WHERE is_deleted = 0
                              GROUP BY sale_order_id";

    $whereConditions = [];
    $params = [];

    if (!empty($search)) {
        $whereConditions[] = "(lpi.invoice_no LIKE ? OR so.saleorder_no LIKE ? OR c.company LIKE ? OR bc.bc_name LIKE ?)";
        $searchParam = "%{$search}%";
        $params = array_merge($params, [$searchParam, $searchParam, $searchParam, $searchParam]);
    }

    $whereClause = !empty($whereConditions) ? ('WHERE ' . implode(' AND ', $whereConditions)) : '';

    $countQuery = "SELECT COUNT(*) as total FROM (
                     SELECT so.id
                     FROM sale_orders so
                     INNER JOIN ($serviceAggregateSubquery) sa ON sa.sale_order_id = so.id
                     INNER JOIN ($latestInvoiceSubquery) li ON li.sale_order_id = so.id
                     INNER JOIN proforma_invoices lpi ON lpi.id = li.latest_invoice_id
                     LEFT JOIN contacts c ON so.contact_id = c.ld_id
                     LEFT JOIN bill_company bc ON lpi.bc_id = bc.bc_id
                     $whereClause
                   ) counted";

    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute($params);
    $totalItems = intval($countStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);
    $totalPages = $totalItems > 0 ? (int)ceil($totalItems / $limit) : 1;

    $query = "SELECT
                lpi.id as invoice_id,
                lpi.invoice_no as pi_number,
                lpi.inv_date as pi_date,
                so.id as sale_order_id,
                so.saleorder_no,
                c.company as company_name,
                bc.bc_name as billing_company,
                sa.service_count,
                sa.grand_total,
                sa.next_due_date,
                CASE
                    WHEN sa.next_due_date = CURDATE() THEN 'Due'
                    WHEN sa.next_due_date < CURDATE() THEN 'Overdue'
                    ELSE 'Upcoming Due'
                END as due_status,
                DATEDIFF(sa.next_due_date, CURDATE()) as days_until_due,
                CASE
                    WHEN sa.next_due_date < CURDATE() THEN DATEDIFF(CURDATE(), sa.next_due_date)
                    ELSE 0
                END as overdue_days
              FROM sale_orders so
              INNER JOIN ($serviceAggregateSubquery) sa ON sa.sale_order_id = so.id
              INNER JOIN ($latestInvoiceSubquery) li ON li.sale_order_id = so.id
              INNER JOIN proforma_invoices lpi ON lpi.id = li.latest_invoice_id
              LEFT JOIN contacts c ON so.contact_id = c.ld_id
              LEFT JOIN bill_company bc ON lpi.bc_id = bc.bc_id
              $whereClause
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

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
