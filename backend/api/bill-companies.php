<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/common.php';

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
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Check if quotation_id is provided
        $quotation_id = isset($_GET['quotation_id']) ? intval($_GET['quotation_id']) : null;
        $bill_company_id = null;
        
        // If quotation_id is provided, get bill_company_id from billing_com_quot_details
        if ($quotation_id) {
            $billingQuery = "SELECT bill_company_id 
                            FROM billing_com_quot_details 
                            WHERE quotation_id = ? 
                            ORDER BY id DESC 
                            LIMIT 1";
            $billingStmt = $db->prepare($billingQuery);
            $billingStmt->execute([$quotation_id]);
            $billingResult = $billingStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($billingResult && isset($billingResult['bill_company_id'])) {
                $bill_company_id = intval($billingResult['bill_company_id']);
            } else {
                // Default to bill_company_id = 2 if no record found
                $bill_company_id = 2;
            }
        }
        
        // Build SQL query
        if ($bill_company_id) {
            // Get specific billing company by ID
            $sql = "SELECT 
                        bc_id, 
                        bc_name, 
                        bc_address, 
                        bc_gst, 
                        bc_gst as gst_no, 
                        bc_msme, 
                        bc_msme as msme_no,
                        bc_logo,
                        bc_seal,
                        bc_bank_name,
                        bc_bank_acc_no,
                        bc_bank_ifsc,
                        bc_bank_branch,
                        bc_bank_address,
                        bc_country_id,
                        bc_state_id
                    FROM bill_company 
                    WHERE bc_id = ? AND status = 'active' AND is_deleted = FALSE";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([$bill_company_id]);
            $billCompanies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Get all active billing companies
            $sql = "SELECT 
                        bc_id, 
                        bc_name, 
                        bc_address, 
                        bc_gst, 
                        bc_gst as gst_no, 
                        bc_msme, 
                        bc_msme as msme_no,
                        bc_logo,
                        bc_seal,
                        bc_bank_name,
                        bc_bank_acc_no,
                        bc_bank_ifsc,
                        bc_bank_branch,
                        bc_bank_address,
                        bc_country_id,
                        bc_state_id
                    FROM bill_company 
                    WHERE status = 'active' AND is_deleted = FALSE 
                    ORDER BY bc_name ASC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute();
            $billCompanies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Get backend URL for constructing full image URLs
        $backendUrl = CommonConfig::getBackendUrl();
        
        // Convert relative image paths to full URLs
        foreach ($billCompanies as &$company) {
            if (!empty($company['bc_logo'])) {
                // Remove leading slash if present
                $logoPath = ltrim($company['bc_logo'], '/');
                $company['bc_logo'] = $backendUrl . '/' . $logoPath;
            }
            if (!empty($company['bc_seal'])) {
                // Remove leading slash if present
                $sealPath = ltrim($company['bc_seal'], '/');
                $company['bc_seal'] = $backendUrl . '/' . $sealPath;
            }
        }
        unset($company); // Break reference
        
        echo json_encode([
            'success' => true,
            'data' => $billCompanies
        ]);
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token: ' . $e->getMessage()]);
}
?>
