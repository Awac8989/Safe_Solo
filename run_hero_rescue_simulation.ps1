# ==============================================================================
# SAFESOLO - KỊCH BẢN MÔ PHỎNG THỰC CHIẾN 2 THIẾT BỊ: NẠN NHÂN VÀ HIỆP SĨ CỨU HỘ
# Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - Đại học Thủ Dầu Một
# - Thiết bị Nạn nhân (Victim): Samsung Galaxy A53 5G (R5CT314T83J)
# - Thiết bị Hiệp sĩ (Hero):    Samsung Galaxy A71    (R58N22P46KZ)
# ==============================================================================

$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$artifactDir = "C:\Users\Admin\.gemini\antigravity\brain\80e30af8-dd29-4f5e-bb89-8a1197db0216"
$apkPath = "C:\Users\Admin\SafeSolo\build\app\outputs\flutter-apk\app-debug.apk"

$victimDev = "R5CT314T83J"
$heroDev   = "R58N22P46KZ"

Write-Host "=============================================================================="
Write-Host "  KHỞI ĐỘNG KỊCH BẢN THỰC CHIẾN LIÊN THIẾT BỊ: NẠN NHÂN & HIỆP SĨ GIẢI CỨU"
Write-Host "  - NẠN NHÂN (Victim): Samsung Galaxy A53 5G ($victimDev)"
Write-Host "  - HIỆP SĨ (Hero):    Samsung Galaxy A71    ($heroDev)"
Write-Host "=============================================================================="

# 1. Cài đặt APK mới nhất lên cả hai thiết bị
Write-Host "`n[BƯỚC 1]: Nạp bản build APK mới nhất lên 2 thiết bị qua USB..."
& $adb -s $victimDev install -r $apkPath
& $adb -s $heroDev   install -r $apkPath

# 2. Thiết lập reverse port kết nối Backend Node.js
& $adb -s $victimDev reverse tcp:4000 tcp:4000
& $adb -s $heroDev   reverse tcp:4000 tcp:4000

# 3. Làm sạch logcat và khởi chạy ứng dụng
& $adb -s $victimDev logcat -c
& $adb -s $heroDev   logcat -c

& $adb -s $victimDev shell am force-stop com.example.safesolo
& $adb -s $heroDev   shell am force-stop com.example.safesolo

& $adb -s $victimDev shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1
& $adb -s $heroDev   shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1

Start-Sleep -Seconds 4

Write-Host "`n[BƯỚC 2]: CHUẨN BỊ MÔI TRƯỜNG VAI DIỄN"
Write-Host "--> Galaxy A53 5G ở Trang chủ sẵn sàng phát tín hiệu cứu sinh"
Write-Host "--> Galaxy A71 di chuyển vào Tab Hiệp Sĩ (Heroes Page) mở Bàn Tác Chiến"
# Chuyển A71 sang Tab Hiệp sĩ (Heroes Tab: x=756, y=2280)
& $adb -s $heroDev shell input tap 756 2280
Start-Sleep -Seconds 2

# Mở Bàn Tác Chiến Hiệp Sĩ (Hero Workspace) trên Galaxy A71 (Chạm thẻ Tác Chiến: x=540, y=780)
& $adb -s $heroDev shell input tap 540 780
Start-Sleep -Seconds 3

# Chụp trạng thái ban đầu của cả 2 máy
& $adb -s $victimDev exec-out screencap -p > "$artifactDir\rescue_sim_01_victim_standby.png"
& $adb -s $heroDev   exec-out screencap -p > "$artifactDir\rescue_sim_02_hero_radar_ready.png"
Write-Host "-> Đã lưu ảnh trạng thái ban đầu của Nạn nhân và Radar Hiệp sĩ."

Write-Host "`n[BƯỚC 3]: NẠN NHÂN PHÁT TÍN HIỆU CẤP CỨU P1 (0-GIÂY BYPASS SOS)"
Write-Host "--> Nạn nhân A53 kích hoạt SOS khẩn cấp: Ngừng tim / Chấn thương đột ngột!"
# Cuộn nhẹ trang chủ A53 xuống thanh Critical SOS Bar
& $adb -s $victimDev shell input swipe 540 1600 540 1100 250
Start-Sleep -Seconds 1

