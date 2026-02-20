<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

$jwt = new JWT();
$database = new Database();
$pdo = $database->getConnection();

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Get JWT token from header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authorization header missing or invalid']);
        exit;
    }

    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    $user_id = $decoded['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['sale_order_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Sale order ID is required']);
        exit;
    }

    if (!isset($input['inv_date']) || empty($input['inv_date'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Proforma invoice date is required']);
        exit;
    }

    $sale_order_id = (int)$input['sale_order_id'];
    $inv_date = $input['inv_date'];

    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $inv_date)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid date format. Please use YYYY-MM-DD format']);
        exit;
    }

    $pdo->beginTransaction();

    try {
        // Get sale order details
        $saleOrderQuery = "SELECT so.*, c.company, bc.bc_id, bc.bc_name, bc.bc_prefix 
                          FROM sale_orders so
                          LEFT JOIN contacts c ON so.contact_id = c.ld_id
                          LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                          WHERE so.id = :sale_order_id AND so.is_invoiced = 0";
        
        $saleOrderStmt = $pdo->prepare($saleOrderQuery);
        $saleOrderStmt->execute(['sale_order_id' => $sale_order_id]);
        $saleOrder = $saleOrderStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$saleOrder) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Sale order not found or already invoiced']);
            exit;
        }

        // Generate proforma invoice number (format: PI-{BC_PREFIX}-YYYY-XXX)
        $current_year = date('Y');
        $bc_prefix = $saleOrder['bc_prefix'] ?? 'XX'; // Default to 'XX' if no prefix
        
        // Get the highest number for the current year and billing company prefix
        $invoice_no_query = "SELECT MAX(CAST(SUBSTRING(invoice_no, LENGTH('PI-{$bc_prefix}-{$current_year}-') + 1) AS UNSIGNED)) as max_num 
                            FROM proforma_invoices 
                            WHERE invoice_no LIKE 'PI-{$bc_prefix}-{$current_year}-%'";
        $invoice_no_stmt = $pdo->prepare($invoice_no_query);
        $invoice_no_stmt->execute();
        $result = $invoice_no_stmt->fetch(PDO::FETCH_ASSOC);
        
        $next_num = ($result['max_num'] ?? 0) + 1;
        $proforma_invoice_no = 'PI-' . $bc_prefix . '-' . $current_year . '-' . str_pad($next_num, 3, '0', STR_PAD_LEFT);
        
        // Debug logging

        // Create proforma invoice
        $proformaInvoiceQuery = "INSERT INTO proforma_invoices 
                                (sale_order_id, contact_id, bc_id, inv_sub_total, inv_grand_total, 
                                 invoice_no, inv_date, created_by, status, created_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())";
        
        $proformaInvoiceStmt = $pdo->prepare($proformaInvoiceQuery);
        $proformaInvoiceStmt->execute([
            $sale_order_id,
            $saleOrder['contact_id'],
            $saleOrder['bc_id'],
            $saleOrder['sub_total'],
            $saleOrder['grand_total'],
            $proforma_invoice_no,
            $inv_date,
            $user_id
        ]);
        
        $proforma_invoice_id = $pdo->lastInsertId();

        // Get sale order details for proforma invoice details
        $saleOrderDetailsQuery = "SELECT sod.*, s.service_name, s.hsn_sac, t.igst, t.cgst, t.sgst
                                 FROM sale_order_details sod
                                 LEFT JOIN services s ON sod.service_id = s.id
                                 LEFT JOIN tax t ON sod.tax_id = t.tax_id
                                 WHERE sod.sale_order_id = :sale_order_id AND sod.is_deleted = 0 AND sod.is_invoiced = 0";
        
        $saleOrderDetailsStmt = $pdo->prepare($saleOrderDetailsQuery);
        $saleOrderDetailsStmt->execute(['sale_order_id' => $sale_order_id]);
        $saleOrderDetails = $saleOrderDetailsStmt->fetchAll(PDO::FETCH_ASSOC);

        // Create proforma invoice details for each sale order detail
        $proformaInvoiceDetailsQuery = "INSERT INTO proforma_invoice_details 
                                       (p_inv_id, sale_order_detail_id, service_id, service_name, qty, 
                                        inv_rate, inv_amount, tax_id, igst, cgst, sgst, 
                                        igst_amount, cgst_amount, sgst_amount, 
                                        inv_bill_amount, inv_total_amount, 
                                        bill_cycle_id, bill_from_date, bill_to_date, 
                                        bill_followup, status, created_at) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $proformaInvoiceDetailsStmt = $pdo->prepare($proformaInvoiceDetailsQuery);
        
        foreach ($saleOrderDetails as $detail) {
            $proformaInvoiceDetailsStmt->execute([
                $proforma_invoice_id,
                $detail['id'],
                $detail['service_id'],
                $detail['service_name'],
                $detail['qty'],
                $detail['rate'],
                $detail['amount'],
                $detail['tax_id'],
                $detail['igst'],
                $detail['cgst'],
                $detail['sgst'],
                $detail['igst_amount'],
                $detail['cgst_amount'],
                $detail['sgst_amount'],
                $detail['bill_amount'],
                $detail['total_amount'],
                $detail['bill_cycle_id'],
                $detail['from_date'],
                $detail['to_date'],
                1, // bill_followup starts at 1
                'invoiced' // status
            ]);
        }

        // Update sale order is_invoiced to 1
        $updateSaleOrderQuery = "UPDATE sale_orders SET is_invoiced = 1, updated_at = NOW() WHERE id = :sale_order_id";
        $updateSaleOrderStmt = $pdo->prepare($updateSaleOrderQuery);
        $updateSaleOrderStmt->execute(['sale_order_id' => $sale_order_id]);

        // Update sale_order_details is_invoiced to 1 for all services of this sale order
        $updateSaleOrderDetailsQuery = "UPDATE sale_order_details SET is_invoiced = 1, updated_at = NOW() WHERE sale_order_id = :sale_order_id";
        $updateSaleOrderDetailsStmt = $pdo->prepare($updateSaleOrderDetailsQuery);
        $updateSaleOrderDetailsStmt->execute(['sale_order_id' => $sale_order_id]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Proforma invoice created successfully',
            'data' => [
                'proforma_invoice_id' => $proforma_invoice_id,
                'proforma_invoice_no' => $proforma_invoice_no,
                'sale_order_id' => $sale_order_id,
                'company' => $saleOrder['company'],
                'total_amount' => $saleOrder['overall_total_amt'],
                'details_count' => count($saleOrderDetails)
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
