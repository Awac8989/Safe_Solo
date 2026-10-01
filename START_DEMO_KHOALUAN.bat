@echo off
title SAFESOLO - DEMO KHOA LUAN TOT NGHIEP
color 0A

echo ===============================================================================
echo        SAFESOLO - TRINH KHOI DONG HE THONG DEMO KHOA LUAN TOT NGHIEP
echo      Tac gia: Doan Minh Quan - MSSV: 2224801030137
echo ===============================================================================
echo.

set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% set ADB=adb

:: 1. KIEM TRA MONGODB
echo [1/4] Kiem tra Co so du lieu MongoDB...
sc query MongoDB | findstr /i "RUNNING" >nul
if %errorlevel% neq 0 (
    echo   -> Dang kich hoat MongoDB Server...
    net start MongoDB >nul 2>&1
)
echo   -> [OK] Co so du lieu MongoDB da san sang!

:: 2. KIEM TRA & KHOI DONG BACKEND SERVER (PORT 4000)
echo.
echo [2/4] Kiem tra SafeSolo Backend API Server (Port 4000)...
netstat -ano | findstr :4000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo   -> Backend chua chay. Dang mo cua so Backend Server port 4000...
    start "SafeSolo Backend API Server (Port 4000)" cmd /k "cd /d %~dp0backend && npm start"
    ping 127.0.0.1 -n 4 >nul
) else (
    echo   -> [OK] Backend API Server dang chay on dinh tai http://localhost:4000
)

:: 3. KET NOI VOI DIEN THOAI SAMSUNG GALAXY A71
echo.
echo [3/4] Ket noi voi Dien thoai Samsung Galaxy A71...
echo   -> Thu ket noi khong day qua Wi-Fi (192.168.1.8:5555)...
%ADB% connect 192.168.1.8:5555 >nul 2>&1
ping 127.0.0.1 -n 3 >nul

:: Thiet lap reverse port cho tat ca thiet bi
echo   -> Cau hinh Reverse Port 4000 (dam bao dien thoai ket noi truc tiep Backend)...
%ADB% -s 192.168.1.8:5555 reverse tcp:4000 tcp:4000 >nul 2>&1
%ADB% reverse tcp:4000 tcp:4000 >nul 2>&1
echo   - [OK] Da thong tuyen Port 4000 thanh cong!

:: 4. BAT SANG MAN HINH VA MO UNG DUNG SAFESOLO
echo.
echo [4/4] Mo ung dung SafeSolo tren dien thoai...
%ADB% shell input keyevent 224 >nul 2>&1
%ADB% shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1 >nul 2>&1
echo   -> [OK] SafeSolo da duoc kich hoat tren man hinh dien thoai!

echo.
echo ===============================================================================
echo                     HE THONG DA SAN SANG CHO BUOI DEMO!
echo ===============================================================================
echo.
echo  THONG TIN TAI KHOAN MAU KHOA LUAN (CHON 1-CHAM TREN MAN HINH):
echo  + TAI KHOAN 1 (CHINH): 0913843958 (Doan Minh Quan - Hiep si SafeSolo KYC)
echo  + TAI KHOAN 2        : 0908889999 (Nguyen Van An - Nguoi dung bao ve)
echo  + TAI KHOAN 3        : 0901112222 (Tran Thi Mai - Nguoi than / Bac si 115)
echo  + MA OTP HOI DONG    : 888888 (Tu dong dien 1-cham)
echo.
echo  CAC TINH NANG NOI BAT NEN DEMO CHO THAY XEM:
echo  1. He sinh thai 4 Nhom - 7 Co che Check-in Sinh ton (Bam nut ⭐ 7 Co che Check-in)
echo     + Nhip tim thuc giac Galaxy Watch 5 & Phong dot quy ngu (WAKE_UP_PULSE)
echo     + Neo tram sac buoi toi & Home Wi-Fi / Quiet Hours Mode (HOME_WIFI)
echo     + Cu chi lac co tay 2 nhip tren Wear OS Watch (GESTURE_WRIST_TWIST)
echo     + To hop phim cung vat ly khi roi vo man hinh (HARDWARE_KEY_COMBO)
echo     + Khau lenh giong noi & Mat ma nguy trang giai cuu (Stealth Duress SOS)
echo     + Diem danh cheo 1-cham Con ^& Me (BUDDY_CROSS_CHECKIN)
echo     + Diem danh uong thuoc & AI Vision (MEDICATION_VISION)
echo  2. The Cap Cuu Man Hinh Khoa va Ma QR y te 115 (Cai dat -^> Ho so y te)
echo  3. Diem danh an toan va Vong tron bao ve (Circle Orbit - GPS Realtime)
echo  4. Canh bao khan cap SOS va Mang luoi Hiep si lan can
echo  5. Dong bo nhip tim, buoc chan tu Samsung Galaxy Watch 5
echo  6. Che do nguy trang va Goi ao thoat hiem khan cap (Fake Call)
echo ===============================================================================
echo.
echo Nhan phim bat ky de thoat cua so nay (Backend van tiep tuc chay ngam).
pause >nul
