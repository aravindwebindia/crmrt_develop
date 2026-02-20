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

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $reportType = $_GET['report_type'] ?? 'sale_order_wise';
        $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? intval($_GET['company_id']) : null;
        $contactPersonId = isset($_GET['contact_person_id']) && $_GET['contact_person_id'] !== '' ? intval($_GET['contact_person_id']) : null;
        $financialYear = $_GET['financial_year'] ?? null;
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 10;

        // Calculate financial year date range (April to March)
        $startDate = null;
        $endDate = null;
        if ($financialYear) {
            $yearParts = explode('-', $financialYear);
            $startYear = intval($yearParts[0]);
            $startDate = "$startYear-04-01";
            $endDate = ($startYear + 1) . "-03-31";
        }

        $response = ['success' => true, 'data' => null];

        switch ($reportType) {
            case 'sale_order_wise':
                $result = getSaleOrderWiseReport($pdo, $companyId, $startDate, $endDate, $page, $limit);
                $response['data'] = $result['data'];
                $response['total_items'] = $result['total_items'];
                $response['total_pages'] = $result['total_pages'];
                break;
            
            case 'company_wise':
                $result = getCompanyWiseReport($pdo, $companyId, $startDate, $endDate, $page, $limit);
                $response['data'] = $result['data'];
                $response['total_items'] = $result['total_items'];
                $response['total_pages'] = $result['total_pages'];
                break;
            
            case 'company_contact_wise':
                $result = getCompanyContactWiseReport($pdo, $companyId, $contactPersonId, $startDate, $endDate, $page, $limit);
                $response['data'] = $result['data'];
                $response['total_items'] = $result['total_items'];
                $response['total_pages'] = $result['total_pages'];
                break;
            
            case 'quotation_wise':
                $result = getQuotationWiseReport($pdo, $companyId, $startDate, $endDate, $page, $limit);
                $response['data'] = $result['data'];
                $response['total_items'] = $result['total_items'];
                $response['total_pages'] = $result['total_pages'];
                break;
            
            case 'accounts_receivable':
                $result = getAccountsReceivableReport($pdo, $companyId, $startDate, $endDate, $page, $limit);
                $response['data'] = $result['data'];
                $response['total_items'] = $result['total_items'];
                $response['total_pages'] = $result['total_pages'];
                break;
            
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid report type']);
                exit;
        }

        echo json_encode($response);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}

