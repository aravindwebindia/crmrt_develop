<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';

// Get JWT token from header
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No token provided']);
    exit();
}

// Verify JWT token
$jwt = new JWT();
$decoded = $jwt->validate($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$sale_order_detail_id = $_GET['sale_order_detail_id'] ?? null;

if (!$sale_order_detail_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Sale order detail ID is required']);
    exit();
}

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }

    // Query to get invoice history for the specific sale order detail
    $query = "SELECT 
                pid.id as invoice_id,
                pi.invoice_no,
                pi.invoice_no as proforma_invoice_no,
                pi.tax_invoice_no,
                pid.inv_total_amount as amount,
                pi.status,
                pi.inv_date,
                pid.service_name,
                sod.duration,
                sod.bill_cycle_id,
                so.saleorder_no,
                bc.cycle_name as bill_cycle_name
              FROM proforma_invoice_details pid
              INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
              INNER JOIN sale_order_details sod ON pid.sale_order_detail_id = sod.id
              INNER JOIN sale_orders so ON  sod.sale_order_id = so.id
              LEFT JOIN bill_cycles bc ON sod.bill_cycle_id = bc.id
              WHERE pid.sale_order_detail_id = :sale_order_detail_id AND pi.is_deleted = 0
              ORDER BY pid.created_at DESC";

    $stmt = $pdo->prepare($query);
    $stmt->execute(['sale_order_detail_id' => $sale_order_detail_id]);
    $invoiceHistory = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $invoiceHistory
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}
?>
