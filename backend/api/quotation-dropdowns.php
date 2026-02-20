<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Credentials: true');

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
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or expired token'
    ]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    $data = [];
    
    // Get contacts
    $stmt = $db->query("SELECT ld_id as contact_id, company as company_name, first_name, last_name, mobile, email, c_address, state, country FROM contacts WHERE is_deleted = FALSE AND status = 'active' ORDER BY company");
    $data['contacts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get contact persons
    $stmt = $db->query("SELECT cp_id, contact_id, contact_person, contact_mobile, contact_email FROM contact_persons WHERE status = 'active' ORDER BY contact_person");
    $data['contact_persons'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get contract types
    $stmt = $db->query("SELECT id, contract_name, terms FROM contract_types WHERE status = 'active' ORDER BY contract_name");
    $data['contract_types'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get services
    $stmt = $db->query("SELECT id, service_name FROM services WHERE status = 'active' AND is_deleted = FALSE ORDER BY service_name");
    $data['services'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get tax rates
    $stmt = $db->query("SELECT tax_id, tax_name, igst, cgst, sgst FROM tax WHERE status = 'active' AND is_deleted = FALSE ORDER BY tax_name");
    $data['tax_rates'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get countries
    $stmt = $db->query("SELECT id as country_id, name as country_name FROM tbl_countries ORDER BY name");
    $data['countries'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get states
    $stmt = $db->query("SELECT id as state_id, name as state_name, country_id FROM tbl_states ORDER BY name");
    $data['states'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $data
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>
