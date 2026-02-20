<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';

try {
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Test data
        $test_data = [
            'is_invoiced' => $input['is_invoiced'] ?? 1,
            'sale_order_id' => $input['sale_order_id'] ?? 1,
            'bc_id' => $input['bc_id'] ?? 1,
            'sub_total' => $input['sub_total'] ?? 1000,
            'grand_total' => $input['grand_total'] ?? 1180,
            'user_id' => $input['user_id'] ?? 1
        ];
        
        echo json_encode([
            'success' => true,
            'message' => 'Test data received',
            'test_data' => $test_data,
            'is_invoiced_type' => gettype($test_data['is_invoiced']),
            'is_invoiced_value' => $test_data['is_invoiced'],
            'is_invoiced_equals_1' => ($test_data['is_invoiced'] === 1),
            'is_invoiced_equals_1_loose' => ($test_data['is_invoiced'] == 1)
        ]);
        
    } else {
        // Check if tables exist
        $tables_query = "SHOW TABLES LIKE 'proforma_invoices'";
        $tables_stmt = $pdo->prepare($tables_query);
        $tables_stmt->execute();
        $proforma_invoices_exists = $tables_stmt->fetch() !== false;
        
        $tables_query2 = "SHOW TABLES LIKE 'proforma_invoice_details'";
        $tables_stmt2 = $pdo->prepare($tables_query2);
        $tables_stmt2->execute();
        $proforma_invoice_details_exists = $tables_stmt2->fetch() !== false;
        
        // Check sale_orders table structure
        $structure_query = "DESCRIBE sale_orders";
        $structure_stmt = $pdo->prepare($structure_query);
        $structure_stmt->execute();
        $sale_orders_structure = $structure_stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'message' => 'Database check completed',
            'proforma_invoices_table_exists' => $proforma_invoices_exists,
            'proforma_invoice_details_table_exists' => $proforma_invoice_details_exists,
            'sale_orders_structure' => $sale_orders_structure
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
