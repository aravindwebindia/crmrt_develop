<?php
/**
 * Simplified Configuration Loader
 * Only loads what's actually needed from unified-config.json
 */
class CommonConfig {
    private static $config = null;
    
    /**
     * Load configuration from unified-config.json
     */
    private static function getConfig() {
        if (self::$config === null) {
            $configPath = __DIR__ . '/../../unified-config.json';
            
            if (!file_exists($configPath)) {
                throw new Exception('Configuration file not found: ' . $configPath);
            }
            
            $configContent = file_get_contents($configPath);
            self::$config = json_decode($configContent, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON in config file: ' . json_last_error_msg());
            }
        }
        
        return self::$config;
    }
    
    /**
     * Get configuration value by key path
     */
    private static function get($key, $default = null) {
        $config = self::getConfig();
        $keys = explode('.', $key);
        $value = $config;
        
        foreach ($keys as $k) {
            if (isset($value[$k])) {
                $value = $value[$k];
            } else {
                return $default;
            }
        }
        
        return $value;
    }
    
    /**
     * Get database configuration (USED BY ALL APIs)
     */
    public static function getDatabaseConfig() {
        return [
            'host' => self::get('database.host', 'localhost'),
            'name' => self::get('database.name', 'crmrt_live'),
            'username' => self::get('database.username', 'root'),
            'password' => self::get('database.password', '')
        ];
    }
    
    /**
     * Get CORS configuration (USED BY cors.php)
     */
    public static function getCorsConfig() {
        return self::get('cors.allowed_origins', ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']);
    }
    
    /**
     * Get SMTP configuration (USED BY email.php)
     */
    public static function getSmtpConfig() {
        return [
            'smtp_host' => self::get('smtp.host', 'smtp.gmail.com'),
            'smtp_port' => self::get('smtp.port', 587),
            'smtp_username' => self::get('smtp.username', ''),
            'smtp_password' => self::get('smtp.password', ''),
            'smtp_encryption' => self::get('smtp.encryption', 'tls'),
            'from_email' => self::get('smtp.from_email', ''),
            'from_name' => self::get('smtp.from_name', '')
        ];
    }
    
    /**
     * Get backend URL (USED BY email.php)
     */
    public static function getBackendUrl() {
        return self::get('server.backend_url', 'http://localhost/crmrt_live2/backend');
    }
}
?>
