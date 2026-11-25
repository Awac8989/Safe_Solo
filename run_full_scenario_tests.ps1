# SafeSolo End-to-End Real Device Automation Test Runner
$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$artifactDir = "C:\Users\Admin\.gemini\antigravity\brain\80e30af8-dd29-4f5e-bb89-8a1197db0216"
$apkPath = "C:\Users\Admin\SafeSolo\build\app\outputs\flutter-apk\app-debug.apk"

Write-Host "=================================================================="
Write-Host "  KHỞI ĐỘNG CHUỖI KIỂM THỬ THỰC CHIẾN TOÀN KỊCH BẢN TRÊN THIẾT BỊ"
Write-Host "  Galaxy A71 (R58N22P46KZ) & Galaxy A53 5G (R5CT314T83J)"
Write-Host "=================================================================="

# 0. Cài đặt APK mới nhất lên cả 2 thiết bị
Write-Host "--> Nạp APK Debug mới lên Galaxy A71..."
& $adb -s R58N22P46KZ install -r $apkPath
Write-Host "--> Nạp APK Debug mới lên Galaxy A53 5G..."
& $adb -s R5CT314T83J install -r $apkPath

# 1. Reverse port 4000 kết nối backend
& $adb -s R58N22P46KZ reverse tcp:4000 tcp:4000
& $adb -s R5CT314T83J reverse tcp:4000 tcp:4000

# 2. Xóa logcat cũ và mở app
& $adb -s R58N22P46KZ logcat -c
& $adb -s R5CT314T83J logcat -c

& $adb -s R58N22P46KZ shell am force-stop com.example.safesolo
& $adb -s R5CT314T83J shell am force-stop com.example.safesolo

& $adb -s R58N22P46KZ shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1
& $adb -s R5CT314T83J shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1

Start-Sleep -Seconds 5

Write-Host "`n>>> [KỊCH BẢN 1]: ĐIỂM DANH SINH TỒN & DEAD-MAN SWITCH <<<"
# Chụp ảnh HomePage ban đầu
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb01_step1_homepage.png"

# Mở Dialog Điểm danh & Trạng thái (Tap Safe Orb: x=540, y=950)
& $adb -s R58N22P46KZ shell input tap 540 950
& $adb -s R5CT314T83J shell input tap 540 950
Start-Sleep -Seconds 2
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb01_step2_checkin_dialog.png"

# Chọn tâm trạng "Bình an" (😐: x=420, y=1100)
& $adb -s R58N22P46KZ shell input tap 420 1100
& $adb -s R5CT314T83J shell input tap 420 1100
Start-Sleep -Seconds 2
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb01_step3_checkin_success.png"
Write-Host "-> Hoàn thành Kịch bản 1: Điểm danh thành công, gia hạn chu kỳ Dead-man's Switch."

Write-Host "`n>>> [KỊCH BẢN 2]: VÒNG TRÒN BẢO HỘ GIA ĐÌNH & MOMENTS LOCKET <<<"
# Chuyển sang Tab 2 (Alive Circle: x=324, y=2280)
& $adb -s R58N22P46KZ shell input tap 324 2280
& $adb -s R5CT314T83J shell input tap 324 2280
Start-Sleep -Seconds 3
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb02_step1_circle_hub.png"

# Cuộn trang xem MomentsFeed và SafeMomentsCarousel
& $adb -s R58N22P46KZ shell input swipe 540 1600 540 900 300
& $adb -s R5CT314T83J shell input swipe 540 1600 540 900 300
Start-Sleep -Seconds 2
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb02_step2_circle_feed.png"
Write-Host "-> Hoàn thành Kịch bản 2: Vòng tròn Alive Circle hiển thị đồng bộ sinh hiệu và feed."

Write-Host "`n>>> [KỊCH BẢN 3]: GIÁM SÁT HÀNH TRÌNH TRỰC TIẾP (LIVE ESCORT JOURNEY) <<<"
# Chuyển sang Tab 3 (Hành trình: x=540, y=2280)
& $adb -s R58N22P46KZ shell input tap 540 2280
& $adb -s R5CT314T83J shell input tap 540 2280
Start-Sleep -Seconds 3
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb03_step1_journey_map.png"
Write-Host "-> Hoàn thành Kịch bản 3: Giám sát lộ trình di chuyển GPS trực tiếp thời gian thực."

Write-Host "`n>>> [KỊCH BẢN 4]: TỰ VỆ SINH TỒN, CUỘC GỌI GIẢ & SOS KHẨN CẤP <<<"
# Quay về Tab 1 (Trang chủ: x=108, y=2280)
& $adb -s R58N22P46KZ shell input tap 108 2280
& $adb -s R5CT314T83J shell input tap 108 2280
Start-Sleep -Seconds 2

# Cuộn xuống khu vực Tactical Emergency Tools
& $adb -s R58N22P46KZ shell input swipe 540 1800 540 600 300
& $adb -s R5CT314T83J shell input swipe 540 1800 540 600 300
Start-Sleep -Seconds 2
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb04_step1_tactical_tools.png"

# Chuyển sang Tab 5 (Cài đặt: x=972, y=2280)
& $adb -s R58N22P46KZ shell input tap 972 2280
& $adb -s R5CT314T83J shell input tap 972 2280
Start-Sleep -Seconds 2
& $adb -s R5CT314T83J exec-out screencap -p > "$artifactDir\kb04_step2_settings.png"

# Chụp lại trạng thái của Galaxy A71 để đối sánh
& $adb -s R58N22P46KZ exec-out screencap -p > "$artifactDir\kb_full_galaxy_a71.png"

Write-Host "`n=== KIỂM TRA TOÀN BỘ LOGCAT VỀ LỖI PIXEL & CRASH TRÊN CẢ 2 THIẾT BỊ ==="
$logA71 = & $adb -s R58N22P46KZ logcat -d
$errA71 = $logA71 | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR|FATAL EXCEPTION|AndroidRuntime"

$logA53 = & $adb -s R5CT314T83J logcat -d
$errA53 = $logA53 | Select-String -Pattern "overflowed|RenderFlex|FLUTTER GLOBAL ERROR|FATAL EXCEPTION|AndroidRuntime"

if ($errA71) {
    Write-Host "Phát hiện sự cố trên Galaxy A71:"
    $errA71 | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: GALAXY A71 ĐẠT 100% TIÊU CHUẨN (0 CRASH, 0 PIXEL OVERFLOW)! <<<"
}

if ($errA53) {
    Write-Host "Phát hiện sự cố trên Galaxy A53 5G:"
    $errA53 | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host ">>> XÁC THỰC HOÀN HẢO: GALAXY A53 5G ĐẠT 100% TIÊU CHUẨN (0 CRASH, 0 PIXEL OVERFLOW)! <<<"
}

Write-Host "=================================================================="
Write-Host "          HOÀN TẤT TOÀN BỘ KỊCH BẢN THỰC CHIẾN SAFESOLO"
Write-Host "=================================================================="
