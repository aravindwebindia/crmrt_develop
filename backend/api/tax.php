<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/Tax.php';

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
        $user_id = is_array($decoded) ? $decoded['user_id'] : $decoded->user_id;
        $role = is_array($decoded) ? $decoded['role'] : $decoded->role;
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired token'
        ]);
        exit();
    }
}

// Initialize Tax model
$tax = new Tax();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get taxes with pagination, search, and sorting
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $search = $_GET['search'] ?? '';
            $sortBy = $_GET['sortBy'] ?? 'tax_name';
            $sortOrder = $_GET['sortOrder'] ?? 'ASC';
            $status = $_GET['status'] ?? '';

            $result = $tax->getAll($page, $limit, $search, $sortBy, $sortOrder, $status);
            $stats = $tax->getStats();

            echo json_encode([
                'success' => true,
                'data' => $result['data'],
                'pagination' => [
                    'current_page' => $result['current_page'],
                    'total_pages' => $result['total_pages'],
                    'total_items' => $result['total_items'],
                    'items_per_page' => $result['items_per_page']
                ],
                'stats' => $stats
            ]);
            break;

        case 'POST':
            // Create new tax
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            $errors = [];
            
            if (empty($input['tax_name'])) {
                $errors['tax_name'] = 'This is required field';
            } elseif ($tax->taxExists($input['tax_name'])) {
                $errors['tax_name'] = 'Tax name already exists';
            }
            
            if (empty($input['status'])) {
                $errors['status'] = 'This is required field';
            } elseif (!in_array($input['status'], ['active', 'inactive'])) {
                $errors['status'] = 'Invalid status';
            }
            
            // Validate IGST, CGST, SGST (at least one should be provided)
            if (empty($input['igst']) && empty($input['cgst']) && empty($input['sgst'])) {
                $errors['tax_rates'] = 'At least one tax rate (IGST, CGST, or SGST) is required';
            }
            
            // Validate tax rates are numeric and positive
            if (!empty($input['igst']) && (!is_numeric($input['igst']) || $input['igst'] < 0)) {
                $errors['igst'] = 'IGST must be a valid positive number';
            }
            if (!empty($input['cgst']) && (!is_numeric($input['cgst']) || $input['cgst'] < 0)) {
                $errors['cgst'] = 'CGST must be a valid positive number';
            }
            if (!empty($input['sgst']) && (!is_numeric($input['sgst']) || $input['sgst'] < 0)) {
                $errors['sgst'] = 'SGST must be a valid positive number';
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
                'tax_name' => $input['tax_name'],
                'igst' => !empty($input['igst']) ? (float)$input['igst'] : null,
                'cgst' => !empty($input['cgst']) ? (float)$input['cgst'] : null,
                'sgst' => !empty($input['sgst']) ? (float)$input['sgst'] : null,
                'status' => $input['status'],
                'created_by' => $user_id
            ];

            if ($tax->create($data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Tax created successfully.'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create tax.'
                ]);
            }
            break;

        case 'PUT':
            // Update tax
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;

            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tax ID is required.'
                ]);
                break;
            }

            $existingTax = $tax->getById($id);
            if (!$existingTax) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tax not found.'
                ]);
                break;
            }

            // Validation
            $errors = [];
            
            if (empty($input['tax_name'])) {
                $errors['tax_name'] = 'This is required field';
            } elseif ($tax->taxExists($input['tax_name'], $id)) {
                $errors['tax_name'] = 'Tax name already exists';
            }
            
            if (empty($input['status'])) {
                $errors['status'] = 'This is required field';
            } elseif (!in_array($input['status'], ['active', 'inactive'])) {
                $errors['status'] = 'Invalid status';
            }
            
            // Validate IGST, CGST, SGST (at least one should be provided)
            if (empty($input['igst']) && empty($input['cgst']) && empty($input['sgst'])) {
                $errors['tax_rates'] = 'At least one tax rate (IGST, CGST, or SGST) is required';
            }
            
            // Validate tax rates are numeric and positive
            if (!empty($input['igst']) && (!is_numeric($input['igst']) || $input['igst'] < 0)) {
                $errors['igst'] = 'IGST must be a valid positive number';
            }
            if (!empty($input['cgst']) && (!is_numeric($input['cgst']) || $input['cgst'] < 0)) {
                $errors['cgst'] = 'CGST must be a valid positive number';
            }
            if (!empty($input['sgst']) && (!is_numeric($input['sgst']) || $input['sgst'] < 0)) {
                $errors['sgst'] = 'SGST must be a valid positive number';
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
                'tax_name' => $input['tax_name'],
                'igst' => !empty($input['igst']) ? (float)$input['igst'] : null,
                'cgst' => !empty($input['cgst']) ? (float)$input['cgst'] : null,
                'sgst' => !empty($input['sgst']) ? (float)$input['sgst'] : null,
                'status' => $input['status'],
                'updated_by' => $user_id
            ];

            if ($tax->update($id, $data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Tax updated successfully.'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update tax.'
                ]);
            }
            break;

        case 'DELETE':
            // Delete tax
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tax ID is required.'
                ]);
                break;
            }
            
            if ($tax->delete($id)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Tax deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete tax'
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
