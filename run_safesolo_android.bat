@echo off
title SafeSolo Multi-Device Launcher (Phone + Galaxy Watch 5)
set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set EMULATOR="C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe"

echo ====================================================================
echo   SAFESOLO - KHOI DONG HE THONG MAY AO DIEN THOAI ^& DONG HO WEAR OS
echo ====================================================================

:: 1. Kiem tra va khoi dong Backend Server (Port 4000)
netstat -ano | findstr :4000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [1/4] Backend chua chay. Dang khoi dong Backend Server port 4000...
    start "SafeSolo Backend (Port 4000)" cmd /k "cd /d %~dp0backend && npm start"
    timeout /t 3 >nul
) else (
    echo [1/4] Backend Server da san sang tren port 4000.
)

:: 2. Kiem tra va khoi dong Emulator Pixel 6 (Phone)
%ADB% devices | findstr emulator-5554 >nul
if %errorlevel% neq 0 (
    echo [2/4] Dang khoi dong Android Emulator Pixel 6 (Dien thoai)...
    start "" %EMULATOR% -avd Pixel_6_API_34
) else (
    echo [2/4] Emulator Pixel 6 da dang chay.
)

:: 3. Kiem tra va khoi dong Emulator Wear OS Small Round (Galaxy Watch 5)
%ADB% devices | findstr emulator-5556 >nul
if %errorlevel% neq 0 (
    echo [3/4] Dang khoi dong Wear OS Emulator (Samsung Galaxy Watch 5)...
    start "" %EMULATOR% -avd Wear_OS_Small_Round_API_34
) else (
    echo [3/4] Emulator Galaxy Watch 5 da dang chay.
)

echo Dang doi cac thiet bi san sang...
timeout /t 8 >nul

:: 4. Reverse port 4000 cho tat ca cac thiet bi (May ao + May that cam cap)
echo [4/4] Dang thiet lap Reverse Port 4000 cho toan bo thiet bi dang ket noi...
for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r "device$"') do (
    %ADB% -s %%d reverse tcp:4000 tcp:4000 >nul 2>&1
    echo   - [OK] Reverse port 4000 cho thiet bi: %%d
    echo   - Dang mo SafeSolo tren %%d...
    %ADB% -s %%d shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1 >nul 2>&1
)

echo.
echo ====================================================================
echo   HOAN TAT! He thong dien thoai va dong ho da san sang dong bo!
echo   Luu y cho may that: Cam cap USB bat USB Debugging, chay lai file nay.
echo ====================================================================
pause
