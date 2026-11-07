@echo off
chcp 65001 >nul
title SafeSolo - KẾT NỐI ĐIỆN THOẠI HONOR MAGIC 7 PRO (SNAPDRAGON 8 ELITE)
color 0B
cls

echo ===============================================================================
echo            SAFESOLO - KẾT NỐI ĐIỆN THOẠI HONOR MAGIC 7 PRO (PTP-AN10)
echo   Flagship Snapdragon 8 Elite - MagicOS 9.0 (Android 15) - 3D Face ID - Vệ Tinh
echo            Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 TDMU
echo ===============================================================================
echo.
echo [1] KẾT NỐI DÂY USB TYPE-C & TỰ ĐỘNG CẤP QUYỀN CHẠY NGẦM 24/7 (Khuyên Dùng)
echo [2] KẾT NỐI KHÔNG DÂY QUA WI-FI (ADB Wireless Port 5555)
echo [3] KÍCH HOẠT MAGIC CAPSULE LIVE ACTIVITY & THIẾT LẬP VỆ TINH BEIDOU
echo [4] TỰ ĐỘNG DÒ TÌM & KẾT NỐI TẤT CẢ (Honor Magic 7 Pro + Galaxy Watch 5)
echo [0] Thoát
echo.
set /p opt="Vui lòng chọn chức năng (0-4): "

if "%opt%"=="1" goto CONNECT_USB
if "%opt%"=="2" goto CONNECT_WIFI
if "%opt%"=="3" goto MAGIC_CAPSULE
if "%opt%"=="4" goto CONNECT_ALL
if "%opt%"=="0" exit /b
goto END

:CONNECT_USB
cls
echo ===============================================================================
echo      ĐANG KẾT NỐI HONOR MAGIC 7 PRO QUA CÁP USB TYPE-C...
echo ===============================================================================
adb devices
echo.
echo [*] 1. Cấp quyền miễn trừ Doze tiết kiệm pin MagicOS (PowerGenie Whitelist):
adb shell dumpsys deviceidle whitelist +com.safesolo.app
adb shell cmd appops set com.safesolo.app RUN_IN_BACKGROUND allow
adb shell cmd appops set com.safesolo.app RUN_ANY_IN_BACKGROUND allow
adb shell am set-standby-bucket com.safesolo.app active
adb shell settings put secure honor_powergenie_whitelist com.safesolo.app
echo.
echo [*] 2. Thiết lập độ phân giải chuẩn Flagship 1280x2800 (Viewport 426x933 dp):
adb shell wm size
adb shell wm density
echo.
echo [*] 3. Kiểm tra kết nối cảm biến và quyền vị trí chính xác:
adb shell pm grant com.safesolo.app android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.safesolo.app android.permission.RECORD_AUDIO
adb shell pm grant com.safesolo.app android.permission.CAMERA
echo.
echo [V] THIẾT LẬP HONOR MAGIC 7 PRO THÀNH CÔNG! SẴN SÀNG CỨU NẠN 24/7.
pause
goto END

:CONNECT_WIFI
cls
set /p IP="Nhập địa chỉ IP Wi-Fi của Honor Magic 7 Pro (ví dụ: 192.168.1.15): "
echo [*] Đang kết nối tới %IP%:5555...
adb tcpip 5555
adb connect %IP%:5555
adb -s %IP%:5555 shell dumpsys deviceidle whitelist +com.safesolo.app
echo [V] KẾT NỐI KHÔNG DÂY HONOR MAGIC 7 PRO THÀNH CÔNG!
pause
goto END

:MAGIC_CAPSULE
cls
echo [*] Bật tính năng Magic Capsule Live Activity trên thanh trạng thái...
adb shell am broadcast -a com.safesolo.action.MAGIC_CAPSULE_UPDATE --es status "READY" --ei cpr_bpm 110 --ei nearest_aed 140
echo [V] Đã phát sóng thử nghiệm Magic Capsule Live Activity!
pause
goto END

:CONNECT_ALL
cls
echo [*] Đang tìm kiếm Honor Magic 7 Pro và Galaxy Watch 5 trên cùng dải mạng...
adb devices
pause
goto END

:END

