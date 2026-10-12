@echo off
chcp 65001 >nul
title [SAFESOLO] HỆ THỐNG VẬN HÀNH 24/7 MIỄN PHÍ QUA CLOUDFLARE TUNNEL
color 0B

echo =========================================================================
echo    HỆ THỐNG VẬN HÀNH SAFESOLO 24/7 MIỄN PHÍ (ZERO COST)
echo =========================================================================
echo.
echo  [*] 1. Kiểm tra MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo      [OK] MongoDB đang chạy sẵn.
) else (
    echo      [!] Khởi động MongoDB...
    start "SafeSolo-MongoDB" /min mongod --dbpath "C:\data\db" 2>nul || start "SafeSolo-MongoDB" /min mongod
)

echo.
echo  [*] 2. Khởi động Backend SafeSolo (Port 4000)...
start "SafeSolo-Backend-247" cmd /k "cd /d c:\Users\Admin\SafeSolo\backend && npm start"

timeout /t 3 >nul

echo.
echo  [*] 3. Khởi động Web Admin (Port 5173)...
start "SafeSolo-WebAdmin" cmd /k "cd /d c:\Users\Admin\SafeSolo\web-admin && npm run dev"

echo.
echo  [*] 4. Kích hoạt Cloudflare HTTPS Tunnel công khai ra toàn thế giới...
echo  -------------------------------------------------------------------------
echo  Đang tạo đường truyền bảo mật HTTPS ^& WSS (miễn phí, không cần mở port)...
echo  -------------------------------------------------------------------------
start "SafeSolo-Cloudflare-Tunnel" cmd /k "c:\Users\Admin\SafeSolo\tools\cloudflared.exe tunnel --url http://127.0.0.1:4000"

echo.
echo =========================================================================
echo  HOÀN TẤT KHỞI ĐỘNG HỆ THỐNG!
echo =========================================================================
echo  - Backend local:      http://127.0.0.1:4000
echo  - Web Admin:          http://localhost:5173
echo  - Cửa sổ Cloudflare:  Sẽ hiển thị link có dạng https://xxxx.trycloudflare.com
echo.
echo  -> Bạn copy link https://xxxx.trycloudflare.com/api dán vào mục:
echo     Cài đặt Máy chủ (Server URL) trên điện thoại SafeSolo là dùng được
echo     24/24 trên 4G/5G bất kỳ đâu trên thế giới!
echo =========================================================================
echo.
pause
