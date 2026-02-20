<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/Contact.php';

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

// Validate token
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
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or expired token'
    ]);
    exit();
}

// Initialize Contact model
$contact = new Contact();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $action = $_GET['action'] ?? '';
        
        switch ($action) {
            case 'salutations':
                $data = $contact->getSalutations();
                echo json_encode([
                    'success' => true,
                    'data' => $data
                ]);
                break;
                
            case 'countries':
                $data = $contact->getCountries();
                echo json_encode([
                    'success' => true,
                    'data' => $data
                ]);
                break;
                
            case 'states':
                $countryId = $_GET['country_id'] ?? null;
                if (!$countryId) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Country ID is required'
                    ]);
                    break;
                }
                $data = $contact->getStatesByCountry($countryId);
                echo json_encode([
                    'success' => true,
                    'data' => $data
                ]);
                break;
                
            default:
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid action'
                ]);
                break;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Internal server error'
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
}
?>
