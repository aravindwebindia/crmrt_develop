<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';
require_once '../config/jwt.php';

try {
    // Get the request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'GET') {
        throw new Exception('Only GET method allowed');
    }
    
    // Get quotation ID from query parameters
    $quotationId = $_GET['quotation_id'] ?? null;
    
    if (!$quotationId) {
        throw new Exception('Quotation ID is required');
    }
    
    // Get authorization header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new Exception('Authorization token required');
    }
    
    $token = $matches[1];
    
    // Verify JWT token
    $jwt = new JWT();
    $decoded = $jwt->validate($token);
    
    if (!$decoded) {
        throw new Exception('Invalid token');
    }
    
    // Handle both array and object responses from JWT validation
    if (is_array($decoded)) {
        $userId = $decoded['user_id'] ?? null;
    } else {
        $userId = $decoded->user_id ?? null;
    }
    
    if (!$userId) {
        throw new Exception('Invalid token');
    }
    
    // Initialize database
    $database = new Database();
    $db = $database->getConnection();
    
    // Get the current quotation to find the base quotation number
    $currentQuotationSql = "SELECT quotation_no FROM quotations WHERE id = ? AND is_deleted = FALSE";
    $currentStmt = $db->prepare($currentQuotationSql);
    $currentStmt->execute([$quotationId]);
    $currentQuotation = $currentStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$currentQuotation) {
        throw new Exception('Quotation not found');
    }
    
    $currentQuotationNo = $currentQuotation['quotation_no'];
    
    // Extract base quotation number (e.g., QT-2025-001 from QT-2025-001-1 or QT-2025-001-2)
    $basePattern = '/^(QT-\d{4}-\d{3})/';
    preg_match($basePattern, $currentQuotationNo, $matches);
    $baseQuotationNo = $matches[1] ?? $currentQuotationNo;
    
    // Find all quotations with the same base number (excluding the current one)
    $referencesSql = "SELECT 
                        q.id,
                        q.quotation_no,
                        q.status,
                        q.created_at,
                        q.updated_at,
                        c.company,
                        cp.contact_person,
                        q.grand_total
                      FROM quotations q
                      LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
                      LEFT JOIN contacts c ON cp.contact_id = c.ld_id
                      WHERE q.quotation_no LIKE ? 
                        AND q.id != ?
                        AND q.is_deleted = FALSE
                      ORDER BY q.created_at DESC";
    
    $referencesStmt = $db->prepare($referencesSql);
    $referencesStmt->execute([$baseQuotationNo . '%', $quotationId]);
    $references = $referencesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $references,
        'base_quotation_no' => $baseQuotationNo,
        'current_quotation_no' => $currentQuotationNo
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
