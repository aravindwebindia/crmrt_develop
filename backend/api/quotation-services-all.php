<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/QuotationService.php';

// Initialize JWT
$jwt = new JWT();

// Get token from Authorization header
$auth_header = '';
$token = null;

// Try multiple methods to get the Authorization header
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['HTTP_authorization'])) {
    $auth_header = $_SERVER['HTTP_authorization'];
} elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $auth_header = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $auth_header = $headers['authorization'];
    }
}

if (!empty($auth_header)) {
    if (preg_match('/Bearer\s(\S+)/i', $auth_header, $matches)) {
        $token = $matches[1];
    }
}

// Validate token for all methods except OPTIONS
if ($_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Access token required'
        ]);
        exit();
    }

    try {
        $decoded = $jwt->validate($token);
        if (!$decoded) {
            throw new Exception('Invalid token');
        }
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired token'
        ]);
        exit();
    }
}

// Initialize model
$quotationService = new QuotationService();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get all services for a specific quotation (including soft-deleted)
            $quotation_id = $_GET['quotation_id'] ?? null;
            
            if (!$quotation_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation ID is required'
                ]);
                break;
            }
            
            $services = $quotationService->getAllByQuotationId($quotation_id);
            
            echo json_encode([
                'success' => true,
                'data' => $services
            ]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>

