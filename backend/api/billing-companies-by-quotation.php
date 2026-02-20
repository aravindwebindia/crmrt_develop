<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

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
    // Get quotation ID from query parameters
    $quotation_id = isset($_GET['quotation_id']) ? $_GET['quotation_id'] : null;
    
    if (!$quotation_id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Quotation ID is required'
        ]);
        exit();
    }
    
    // Step 1: Get bill_company_id from billing_com_quot_details table
    $query1 = "SELECT bill_company_id FROM billing_com_quot_details WHERE quotation_id = :quotation_id";
    $stmt1 = $db->prepare($query1);
    $stmt1->bindParam(':quotation_id', $quotation_id);
    $stmt1->execute();
    $selectedBillCompanyId = $stmt1->fetch(PDO::FETCH_COLUMN);
    
    // Step 2: Get all billing companies from bill_company table
    $query2 = "SELECT bc_id, bc_name FROM bill_company WHERE status = 'active' AND is_deleted = FALSE ORDER BY bc_name ASC";
    $stmt2 = $db->prepare($query2);
    $stmt2->execute();
    $allBillingCompanies = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    
    // Step 3: Loop through and check ternary operator bc_id == bill_company_id
    $billingCompanies = [];
    foreach ($allBillingCompanies as $company) {
        $billingCompanies[] = [
            'bill_company_id' => $company['bc_id'],
            'company_name' => $company['bc_name'],
            'selected_bill_company_id' => ($company['bc_id'] == $selectedBillCompanyId) ? $company['bc_id'] : null
        ];
    }
    
    // Debug logging
    echo json_encode([
        'success' => true,
        'data' => $billingCompanies
    ]);
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token: ' . $e->getMessage()]);
}
?>
