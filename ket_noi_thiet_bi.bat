@echo off
chcp 65001 >nul
title KẾT NỐI ADB ĐIỆN THOẠI & ĐỒNG HỒ GALAXY WATCH - SAFESOLO
color 0A

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

:MENU
cls
echo =========================================================================
echo    CÔNG CỤ KẾT NỐI TỰ ĐỘNG THIẾT BỊ ANDROID ^& GALAXY WATCH (SAFESOLO)
echo =========================================================================
echo.
echo [1] KẾT NỐI QUA DÂY CÁP USB (KHUYÊN DÙNG - CẮM LÀ TỰ ĐỘNG NHẬN, BẤT KỂ WIFI NÀO)
echo [2] Kết nối Điện thoại qua Wi-Fi (IP: 192.168.1.8)
echo [3] Kết nối Đồng hồ Galaxy Watch qua Wi-Fi (IP: 192.168.1.9)
echo [4] Cố định cổng Wi-Fi 5555 (Cắm cáp 1 lần rồi rút ra dùng Wi-Fi không đổi port)
echo [5] Kiểm tra danh sách thiết bị đang kết nối (adb devices)
echo [6] Khởi động lại trình dịch ADB (adb kill-server)
echo [0] Thoát
echo.
set /p opt="Chọn thao tác [1-6, 0]: "

if "%opt%"=="1" goto CONNECT_USB
if "%opt%"=="2" goto CONNECT_PHONE_WIFI
if "%opt%"=="3" goto CONNECT_WATCH_WIFI
if "%opt%"=="4" goto SETUP_TCPIP_5555
if "%opt%"=="5" goto CHECK_DEVICES
if "%opt%"=="6" goto RESTART_ADB
if "%opt%"=="0" exit
goto MENU

:CONNECT_USB
cls
echo [HƯỚNG DẪN KẾT NỐI QUA DÂY CÁP USB - CẮM LÀ TỰ ĐỘNG NHẬN]:
echo 1. Trên điện thoại, vào Cài đặt -> Tùy chọn nhà phát triển.
echo 2. Bật công tắc "Gỡ lỗi USB" (USB Debugging).
echo 3. Cắm sợi dây cáp USB vào máy tính.
echo 4. Trên màn hình điện thoại hiện bảng hỏi:
echo    "Cho phép gỡ lỗi USB từ máy tính này?"
echo    -> TÍCH CHỌN: "Luôn cho phép từ máy tính này" -> Bấm CHO PHÉP.
echo.
echo Đang kiểm tra thiết bị qua USB...
%ADB% devices
echo.
pause
goto MENU

:CONNECT_PHONE_WIFI
cls
echo [KẾT NỐI ĐIỆN THOẠI QUA WI-FI]:
set /p phone_port="Nhập số cổng Port trên màn hình điện thoại (VD: 41647): "
if "%phone_port%"=="" set phone_port=41647
echo Đang kết nối tới 192.168.1.8:%phone_port% ...
%ADB% connect 192.168.1.8:%phone_port%
echo.
%ADB% devices
echo.
pause
goto MENU

:CONNECT_WATCH_WIFI
cls
echo [KẾT NỐI ĐỒNG HỒ GALAXY WATCH QUA WI-FI]:
echo Lưu ý: Chạm sáng màn hình đồng hồ để không bị ngủ Wi-Fi.
set /p watch_port="Nhập số cổng Port trên đồng hồ (VD: 42753): "
if "%watch_port%"=="" set watch_port=42753
echo Đang kết nối tới 192.168.1.9:%watch_port% ...
%ADB% connect 192.168.1.9:%watch_port%
echo.
%ADB% devices
echo.
pause
goto MENU

:SETUP_TCPIP_5555
cls
echo [CỐ ĐỊNH CỔNG 5555 ĐỂ KHÔNG BỊ ĐỔI PORT WI-FI]:
echo 1. Hãy cắm dây cáp USB điện thoại vào máy tính trước.
echo 2. Nhấn Enter để chuyển ADB sang chế độ Wi-Fi cố định cổng 5555.
pause
%ADB% tcpip 5555
echo.
echo -> Đã kích hoạt cổng cố định 5555!
echo Bây giờ bạn có thể rút dây cáp ra.
set /p phone_ip="Nhập IP điện thoại (mặc định 192.168.1.8): "
if "%phone_ip%"=="" set phone_ip=192.168.1.8
%ADB% connect %phone_ip%:5555
echo.
%ADB% devices
echo.
pause
goto MENU

:CHECK_DEVICES
cls
echo [DANH SÁCH THIẾT BỊ ĐANG KẾT NỐI]:
%ADB% devices -l
echo.
pause
goto MENU

:RESTART_ADB
cls
echo Đang khởi động lại ADB daemon...
%ADB% kill-server
%ADB% start-server
echo Hoàn tất!
echo.
pause
goto MENU
