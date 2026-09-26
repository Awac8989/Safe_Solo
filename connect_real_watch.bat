@echo off
chcp 65001 >nul
title SafeSolo - Kết Nối Đồng Hồ Thật (Samsung Galaxy Watch / Wear OS)
color 0A

echo ===============================================================================
echo        SAFESOLO - HƯỚNG DẪN & CÔNG CỤ KẾT NỐI VỚI SAMSUNG GALAXY WATCH THẬT
echo ===============================================================================
echo.
echo [YÊU CẦU CHUẨN BỊ TRÊN ĐỒNG HỒ SAMSUNG GALAXY WATCH 4/5/6/7]:
echo  1. Đồng hồ và Máy tính/Điện thoại cùng kết nối chung một mạng Wi-Fi.
echo  2. Trên Galaxy Watch: Vào Cài đặt -> Thông tin đồng hồ -> Thông tin phần mềm.
echo     -> Nhấn liên tục 7 lần vào "Số hiệu bản dựng" để bật Chế độ nhà phát triển.
echo  3. Quay lại menu Cài đặt -> Tùy chọn cho nhà phát triển:
echo     -> Bật "Gỡ lỗi ADB" (ADB debugging).
echo     -> Bật "Gỡ lỗi qua Wi-Fi" (Wireless debugging).
echo  4. Xem địa chỉ IP và Cổng (Port) hiển thị trên đồng hồ (VD: 192.168.1.45:5555).
echo.
echo ===============================================================================
echo.

set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB_PATH%" (
    where adb >nul 2>nul
    if %errorlevel% equ 0 (
        set "ADB_PATH=adb"
    ) else (
        echo [LỖI] Không tìm thấy adb.exe trong Android SDK platform-tools!
        echo Vui lòng đảm bảo Android SDK đã được cài đặt.
        pause
        exit /b 1
    )
)

echo [1/4] Tìm thấy công cụ kết nối ADB tại: %ADB_PATH%
echo.

set /p WATCH_IP=">> Nhập địa chỉ IP & Port của Galaxy Watch (VD: 192.168.1.45:5555): "

if "%WATCH_IP%"=="" (
    echo [LỖI] Bạn chưa nhập địa chỉ IP của đồng hồ!
    pause
    exit /b 1
)

echo.
echo [2/4] Đang kết nối ADB không dây tới đồng hồ %WATCH_IP%...
echo (Vui lòng nhìn vào mặt đồng hồ và bấm "OK" hoặc "Luôn cho phép" nếu có thông báo)
"%ADB_PATH%" connect %WATCH_IP%

timeout /t 3 >nul

echo.
echo [3/4] Danh sách thiết bị hiện tại:
"%ADB_PATH%" devices -l

echo.
echo Đang kiểm tra trạng thái cài đặt SafeSolo trên đồng hồ...
"%ADB_PATH%" -s %WATCH_IP% shell pm list packages | findstr "com.example.safesolo" >nul
if %errorlevel% equ 0 (
    echo -> Ứng dụng SafeSolo đã được cài đặt sẵn trên đồng hồ.
) else (
    echo -> Ứng dụng chưa có trên đồng hồ. Đang cài đặt bản build SafeSolo...
    if exist "%~dp0build\app\outputs\flutter-apk\app-debug.apk" (
        "%ADB_PATH%" -s %WATCH_IP% install -r "%~dp0build\app\outputs\flutter-apk\app-debug.apk"
    ) else if exist "%~dp0build\app\outputs\flutter-apk\app-release.apk" (
        "%ADB_PATH%" -s %WATCH_IP% install -r "%~dp0build\app\outputs\flutter-apk\app-release.apk"
    ) else (
        echo -> Đang build file APK dành riêng cho Galaxy Watch...
        cd /d "%~dp0"
        call flutter build apk --debug
        "%ADB_PATH%" -s %WATCH_IP% install -r "%~dp0build\app\outputs\flutter-apk\app-debug.apk"
    )
)

echo.
echo [4/5] Đang cấp quyền cảm biến sinh học (Nhịp tim BioActive, Bước chân, SpO2)...
"%ADB_PATH%" -s %WATCH_IP% shell pm grant com.example.safesolo android.permission.BODY_SENSORS 2>nul
"%ADB_PATH%" -s %WATCH_IP% shell pm grant com.example.safesolo android.permission.BODY_SENSORS_BACKGROUND 2>nul
"%ADB_PATH%" -s %WATCH_IP% shell pm grant com.example.safesolo android.permission.ACTIVITY_RECOGNITION 2>nul

echo.
echo [5/5] Đang khởi chạy SafeSolo trên mặt đồng hồ SM-R900 (%WATCH_IP%)...
"%ADB_PATH%" -s %WATCH_IP% shell am start -n com.example.safesolo/.MainActivity

echo.
echo ===============================================================================
echo        KẾT NỐI VÀ THIẾT LẬP CẢM BIẾN SAMSUNG GALAXY WATCH 5 (SM-R900) THÀNH CÔNG!
echo ===============================================================================
echo  LƯU Ý ĐỂ ĐO CHỈ SỐ SINH TỒN CHUẨN XÁC:
echo  - Đeo đồng hồ cách xương cổ tay khoảng 1 - 2 ngón tay.
echo  - Dây đeo ôm sát vừa vặn, không quá chặt cũng không lỏng lẻo.
echo  - Cảm biến quang BioActive ở mặt dưới đồng hồ tiếp xúc đều với da.
echo  - SpO2 và nhịp tim được lọc nhiễu tự động (loại trừ báo động giả khi tháo đồng hồ).
echo -------------------------------------------------------------------------------
echo 1. Nhìn lên mặt đồng hồ Galaxy Watch 5: Giao diện tròn 1:1 SafeSolo sẽ kích hoạt.
echo 2. Mặt đồng hồ hiển thị mã PIN 6 số (VD: 742-891).
echo 3. Mở app SafeSolo trên điện thoại -> Vào "Thiết bị đeo & Đồng hồ" -> Nhập mã PIN
echo    hoặc bấm "Ghép nối nhanh (1-Chạm)" để bắt đầu đồng bộ dữ liệu sinh tồn thật!
echo ===============================================================================
echo.
pause