// Sale Order Wise Report
function getSaleOrderWiseReport($pdo, $companyId, $startDate, $endDate, $page = 1, $limit = 10) {
    $whereClauses = ["so.is_deleted = 0"];
    $params = [];

    if ($companyId) {
        $whereClauses[] = "so.contact_id = ?";
        $params[] = $companyId;
    }

    if ($startDate && $endDate) {
        $whereClauses[] = "DATE(so.date) BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    $whereSQL = implode(' AND ', $whereClauses);

    // Count total records
    $countSql = "SELECT COUNT(DISTINCT so.id) as total
            FROM sale_orders so
            LEFT JOIN contacts c ON so.contact_id = c.ld_id
            WHERE $whereSQL";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalItems / $limit);
    $offset = ($page - 1) * $limit;

    // LIMIT and OFFSET must be integers, not parameters
    $limit = intval($limit);
    $offset = intval($offset);

     $sql = "SELECT 
                 so.id,
                 so.saleorder_no as so_number,
                 c.company as customer,
                 so.overall_total_amt as so_value,
                 COALESCE(SUM(pi.tax_received_amt), 0) as total_pi_value,
                 COUNT(DISTINCT pi.id) as pi_count,
                 COUNT(DISTINCT CASE WHEN pi.tax_invoice_no IS NOT NULL AND pi.tax_invoice_no != '' THEN pi.id END) as paid_pi_count,
                 COALESCE(SUM(CASE WHEN pi.tax_invoice_no IS NOT NULL AND pi.tax_invoice_no != '' THEN COALESCE(pi.tax_received_amt, 0) ELSE 0 END), 0) as total_paid_amount,
                 (so.overall_total_amt - COALESCE(SUM(pi.tax_received_amt), 0)) as diff
             FROM sale_orders so
             LEFT JOIN contacts c ON so.contact_id = c.ld_id
             LEFT JOIN proforma_invoices pi ON so.id = pi.sale_order_id AND pi.is_deleted = 0
             WHERE $whereSQL
             GROUP BY so.id, so.saleorder_no, c.company, so.overall_total_amt, so.date
             ORDER BY so.date DESC, so.id DESC
             LIMIT $limit OFFSET $offset";

     $stmt = $pdo->prepare($sql);
     $stmt->execute($params);
     $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

     // Add status based on payment status (tax_invoice_no) and amount comparison
     foreach ($results as &$row) {
         $soValue = floatval($row['so_value']);
         $piValue = floatval($row['total_pi_value']);
         $paidAmount = floatval($row['total_paid_amount']);
         $diff = floatval($row['diff']);
         $piCount = intval($row['pi_count']);
         $paidPiCount = intval($row['paid_pi_count']);

         // If no proforma invoices exist
         if ($piCount == 0) {
             $row['status'] = 'Missing PI';
         }
         // If tax_invoice_no is NULL for all PIs (not paid)
         elseif ($paidPiCount == 0) {
             if (abs($diff) < 0.01) {
                 $row['status'] = 'Not Paid';
             } elseif ($diff > 0) {
                 $row['status'] = 'Not Paid';
             } else {
                 $row['status'] = 'Not Paid';
             }
         }
         // If tax_invoice_no exists (payment made) - check amounts
         else {
             // Check if fully paid: SO amount equals paid amount
             if (abs($soValue - $paidAmount) < 0.01) {
                 $row['status'] = 'Fully Paid';
             }
             // Check if partially paid: paid amount > 0 but less than SO amount
             elseif ($paidAmount > 0 && $paidAmount < $soValue) {
                 $row['status'] = 'Partially Paid';
             }
             // Check if over paid: paid amount exceeds SO amount
             elseif ($paidAmount > $soValue) {
                 $row['status'] = 'Over Paid';
             }
             // Default: check billing status
             else {
                 if (abs($diff) < 0.01) {
                     $row['status'] = 'Fully Billed';
                 } elseif ($diff > 0) {
                     $row['status'] = 'Partially Billed';
                 } else {
                     $row['status'] = 'Over Billed';
                 }
             }
         }
     }

    return [
        'data' => ['sale_orders' => $results],
        'total_items' => intval($totalItems),
        'total_pages' => $totalPages
    ];
}

// Company Wise Report
function getCompanyWiseReport($pdo, $companyId, $startDate, $endDate, $page = 1, $limit = 10) {
    $whereClauses = [];
    $params = [];

    if ($companyId) {
        $whereClauses[] = "c.ld_id = ?";
        $params[] = $companyId;
    }

    $whereSQL = count($whereClauses) > 0 ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    // Count total records
    $countSql = "SELECT COUNT(DISTINCT c.ld_id) as total
            FROM contacts c
            $whereSQL";
    $countParams = [];
    if ($companyId) {
        $countParams[] = $companyId;
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalItems / $limit);
    $offset = ($page - 1) * $limit;

    // LIMIT and OFFSET must be integers, not parameters
    $limit = intval($limit);
    $offset = intval($offset);

    // Build JOIN conditions with date filter - params will be added separately
    // Note: Date filters are NOT applied in JOIN conditions to ensure companies appear even without matching records
    $soJoinCondition = "c.ld_id = so.contact_id AND so.is_deleted = 0";
    
    // Date filtering is handled in subqueries, not in JOINs, to ensure companies always appear
    $allParams = $params;

    // Use separate subqueries to avoid double counting issues
    $dateFilterSQL1 = $startDate && $endDate ? " AND DATE(so3.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL2 = $startDate && $endDate ? " AND DATE(so4.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL3 = $startDate && $endDate ? " AND DATE(so5.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL4 = $startDate && $endDate ? " AND DATE(so6.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    
    $sql = "SELECT 
                c.ld_id as company_id,
                c.company as company_name,
                COUNT(DISTINCT so.id) as total_sale_orders,
                COUNT(DISTINCT q.id) as total_quotations,
                COALESCE((
                    SELECT SUM(so3.overall_total_amt)
                    FROM sale_orders so3
                    WHERE so3.contact_id = c.ld_id 
                    AND so3.is_deleted = 0
                    $dateFilterSQL1
                ), 0) as total_so_value,
                COALESCE((
                    SELECT SUM(pi2.tax_received_amt)
                    FROM proforma_invoices pi2
                    INNER JOIN sale_orders so4 ON pi2.sale_order_id = so4.id
                    WHERE so4.contact_id = c.ld_id
                    AND so4.is_deleted = 0
                    AND pi2.is_deleted = 0
                    $dateFilterSQL2
                ), 0) as total_pi_value,
                GREATEST(0, 
                    COALESCE((
                        SELECT SUM(so5.overall_total_amt)
                        FROM sale_orders so5
                        WHERE so5.contact_id = c.ld_id 
                        AND so5.is_deleted = 0
                        $dateFilterSQL3
                    ), 0) - 
                    COALESCE((
                        SELECT SUM(pi3.tax_received_amt)
                        FROM proforma_invoices pi3
                        INNER JOIN sale_orders so6 ON pi3.sale_order_id = so6.id
                        WHERE so6.contact_id = c.ld_id
                        AND so6.is_deleted = 0
                        AND pi3.is_deleted = 0
                        $dateFilterSQL4
                    ), 0)
                ) as total_outstanding
            FROM contacts c
            LEFT JOIN contact_persons cp ON c.ld_id = cp.contact_id
            LEFT JOIN quotations q ON cp.cp_id = q.cp_id AND q.is_deleted = FALSE AND q.status='accepted'
                " . ($startDate && $endDate ? " AND DATE(q.created_at) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "") . "
            LEFT JOIN sale_orders so ON c.ld_id = so.contact_id AND so.is_deleted = 0
                " . ($startDate && $endDate ? " AND DATE(so.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "") . "
            LEFT JOIN proforma_invoices pi ON so.id = pi.sale_order_id AND pi.is_deleted = 0
            $whereSQL
            GROUP BY c.ld_id, c.company
            ORDER BY 
                CASE 
                    WHEN MAX(COALESCE(so.date, q.created_at, pi.inv_date)) IS NULL THEN 1
                    ELSE 0
                END ASC,
                MAX(COALESCE(so.date, q.created_at, pi.inv_date)) DESC, 
                c.company
            LIMIT $limit OFFSET $offset";
     

    $stmt = $pdo->prepare($sql);
    $stmt->execute($allParams);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'data' => ['companies' => $results],
        'total_items' => intval($totalItems),
        'total_pages' => $totalPages
    ];
}

// Company + Contact Person Wise Report
function getCompanyContactWiseReport($pdo, $companyId, $contactPersonId, $startDate, $endDate, $page = 1, $limit = 10) {
    $whereClauses = [];
    $params = [];

    if ($companyId) {
        $whereClauses[] = "c.ld_id = ?";
        $params[] = $companyId;
    }

    if ($contactPersonId) {
        $whereClauses[] = "cp.cp_id = ?";
        $params[] = $contactPersonId;
    }

    $whereSQL = count($whereClauses) > 0 ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    // Count total records
    $countSql = "SELECT COUNT(DISTINCT CONCAT(c.ld_id, '-', cp.cp_id)) as total
            FROM contacts c
            LEFT JOIN contact_persons cp ON c.ld_id = cp.contact_id
            $whereSQL";
    $countParams = [];
    if ($companyId) {
        $countParams[] = $companyId;
    }
    if ($contactPersonId) {
        $countParams[] = $contactPersonId;
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalItems / $limit);
    $offset = ($page - 1) * $limit;

    // LIMIT and OFFSET must be integers, not parameters
    $limit = intval($limit);
    $offset = intval($offset);

    // Date filtering is handled in subqueries and inline in JOINs, not as parameters, to ensure companies/contact persons always appear
    $allParams = $params;

    // Use separate subqueries to avoid double counting issues (same logic as company_wise)
    $dateFilterSQL1 = $startDate && $endDate ? " AND DATE(so3.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL2 = $startDate && $endDate ? " AND DATE(so4.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL3 = $startDate && $endDate ? " AND DATE(so5.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";
    $dateFilterSQL4 = $startDate && $endDate ? " AND DATE(so6.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "";

    $sql = "SELECT 
                c.ld_id as company_id,
                c.company as company_name,
                cp.cp_id as contact_person_id,
                cp.contact_person,
                COUNT(DISTINCT so.id) as total_sale_orders,
                COUNT(DISTINCT q.id) as total_quotations,
                COALESCE((
                    SELECT SUM(so3.overall_total_amt)
                    FROM sale_orders so3
                    INNER JOIN quotations q3 ON so3.quotation_id = q3.id
                    WHERE q3.cp_id = cp.cp_id
                    AND so3.is_deleted = 0
                    AND q3.is_deleted = FALSE
                    AND q3.status = 'accepted'
                    $dateFilterSQL1
                ), 0) as total_so_value,
                COALESCE((
                    SELECT SUM(pi2.tax_received_amt)
                    FROM proforma_invoices pi2
                    INNER JOIN sale_orders so4 ON pi2.sale_order_id = so4.id
                    INNER JOIN quotations q4 ON so4.quotation_id = q4.id
                    WHERE q4.cp_id = cp.cp_id
                    AND so4.is_deleted = 0
                    AND pi2.is_deleted = 0
                    AND q4.is_deleted = FALSE
                    AND q4.status = 'accepted'
                    $dateFilterSQL2
                ), 0) as total_pi_value,
                GREATEST(0, 
                    COALESCE((
                        SELECT SUM(so5.overall_total_amt)
                        FROM sale_orders so5
                        INNER JOIN quotations q5 ON so5.quotation_id = q5.id
                        WHERE q5.cp_id = cp.cp_id
                        AND so5.is_deleted = 0
                        AND q5.is_deleted = FALSE
                        AND q5.status = 'accepted'
                        $dateFilterSQL3
                    ), 0) - 
                    COALESCE((
                        SELECT SUM(pi3.tax_received_amt)
                        FROM proforma_invoices pi3
                        INNER JOIN sale_orders so6 ON pi3.sale_order_id = so6.id
                        INNER JOIN quotations q6 ON so6.quotation_id = q6.id
                        WHERE q6.cp_id = cp.cp_id
                        AND so6.is_deleted = 0
                        AND pi3.is_deleted = 0
                        AND q6.is_deleted = FALSE
                        AND q6.status = 'accepted'
                        $dateFilterSQL4
                    ), 0)
                ) as total_outstanding
            FROM contacts c
            LEFT JOIN contact_persons cp ON c.ld_id = cp.contact_id
            LEFT JOIN quotations q ON cp.cp_id = q.cp_id AND q.is_deleted = FALSE AND q.status = 'accepted'
                " . ($startDate && $endDate ? " AND DATE(q.created_at) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "") . "
            LEFT JOIN sale_orders so ON q.id = so.quotation_id AND so.is_deleted = 0
                " . ($startDate && $endDate ? " AND DATE(so.date) BETWEEN '" . addslashes($startDate) . "' AND '" . addslashes($endDate) . "'" : "") . "
            LEFT JOIN proforma_invoices pi ON so.id = pi.sale_order_id AND pi.is_deleted = 0
            $whereSQL
            GROUP BY c.ld_id, c.company, cp.cp_id, cp.contact_person
            ORDER BY 
                CASE 
                    WHEN MAX(COALESCE(so.date, q.created_at, pi.inv_date)) IS NULL THEN 1
                    ELSE 0
                END ASC,
                MAX(COALESCE(so.date, q.created_at, pi.inv_date)) DESC, 
                c.company, cp.contact_person
            LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($allParams);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'data' => ['company_contacts' => $results],
        'total_items' => intval($totalItems),
        'total_pages' => $totalPages
    ];
}

