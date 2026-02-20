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
    $contact_id = $_GET['contact_id'] ?? null;
    
    if ($contact_id) {
        // Get quotations for specific company (contact_id)
        // Join: quotations -> contact_persons -> contacts
        $query = "SELECT q.id, q.quotation_no, q.grand_total, 
                  q.contract_from_date, q.contract_to_date,
                  c.company AS company_name, cp.contact_person, cp.cp_id,
                  q.created_at
           FROM quotations q
           INNER JOIN quotation_services qs ON q.id = qs.quotation_id
           INNER JOIN contact_persons cp ON q.cp_id = cp.cp_id
           INNER JOIN contacts c ON cp.contact_id = c.ld_id
           WHERE c.ld_id = :contact_id
             AND q.status = 'accepted'
             AND q.is_deleted = FALSE
             AND qs.is_deleted = FALSE 
             AND qs.is_moved_so = 0
           GROUP BY q.id
           ORDER BY q.created_at DESC";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':contact_id', $contact_id);
        $stmt->execute();
        
        $quotations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $quotations
        ]);
    } else {
        // Get all accepted quotations with company and contact person details
        $query = "SELECT q.id, q.quotation_no, q.grand_total, q.contract_from_date, q.contract_to_date,
                         c.company as company_name, cp.contact_person, c.ld_id as contact_id
                  FROM quotations q
                  INNER JOIN contact_persons cp ON q.cp_id = cp.cp_id
                  INNER JOIN contacts c ON cp.contact_id = c.ld_id
                  WHERE q.status = 'accepted'
                  ORDER BY c.company, cp.contact_person, q.created_at DESC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $quotations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $quotations
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>
