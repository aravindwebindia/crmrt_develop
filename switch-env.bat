@echo off
echo 🎯 Configuration Manager for Windows
echo.

if "%1"=="" (
    echo Usage: switch-env.bat [development^|production]
    echo.
    echo Examples:
    echo   switch-env.bat development
    echo   switch-env.bat production
    echo.
    goto :end
)

if "%1"=="development" (
    echo ✅ Switching to Development Environment...
    node config-manager.js switch development
    echo.
    echo 🚀 Development URLs:
    echo   Frontend: http://localhost:3000
    echo   Backend:  http://localhost/crmrt_live2/backend
    echo   API:      http://localhost/crmrt_live2/backend/api
) else if "%1"=="production" (
    echo ✅ Switching to Production Environment...
    node config-manager.js switch production
    echo.
    echo 🚀 Production URLs:
    echo   Frontend: http://13.235.254.118:81
    echo   Backend:  http://13.235.254.118:81/backend
    echo   API:      http://13.235.254.118:81/backend/api
) else (
    echo ❌ Invalid environment: %1
    echo.
    echo Available environments:
    echo   development
    echo   production
)

:end
pause
