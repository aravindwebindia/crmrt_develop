<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

error_log("=== TEST LOGGING START ===");
error_log("Test message from test-logging.php");
error_log("Current time: " . date('Y-m-d H:i:s'));
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("=== TEST LOGGING END ===");

echo json_encode([
    'success' => true,
    'message' => 'Test logging completed. Check PHP error log.',
    'timestamp' => date('Y-m-d H:i:s')
]);
?>

