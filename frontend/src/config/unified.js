/**
 * Unified Configuration Loader for Frontend
 * Single source of truth for all application settings
 */

class UnifiedConfig {
  static config = null;

  static async load() {
    if (this.config === null) {
      try {
        const response = await fetch('/frontend-config.json');
        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }
        this.config = await response.json();
      } catch (error) {
        // Fallback to default config
        this.config = {
          environment: 'development',
          server: {
            frontend_url: 'http://localhost:3000',
            backend_url: 'http://localhost/crmrt_live2/backend',
            api_base_url: 'http://localhost/crmrt_live2/backend/api'
          }
        };
      }
    }
    return this.config;
  }

  static async get(key, defaultValue = null) {
    const config = await this.load();
    const keys = key.split('.');
    let value = config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  // Convenience methods
  static async getEnvironment() {
    return await this.get('environment', 'development');
  }

  static async getFrontendUrl() {
    return await this.get('server.frontend_url', 'http://localhost:3000');
  }

  static async getBackendUrl() {
    return await this.get('server.backend_url', 'http://localhost/crmrt_live2/backend');
  }

  static async getApiBaseUrl() {
    return await this.get('server.api_base_url', 'http://localhost/crmrt_live2/backend/api');
  }

  static async getAssetBaseUrl() {
    return await this.get('server.frontend_url', 'http://localhost/crmrt_live2');
  }

  static async isProduction() {
    return (await this.getEnvironment()) === 'production';
  }
}

export default UnifiedConfig;
