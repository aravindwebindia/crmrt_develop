<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';
require_once '../models/Quotation.php';
require_once '../models/QuotationService.php';

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
        $quotation_id = $_GET['id'] ?? null;

        if (!$quotation_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Quotation ID is required']);
            exit;
        }

        // Get quotation details
        $quotationModel = new Quotation($pdo);
        $quotation = $quotationModel->getById($quotation_id);

        if (!$quotation) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quotation not found']);
            exit;
        }

        // Get quotation services
        $quotationServiceModel = new QuotationService();
        $services = $quotationServiceModel->getAllByQuotationId($quotation_id);

        // Calculate totals
        $sub_total = 0;
        $total_tax = 0;
        $grand_total = 0;

        foreach ($services as $service) {
            $sub_total += $service['amount'];
            $total_tax += ($service['igst_amount'] ?? 0);
            $grand_total += $service['total_amount'];
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'quotation' => $quotation,
                'services' => $services,
                'totals' => [
                    'sub_total' => $sub_total,
                    'total_tax' => $total_tax,
                    'grand_total' => $grand_total
                ]
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
