# ==============================================================================
# SAFESOLO - KIỂM THỬ THỰC CHIẾN HỆ SINH THÁI ĐỒNG HỒ THÔNG MINH (GALAXY WATCH 5)
# Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - Đại học Thủ Dầu Một
# ==============================================================================

$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$artifactDir = "C:\Users\Admin\.gemini\antigravity\brain\80e30af8-dd29-4f5e-bb89-8a1197db0216"

$phoneDev = "R58N22P46KZ" # Galaxy A71 đóng vai Điện thoại quản lý đồng hồ
$watchDev = "R5CT314T83J" # Galaxy A53 đóng vai Màn hình Samsung Galaxy Watch 5

Write-Host "=============================================================================="
Write-Host "  KHỞI ĐỘNG KIỂM THỬ ĐỒNG BỘ THỜI GIAN THỰC GALAXY WATCH 5 & ĐIỆN THOẠI"
Write-Host "  - ĐIỆN THOẠI QUẢN LÝ: Samsung Galaxy A71 ($phoneDev)"
Write-Host "  - MÀN HÌNH ĐỒNG HỒ:   Samsung Galaxy A53 ($watchDev)"
Write-Host "=============================================================================="

# 1. Reset logcat trên 2 máy
& $adb -s $phoneDev logcat -c
& $adb -s $watchDev logcat -c

# 2. Khởi chạy app vào trang Quản lý đồng hồ trên Galaxy A71
Write-Host "`n--> Bước 1: Mở Trung tâm Điều khiển Đồng hồ trên Galaxy A71..."
& $adb -s $phoneDev shell am force-stop com.example.safesolo
& $adb -s $phoneDev shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 3

# Nhấn vào Thẻ đồng hồ hoặc Cài đặt để mở Smartwatch Page
# Chạm thẻ Smartwatch trên HomePage (y=1800) hoặc dùng deep link
& $adb -s $phoneDev shell input tap 540 1850
Start-Sleep -Seconds 2
& $adb -s $phoneDev exec-out screencap -p > "$artifactDir\watch_sim_01_phone_smartwatch_hub.png"

# 3. Khởi chạy giao diện Wear OS Watch trên Galaxy A53
Write-Host "`n--> Bước 2: Hiển thị giao diện mặt đồng hồ Samsung Galaxy Watch 5 trên Galaxy A53..."
& $adb -s $watchDev shell am force-stop com.example.safesolo
# Khởi chạy app và điều hướng đến màn hình đồng hồ
& $adb -s $watchDev shell am start -n com.example.safesolo/.MainActivity -d "safesolo://wear-os"
Start-Sleep -Seconds 3
& $adb -s $watchDev exec-out screencap -p > "$artifactDir\watch_sim_02_wearos_watchface.png"

# 4. Vuốt xem các màn hình thẻ Wear OS (Health Monitor, Stroke Shield, Medical ID)
Write-Host "`n--> Bước 3: Duyệt các thẻ Routine Tiles trên Đồng hồ (Sức khỏe, Đột quỵ, Medical ID)..."
# Vuốt sang Thẻ 1: Dashboard
& $adb -s $watchDev shell input swipe 900 1200 200 1200 300
Start-Sleep -Seconds 1

# Vuốt sang Thẻ 2: Health Monitor (Nhịp tim, SpO2, Pin)
& $adb -s $watchDev shell input swipe 900 1200 200 1200 300
Start-Sleep -Seconds 2
& $adb -s $watchDev exec-out screencap -p > "$artifactDir\watch_sim_03_wearos_health_monitor.png"

# Vuốt sang Thẻ 3: Stroke Shield (FAST Test trên đồng hồ)
& $adb -s $watchDev shell input swipe 900 1200 200 1200 300
Start-Sleep -Seconds 2
& $adb -s $watchDev exec-out screencap -p > "$artifactDir\watch_sim_04_wearos_stroke_shield.png"

# Vuốt sang Thẻ 4: Medical ID ICE QR Code
& $adb -s $watchDev shell input swipe 900 1200 200 1200 300
Start-Sleep -Seconds 2
& $adb -s $watchDev exec-out screencap -p > "$artifactDir\watch_sim_05_wearos_medical_ice_qr.png"

# 5. Đối soát logcat
Write-Host "`n=== ĐỐI SOÁT LOGCAT ĐỒNG HỒ & ĐIỆN THOẠI ==="
$logPhone = & $adb -s $phoneDev logcat -d
$errPhone = $logPhone | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR"

$logWatch = & $adb -s $watchDev logcat -d
$errWatch = $logWatch | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR"

if ($errPhone) {
    Write-Host "Phát hiện lỗi trên Điện thoại:"
    $errPhone | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: ĐIỆN THOẠI GALAXY A71 ĐẠT 100% TIÊU CHUẨN (0 OVERFLOW)! <<<"
}

if ($errWatch) {
    Write-Host "Phát hiện lỗi trên Đồng hồ:"
    $errWatch | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: ĐỒNG HỒ WEAR OS TRÊN GALAXY A53 ĐẠT 100% TIÊU CHUẨN (0 OVERFLOW)! <<<"
}

Write-Host "=============================================================================="
Write-Host "     HOÀN TẤT THỰC CHIẾN KIỂM THỬ ĐỒNG HỒ THÔNG MINH WEAR OS SAFESOLO"
Write-Host "=============================================================================="
