@echo off
setlocal

echo wterm - 起動
echo ================================
echo.

cd /d "%~dp0"

if /I "%~1"=="--build" (
    call build.bat
    if %ERRORLEVEL% neq 0 (
        exit /b 1
    )
)

echo サーバーを起動中（WebView2モード）...
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd -ArgumentList '/c','npm','run','start:webview'"

exit /b 0
