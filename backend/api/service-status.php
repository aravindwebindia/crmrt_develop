<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/Service.php';

// Get Authorization header - check multiple cases
$auth_header = '';
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    // Check both cases
    $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : 
                   (isset($headers['authorization']) ? $headers['authorization'] : '');
} elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

if (!$auth_header || !preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Access denied. No token provided.']);
    exit();
}

$token = $matches[1];
$jwt = new JWT();
$decoded = $jwt->validate($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
    exit();
}

// Handle both array and object responses from JWT validation
if (is_array($decoded)) {
    $user_id = $decoded['user_id'] ?? null;
} else {
    $user_id = $decoded->user_id ?? null;
}

if (!$user_id) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token data.']);
    exit();
}
$service = new Service();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Service ID is required'
        ]);
        exit();
    }
    
    // Check if service exists
    $existingService = $service->getById($id);
    if (!$existingService) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Service not found'
        ]);
        exit();
    }
    
    if ($service->toggleStatus($id, $user_id)) {
        echo json_encode([
            'success' => true,
            'message' => 'Service status updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update service status'
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
