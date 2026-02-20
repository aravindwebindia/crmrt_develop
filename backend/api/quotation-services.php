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
            // Get services for a specific quotation
            $quotation_id = $_GET['quotation_id'] ?? null;
            $edit = $_GET['edit'] ?? null;
            
            if (!$quotation_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation ID is required'
                ]);
                break;
            }
            
            // If edit parameter is provided, use getByQuotationIdEdit
            if ($edit === 'true' || $edit === '1') {
                $services = $quotationService->getByQuotationIdEdit($quotation_id);
            } else {
                $services = $quotationService->getByQuotationId($quotation_id);
            }
            
            echo json_encode([
                'success' => true,
                'data' => $services
            ]);
            break;

        case 'PUT':
            // Update service descriptions only
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || !isset($input['quotation_id']) || !isset($input['services'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation ID and services data are required'
                ]);
                break;
            }
            
            $quotation_id = $input['quotation_id'];
            $services = $input['services'];
            
            // Update each service description
            $success = true;
            $errors = [];
            
            foreach ($services as $service) {
                if (!isset($service['id']) || !isset($service['description'])) {
                    $errors[] = 'Service ID and description are required for each service';
                    $success = false;
                    continue;
                }
                
                $updateResult = $quotationService->updateDescription($service['id'], $service['description']);
                if (!$updateResult) {
                    $errors[] = "Failed to update service ID: {$service['id']}";
                    $success = false;
                }
            }
            
            if ($success) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Service descriptions updated successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Some updates failed',
                    'errors' => $errors
                ]);
            }
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
