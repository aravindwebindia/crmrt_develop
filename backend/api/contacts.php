<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

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

// Validate token for all methods except OPTIONS (handled in CORS include)
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

// Initialize Contact model
$contact = new Contact();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get pagination parameters
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $sortBy = isset($_GET['sortBy']) ? $_GET['sortBy'] : 'created_at';
            $sortOrder = isset($_GET['sortOrder']) ? strtoupper($_GET['sortOrder']) : 'DESC';
            $status = isset($_GET['status']) ? $_GET['status'] : '';
            
            // Validate pagination parameters
            $page = max(1, $page);
            $limit = max(1, min(100, $limit)); // Limit between 1 and 100
            
            $result = $contact->getAll($page, $limit, $search, $sortBy, $sortOrder, $status);
            
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
            // Create new contact
            $input = json_decode(file_get_contents('php://input'), true);
            
            
            // Validation
            $errors = [];
            
            if (empty($input['first_name'])) {
                $errors['first_name'] = 'This is required field';
            }
            
            if (empty($input['email'])) {
                $errors['email'] = 'This is required field';
            } elseif (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
                $errors['email'] = 'Please enter a valid email address with @ and .';
            }
            
            if (empty($input['mobile'])) {
                $errors['mobile'] = 'This is required field';
            } elseif (!preg_match('/^[0-9]{8,15}$/', $input['mobile'])) {
                $errors['mobile'] = 'Mobile number must be 8 to 15 digits';
            }
            
            if (empty($input['company'])) {
                $errors['company'] = 'This is required field';
            }
            
            if (empty($input['country'])) {
                $errors['country'] = 'This is required field';
            }
            
            if (empty($input['state'])) {
                $errors['state'] = 'This is required field';
            }
            
            if (empty($input['c_address'])) {
                $errors['c_address'] = 'This is required field';
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
                'sal_id' => !empty($input['sal_id']) ? (int)$input['sal_id'] : 0,
                'first_name' => trim($input['first_name']),
                'last_name' => trim($input['last_name']),
                'designation' => $input['designation'] ?? '',
                'email' => trim($input['email']),
                'mobile' => trim($input['mobile']),
                'notes' => $input['notes'] ?? '',
                'company' => trim($input['company']),
                'c_address' => trim($input['c_address']),
                'picture' => $input['picture'] ?? '',
                'company_gst' => $input['company_gst'] ?? '',
                'state' => (int)$input['state'],
                'country' => (int)$input['country'],
                'city' => $input['city'] ?? '',
                'zip' => $input['zip'] ?? '',
                'status' => $input['status'] ?? 'active',
                'created_by' => $user_id
            ];
            
            if ($contact->create($data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact created successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create contact'
                ]);
            }
            break;
            
        case 'PUT':
            // Update contact
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact ID is required'
                ]);
                break;
            }
            
            // Check if contact exists
            $existingContact = $contact->getById($id);
            if (!$existingContact) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact not found'
                ]);
                break;
            }
            
            // Validation
            $errors = [];
            
            if (empty($input['first_name'])) {
                $errors['first_name'] = 'This is required field';
            }
            
            if (empty($input['email'])) {
                $errors['email'] = 'This is required field';
            } elseif (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
                $errors['email'] = 'Please enter a valid email address with @ and .';
            }
            
            if (empty($input['mobile'])) {
                $errors['mobile'] = 'This is required field';
            } elseif (!preg_match('/^[0-9]{8,15}$/', $input['mobile'])) {
                $errors['mobile'] = 'Mobile number must be 8 to 15 digits';
            }
            
            if (empty($input['company'])) {
                $errors['company'] = 'This is required field';
            }
            
            if (empty($input['country'])) {
                $errors['country'] = 'This is required field';
            }
            
            if (empty($input['state'])) {
                $errors['state'] = 'This is required field';
            }
            
            if (empty($input['c_address'])) {
                $errors['c_address'] = 'This is required field';
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
                'sal_id' => !empty($input['sal_id']) ? (int)$input['sal_id'] : 0,
                'first_name' => trim($input['first_name']),
                'last_name' => trim($input['last_name']),
                'designation' => $input['designation'] ?? '',
                'email' => trim($input['email']),
                'mobile' => trim($input['mobile']),
                'notes' => $input['notes'] ?? '',
                'company' => trim($input['company']),
                'c_address' => trim($input['c_address']),
                'picture' => $input['picture'] ?? '',
                'company_gst' => $input['company_gst'] ?? '',
                'state' => (int)$input['state'],
                'country' => (int)$input['country'],
                'city' => $input['city'] ?? '',
                'zip' => $input['zip'] ?? '',
                'status' => $input['status'] ?? 'active',
                'updated_by' => $user_id
            ];
            
            if ($contact->update($id, $data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact updated successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update contact'
                ]);
            }
            break;
            
        case 'DELETE':
            // Delete contact
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact ID is required'
                ]);
                break;
            }
            
            if ($contact->delete($id)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete contact'
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
