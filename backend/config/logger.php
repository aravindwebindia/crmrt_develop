<?php
/**
 * API Logger for tracking call times and errors
 */
class ApiLogger {
    private static $startTime;
    private static $requestId;
    
    /**
     * Start timing an API call
     */
    public static function startRequest($apiEndpoint) {
        self::$startTime = microtime(true);
        self::$requestId = uniqid('req_', true);
        
        $logMessage = sprintf(
            "[%s] API_START: %s | Request ID: %s | Time: %s",
            date('Y-m-d H:i:s'),
            $apiEndpoint,
            self::$requestId,
            date('Y-m-d H:i:s.u')
        );
        
        error_log($logMessage);
    }
    
    /**
     * End timing and log the API call duration
     */
    public static function endRequest($apiEndpoint, $status = 'SUCCESS') {
        if (self::$startTime === null) {
            return;
        }
        
        $endTime = microtime(true);
        $duration = round(($endTime - self::$startTime) * 1000, 2); // Convert to milliseconds
        
        $logMessage = sprintf(
            "[%s] API_END: %s | Request ID: %s | Duration: %sms | Status: %s",
            date('Y-m-d H:i:s'),
            $apiEndpoint,
            self::$requestId,
            $duration,
            $status
        );
        
        error_log($logMessage);
        
        // Reset for next request
        self::$startTime = null;
        self::$requestId = null;
    }
    
    /**
     * Log API errors
     */
    public static function logError($apiEndpoint, $errorMessage, $errorCode = null) {
        $logMessage = sprintf(
            "[%s] API_ERROR: %s | Request ID: %s | Error: %s | Code: %s",
            date('Y-m-d H:i:s'),
            $apiEndpoint,
            self::$requestId ?? 'unknown',
            $errorMessage,
            $errorCode ?? 'N/A'
        );
        
        error_log($logMessage);
    }
    
    /**
     * Log API warnings
     */
    public static function logWarning($apiEndpoint, $warningMessage) {
        $logMessage = sprintf(
            "[%s] API_WARNING: %s | Request ID: %s | Warning: %s",
            date('Y-m-d H:i:s'),
            $apiEndpoint,
            self::$requestId ?? 'unknown',
            $warningMessage
        );
        
        error_log($logMessage);
    }
    
    /**
     * Log database query times
     */
    public static function logQuery($query, $duration, $params = []) {
        $logMessage = sprintf(
            "[%s] DB_QUERY: Duration: %sms | Query: %s | Params: %s",
            date('Y-m-d H:i:s'),
            round($duration * 1000, 2),
            substr($query, 0, 200) . (strlen($query) > 200 ? '...' : ''),
            json_encode($params)
        );
        
        error_log($logMessage);
    }
    
    /**
     * Get current request ID
     */
    public static function getRequestId() {
        return self::$requestId;
    }
}
?>


