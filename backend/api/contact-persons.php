<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../models/ContactPerson.php';

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
    if (!$decoded) {
        throw new Exception('Invalid token');
    }
    $user_id = is_array($decoded) ? $decoded['user_id'] : $decoded->user_id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or expired token'
    ]);
    exit();
}

// Initialize ContactPerson model
$contactPerson = new ContactPerson();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get contact persons by contact ID
            $contactId = $_GET['contact_id'] ?? null;
            
            if (!$contactId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact ID is required'
                ]);
                break;
            }
            
            $contactPersons = $contactPerson->getByContactId($contactId);
            echo json_encode([
                'success' => true,
                'data' => $contactPersons
            ]);
            break;

        case 'POST':
            // Create new contact person
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            $errors = [];
            
            if (empty($input['contact_id'])) {
                $errors['contact_id'] = 'Contact ID is required';
            }
            
            if (empty($input['contact_person'])) {
                $errors['contact_person'] = 'Contact person name is required';
            }
            
            if (empty($input['contact_mobile'])) {
                $errors['contact_mobile'] = 'Contact mobile is required';
            }
            
            if (empty($input['contact_email'])) {
                $errors['contact_email'] = 'Contact email is required';
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
                'contact_id' => $input['contact_id'],
                'contact_person' => $input['contact_person'],
                'contact_mobile' => $input['contact_mobile'],
                'contact_email' => $input['contact_email'],
                'status' => 'active'
            ];

            $cpId = $contactPerson->create($data);
            if ($cpId) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact person created successfully.',
                    'cp_id' => $cpId
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create contact person.'
                ]);
            }
            break;

        case 'PUT':
            // Update contact person
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;

            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact person ID is required.'
                ]);
                break;
            }

            // Validation
            $errors = [];
            
            if (empty($input['contact_person'])) {
                $errors['contact_person'] = 'Contact person name is required';
            }
            
            if (empty($input['contact_mobile'])) {
                $errors['contact_mobile'] = 'Contact mobile is required';
            }
            
            if (empty($input['contact_email'])) {
                $errors['contact_email'] = 'Contact email is required';
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
                'contact_person' => $input['contact_person'],
                'contact_mobile' => $input['contact_mobile'],
                'contact_email' => $input['contact_email'],
                'status' => $input['status'] ?? 'active'
            ];

            if ($contactPerson->update($id, $data)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact person updated successfully.'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update contact person.'
                ]);
            }
            break;

        case 'DELETE':
            // Delete contact person
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Contact person ID is required.'
                ]);
                break;
            }
            
            if ($contactPerson->delete($id)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Contact person deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete contact person'
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
