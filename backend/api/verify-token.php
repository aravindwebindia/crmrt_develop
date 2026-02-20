<?php
header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/User.php';

$database = new Database();
$db = $database->getConnection();
$jwt = new JWT();

// Get Authorization header with robust fallbacks across Apache/FastCGI setups
$auth_header = '';

if (function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $auth_header = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $auth_header = $headers['authorization'];
    }
}

if (!$auth_header && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    if (isset($headers['Authorization'])) {
        $auth_header = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $auth_header = $headers['authorization'];
    }
}

if (!$auth_header && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
}
if (!$auth_header && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}
if (!$auth_header && isset($_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'];
}
if (!$auth_header && isset($_SERVER['Authorization'])) {
    $auth_header = $_SERVER['Authorization'];
}

// DEBUG: Log the authorization header
if (!$auth_header || !preg_match('/Bearer\s+(\S+)/i', $auth_header, $matches)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Access denied. No token provided.']);
    exit();
}

$token = $matches[1];
$decoded = $jwt->validate($token);
if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
    exit();
}

// Get user data
$user = new User($db);
if ($user->getById($decoded['user_id'])) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'profile_image' => $user->profile_image,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'phone' => $user->phone
        ]
    ]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not found.']);
}
?>
