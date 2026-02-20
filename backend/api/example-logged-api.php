<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/api-wrapper.php';

// Initialize API wrapper for logging
$apiWrapper = new ApiWrapper('example-logged-api.php');

try {
    // Simulate some processing time
    usleep(100000); // 100ms delay
    
    // Example database query simulation
    $queryStart = microtime(true);
    // Simulate query execution
    usleep(50000); // 50ms delay
    $queryDuration = microtime(true) - $queryStart;
    
    // Log the query
    $apiWrapper->logQuery("SELECT * FROM contacts WHERE status = 'active'", $queryDuration, ['status' => 'active']);
    
    // Example response
    $response = [
        'success' => true,
        'message' => 'API call completed successfully',
        'data' => [
            'timestamp' => date('Y-m-d H:i:s'),
            'request_id' => ApiLogger::getRequestId()
        ]
    ];
    
    echo json_encode($response);
    
} catch (Exception $e) {
    $apiWrapper->logError($e->getMessage(), $e->getCode());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error',
        'error' => $e->getMessage()
    ]);
}

// The ApiWrapper destructor will automatically log the end time
?>


