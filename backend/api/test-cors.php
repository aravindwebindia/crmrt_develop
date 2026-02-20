<?php
require_once __DIR__ . '/../config/cors.php';

header('Content-Type: application/json');

$response = [
    'success' => true,
    'message' => 'CORS test successful',
    'origin' => isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'Not set',
    'method' => $_SERVER['REQUEST_METHOD'],
    'timestamp' => date('Y-m-d H:i:s')
];

echo json_encode($response);
?>
