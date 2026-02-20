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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

    $sale_order_id = $_GET['sale_order_id'] ?? null;

    if (!$sale_order_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Sale order ID is required']);
        exit;
    }

    // Get sale order details
    $saleOrderQuery = "SELECT 
                        so.id,
                        so.saleorder_no as so_number,
                        q.quotation_no,
                        c.company as company_name,
                        so.date as so_date,
                        so.overall_total_amt as total_amount,
                        so.status,
                        bc.bc_name as billing_company
                      FROM sale_orders so
                      LEFT JOIN quotations q ON so.quotation_id = q.id
                      LEFT JOIN contacts c ON so.contact_id = c.ld_id
                      LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                      WHERE so.id = ?";

    $stmt = $pdo->prepare($saleOrderQuery);
    $stmt->execute([$sale_order_id]);
    $saleOrder = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$saleOrder) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Sale order not found']);
        exit;
    }

    // Get total invoiced amount from proforma invoices
    $invoicedQuery = "SELECT 
                        COALESCE(SUM(tax_received_amt), 0) as total_invoiced_amount,
                        COUNT(*) as invoice_count
                      FROM proforma_invoices 
                      WHERE sale_order_id = ? AND tax_invoice_no IS NOT NULL";

    $stmt = $pdo->prepare($invoicedQuery);
    $stmt->execute([$sale_order_id]);
    $invoiceData = $stmt->fetch(PDO::FETCH_ASSOC);

    $total_invoiced_amount = (float)$invoiceData['total_invoiced_amount'];
    $invoice_count = (int)$invoiceData['invoice_count'];
    $outstanding_amount = $saleOrder['total_amount'] - $total_invoiced_amount;

    // Get individual invoices for details
    $invoicesQuery = "SELECT 
                        id,
                        invoice_no as pi_number,
                        tax_invoice_no,
                        tax_received_amt,
                        inv_grand_total,
                        status,
                        inv_date
                      FROM proforma_invoices 
                      WHERE sale_order_id = ? AND tax_invoice_no IS NOT NULL
                      ORDER BY inv_date ASC";

    $stmt = $pdo->prepare($invoicesQuery);
    $stmt->execute([$sale_order_id]);
    $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'sale_order' => $saleOrder,
            'outstanding_summary' => [
                'total_amount' => $saleOrder['total_amount'],
                'invoiced_amount' => $total_invoiced_amount,
                'outstanding_amount' => $outstanding_amount,
                'invoice_count' => $invoice_count
            ],
            'invoices' => $invoices
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
