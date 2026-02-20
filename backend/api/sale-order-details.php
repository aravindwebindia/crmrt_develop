<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

$database = new Database();
$pdo = $database->getConnection();

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Get JWT token from header
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No token provided']);
        exit;
    }

    // Verify JWT token
    $jwt = new JWT();
    $decoded = $jwt->validate($token);

    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token']);
        exit;
    }

    $sale_order_id = $_GET['id'] ?? null;
    if (!$sale_order_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Sale order ID is required']);
        exit;
    }

    // Get sale order basic information
    $saleOrderQuery = "SELECT 
                        so.id,
                        so.saleorder_no,
                        so.date as so_date,
                        so.status,
                        so.overall_amt,
                        so.overall_gst,
                        so.overall_total_amt,
                        so.is_invoiced,
                        so.created_at,
                        so.bc_id,
                        q.quotation_no,
                        c.company as company_name,
                        c.email as company_email,
                        c.mobile as company_mobile,
                        c.c_address as company_address,
                        bc.bc_name as billing_company
                      FROM sale_orders so
                      LEFT JOIN quotations q ON so.quotation_id = q.id
                      LEFT JOIN contacts c ON so.contact_id = c.ld_id
                      LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                      WHERE so.id = :sale_order_id AND so.is_deleted = 0";

    $saleOrderStmt = $pdo->prepare($saleOrderQuery);
    $saleOrderStmt->execute(['sale_order_id' => $sale_order_id]);
    $saleOrder = $saleOrderStmt->fetch(PDO::FETCH_ASSOC);

    if (!$saleOrder) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Sale order not found']);
        exit;
    }

    // Get sale order details (services)
    $detailsQuery = "SELECT 
                      sod.id,
                      sod.service_id,
                      sod.service_name,
                      sod.qty,
                      sod.rate,
                      sod.amount,
                      sod.igst,
                      sod.cgst,
                      sod.sgst,
                      sod.igst_amount,
                      sod.cgst_amount,
                      sod.sgst_amount,
                      sod.bill_amount,
                      sod.total_amount,
                      sod.bill_cycle_id,
                      sod.duration,
                      sod.tax_id,
                      sod.from_date,
                      sod.to_date,
                      sod.bo_gst_amt,
                      sod.quotation_service_id,
                      bcy.cycle_name as bill_cycle_name
                    FROM sale_order_details sod
                    LEFT JOIN bill_cycles bcy ON sod.bill_cycle_id = bcy.id
                    WHERE sod.sale_order_id = :sale_order_id AND sod.is_deleted = 0
                    ORDER BY sod.id";

    $detailsStmt = $pdo->prepare($detailsQuery);
    $detailsStmt->execute(['sale_order_id' => $sale_order_id]);
    $details = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate totals from service details
    $total_amount = 0;
    $total_igst = 0;
    $total_cgst = 0;
    $total_sgst = 0;
    $total_bill_amount = 0;
    $total_bo_gst_amt = 0;

    foreach ($details as $detail) {
        $total_amount += floatval($detail['amount'] ?? 0);
        $total_igst += floatval($detail['igst_amount'] ?? 0);
        $total_cgst += floatval($detail['cgst_amount'] ?? 0);
        $total_sgst += floatval($detail['sgst_amount'] ?? 0);
        $total_bill_amount += floatval($detail['bill_amount'] ?? 0);
        $total_bo_gst_amt += floatval($detail['bo_gst_amt'] ?? 0);
    }

    // Use overall_total_amt from sale_orders table as the total final amount
    $total_final_amount = floatval($saleOrder['overall_total_amt'] ?? 0);

    // Calculate outstanding amount
    $total_invoiced_amount = 0;
    $outstanding_amount = 0;
    
    // Get total invoiced amount from proforma invoices
    $invoicedQuery = "SELECT SUM(tax_received_amt) as total_invoiced 
                      FROM proforma_invoices 
                      WHERE sale_order_id = :sale_order_id 
                      AND tax_invoice_no IS NOT NULL";
    $invoicedStmt = $pdo->prepare($invoicedQuery);
    $invoicedStmt->execute(['sale_order_id' => $sale_order_id]);
    $invoicedResult = $invoicedStmt->fetch(PDO::FETCH_ASSOC);
    
    $total_invoiced_amount = floatval($invoicedResult['total_invoiced'] ?? 0);
    $outstanding_amount = $total_final_amount - $total_invoiced_amount;

    $response = [
        'success' => true,
        'data' => [
            'sale_order' => $saleOrder,
            'details' => $details,
            'totals' => [
                'total_amount' => $total_amount,
                'total_igst' => $total_igst,
                'total_cgst' => $total_cgst,
                'total_sgst' => $total_sgst,
                'total_bill_amount' => $total_bill_amount,
                'total_bo_gst_amt' => $total_bo_gst_amt,
                'total_final_amount' => $total_final_amount,
                'total_invoiced_amount' => $total_invoiced_amount,
                'outstanding_amount' => $outstanding_amount
            ]
        ]
    ];

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
