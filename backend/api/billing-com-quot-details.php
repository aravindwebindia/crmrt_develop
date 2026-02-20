<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

// Initialize JWT
$jwt = new JWT();

// Get token from Authorization header
$auth_header = '';

// Use getallheaders() as the primary method since we know it works
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $auth_header = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $auth_header = $headers['authorization'];
    }
}

// Fallback methods
if (!$auth_header) {
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['Authorization'])) {
        $auth_header = $_SERVER['Authorization'];
    }
}

if (!$auth_header || !preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authorization token required']);
    exit;
}

$token = $matches[1];

try {
    // Verify token
    $decoded = $jwt->decode($token);
    
    if (!$decoded || !isset($decoded['user_id'])) {
        throw new Exception('Invalid token');
    }
    
    $database = new Database();
    $db = $database->getConnection();
    $user_id = $decoded['user_id'];
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Create billing company quotation details
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['quotation_id']) || !isset($input['bill_company_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'quotation_id and bill_company_id are required']);
            exit;
        }
        
        $quotation_id = (int)$input['quotation_id'];
        $bill_company_id = (int)$input['bill_company_id'];
        
        // Check if quotation exists
        $quotationCheck = $db->prepare("SELECT id FROM quotations WHERE id = ? AND is_deleted = FALSE");
        $quotationCheck->execute([$quotation_id]);
        if (!$quotationCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Quotation not found']);
            exit;
        }
        
        // Check if billing company exists
        $billCompanyCheck = $db->prepare("SELECT bc_id FROM bill_company WHERE bc_id = ? AND status = 'active' AND is_deleted = FALSE");
        $billCompanyCheck->execute([$bill_company_id]);
        if (!$billCompanyCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Billing company not found']);
            exit;
        }
        
        // Check if combination already exists
        $existingCheck = $db->prepare("SELECT id FROM billing_com_quot_details WHERE quotation_id = ? AND bill_company_id = ?");
        $existingCheck->execute([$quotation_id, $bill_company_id]);
        if ($existingCheck->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'This quotation is already associated with this billing company']);
            exit;
        }
        
        // Insert new record
        $sql = "INSERT INTO billing_com_quot_details (quotation_id, bill_company_id, created_by) VALUES (?, ?, ?)";
        $stmt = $db->prepare($sql);
        
        if ($stmt->execute([$quotation_id, $bill_company_id, $user_id])) {
            $new_id = $db->lastInsertId();
            
            // Get the created record with related data
            $getRecord = $db->prepare("
                SELECT bqd.*, 
                       q.quotation_no,
                       bc.bc_name,
                       u.username as created_by_name
                FROM billing_com_quot_details bqd
                LEFT JOIN quotations q ON bqd.quotation_id = q.id
                LEFT JOIN bill_company bc ON bqd.bill_company_id = bc.bc_id
                LEFT JOIN users u ON bqd.created_by = u.id
                WHERE bqd.id = ?
            ");
            $getRecord->execute([$new_id]);
            $record = $getRecord->fetch(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'message' => 'Billing company quotation details created successfully',
                'data' => $record
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to create billing company quotation details']);
        }
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get billing company quotation details
        $quotation_id = isset($_GET['quotation_id']) ? (int)$_GET['quotation_id'] : null;
        
        if ($quotation_id) {
            // Get details for specific quotation
            $sql = "SELECT bqd.*, 
                           q.quotation_no,
                           bc.bc_name,
                           bc.bc_address,
                           bc.bc_gst as gst_no,
                           bc.bc_msme as msme_no,
                           bc.bc_state_id,
                           bc.bc_country_id,
                           u.username as created_by_name
                    FROM billing_com_quot_details bqd
                    LEFT JOIN quotations q ON bqd.quotation_id = q.id
                    LEFT JOIN bill_company bc ON bqd.bill_company_id = bc.bc_id
                    LEFT JOIN users u ON bqd.created_by = u.id
                    WHERE bqd.quotation_id = ?
                    ORDER BY bqd.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([$quotation_id]);
            $details = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $details
            ]);
        } else {
            // Get all details
            $sql = "SELECT bqd.*, 
                           q.quotation_no,
                           bc.bc_name,
                           u.username as created_by_name
                    FROM billing_com_quot_details bqd
                    LEFT JOIN quotations q ON bqd.quotation_id = q.id
                    LEFT JOIN bill_company bc ON bqd.bill_company_id = bc.bc_id
                    LEFT JOIN users u ON bqd.created_by = u.id
                    ORDER BY bqd.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute();
            $details = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $details
            ]);
        }
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Delete billing company quotation details
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['quotation_id']) || !isset($input['bill_company_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'quotation_id and bill_company_id are required']);
            exit;
        }
        
        $quotation_id = (int)$input['quotation_id'];
        $bill_company_id = (int)$input['bill_company_id'];
        
        $sql = "DELETE FROM billing_com_quot_details WHERE quotation_id = ? AND bill_company_id = ?";
        $stmt = $db->prepare($sql);
        
        if ($stmt->execute([$quotation_id, $bill_company_id])) {
            echo json_encode([
                'success' => true,
                'message' => 'Billing company quotation details deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to delete billing company quotation details']);
        }
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token: ' . $e->getMessage()]);
}
?>
