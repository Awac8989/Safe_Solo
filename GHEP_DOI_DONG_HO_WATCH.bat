@echo off
chcp 65001 >nul
title [SAFESOLO] GHÉP ĐÔI ĐỒNG HỒ GALAXY WATCH (SM-R900)
color 0B

echo =========================================================================
echo        SAFESOLO - GHÉP ĐÔI SAMSUNG GALAXY WATCH LẦN ĐẦU
echo =========================================================================
echo.
echo  1. Trên mặt đồng hồ Galaxy Watch, hãy nhấn vào:
echo     "+ Ghép đôi thiết bị mới"
echo.
echo  2. Màn hình đồng hồ sẽ hiện ra:
echo     - Dòng IP & Cổng (VD: 192.168.1.7:41253 - bạn chỉ cần lấy 5 số cuối 41253)
echo     - Mã ghép nối Wi-Fi (gồm 6 chữ số)
echo.
echo =========================================================================
echo.

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% set ADB=adb

set /p PAIR_PORT=">> Nhập 5 SỐ CỔNG GHÉP NỐI (VD: 41253): "
set /p PAIR_CODE=">> Nhập MÃ GHÉP NỐI 6 SỐ: "

if "%PAIR_PORT%"=="" (
    echo [Lỗi] Chưa nhập cổng!
    pause
    exit /b
)

if "%PAIR_CODE%"=="" (
    echo [Lỗi] Chưa nhập mã ghép nối!
    pause
    exit /b
)

echo.
echo [*] Đang ghép nối ADB với Galaxy Watch (192.168.1.7:%PAIR_PORT%)...
%ADB% pair 192.168.1.7:%PAIR_PORT% %PAIR_CODE%

echo.
echo [*] Đang kết nối ADB không dây...
%ADB% connect 192.168.1.7:38235
%ADB% connect 192.168.1.7:%PAIR_PORT%

echo.
echo [*] Đang ghim cố định cổng 5555 cho đồng hồ...
%ADB% -s 192.168.1.7:38235 tcpip 5555 2>nul
timeout /t 2 >nul
%ADB% connect 192.168.1.7:5555

echo.
echo =========================================================================
echo  DANH SÁCH THIẾT BỊ ĐÃ KẾT NỐI:
echo =========================================================================
%ADB% devices -l
echo.
echo Bạn có thể đóng cửa sổ này!
pause
