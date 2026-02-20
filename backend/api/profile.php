<?php
header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/cors.php';

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/User.php';

$database = new Database();
$db = $database->getConnection();
$user = new User($db);
$jwt = new JWT();

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

// DEBUG: Log the authorization header
// Fallback: check for token in request body or query parameters
$token = null;
if ($auth_header && preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    $token = $matches[1];
} elseif (isset($_POST['token'])) {
    $token = $_POST['token'];
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Access denied. No token provided.']);
    exit();
}

$decoded = $jwt->validate($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        // Get user profile
        $user->id = $decoded['user_id'];
        if ($user->getProfile()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'role' => $user->role,
                    'profile_image' => $user->profile_image,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'phone' => $user->phone,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at
                ]
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Profile not found.']);
        }
        break;
        
    case 'PUT':
        // Update user profile
        $data = json_decode(file_get_contents("php://input"));
        
        $user->id = $decoded['user_id'];
        $user->first_name = $data->first_name ?? '';
        $user->last_name = $data->last_name ?? '';
        $user->phone = $data->phone ?? '';
        $user->profile_image = $data->profile_image ?? '';
        
        if ($user->updateProfile()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Profile updated successfully.'
            ]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Unable to update profile.']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
        break;
}
?>
