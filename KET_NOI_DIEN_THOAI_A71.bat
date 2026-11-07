@echo off
chcp 65001 >nul
title SafeSolo - KẾT NỐI ĐIỆN THOẠI SAMSUNG A71
color 0A

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% set ADB=adb

:MENU
cls
echo ===============================================================================
echo            SAFESOLO - KẾT NỐI ĐIỆN THOẠI SAMSUNG A71 (192.168.1.7)
echo ===============================================================================
echo.
echo [1] GHÉP NỐI BẰNG MÃ 6 SỐ (KHUYÊN DÙNG LẦN ĐẦU KHI DÙNG WI-FI)
echo     - Chạm vào dòng "Ghép nối thiết bị bằng mã ghép nối" trên điện thoại
echo     - Nhập số Cổng ghép nối và Mã 6 số để ghép đôi vĩnh viễn
echo.
echo [2] KẾT NỐI NHANH WI-FI (Khi máy tính đã nằm trong mục 'Thiết bị đã ghép nối')
echo     - Nhập cổng hiển thị ở "Địa chỉ IP và cổng" (Hiện tại: 40817)
echo.
echo [3] KẾT NỐI BẰNG DÂY CÁP USB (CỰC NHANH - 100%% THÀNH CÔNG)
echo     - Cắm cáp USB vào máy tính, bấm Cho phép trên màn hình điện thoại
echo.
echo [4] TỰ ĐỘNG DÒ TÌM & KẾT NỐI TẤT CẢ (Điện thoại A71 + Đồng hồ Galaxy Watch)
echo.
echo [5] Kiểm tra danh sách thiết bị đang kết nối (adb devices)
echo.
echo [0] Thoát
echo ===============================================================================
set /p opt=">> Chọn chức năng [1-5]: "

if "%opt%"=="1" goto PAIR_WIFI
if "%opt%"=="2" goto CONNECT_WIFI
if "%opt%"=="3" goto USB_CONNECT
if "%opt%"=="4" goto AUTO_PYTHON
if "%opt%"=="5" goto CHECK_DEV
if "%opt%"=="0" exit
goto MENU

:PAIR_WIFI
cls
echo ===============================================================================
echo          HƯỚNG DẪN GHÉP NỐI ĐIỆN THOẠI A71 BẰNG MÃ 6 SỐ
echo ===============================================================================
echo 1. Trên điện thoại, trong màn hình "Gỡ lỗi qua Wi-Fi":
echo    Bấm vào: [Ghép nối thiết bị bằng mã ghép nối]
echo.
echo 2. Hộp thoại hiện lên trên điện thoại:
echo    - "Địa chỉ IP và cổng": 192.168.1.7:XXXXX  (XXXXX là 5 số CỔNG GHÉP NỐI)
echo    - "Mã ghép nối Wi-Fi": XXXXXX (gồm 6 chữ số)
echo -------------------------------------------------------------------------------
echo.
set /p PAIR_PORT=">> Nhập số CỔNG GHÉP NỐI (5 số cuối sau dấu hai chấm, VD 39481): "
if "%PAIR_PORT%"=="" (
    echo [!] Chưa nhập cổng. Hủy thao tác.
    pause
    goto MENU
)
set /p PAIR_CODE=">> Nhập MÃ GHÉP NỐI (6 chữ số trên điện thoại): "
if "%PAIR_CODE%"=="" (
    echo [!] Chưa nhập mã ghép nối. Hủy thao tác.
    pause
    goto MENU
)
echo.
echo [*] Đang gửi mã ghép nối tới 192.168.1.7:%PAIR_PORT%...
%ADB% pair 192.168.1.7:%PAIR_PORT% %PAIR_CODE%
echo.
echo [*] Ghép nối hoàn tất! Bây giờ kết nối vào cổng chính của điện thoại...
set /p MAIN_PORT=">> Nhập số cổng chính ở dòng 'Địa chỉ IP và cổng' (Mặc định: 40817): "
if "%MAIN_PORT%"=="" set MAIN_PORT=40817
%ADB% connect 192.168.1.7:%MAIN_PORT%
%ADB% reverse tcp:4000 tcp:4000
echo.
echo [*] Danh sách thiết bị kết nối hiện tại:
%ADB% devices -l
echo.
pause
goto MENU

:CONNECT_WIFI
cls
echo ===============================================================================
echo                     KẾT NỐI NHANH QUA WI-FI
echo ===============================================================================
set /p MAIN_PORT=">> Nhập số cổng ở dòng 'Địa chỉ IP và cổng' (Mặc định: 40817): "
if "%MAIN_PORT%"=="" set MAIN_PORT=40817
echo [*] Đang kết nối tới 192.168.1.7:%MAIN_PORT%...
%ADB% connect 192.168.1.7:%MAIN_PORT%
%ADB% reverse tcp:4000 tcp:4000
echo.
echo [*] Danh sách thiết bị:
%ADB% devices -l
echo.
pause
goto MENU

:USB_CONNECT
cls
echo ===============================================================================
echo                     KẾT NỐI QUA DÂY CÁP USB
echo ===============================================================================
echo 1. Cắm dây cáp Type-C từ máy tính vào điện thoại Samsung A71.
echo 2. Bật "Gỡ lỗi USB" (USB debugging) trong Tùy chọn nhà phát triển.
echo 3. Trên điện thoại, chọn "Luôn cho phép từ máy tính này" -> Bấm Cho phép.
echo.
pause
%ADB% devices -l
echo [*] Cấu hình cố định cổng Wi-Fi 5555...
%ADB% tcpip 5555
%ADB% reverse tcp:4000 tcp:4000
echo.
echo [+] Thành công! Bây giờ bạn có thể rút dây cáp ra và dùng không dây:
echo     Máy tính sẽ tự động kết nối qua: 192.168.1.7:5555
echo.
%ADB% connect 192.168.1.7:5555
%ADB% devices -l
echo.
pause
goto MENU

:AUTO_PYTHON
cls
python "%~dp0scripts\adb_auto_connect.py"
pause
goto MENU

:CHECK_DEV
cls
echo [*] Danh sách thiết bị hiện tại:
%ADB% devices -l
echo.
pause
goto MENU
