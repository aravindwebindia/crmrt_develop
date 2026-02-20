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
        $invoice_id = isset($_GET['invoice_id']) ? intval($_GET['invoice_id']) : null;
        $sale_order_id = isset($_GET['sale_order_id']) ? intval($_GET['sale_order_id']) : null;
        $bill_to_date = isset($_GET['bill_to_date']) ? $_GET['bill_to_date'] : null;

        if ((!$invoice_id && !$sale_order_id) || !$bill_to_date) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invoice ID or Sale Order ID, and bill_to_date are required']);
            exit;
        }

        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $bill_to_date)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid date format. Please use YYYY-MM-DD format']);
            exit;
        }

        // Get service details for this recurring invoice (same sale_order_id and bill_to_date)
        // This handles services from multiple invoices linked to the same sale order
        $query = "SELECT 
                    pid.id,
                    pid.service_name,
                    pid.qty,
                    pid.inv_rate,
                    pid.inv_amount,
                    pid.igst,
                    pid.cgst,
                    pid.sgst,
                    pid.igst_amount,
                    pid.cgst_amount,
                    pid.sgst_amount,
                    pid.inv_bill_amount,
                    pid.inv_total_amount,
                    pid.bill_from_date,
                    pid.bill_to_date,
                    pid.bill_followup,
                    bc.cycle_name,
                    bc.cycle_terms,
                    s.hsn_sac,
                    t.tax_name,
                    pi.invoice_no
                  FROM proforma_invoice_details pid
                  LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                  LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                  LEFT JOIN services s ON pid.service_id = s.id
                  LEFT JOIN tax t ON pid.tax_id = t.tax_id
                  WHERE pid.bill_to_date = ?
                    AND pid.status = 'invoiced' 
                    AND pid.bill_cycle_id IN (2, 3, 4)";
        
        $queryParams = [$bill_to_date];
        
        if ($sale_order_id) {
            $query .= " AND pi.sale_order_id = ?";
            $queryParams[] = $sale_order_id;
        } else {
            $query .= " AND pid.p_inv_id = ?";
            $queryParams[] = $invoice_id;
        }
        
        $query .= " ORDER BY pid.id ASC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($queryParams);
        $serviceDetails = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $serviceDetails
        ]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>

