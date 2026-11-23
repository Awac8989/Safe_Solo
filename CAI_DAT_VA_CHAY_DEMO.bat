@echo off
chcp 65001 >nul
echo ==============================================================================
echo   SAFESOLO — CÀI ĐẶT APK MỚI NHẤT & CHẠY DEMO ĐỒNG LOẠT TRÊN 3 THIẾT BỊ
echo   (Samsung Galaxy A53 5G, Samsung Galaxy A71, Samsung Galaxy Watch 5)
echo ==============================================================================
echo.

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set APK="build\app\outputs\flutter-apk\app-debug.apk"

if not exist %APK% (
    echo [!] Chưa tìm thấy file %APK%!
    echo [*] Đang biên dịch APK...
    call flutter build apk --debug
)

echo.
echo [*] Kiểm tra kết nối 3 thiết bị...
%ADB% connect 192.168.1.6:36429
%ADB% connect 192.168.1.7:37071
%ADB% connect 192.168.1.16:34001

echo.
echo ==============================================================================
echo 1. CÀI ĐẶT LÊN SAMSUNG GALAXY A71 (NẠN NHÂN / THIẾT BỊ THAM CHIẾU)
echo ==============================================================================
%ADB% -s 192.168.1.16:34001 install -r -d %APK%
echo [*] Khởi chạy SafeSolo trên Galaxy A71...
%ADB% -s 192.168.1.16:34001 shell am start -n com.example.safesolo/.MainActivity

echo.
echo ==============================================================================
echo 2. CÀI ĐẶT LÊN SAMSUNG GALAXY A53 5G (HIỆP SĨ CỨU HỘ PHTLS)
echo ==============================================================================
%ADB% -s 192.168.1.7:37071 install -r -d %APK%
echo [*] Khởi chạy SafeSolo trên Galaxy A53...
%ADB% -s 192.168.1.7:37071 shell am start -n com.example.safesolo/.MainActivity

echo.
echo ==============================================================================
echo 3. CÀI ĐẶT LÊN SAMSUNG GALAXY WATCH 5 (ĐỒNG HỒ THÔNG MINH WEAR OS)
echo ==============================================================================
%ADB% -s 192.168.1.6:36429 install -r -d %APK%
echo [*] Khởi chạy SafeSolo trên Galaxy Watch 5...
%ADB% -s 192.168.1.6:36429 shell am start -n com.example.safesolo/.MainActivity

echo.
echo ==============================================================================
echo   HOÀN TẤT! TOÀN BỘ 3 MÀN HÌNH ĐÃ KHỞI CHẠY SAFESOLO SẴN SÀNG QUAY DEMO
echo ==============================================================================
pause
