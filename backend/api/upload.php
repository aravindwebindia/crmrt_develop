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

// Get Authorization header
$auth_header = '';
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
} elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

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

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Check if file was uploaded
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No file uploaded or upload error.']);
        exit();
    }
    
    $file = $_FILES['image'];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($file['type'], $allowedTypes)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.']);
        exit();
    }
    
    // Validate file size (5MB max)
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'File too large. Maximum size is 5MB.']);
        exit();
    }
    
    // Create uploads directory if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/profiles/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'profile_' . $decoded['user_id'] . '_' . time() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $filepath)) {
        // Update user profile with image path
        $user->id = $decoded['user_id'];
        $user->profile_image = 'uploads/profiles/' . $filename;
        
        if ($user->updateProfile()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Image uploaded successfully.',
                'image_url' => 'uploads/profiles/' . $filename
            ]);
        } else {
            // Delete uploaded file if database update fails
            unlink($filepath);
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to update profile with image.']);
        }
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to upload file.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
?>
