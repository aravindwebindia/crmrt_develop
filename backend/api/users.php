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
$request_uri = $_SERVER['REQUEST_URI'];

// Parse URL to get user ID - handle different URL structures
$path_parts = explode('/', trim($request_uri, '/'));
$user_id = null;

// Look for user ID in the URL path
foreach ($path_parts as $part) {
    if (is_numeric($part)) {
        $user_id = $part;
        break;
    }
}

switch($method) {
    case 'GET':
        if ($user_id) {
            // Get single user
            if ($user->getById($user_id)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'id' => $user->id,
                        'username' => $user->username,
                        'email' => $user->email,
                        'role' => $user->role,
                        'created_at' => $user->created_at
                    ]
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
            }
        } else {
            // Get all users (admin only)
            if ($decoded['role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Access denied. Admin role required.']);
                exit();
            }
            
            $stmt = $user->getAll();
            $users = [];
            
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $users[] = [
                    'id' => $row['id'],
                    'username' => $row['username'],
                    'email' => $row['email'],
                    'role' => $row['role'],
                    'created_at' => $row['created_at']
                ];
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $users
            ]);
        }
        break;
        
    case 'POST':
        // Create new user (admin only)
        if ($decoded['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin role required.']);
            exit();
        }
        
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->username) && !empty($data->email) && !empty($data->password) && !empty($data->role)) {
            // Check if username already exists
            if ($user->usernameExists($data->username)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Username already exists. Please use a different username.'
                ]);
                break;
            }
            
            // Check if email already exists
            if ($user->emailExists($data->email)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists. Please use a different email address.'
                ]);
                break;
            }
            
            $user->username = $data->username;
            $user->email = $data->email;
            $user->password = $data->password;
            $user->role = $data->role;
            
            if ($user->create()) {
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'User created successfully.',
                    'data' => [
                        'id' => $user->id,
                        'username' => $user->username,
                        'email' => $user->email,
                        'role' => $user->role
                    ]
                ]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unable to create user.']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        }
        break;
        
    case 'PUT':
        // Update user (admin only)
        if ($decoded['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin role required.']);
            exit();
        }
        
        if ($user_id) {
            $data = json_decode(file_get_contents("php://input"));
            
            // Check if username already exists (excluding current user)
            if ($user->usernameExists($data->username, $user_id)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Username already exists. Please use a different username.'
                ]);
                break;
            }
            
            // Check if email already exists (excluding current user)
            if ($user->emailExists($data->email, $user_id)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists. Please use a different email address.'
                ]);
                break;
            }
            
            $user->id = $user_id;
            $user->username = $data->username;
            $user->email = $data->email;
            $user->role = $data->role;
            
            // Only set password if it's provided and not empty
            if (isset($data->password) && !empty(trim($data->password))) {
                $user->password = $data->password;
            }
            
            if ($user->update()) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'User updated successfully.'
                ]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unable to update user.']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required.']);
        }
        break;
        
    case 'DELETE':
        // Delete user (admin only)
        if ($decoded['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin role required.']);
            exit();
        }
        
        if ($user_id) {
            $user->id = $user_id;
            
            if ($user->delete()) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'User deleted successfully.'
                ]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unable to delete user.']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required.']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
        break;
}
?>
