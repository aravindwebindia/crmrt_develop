<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Quotation.php';
require_once __DIR__ . '/../models/QuotationService.php';

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

// Initialize models
$quotation = new Quotation();
$quotationService = new QuotationService();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get quotations with pagination, search, and sorting
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $search = $_GET['search'] ?? '';
            $sortBy = $_GET['sortBy'] ?? 'created_at';
            $sortOrder = $_GET['sortOrder'] ?? 'DESC';
            $status = $_GET['status'] ?? '';

            $result = $quotation->getAll($page, $limit, $search, $sortBy, $sortOrder, $status);
            $stats = $quotation->getStats();

            // Check if we need to update missing created_at values
            if (isset($_GET['update_created_at']) && $_GET['update_created_at'] === '1') {
                $updateResult = $quotation->updateMissingCreatedAt();
                echo json_encode([
                    'success' => true,
                    'data' => $result['data'],
                    'pagination' => [
                        'current_page' => $result['current_page'],
                        'total_pages' => $result['total_pages'],
                        'total_items' => $result['total_items'],
                        'items_per_page' => $result['items_per_page']
                    ],
                    'stats' => $stats,
                    'updated_created_at' => $updateResult
                ]);
            } else {
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
            }
            break;

        case 'POST':
            // Create new quotation
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            $errors = [];
            
            if (empty($input['cp_id'])) {
                $errors['cp_id'] = 'Contact person is required';
            }
            
            if (empty($input['contract_type_id'])) {
                $errors['contract_type_id'] = 'Contract type is required';
            }
            
            if (empty($input['contract_from_date'])) {
                $errors['contract_from_date'] = 'Contract from date is required';
            }
            
            if (empty($input['contract_to_date'])) {
                $errors['contract_to_date'] = 'Contract to date is required';
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
                'cp_id' => $input['cp_id'],
                'contract_type_id' => $input['contract_type_id'],
                'contract_from_date' => $input['contract_from_date'],
                'contract_to_date' => $input['contract_to_date'],
                'contact_address' => $input['contact_address'] ?? '',
                'state_id' => $input['state_id'] ?: 1, // Use from contact or default to 1
                'country_id' => $input['country_id'] ?: 1, // Use from contact or default to 1
                'status' => $input['status'] ?? 'draft',
                'grand_total' => $input['grand_total'] ?? 0,
                'created_by' => $user_id
            ];

            $quotationId = $quotation->create($data);
            if ($quotationId) {
                // Save quotation services if provided
                if (!empty($input['services'])) {
                    foreach ($input['services'] as $service) {
                        $serviceData = [
                            'quotation_id' => $quotationId,
                            'service_id' => $service['service_id'],
                            'quantity' => $service['quantity'],
                            'rate' => $service['rate'],
                            'amount' => $service['amount'],
                            'tax_id' => $service['tax_id'],
                            'igst' => $service['igst'] ?? 0,
                            'cgst' => $service['cgst'] ?? 0,
                            'sgst' => $service['sgst'] ?? 0,
                            'igst_amount' => $service['igst_amount'] ?? 0,
                            'cgst_amount' => $service['cgst_amount'] ?? 0,
                            'sgst_amount' => $service['sgst_amount'] ?? 0,
                            'total_amount' => $service['total_amount'],
                            'description' => $service['description'] ?? '',
                            'created_by' => $user_id
                        ];
                        $quotationService->create($serviceData);
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Quotation created successfully.',
                    'quotation_id' => $quotationId
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create quotation.'
                ]);
            }
            break;

        case 'PUT':
            // Edit quotation - create new version instead of updating
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;

            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation ID is required.'
                ]);
                break;
            }

            $existingQuotation = $quotation->getById($id);
            if (!$existingQuotation) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation not found.'
                ]);
                break;
            }

            // Validation
            $errors = [];
            
            if (empty($input['cp_id'])) {
                $errors['cp_id'] = 'Contact person is required';
            }
            
            if (empty($input['contract_type_id'])) {
                $errors['contract_type_id'] = 'Contract type is required';
            }
            
            if (empty($input['contract_from_date'])) {
                $errors['contract_from_date'] = 'Contract from date is required';
            }
            
            if (empty($input['contract_to_date'])) {
                $errors['contract_to_date'] = 'Contract to date is required';
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

            // Generate versioned quotation number
            $versionedQuotationNo = $quotation->generateVersionedQuotationNo($existingQuotation['quotation_no']);

            // Create new quotation data
            $data = [
                'cp_id' => $input['cp_id'],
                'contract_type_id' => $input['contract_type_id'],
                'contract_from_date' => $input['contract_from_date'],
                'contract_to_date' => $input['contract_to_date'],
                'contact_address' => $input['contact_address'] ?? '',
                'state_id' => $input['state_id'] ?: 1,
                'country_id' => $input['country_id'] ?: 1,
                'status' => 'draft', // New version starts as draft
                'grand_total' => $input['grand_total'] ?? 0,
                'created_by' => $user_id
            ];

            // Create new quotation with versioned number
            $quotationNo = $versionedQuotationNo;
            $sql = "INSERT INTO quotations (cp_id, quotation_no, contract_type_id, contract_from_date, contract_to_date, contact_address, state_id, country_id, status, grand_total, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $database = new Database();
            $db = $database->getConnection();
            $stmt = $db->prepare($sql);
            
            $result = $stmt->execute([
                $data['cp_id'],
                $quotationNo,
                $data['contract_type_id'],
                $data['contract_from_date'],
                $data['contract_to_date'],
                $data['contact_address'],
                $data['state_id'],
                $data['country_id'],
                $data['status'],
                $data['grand_total'],
                $data['created_by']
            ]);
            
            if ($result) {
                $newQuotationId = $db->lastInsertId();
                
                // Mark original quotation as edited
                $quotation->markAsEdited($id);
                
                // Soft delete all services from the original quotation
                $quotationService->deleteByQuotationId($id);
                
                // Save quotation services for new quotation
                if (!empty($input['services'])) {
                    foreach ($input['services'] as $service) {
                        $serviceData = [
                            'quotation_id' => $newQuotationId,
                            'service_id' => $service['service_id'],
                            'quantity' => $service['quantity'],
                            'rate' => $service['rate'],
                            'amount' => $service['amount'],
                            'tax_id' => $service['tax_id'],
                            'igst' => $service['igst'] ?? 0,
                            'cgst' => $service['cgst'] ?? 0,
                            'sgst' => $service['sgst'] ?? 0,
                            'igst_amount' => $service['igst_amount'] ?? 0,
                            'cgst_amount' => $service['cgst_amount'] ?? 0,
                            'sgst_amount' => $service['sgst_amount'] ?? 0,
                            'total_amount' => $service['total_amount'],
                            'description' => $service['description'] ?? '',
                            'created_by' => $user_id
                        ];
                        $quotationService->create($serviceData);
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Quotation edited successfully. New version created.',
                    'quotation_id' => $newQuotationId,
                    'quotation_no' => $quotationNo
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create quotation version.'
                ]);
            }
            break;

        case 'DELETE':
            // Delete quotation
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quotation ID is required.'
                ]);
                break;
            }
            
            if ($quotation->delete($id)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Quotation deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete quotation'
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