// Quotation Wise Report
function getQuotationWiseReport($pdo, $companyId, $startDate, $endDate, $page = 1, $limit = 10) {
    $whereClauses = ["q.is_deleted = FALSE", "q.status = 'accepted'"];
    $params = [];

    if ($companyId) {
        $whereClauses[] = "c.ld_id = ?";
        $params[] = $companyId;
    }

    if ($startDate && $endDate) {
        $whereClauses[] = "DATE(q.created_at) BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    $whereSQL = implode(' AND ', $whereClauses);

    // Count total records
    $countSql = "SELECT COUNT(DISTINCT q.id) as total
            FROM quotations q
            LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
            LEFT JOIN contacts c ON cp.contact_id = c.ld_id
            WHERE $whereSQL";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalItems / $limit);
    $offset = ($page - 1) * $limit;

    // LIMIT and OFFSET must be integers, not parameters
    $limit = intval($limit);
    $offset = intval($offset);

    $sql = "SELECT 
                q.id,
                q.quotation_no,
                c.company as company_name,
                cp.contact_person,
                q.grand_total,
                COALESCE((
                    SELECT COUNT(DISTINCT so2.id)
                    FROM sale_orders so2
                    WHERE so2.quotation_id = q.id
                    AND so2.is_deleted = 0
                ), 0) as total_sale_orders,
                COALESCE((
                    SELECT COUNT(DISTINCT pi2.id)
                    FROM proforma_invoices pi2
                    INNER JOIN sale_orders so3 ON pi2.sale_order_id = so3.id
                    WHERE so3.quotation_id = q.id
                    AND so3.is_deleted = 0
                    AND pi2.is_deleted = 0
                ), 0) as total_proforma_invoices,
                COALESCE((
                    SELECT SUM(so6.overall_total_amt)
                    FROM sale_orders so6
                    WHERE so6.quotation_id = q.id
                    AND so6.is_deleted = 0
                ), 0) as total_so_value,
                COALESCE((
                    SELECT SUM(pi4.tax_received_amt)
                    FROM proforma_invoices pi4
                    INNER JOIN sale_orders so4 ON pi4.sale_order_id = so4.id
                    WHERE so4.quotation_id = q.id
                    AND so4.is_deleted = 0
                    AND pi4.is_deleted = 0
                ), 0) as total_pi_value,
                GREATEST(0, 
                    COALESCE((
                        SELECT SUM(so7.overall_total_amt)
                        FROM sale_orders so7
                        WHERE so7.quotation_id = q.id
                        AND so7.is_deleted = 0
                    ), 0) - 
                    COALESCE((
                        SELECT SUM(pi5.tax_received_amt)
                        FROM proforma_invoices pi5
                        INNER JOIN sale_orders so5 ON pi5.sale_order_id = so5.id
                        WHERE so5.quotation_id = q.id
                        AND so5.is_deleted = 0
                        AND pi5.is_deleted = 0
                    ), 0)
                ) as total_outstanding
            FROM quotations q
            LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
            LEFT JOIN contacts c ON cp.contact_id = c.ld_id
            WHERE $whereSQL
            GROUP BY q.id, q.quotation_no, c.company, cp.contact_person, q.grand_total, q.created_at
            ORDER BY q.created_at DESC, q.id DESC
            LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'data' => ['quotations' => $results],
        'total_items' => intval($totalItems),
        'total_pages' => $totalPages
    ];
}

