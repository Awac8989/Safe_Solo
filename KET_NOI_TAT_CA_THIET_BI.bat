@echo off
chcp 65001 >nul
echo ==============================================================================
echo   SAFESOLO — TỰ ĐỘNG KẾT NỐI KHÔNG DÂY TOÀN BỘ 3 THIẾT BỊ PHẦN CỨNG THẬT
echo   (Samsung Galaxy A53 5G, Samsung Galaxy A71 & Samsung Galaxy Watch 5)
echo ==============================================================================
echo.

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo [*] Đang kết nối Samsung Galaxy Watch 5 (192.168.1.6:36429)...
%ADB% connect 192.168.1.6:36429

echo [*] Đang kết nối Samsung Galaxy A53 5G (192.168.1.7:37071)...
%ADB% connect 192.168.1.7:37071

echo [*] Đang kết nối Samsung Galaxy A71 (192.168.1.16:34001)...
%ADB% connect 192.168.1.16:34001

echo.
echo ==============================================================================
echo   DANH SÁCH TOÀN BỘ THIẾT BỊ SAFESOLO ĐANG HOẠT ĐỘNG
echo ==============================================================================
%ADB% devices -l
echo.
echo [*] Đang thiết lập ADB Reverse Port 4000 (Backend SafeSolo) cho mọi thiết bị...
for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r /c:"[0-9a-zA-Z.:].*device$"') do (
    echo   -^> Reverse tcp:4000 cho %%d
    %ADB% -s %%d reverse tcp:4000 tcp:4000
)
echo.
pause
