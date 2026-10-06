@echo off
chcp 65001 >nul
title SafeSolo - Tự Động Kết Nối & Ghi Nhớ Thiết Bị
color 0A

echo ===============================================================================
echo     SAFESOLO - TỰ ĐỘNG DÒ TÌM, KẾT NỐI & GHI NHỚ THIẾT BỊ (A71 & SM-R900)
echo ===============================================================================
echo.
echo [1] Tự động dò tìm cổng & kết nối tất cả thiết bị (Điện thoại + Đồng hồ)
echo [2] Ghép đôi thiết bị mới (Pairing đồng hồ Galaxy Watch bằng mã 6 số)
echo [3] Bật chế độ chạy ngầm (Khi bạn bật Wi-Fi debugging trên máy là tự kết nối)
echo [4] Kiểm tra danh sách thiết bị hiện tại (adb devices)
echo.

set /p CHOICE=">> Chọn chức năng [1-4] (Mặc định nhấn Enter để chạy [1]): "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    echo.
    python "%~dp0scripts\adb_auto_connect.py"
)
if "%CHOICE%"=="2" (
    echo.
    python "%~dp0scripts\adb_auto_connect.py" --pair
)
if "%CHOICE%"=="3" (
    echo.
    python "%~dp0scripts\adb_auto_connect.py" --watch
)
if "%CHOICE%"=="4" (
    echo.
    set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    if not exist %ADB% set ADB=adb
    %ADB% devices -l
)

echo.
echo ===============================================================================
pause
