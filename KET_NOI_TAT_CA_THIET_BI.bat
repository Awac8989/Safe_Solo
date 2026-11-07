@echo off
chcp 65001 >nul
title [SAFESOLO] HỆ THỐNG KẾT NỐI ĐA THIẾT BỊ PHẦN CỨNG 4 NỀN TẢNG
color 0B
cls

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% set ADB=adb

echo ===============================================================================
echo     SAFESOLO — HỆ THỐNG ĐIỀU PHỐI & KẾT NỐI ĐA THIẾT BỊ PHẦN CỨNG THẬT
echo  1. Honor Magic 7 Pro (MagicOS 9 / Snapdragon 8 Elite / Magic Capsule)
echo  2. Samsung Galaxy A53 5G (One UI 6 / Exynos 1280 / Knox Vault TEE)
echo  3. Samsung Galaxy A71 (One UI 5 / Snapdragon 730 / Máy chuẩn tham chiếu)
echo  4. Samsung Galaxy Watch 5 SM-R900 (Wear OS 4 / BioActive Sensor)
echo  Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 TDMU
echo ===============================================================================
echo.
echo [1] KẾT NỐI NHANH TẤT CẢ THIẾT BỊ ĐANG CẮM DÂY HOẶC TRÊN CÙNG MẠNG WI-FI
echo [2] KẾT NỐI ĐIỆN THOẠI HONOR MAGIC 7 PRO
echo [3] KẾT NỐI ĐIỆN THOẠI SAMSUNG GALAXY A53 5G
echo [4] KẾT NỐI ĐIỆN THOẠI SAMSUNG GALAXY A71
echo [5] KẾT NỐI ĐỒNG HỒ SAMSUNG GALAXY WATCH 5 (SM-R900)
echo [6] THIẾT LẬP REVERSE PORT 5000 & 5173 CHO TOÀN BỘ HỆ SINH THÁI
echo [0] Thoát
echo.
set /p opt="Vui lòng chọn chức năng (0-6): "

if "%opt%"=="1" goto CONNECT_ALL
if "%opt%"=="2" (
    call KET_NOI_HONOR_MAGIC_7_PRO.bat
    goto END
)
if "%opt%"=="3" (
    call KET_NOI_SAMSUNG_A53.bat
    goto END
)
if "%opt%"=="4" (
    call KET_NOI_DIEN_THOAI_A71.bat
    goto END
)
if "%opt%"=="5" (
    call GHEP_DOI_DONG_HO_WATCH.bat
    goto END
)
if "%opt%"=="6" goto REVERSE_PORTS
if "%opt%"=="0" exit /b
goto END

:CONNECT_ALL
cls
echo [*] Đang dò tìm và kích hoạt toàn bộ thiết bị SafeSolo...
%ADB% devices -l
echo.
echo [*] Cấu hình miễn trừ tiết kiệm pin cho tất cả thiết bị Android kết nối:
for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r /c:"[0-9a-zA-Z].*device$"') do (
    echo   -> Đang thiết lập cho thiết bị %%d...
    %ADB% -s %%d shell dumpsys deviceidle whitelist +com.safesolo.app >nul 2>nul
    %ADB% -s %%d shell am set-standby-bucket com.safesolo.app active >nul 2>nul
    %ADB% -s %%d reverse tcp:5000 tcp:5000 >nul 2>nul
    %ADB% -s %%d reverse tcp:5173 tcp:5173 >nul 2>nul
)
echo.
echo ===============================================================================
echo  DANH SÁCH THIẾT BỊ HOẠT ĐỘNG SẴN SÀNG TRONG HỆ SINH THÁI SAFESOLO:
echo ===============================================================================
%ADB% devices -l
echo.
pause
goto END

:REVERSE_PORTS
cls
echo [*] Đang cấu hình chuyển tiếp Reverse Port (Backend 5000, Web TOC 5173)...
for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r /c:"[0-9a-zA-Z].*device$"') do (
    %ADB% -s %%d reverse tcp:5000 tcp:5000
    %ADB% -s %%d reverse tcp:5173 tcp:5173
    echo   [OK] Đã mở cổng cho thiết bị %%d
)
echo [V] Đã thiết lập Reverse Port thành công!
pause
goto END

:END
