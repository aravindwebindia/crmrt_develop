<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

$jwt = new JWT();
$database = new Database();
$pdo = $database->getConnection();

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Get JWT token from header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authorization header missing or invalid']);
        exit;
    }

    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'contacts':
            // Get contacts from sale orders where is_invoiced = 0
            $query = "SELECT DISTINCT contacts.ld_id, contacts.company 
                      FROM sale_orders 
                      JOIN contacts ON contacts.ld_id = sale_orders.contact_id 
                      WHERE sale_orders.is_invoiced = 0 and sale_orders.is_deleted = FALSE
                      ORDER BY contacts.company ASC";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute();
            $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $contacts
            ]);
            break;
            
        case 'sale_orders':
            $contact_id = $_GET['contact_id'] ?? null;
            
            if (!$contact_id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Contact ID is required']);
                exit;
            }
            
            // Get sale orders for selected contact where is_invoiced = 0
            $query = "SELECT id, saleorder_no 
                      FROM sale_orders 
                      WHERE is_invoiced = 0 AND status = 'active' AND is_deleted = FALSE AND contact_id = :contact_id 
                      ORDER BY created_at DESC, id DESC";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute(['contact_id' => $contact_id]);
            $sale_orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $sale_orders
            ]);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action. Use "contacts" or "sale_orders"']);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
