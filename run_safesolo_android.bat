@echo off
title SafeSolo Android Launcher
echo Dang mo Android Emulator Pixel 6...
start "" "C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd Pixel_6_API_34
echo Dang ket noi port 4000...
timeout /t 5 >nul
"C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe" wait-for-device
"C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe" reverse tcp:4000 tcp:4000
echo Khoi dong app SafeSolo tren Android...
"C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe" shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1
echo Hoan tat! Cua so dien thoai Pixel 6 dang chay tren man hinh cua ban.
pause
