<?php
/**
 * API Wrapper for automatic logging
 */
require_once __DIR__ . '/logger.php';

class ApiWrapper {
    private $apiEndpoint;
    private $startTime;
    
    public function __construct($apiEndpoint) {
        $this->apiEndpoint = $apiEndpoint;
        $this->startTime = microtime(true);
        
        // Start logging
        ApiLogger::startRequest($apiEndpoint);
    }
    
    public function __destruct() {
        // End logging when object is destroyed
        $this->endRequest();
    }
    
    public function endRequest($status = 'SUCCESS') {
        if ($this->startTime !== null) {
            ApiLogger::endRequest($this->apiEndpoint, $status);
            $this->startTime = null;
        }
    }
    
    public function logError($errorMessage, $errorCode = null) {
        ApiLogger::logError($this->apiEndpoint, $errorMessage, $errorCode);
    }
    
    public function logWarning($warningMessage) {
        ApiLogger::logWarning($this->apiEndpoint, $warningMessage);
    }
    
    public function logQuery($query, $duration, $params = []) {
        ApiLogger::logQuery($query, $duration, $params);
    }
}
?>


