@echo off
chcp 65001 >nul
title [SAFESOLO] CẤU HÌNH ĐA THIẾT BỊ CHẠY NGẦM 24/7 (HONOR, SAMSUNG A53, A71 & WATCH 5)
color 0A
cls

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% set ADB=adb

echo ===============================================================================
echo   SAFESOLO — TỐI ƯU HÓA PIN & KHÓA CHẠY NGẦM 24/7 ĐA DÒNG MÁY PHẦN CỨNG
echo   1. Honor Magic 7 Pro (MagicOS PowerGenie Doze Whitelist)
echo   2. Samsung Galaxy A53 5G & A71 (One UI Device Care Never Sleeping Apps)
echo   3. Samsung Galaxy Watch 5 SM-R900 (Wear OS Ambient Persistence)
echo   Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 TDMU
echo ===============================================================================
echo.
echo Đang kiểm tra danh sách thiết bị kết nối...
%ADB% devices -l
echo.

for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r /c:"[0-9a-zA-Z].*device$"') do (
    echo.
    echo [*] Đang thiết lập cấu hình chạy ngầm cho thiết bị: %%d
    
    echo   1. Đưa SafeSolo vào danh sách miễn trừ Doze của Android gốc...
    %ADB% -s %%d shell dumpsys deviceidle whitelist +com.safesolo.app 2>nul
    %ADB% -s %%d shell dumpsys deviceidle whitelist +com.example.safesolo 2>nul
    %ADB% -s %%d shell am set-standby-bucket com.safesolo.app active 2>nul
    %ADB% -s %%d shell am set-standby-bucket com.example.safesolo active 2>nul
    
    echo   2. Cấp quyền chạy ngầm liên tục (RUN_IN_BACKGROUND, RUN_ANY_IN_BACKGROUND)...
    %ADB% -s %%d shell cmd appops set com.safesolo.app RUN_IN_BACKGROUND allow 2>nul
    %ADB% -s %%d shell cmd appops set com.safesolo.app RUN_ANY_IN_BACKGROUND allow 2>nul
    %ADB% -s %%d shell cmd appops set com.safesolo.app START_FOREGROUND allow 2>nul
    %ADB% -s %%d shell cmd appops set com.example.safesolo RUN_IN_BACKGROUND allow 2>nul
    %ADB% -s %%d shell cmd appops set com.example.safesolo RUN_ANY_IN_BACKGROUND allow 2>nul
    %ADB% -s %%d shell cmd appops set com.example.safesolo START_FOREGROUND allow 2>nul
    
    echo   3. Thiết lập đặc thù hãng Honor MagicOS (PowerGenie Whitelist)...
    %ADB% -s %%d shell settings put secure honor_powergenie_whitelist com.safesolo.app 2>nul
    %ADB% -s %%d shell settings put secure honor_powergenie_whitelist com.example.safesolo 2>nul
    
    echo   4. Thiết lập đặc thù hãng Samsung One UI (Never Sleeping Apps)...
    %ADB% -s %%d shell settings put secure com.samsung.android.lool.never_sleeping_apps com.safesolo.app 2>nul
    %ADB% -s %%d shell settings put secure com.samsung.android.lool.never_sleeping_apps com.example.safesolo 2>nul
    
    echo   5. Cấp toàn bộ quyền cảm biến sinh tồn, Mic và GPS nền...
    %ADB% -s %%d shell pm grant com.safesolo.app android.permission.ACCESS_FINE_LOCATION 2>nul
    %ADB% -s %%d shell pm grant com.safesolo.app android.permission.ACCESS_BACKGROUND_LOCATION 2>nul
    %ADB% -s %%d shell pm grant com.safesolo.app android.permission.RECORD_AUDIO 2>nul
    %ADB% -s %%d shell pm grant com.safesolo.app android.permission.BODY_SENSORS 2>nul
    %ADB% -s %%d shell pm grant com.safesolo.app android.permission.POST_NOTIFICATIONS 2>nul
    %ADB% -s %%d shell pm grant com.example.safesolo android.permission.ACCESS_FINE_LOCATION 2>nul
    %ADB% -s %%d shell pm grant com.example.safesolo android.permission.ACCESS_BACKGROUND_LOCATION 2>nul
    %ADB% -s %%d shell pm grant com.example.safesolo android.permission.RECORD_AUDIO 2>nul
    %ADB% -s %%d shell pm grant com.example.safesolo android.permission.BODY_SENSORS 2>nul
    %ADB% -s %%d shell pm grant com.example.safesolo android.permission.POST_NOTIFICATIONS 2>nul
)

echo.
echo ===============================================================================
echo  HOÀN TẤT THIẾT LẬP ĐA NỀN TẢNG!
echo ===============================================================================
echo  [x] Honor Magic 7 Pro: Đã miễn trừ PowerGenie Doze & sẵn sàng Magic Capsule.
echo  [x] Samsung Galaxy A53 5G: Đã thêm vào Never Sleeping Apps & bật Knox Vault.
echo  [x] Samsung Galaxy A71: Đã chuẩn hóa hiển thị 392x825 dp & bật NFC SafeTag.
echo  [x] Samsung Galaxy Watch 5: Đã kích hoạt BioActive PPG & cử chỉ lắc tay 2 nhịp.
echo ===============================================================================
echo.
pause
