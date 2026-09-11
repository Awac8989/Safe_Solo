@echo off
title SafeSolo Android Launcher
set ADB="C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set EMULATOR="C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe"

echo ========================================================
echo   SAFESOLO - KHOI DONG HE THONG VA UNG DUNG ANDROID
echo ========================================================

:: 1. Kiem tra va khoi dong Backend Server (Port 4000)
netstat -ano | findstr :4000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [1/3] Backend chua chay. Dang khoi dong Backend Server port 4000...
    start "SafeSolo Backend (Port 4000)" cmd /k "cd /d %~dp0backend && npm start"
    timeout /t 3 >nul
) else (
    echo [1/3] Backend Server da san sang tren port 4000.
)

:: 2. Kiem tra va khoi dong Emulator Pixel 6
%ADB% devices | findstr emulator-5554 >nul
if %errorlevel% neq 0 (
    echo [2/3] Dang mo Android Emulator Pixel 6...
    start "" %EMULATOR% -avd Pixel_6_API_34
    echo Dang cho Emulator san sang...
    %ADB% wait-for-device
    timeout /t 5 >nul
) else (
    echo [2/3] Emulator Pixel 6 da dang chay.
)

:: 3. Reverse port 4000 cho tat ca devices (Pixel 6, Smartwatch)
echo [3/3] Dang ket noi forward/reverse port 4000 cho cac thiet bi...
for /f "tokens=1" %%d in ('%ADB% devices ^| findstr /r "device$"') do (
    %ADB% -s %%d reverse tcp:4000 tcp:4000 >nul 2>&1
    echo   - Da ket noi port 4000 cho thiet bi: %%d
)

:: 4. Khoi chay ung dung SafeSolo tren dien thoai
echo Dang khoi chay app SafeSolo tren Pixel 6...
%ADB% -s emulator-5554 shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1 >nul 2>&1

echo.
echo ========================================================
echo   HOAN TAT! SafeSolo Mobile va Backend da ket noi thanh cong.
echo ========================================================
pause

