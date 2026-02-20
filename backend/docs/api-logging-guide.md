# API Logging Guide

## Overview
The API logging system tracks call times, errors, and database queries for all API endpoints.

## Files Added
- `backend/config/logger.php` - Core logging functionality
- `backend/config/api-wrapper.php` - Easy-to-use wrapper class
- `backend/api/example-logged-api.php` - Example implementation

## How to Use

### Method 1: Using ApiWrapper (Recommended)

```php
<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/api-wrapper.php';

// Initialize API wrapper for logging
$apiWrapper = new ApiWrapper('your-api-endpoint.php');

try {
    // Your API logic here
    
    // Log database queries
    $queryStart = microtime(true);
    // Execute your query
    $queryDuration = microtime(true) - $queryStart;
    $apiWrapper->logQuery("SELECT * FROM table", $queryDuration, $params);
    
    // Your response
    echo json_encode($response);
    
} catch (Exception $e) {
    $apiWrapper->logError($e->getMessage(), $e->getCode());
    // Handle error
}

// ApiWrapper destructor automatically logs end time
?>
```

### Method 2: Direct Logger Usage

```php
<?php
require_once __DIR__ . '/../config/logger.php';

// Start logging
ApiLogger::startRequest('your-api-endpoint.php');

try {
    // Your API logic
    
    // Log queries
    $start = microtime(true);
    // Execute query
    $duration = microtime(true) - $start;
    ApiLogger::logQuery("SELECT * FROM table", $duration, $params);
    
    // End logging
    ApiLogger::endRequest('your-api-endpoint.php', 'SUCCESS');
    
} catch (Exception $e) {
    ApiLogger::logError('your-api-endpoint.php', $e->getMessage(), $e->getCode());
    ApiLogger::endRequest('your-api-endpoint.php', 'ERROR');
}
?>
```

## Log Output Examples

### API Call Logs
```
[2025-01-05 18:35:23] API_START: contacts.php | Request ID: req_65a1b2c3d4e5f | Time: 2025-01-05 18:35:23.123456
[2025-01-05 18:35:23] API_END: contacts.php | Request ID: req_65a1b2c3d4e5f | Duration: 245.67ms | Status: SUCCESS
```

### Database Query Logs
```
[2025-01-05 18:35:23] DB_QUERY: Duration: 12.34ms | Query: SELECT * FROM contacts WHERE status = 'active' | Params: {"status":"active"}
```

### Error Logs
```
[2025-01-05 18:35:23] API_ERROR: contacts.php | Request ID: req_65a1b2c3d4e5f | Error: Database connection failed | Code: 500
```

## Benefits
- **Performance Monitoring**: Track API response times
- **Error Tracking**: Log all API errors with context
- **Database Performance**: Monitor query execution times
- **Request Tracing**: Each request gets a unique ID for tracking
- **Production Ready**: All logs go to PHP error_log

## Integration Steps
1. Add `require_once __DIR__ . '/../config/api-wrapper.php';` to your API files
2. Create `$apiWrapper = new ApiWrapper('your-api-name.php');` at the start
3. Add `$apiWrapper->logQuery()` calls for database operations
4. Add `$apiWrapper->logError()` calls in catch blocks
5. The wrapper automatically handles start/end timing


