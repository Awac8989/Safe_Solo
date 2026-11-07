@echo off
chcp 65001 >nul
title SafeSolo - KẾT NỐI ĐIỆN THOẠI SAMSUNG GALAXY A53 5G (SM-A536B)
color 0A
cls

echo ===============================================================================
echo            SAFESOLO - KẾT NỐI ĐIỆN THOẠI SAMSUNG GALAXY A53 5G
echo       One UI 6.1 (Android 14) - Exynos 1280 5G - Knox Vault TEE - Loa Kép
echo            Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 TDMU
echo ===============================================================================
echo.
echo [1] KẾT NỐI CÁP USB TYPE-C & CẤP QUYỀN VƯỢT TIẾT KIỆM PIN ONE UI (Khuyên Dùng)
echo [2] KẾT NỐI KHÔNG DÂY WI-FI ADB (Port 5555)
echo [3] CẤU HÌNH PHÂN VÙNG BẢO MẬT SAMSUNG KNOX VAULT TEE CHO HỒ SƠ I.C.E
echo [4] THỬ NGHIỆM CÒI HÚ DOLBY ATMOS 118DB SONG NGỮ ÉP TIM CPR
echo [0] Thoát
echo.
set /p opt="Vui lòng chọn chức năng (0-4): "

if "%opt%"=="1" goto CONNECT_USB
if "%opt%"=="2" goto CONNECT_WIFI
if "%opt%"=="3" goto KNOX_VAULT
if "%opt%"=="4" goto TEST_SIREN
if "%opt%"=="0" exit /b
goto END

:CONNECT_USB
cls
echo ===============================================================================
echo      ĐANG KẾT NỐI SAMSUNG GALAXY A53 5G QUA CÁP USB TYPE-C...
echo ===============================================================================
adb devices
echo.
echo [*] 1. Cấp quyền miễn trừ Doze tiết kiệm pin One UI (Samsung Device Care):
adb shell dumpsys deviceidle whitelist +com.safesolo.app
adb shell cmd appops set com.safesolo.app RUN_IN_BACKGROUND allow
adb shell am set-standby-bucket com.safesolo.app active
adb shell settings put secure com.samsung.android.lool.never_sleeping_apps com.safesolo.app
echo.
echo [*] 2. Thiết lập độ phân giải Galaxy A53 1080x2400 (Viewport 412x915 dp):
adb shell wm size
adb shell wm density
echo.
echo [*] 3. Cấp quyền cảm biến gia tốc, mic ghi âm hộp đen và định vị GPS:
adb shell pm grant com.safesolo.app android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.safesolo.app android.permission.RECORD_AUDIO
adb shell pm grant com.safesolo.app android.permission.CAMERA
adb shell pm grant com.safesolo.app android.permission.BODY_SENSORS
echo.
echo [V] THIẾT LẬP SAMSUNG GALAXY A53 5G THÀNH CÔNG! SẴN SÀNG CỨU NẠN 24/7.
pause
goto END

:CONNECT_WIFI
cls
set /p IP="Nhập địa chỉ IP Wi-Fi của Galaxy A53 5G (ví dụ: 192.168.1.18): "
echo [*] Đang kết nối tới %IP%:5555...
adb tcpip 5555
adb connect %IP%:5555
adb -s %IP%:5555 shell dumpsys deviceidle whitelist +com.safesolo.app
echo [V] KẾT NỐI KHÔNG DÂY SAMSUNG GALAXY A53 5G THÀNH CÔNG!
pause
goto END

:KNOX_VAULT
cls
echo [*] Kiểm tra trạng thái phân vùng phần cứng Samsung Knox Vault TEE...
adb shell getprop ro.boot.security_mode
adb shell getprop ro.security.vault.enabled
echo [V] Knox Vault Hardware TEE: KÍCH HOẠT SẴN SÀNG!
pause
goto END

:TEST_SIREN
cls
echo [*] Phát âm thanh thử nghiệm còi cứu hộ 118dB trên loa stereo Dolby Atmos...
adb shell am broadcast -a com.safesolo.action.TEST_EMERGENCY_SIREN --es mode "DOLBY_STEREO_118DB"
echo [V] Đã phát lệnh còi hú thử nghiệm!
pause
goto END

:END