// Accounts Receivable Summary Report
function getAccountsReceivableReport($pdo, $companyId, $startDate, $endDate, $page = 1, $limit = 10) {
    $whereClauses = ["pi.is_deleted = 0"];
    $params = [];

    if ($companyId) {
        $whereClauses[] = "so.contact_id = ?";
        $params[] = $companyId;
    }

    if ($startDate && $endDate) {
        $whereClauses[] = "DATE(pi.inv_date) BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    $whereSQL = implode(' AND ', $whereClauses);

    // Calculate outstanding: inv_grand_total - tax_received_amt (if tax_invoice_no exists, else use inv_grand_total)
    // Get invoice details - only show invoices with outstanding > 0
    $sql = "SELECT 
                c.company as customer_name,
                so.saleorder_no as sales_order_no,
                pi.invoice_no as proforma_invoice_no,
                DATE_FORMAT(pi.inv_date, '%d-%b-%Y') as invoice_date,
                pi.inv_grand_total as total_amount,
                GREATEST(0, pi.inv_grand_total - COALESCE(pi.tax_received_amt, 0)) as outstanding,
                COALESCE(pi.tax_received_amt, 0) as collected
            FROM proforma_invoices pi
            LEFT JOIN sale_orders so ON pi.sale_order_id = so.id AND so.is_deleted = 0
            LEFT JOIN contacts c ON so.contact_id = c.ld_id
            WHERE $whereSQL 
                AND (
                    GREATEST(0, pi.inv_grand_total - COALESCE(pi.tax_received_amt, 0)) > 0
                    OR pi.status = 'completed'
                )
            ORDER BY pi.inv_date DESC";

    // Count total invoices with outstanding > 0
    $countSql = "SELECT COUNT(*) as total
            FROM proforma_invoices pi
            LEFT JOIN sale_orders so ON pi.sale_order_id = so.id AND so.is_deleted = 0
            LEFT JOIN contacts c ON so.contact_id = c.ld_id
            WHERE $whereSQL 
                AND (
                    GREATEST(0, pi.inv_grand_total - COALESCE(pi.tax_received_amt, 0)) > 0
                    OR pi.status = 'completed'
                )";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalItems / $limit);
    $offset = ($page - 1) * $limit;

    // LIMIT and OFFSET must be integers, not parameters
    $limit = intval($limit);
    $offset = intval($offset);
    $sql .= " LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get summary by sales order
    $summaryWhereClauses = ["so.is_deleted = 0", "pi.is_deleted = 0"];
    $summaryParams = [];

    if ($companyId) {
        $summaryWhereClauses[] = "so.contact_id = ?";
        $summaryParams[] = $companyId;
    }

    if ($startDate && $endDate) {
        $summaryWhereClauses[] = "DATE(pi.inv_date) BETWEEN ? AND ?";
        $summaryParams[] = $startDate;
        $summaryParams[] = $endDate;
    }

    $summaryWhereSQL = implode(' AND ', $summaryWhereClauses);

    $summarySql = "SELECT 
                    so.saleorder_no as sales_order_no,
                    c.company as customer,
                    COALESCE(SUM(pi.inv_grand_total), 0) as total_invoice_value,
                    COALESCE(SUM(pi.tax_received_amt), 0) as total_received,
                    COALESCE(SUM(pi.inv_grand_total), 0) - COALESCE(SUM(pi.tax_received_amt), 0) as outstanding,
                    CASE 
                        WHEN SUM(pi.inv_grand_total) > 0 
                        THEN ROUND((SUM(pi.tax_received_amt) / SUM(pi.inv_grand_total)) * 100, 2)
                        ELSE 0 
                    END as collection_percentage,
                    MAX(DATE_FORMAT(pi.inv_date, '%d-%b-%Y')) as last_payment_date,
                    MAX(pi.inv_date) as max_inv_date
                FROM sale_orders so
                LEFT JOIN contacts c ON so.contact_id = c.ld_id
                LEFT JOIN proforma_invoices pi ON so.id = pi.sale_order_id AND pi.is_deleted = 0
                WHERE $summaryWhereSQL
                GROUP BY so.saleorder_no, c.company, so.id
                HAVING (
                    outstanding > 0 
                    OR SUM(CASE WHEN pi.status = 'completed' THEN 1 ELSE 0 END) > 0
                )
                ORDER BY max_inv_date DESC, so.saleorder_no";

    $summaryStmt = $pdo->prepare($summarySql);
    $summaryStmt->execute($summaryParams);
    $summaryBySO = $summaryStmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate totals for ALL invoices (not just those with outstanding > 0)
    $totalsSql = "SELECT 
                    COALESCE(SUM(pi.inv_grand_total), 0) as total_amount,
                    COALESCE(SUM(pi.tax_received_amt), 0) as total_collected,
                    COALESCE(SUM(pi.inv_grand_total), 0) - COALESCE(SUM(pi.tax_received_amt), 0) as total_outstanding
                FROM proforma_invoices pi
                LEFT JOIN sale_orders so ON pi.sale_order_id = so.id AND so.is_deleted = 0
                LEFT JOIN contacts c ON so.contact_id = c.ld_id
                WHERE $summaryWhereSQL";
    
    $totalsStmt = $pdo->prepare($totalsSql);
    $totalsStmt->execute($summaryParams);
    $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC);
    
    $totalAmount = floatval($totals['total_amount']);
    $totalCollected = floatval($totals['total_collected']);
    $totalOutstanding = floatval($totals['total_outstanding']);
    $collectionPercentage = $totalAmount > 0 ? round(($totalCollected / $totalAmount) * 100, 2) : 0;

    return [
        'data' => [
            'invoices' => $invoices,
            'summary_by_so' => $summaryBySO,
            'summary' => [
                'total_amount' => $totalAmount,
                'total_outstanding' => $totalOutstanding,
                'total_collected' => $totalCollected,
                'collection_percentage' => $collectionPercentage
            ]
        ],
        'total_items' => intval($totalItems),
        'total_pages' => $totalPages
    ];
}

?>

