<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';
require_once '../models/Quotation.php';

try {
    // Get the request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'POST') {
        throw new Exception('Only POST method allowed');
    }
    
    // Get the request body
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    // Validate required fields
    if (!isset($input['quotation_id']) || empty($input['quotation_id'])) {
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
    require_once '../config/jwt.php';
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
    
    // Initialize database and quotation model
    $database = new Database();
    $quotation = new Quotation();
    
    // Get quotation details
    $quotationData = $quotation->getById($input['quotation_id']);
    
    if (!$quotationData) {
        throw new Exception('Quotation not found');
    }
    
    // Check if quotation can be confirmed (only draft, sent, edited, or hold status)
    if (!in_array($quotationData['status'], ['draft', 'sent', 'edited', 'hold'])) {
        throw new Exception('Only draft, sent, edited, or hold quotations can be confirmed');
    }
    
    // Determine the status to set (default to 'hold' if not specified)
    $newStatus = $input['status'] ?? 'hold';
    
    // Validate status
    if (!in_array($newStatus, ['accepted', 'hold'])) {
        throw new Exception('Invalid status. Must be either "accepted" or "hold"');
    }
    
    // Update quotation status
    $result = $quotation->updateStatusWithUser($input['quotation_id'], $newStatus, $userId);
    
    if (!$result) {
        throw new Exception('Failed to confirm quotation');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Quotation confirmed successfully',
        'data' => [
            'quotation_id' => $input['quotation_id'],
            'status' => $newStatus
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
