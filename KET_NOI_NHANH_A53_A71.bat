@echo off
chcp 65001 >nul
echo ==============================================================================
echo   SAFESOLO — TỰ ĐỘNG KẾT NỐI KHÔNG DÂY SAMSUNG A53 & SAMSUNG A71
echo ==============================================================================
echo.

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo [*] Đang kết nối Samsung Galaxy A53 5G (192.168.1.7:37071)...
%ADB% connect 192.168.1.7:37071

echo [*] Đang kết nối Samsung Galaxy A71 (192.168.1.16:34001)...
%ADB% connect 192.168.1.16:34001

echo.
echo ==============================================================================
echo   DANH SÁCH THIẾT BỊ ĐÃ KẾT NỐI
echo ==============================================================================
%ADB% devices -l
echo.
pause
