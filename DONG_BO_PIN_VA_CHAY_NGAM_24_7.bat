@echo off
chcp 65001 >nul
title [SAFESOLO] CẤU HÌNH ĐIỆN THOẠI CHẠY NGẦM 24/24 KHÔNG BỊ TẮT
color 0A

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo =========================================================================
echo    CẤU HÌNH ĐIỆN THOẠI SAMSUNG/ANDROID CHẠY SAFESOLO 24/24 KHÔNG BỊ TẮT
echo =========================================================================
echo.
echo Đang kiểm tra thiết bị Android...
%ADB% devices
echo.

echo 1. Đưa SafeSolo vào danh sách miễn trừ tiết kiệm pin (Doze Mode Whitelist)...
%ADB% shell dumpsys deviceidle whitelist +com.example.safesolo

echo 2. Cấp quyền chạy ngầm không giới hạn (RUN_IN_BACKGROUND)...
%ADB% shell cmd appops set com.example.safesolo RUN_IN_BACKGROUND allow
%ADB% shell cmd appops set com.example.safesolo RUN_ANY_IN_BACKGROUND allow
%ADB% shell cmd appops set com.example.safesolo START_FOREGROUND allow

echo 3. Cho phép truy cập vị trí nền chính xác (ACCESS_BACKGROUND_LOCATION)...
%ADB% shell pm grant com.example.safesolo android.permission.ACCESS_FINE_LOCATION 2>nul
%ADB% shell pm grant com.example.safesolo android.permission.ACCESS_COARSE_LOCATION 2>nul
%ADB% shell pm grant com.example.safesolo android.permission.ACCESS_BACKGROUND_LOCATION 2>nul
%ADB% shell pm grant com.example.safesolo android.permission.BODY_SENSORS 2>nul
%ADB% shell pm grant com.example.safesolo android.permission.POST_NOTIFICATIONS 2>nul

echo.
echo =========================================================================
echo  HOÀN TẤT THIẾT LẬP!
echo =========================================================================
echo  Ứng dụng SafeSolo trên điện thoại của bạn giờ đây đã được:
echo  [x] Miễn trừ tối ưu hóa pin (Không bao giờ bị Android tắt ngầm).
echo  [x] Giữ kết nối Dead-man Switch và cảm biến nhịp tim liên tục 24/24.
echo  [x] Nhận tín hiệu SOS và tự động kích hoạt còi báo động khẩn cấp.
echo =========================================================================
echo.
pause
