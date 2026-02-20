<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../jwt/JWT.php';
require_once '../config/database.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get authorization header
    $auth_header = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if (empty($auth_header)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Access token required']);
        exit;
    }

    // Extract token
    if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
        $token = $matches[1];
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token format']);
        exit;
    }

    // Verify token
    $decoded = $jwt->decode($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get sale orders ready for proforma invoice generation
        $query = "SELECT 
                    so.id,
                    so.saleorder_no as so_number,
                    q.quotation_no,
                    c.company as company_name,
                    so.date as so_date,
                    so.grand_total as total_amount,
                    so.status,
                    bc.bc_name as billing_company,
                    so.is_invoiced,
                    so.is_proforma_generated
                  FROM sale_orders so
                  LEFT JOIN quotations q ON so.quotation_id = q.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                  WHERE so.is_invoiced = 1 
                  AND (so.is_proforma_generated = 0 OR so.is_proforma_generated IS NULL)
                  ORDER BY so.date DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $sale_orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $sale_orders
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
