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

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        // Validate required fields
        if (empty($data->username) || empty($data->password)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Username and password are required'
            ]);
            exit();
        }
        
        if ($user->login($data->username, $data->password)) {
                $token_payload = [
                    'user_id' => $user->id,
                    'username' => $user->username,
                    'role' => $user->role,
                    'exp' => time() + (24 * 60 * 60) // 24 hours
                ];
                
                $token = $jwt->encode($token_payload);
                
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Login successful',
                    'token' => $token,
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
            echo json_encode([
                'success' => false,
                'message' => 'Invalid credentials'
            ]);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
        break;
}
?>
