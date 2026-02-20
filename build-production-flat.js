const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FlatProductionBuilder {
  constructor() {
    this.productionDir = path.join(__dirname, 'production');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'unified-config.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('❌ Failed to load config:', error.message);
      process.exit(1);
    }
  }

  build() {
    console.log('🚀 Building flat production structure...');
    console.log(`📋 Environment: ${this.config.environment}`);
    console.log(`🌐 Frontend URL: ${this.config.server.frontend_url}`);
    console.log(`🔧 Backend URL: ${this.config.server.backend_url}`);
    console.log(`📡 API URL: ${this.config.server.api_base_url}`);
    
    this.createProductionDirectory();
    this.buildFrontend();
    this.copyBackendFiles();
    this.copyFrontendFilesToRoot();
    this.updateProductionConfigs();
    this.createDeploymentInstructions();
    
    console.log('✅ Flat production build completed successfully!');
    console.log(`📦 Production files ready in: ${this.productionDir}`);
  }

  createProductionDirectory() {
    // Remove existing production directory
    if (fs.existsSync(this.productionDir)) {
      fs.rmSync(this.productionDir, { recursive: true });
    }
    
    // Create production directory structure
    fs.mkdirSync(this.productionDir, { recursive: true });
    fs.mkdirSync(path.join(this.productionDir, 'backend'), { recursive: true });
  }

  buildFrontend() {
    console.log('🏗️ Building frontend for production...');
    
    try {
      // Change to frontend directory and build
      process.chdir(path.join(__dirname, 'frontend'));
      execSync('npm run build', { stdio: 'inherit' });
      
      console.log('✅ Frontend build completed');
    } catch (error) {
      console.error('❌ Frontend build failed:', error.message);
      process.exit(1);
    } finally {
      // Change back to root directory
      process.chdir(__dirname);
    }
  }

  copyBackendFiles() {
    console.log('📁 Copying backend files...');
    
    const backendSource = path.join(__dirname, 'backend');
    const backendDest = path.join(this.productionDir, 'backend');
    
    // Copy all backend files except development-specific ones
    this.copyDirectory(backendSource, backendDest, [
      'node_modules',
      '.git',
      '*.log',
      '*.tmp',
      'test',
      'tests',
      '*.test.php',
      '*.spec.php'
    ]);
    
    console.log('✅ Backend files copied to production/backend');
  }

  copyFrontendFilesToRoot() {
    console.log('📁 Copying frontend files to production root...');
    
    const buildDir = path.join(__dirname, 'frontend', 'build');
    
    if (!fs.existsSync(buildDir)) {
      console.error('❌ Frontend build directory not found');
      process.exit(1);
    }
    
    // Copy all files from build directory to production root
    this.copyDirectory(buildDir, this.productionDir, []);
    
    console.log('✅ Frontend files copied to production root');
  }

  updateProductionConfigs() {
    console.log('🔧 Updating production configurations...');
    
    // Update CORS configuration for production
    const corsContent = `<?php
require_once __DIR__ . '/common.php';

$allowedOrigins = CommonConfig::getCorsConfig();

header('Access-Control-Allow-Origin: ' . $allowedOrigins);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>`;

    fs.writeFileSync(path.join(this.productionDir, 'backend', 'config', 'cors.php'), corsContent);
    
    // Create production-specific config
    const productionConfig = {
      environment: 'production',
      app: this.config.app,
      server: this.config.server,
      database: this.config.database,
      smtp: this.config.smtp
    };
    
    fs.writeFileSync(
      path.join(this.productionDir, 'backend', 'config', 'production-config.json'),
      JSON.stringify(productionConfig, null, 2)
    );
    
    console.log('✅ Production configurations updated');
  }

  createDeploymentInstructions() {
    console.log('📋 Creating deployment instructions...');
    
    const instructions = `# Production Deployment Instructions

## Environment Configuration
- **Environment**: ${this.config.environment}
- **Frontend URL**: ${this.config.server.frontend_url}
- **Backend URL**: ${this.config.server.backend_url}
- **API URL**: ${this.config.server.api_base_url}

## File Structure
\`\`\`
production/
├── index.html              # Main React application
├── static/                 # Static assets (CSS, JS, images)
├── asset-manifest.json     # Asset manifest
├── manifest.json           # PWA manifest
├── logo.svg               # Application logo
├── backend/               # PHP backend API
│   ├── api/              # API endpoints
│   ├── config/           # Configuration files
│   ├── models/           # Database models
│   └── uploads/          # File uploads
└── database/             # Database files
    ├── schema.sql        # Database schema
    ├── full_database.sql # Complete database
    └── setup scripts     # Database setup
\`\`\`

## Deployment Steps

### 1. Database Setup
1. Create database: ${this.config.database.name}
2. Import database schema from database/ folder
3. Update database credentials in backend/config/production-config.json

### 2. Web Server Configuration
1. Point web server document root to this directory
2. Configure API routing to backend/api/
3. Configure static file serving for static/ folder

### 3. File Permissions
\`\`\`bash
chmod -R 755 .
chmod -R 777 backend/uploads
chmod -R 777 backend/logs
\`\`\`

### 4. Environment Variables
Update the following in backend/config/production-config.json:
- Database credentials
- SMTP settings
- JWT secret key
- Application URLs

### 5. SSL Certificate (Recommended)
- Install SSL certificate for HTTPS
- Update URLs in production-config.json to use HTTPS

### 6. Security Checklist
- [ ] Remove development files
- [ ] Set proper file permissions
- [ ] Configure firewall rules
- [ ] Enable error logging
- [ ] Set up backup procedures
- [ ] Configure monitoring

## Support
For technical support, contact the development team.

Generated on: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(this.productionDir, 'README.md'), instructions);
    
    console.log('✅ Deployment instructions created');
  }

  copyDirectory(src, dest, exclude = []) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      // Skip excluded items
      if (exclude.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(item);
        }
        return item === pattern;
      })) {
        continue;
      }
      
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath, exclude);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Main execution
if (require.main === module) {
  const builder = new FlatProductionBuilder();
  builder.build();
}

module.exports = FlatProductionBuilder;