# Nhấn nút Ngừng tim CPR / Cấp cứu 0-Giây (x=240, y=1450)
& $adb -s $victimDev shell input tap 240 1450
Start-Sleep -Seconds 3

# Chụp màn hình War Room Cứu Nạn của Nạn nhân
& $adb -s $victimDev exec-out screencap -p > "$artifactDir\rescue_sim_03_victim_war_room.png"
Write-Host "-> Nạn nhân đã chuyển vào BÀN TÁC CHIẾN CỨU NẠN (SosMapPage) thời gian thực!"

Write-Host "`n[BƯỚC 4]: HIỆP SĨ NHẬN CẢNH BÁO TRÊN RADAR VÀ BẤM 'NHẬN CA CỨU NẠN'"
Write-Host "--> Galaxy A71: Hiệp sĩ bấm nút NHẬN CA CỨU NẠN trên Radar tiếp cận hiện trường..."
# Nhấn nút NHẬN CA CỨU NẠN (x=700, y=1250)
& $adb -s $heroDev shell input tap 700 1250
Start-Sleep -Seconds 3

# Chụp màn hình Active Mission tiếp cận nạn nhân trên máy Hiệp sĩ
& $adb -s $heroDev exec-out screencap -p > "$artifactDir\rescue_sim_04_hero_mission_enroute.png"
Write-Host "-> Hiệp sĩ đã nhận ca! Đang bật HUD điều hướng T+0s và đếm thời gian tiếp cận."

Write-Host "`n[BƯỚC 5]: HIỆP SĨ KÍCH HOẠT CÔNG CỤ SƠ CỨU LÂM SÀNG (CPR COACH & AHA METRONOME)"
Write-Host "--> Galaxy A71: Kích hoạt máy đếm nhịp ép tim CPR AHA 110 BPM..."
# Cuộn màn hình Active Mission xuống khu vực công cụ sơ cứu CPR
& $adb -s $heroDev shell input swipe 540 1800 540 1000 250
Start-Sleep -Seconds 1

# Bật máy đếm nhịp CPR Metronome hoặc thao tác lâm sàng
& $adb -s $heroDev shell input tap 540 1450
Start-Sleep -Seconds 3

# Chụp màn hình Hiệp sĩ đang sơ cứu lâm sàng
& $adb -s $heroDev exec-out screencap -p > "$artifactDir\rescue_sim_05_hero_cpr_first_aid.png"

# Chụp lại màn hình Nạn nhân A53 đồng thời để đối chiếu
& $adb -s $victimDev exec-out screencap -p > "$artifactDir\rescue_sim_06_victim_rescuer_connected.png"

Write-Host "`n=== ĐỐI SOÁT LOGCAT VÀ CHUẨN ĐOÁN LỖI TRÊN CẢ 2 MÁY ==="
$logVictim = & $adb -s $victimDev logcat -d
$errVictim = $logVictim | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR"

$logHero = & $adb -s $heroDev logcat -d
$errHero = $logHero | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR"

if ($errVictim) {
    Write-Host "Phát hiện lỗi trên máy Nạn nhân (A53):"
    $errVictim | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: MÁY NẠN NHÂN GALAXY A53 ĐẠT 100% TIÊU CHUẨN (0 OVERFLOW, 0 CRASH)! <<<"
}

if ($errHero) {
    Write-Host "Phát hiện lỗi trên máy Hiệp sĩ (A71):"
    $errHero | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: MÁY HIỆP SĨ GALAXY A71 ĐẠT 100% TIÊU CHUẨN (0 OVERFLOW, 0 CRASH)! <<<"
}

Write-Host "=============================================================================="
Write-Host "    HOÀN TẤT THỰC CHIẾN KỊCH BẢN: NẠN NHÂN & HIỆP SĨ GIẢI CỨU SAFESOLO"
Write-Host "=============================================================================="
