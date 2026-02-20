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

// DEBUG: Log the authorization header
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
    $user_role = $decoded['role'] ?? null;
} else {
    $user_id = $decoded->user_id ?? null;
    $user_role = $decoded->role ?? null;
}

if (!$user_id) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token data.']);
    exit();
}

// Initialize Service model
$service = new Service();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get pagination parameters
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $sortBy = isset($_GET['sortBy']) ? $_GET['sortBy'] : 'service_name';
            $sortOrder = isset($_GET['sortOrder']) ? strtoupper($_GET['sortOrder']) : 'ASC';
            $status = isset($_GET['status']) ? $_GET['status'] : '';
            
            // Validate pagination parameters
            $page = max(1, $page);
            $limit = max(1, min(100, $limit)); // Limit between 1 and 100
            
            $result = $service->getAll($page, $limit, $search, $sortBy, $sortOrder, $status);
            
            echo json_encode([
                'success' => true,
                'data' => $result['data'],
                'pagination' => [
                    'current_page' => $result['current_page'],
                    'total_pages' => $result['total_pages'],
                    'total_items' => $result['total_items'],
                    'items_per_page' => $result['items_per_page']
                ],
                'stats' => $result['stats']
            ]);
            break;
            
        case 'POST':
            // Create new service
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            $errors = [];
            
            if (empty($input['service_name'])) {
                $errors['service_name'] = 'Service name is required';
            } elseif (strlen($input['service_name']) < 2) {
                $errors['service_name'] = 'Service name must be at least 2 characters';
            } elseif (strlen($input['service_name']) > 100) {
                $errors['service_name'] = 'Service name must not exceed 100 characters';
            } elseif ($service->nameExists($input['service_name'])) {
                $errors['service_name'] = 'Service name already exists';
            }
            
            if (empty($input['hsn_sac'])) {
                $errors['hsn_sac'] = 'HSN/SAC is required';
            } elseif (!preg_match('/^[0-9]{3,10}$/', $input['hsn_sac'])) {
                $errors['hsn_sac'] = 'HSN/SAC must be 3-10 digits';
            }
            
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $errors
                ]);
                break;
            }
            
            $data = [
                'service_name' => trim($input['service_name']),
                'hsn_sac' => trim($input['hsn_sac']),
                'status' => $input['status'] ?? 'active',
                'created_by' => $user_id,
                'updated_by' => $user_id
            ];
            
            if ($service->create($data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Service created successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create service'
                ]);
            }
            break;
            
        case 'PUT':
            // Update service
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Service ID is required'
                ]);
                break;
            }
            
            // Check if service exists
            $existingService = $service->getById($id);
            if (!$existingService) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Service not found'
                ]);
                break;
            }
            
            // Validation
            $errors = [];
            
            if (empty($input['service_name'])) {
                $errors['service_name'] = 'Service name is required';
            } elseif (strlen($input['service_name']) < 2) {
                $errors['service_name'] = 'Service name must be at least 2 characters';
            } elseif (strlen($input['service_name']) > 100) {
                $errors['service_name'] = 'Service name must not exceed 100 characters';
            } elseif ($service->nameExists($input['service_name'], $id)) {
                $errors['service_name'] = 'Service name already exists';
            }
            
            if (empty($input['hsn_sac'])) {
                $errors['hsn_sac'] = 'HSN/SAC is required';
            } elseif (!preg_match('/^[0-9]{3,10}$/', $input['hsn_sac'])) {
                $errors['hsn_sac'] = 'HSN/SAC must be 3-10 digits';
            }
            
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $errors
                ]);
                break;
            }
            
            $data = [
                'service_name' => trim($input['service_name']),
                'hsn_sac' => trim($input['hsn_sac']),
                'status' => $input['status'],
                'updated_by' => $user_id
            ];
            
            if ($service->update($id, $data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Service updated successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update service'
                ]);
            }
            break;
            
        case 'DELETE':
            // Soft delete service
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Service ID is required'
                ]);
                break;
            }
            
            // Check if service exists
            $existingService = $service->getById($id);
            if (!$existingService) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Service not found'
                ]);
                break;
            }
            
            if ($service->softDelete($id, $user_id)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Service deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete service'
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
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>
