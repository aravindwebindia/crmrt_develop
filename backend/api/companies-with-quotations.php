<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

// Initialize JWT
$jwt = new JWT();

// Get token from Authorization header
$auth_header = '';
$token = null;

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
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired token'
        ]);
        exit();
    }
}

$database = new Database();
$db = $database->getConnection();

try {
    // Get companies that have active quotations
    // Join: quotations -> contact_persons -> contacts
    $query = "SELECT DISTINCT 
                    c.ld_id as contact_id,
                    c.company as company_name
              FROM contacts c
              INNER JOIN contact_persons cp ON c.ld_id = cp.contact_id
              INNER JOIN quotations q ON cp.cp_id = q.cp_id
              INNER JOIN quotation_services qs ON q.id = qs.quotation_id
              WHERE q.status = 'accepted' AND qs.is_deleted = FALSE AND qs.is_moved_so = 0
              ORDER BY c.company ASC";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $companies
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>
