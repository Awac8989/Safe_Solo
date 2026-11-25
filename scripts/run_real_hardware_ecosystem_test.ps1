# Script Kiem Thu Thuc Te Toan Bo He Sinh Thai SafeSolo
# Tac gia: Doan Minh Quan (MSSV: 2224801030137 - D22KTPM03, TDMU)
$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$victim = "R5CT314T83J" # Galaxy A53 5G
$hero   = "R58N22P46KZ" # Galaxy A71
$pkg    = "com.example.safesolo"
$artifactDir = "C:\Users\Admin\.gemini\antigravity\brain\80e30af8-dd29-4f5e-bb89-8a1197db0216"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "     KIEM THU THUC TE HE SINH THAI SAFESOLO TREN PHAN CUNG THAT           " -ForegroundColor Yellow
Write-Host "  Galaxy A53 (Nan Nhan) + Galaxy A71 (Hiep Si) + Watch 5 + Web Admin TOC  " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. Bat sang man hinh va reverse port 4000
Write-Host "`n[BUOC 1] Bat sang man hinh, mo khoa & Cau hinh reverse port 4000..." -ForegroundColor Cyan
& $adb -s $victim shell input keyevent 224
& $adb -s $victim shell input keyevent 82
& $adb -s $hero shell input keyevent 224
& $adb -s $hero shell input keyevent 82

& $adb -s $victim reverse tcp:4000 tcp:4000
& $adb -s $hero reverse tcp:4000 tcp:4000

# Xoa sach logcat de doat soat loi moi nhat
& $adb -s $victim logcat -c
& $adb -s $hero logcat -c
Start-Sleep -Seconds 1

# 2. Khoi dong SafeSolo tren Galaxy A53 (Nan Nhan)
Write-Host "`n[BUOC 2] Khoi dong SafeSolo tren Galaxy A53 5G (Nan Nhan)..." -ForegroundColor Cyan
& $adb -s $victim shell monkey -p $pkg -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 4
& $adb -s $victim shell screencap -p /sdcard/victim_a53_home.png
& $adb -s $victim pull /sdcard/victim_a53_home.png "$artifactDir\REAL_01_Victim_A53_Home.png"

# 3. Khoi dong SafeSolo tren Galaxy A71 (Hiep Si)
Write-Host "`n[BUOC 3] Khoi dong SafeSolo tren Galaxy A71 (Hiep Si Giai Cuu)..." -ForegroundColor Cyan
& $adb -s $hero shell monkey -p $pkg -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 4
& $adb -s $hero shell screencap -p /sdcard/hero_a71_home.png
& $adb -s $hero pull /sdcard/hero_a71_home.png "$artifactDir\REAL_02_Hero_A71_Home.png"

# 4. Kiem tra Dong bo Dong ho Galaxy Watch 5 tren A53 (/smartwatch)
Write-Host "`n[BUOC 4] Mo Dong bo Smartwatch Hub & Sinh hieu Watch 5 tren Galaxy A53..." -ForegroundColor Cyan
& $adb -s $victim shell am start -n "$pkg/.MainActivity" -d "safesolo://app/smartwatch"
Start-Sleep -Seconds 2
# Neu deep link chua bat duoc thi dung tap hoac am start route
& $adb -s $victim shell screencap -p /sdcard/victim_a53_watch.png
& $adb -s $victim pull /sdcard/victim_a53_watch.png "$artifactDir\REAL_03_Victim_A53_Watch_Sync.png"

# 5. Kiem tra Ho so Y te Cap cuu Medical ICE Card tren A53 (/lockscreen-medical)
Write-Host "`n[BUOC 5] Mo The Y Te Khan Cap Lockscreen Medical ICE Card tren Galaxy A53..." -ForegroundColor Cyan
& $adb -s $victim shell am start -n "$pkg/.MainActivity" -d "safesolo://app/lockscreen-medical"
Start-Sleep -Seconds 2
& $adb -s $victim shell screencap -p /sdcard/victim_a53_ice.png
& $adb -s $victim pull /sdcard/victim_a53_ice.png "$artifactDir\REAL_04_Victim_A53_Medical_ICE.png"

# 6. Mo Khong gian Tac chien Hiep Si tren A71 (/hero-workspace)
Write-Host "`n[BUOC 6] Mo Khong Gian Tac Chien Hiep Si (Hero Workspace) tren Galaxy A71..." -ForegroundColor Cyan
& $adb -s $hero shell am start -n "$pkg/.MainActivity" -d "safesolo://app/hero-workspace"
Start-Sleep -Seconds 2
& $adb -s $hero shell screencap -p /sdcard/hero_a71_workspace.png
& $adb -s $hero pull /sdcard/hero_a71_workspace.png "$artifactDir\REAL_05_Hero_A71_Workspace.png"

# 7. Mo Huan luyen vien Ep tim CPR Coach tren A71 (/cpr-coach)
Write-Host "`n[BUOC 7] Kich hoat Huong dan Ep tim Hoi sinh CPR Coach (110 BPM) tren Galaxy A71..." -ForegroundColor Cyan
& $adb -s $hero shell am start -n "$pkg/.MainActivity" -d "safesolo://app/cpr-coach"
Start-Sleep -Seconds 2
& $adb -s $hero shell screencap -p /sdcard/hero_a71_cpr.png
& $adb -s $hero pull /sdcard/hero_a71_cpr.png "$artifactDir\REAL_06_Hero_A71_CPR_Coach.png"

# 8. Mo Ban do Tram Cuu Sinh SafePoints & AED tren A71 (/safepoints-map)
Write-Host "`n[BUOC 8] Mo Ban Do Tram Cuu Sinh SafePoints & May Soc Tim AED tren Galaxy A71..." -ForegroundColor Cyan
& $adb -s $hero shell am start -n "$pkg/.MainActivity" -d "safesolo://app/safepoints-map"
Start-Sleep -Seconds 2
& $adb -s $hero shell screencap -p /sdcard/hero_a71_safepoints.png
& $adb -s $hero pull /sdcard/hero_a71_safepoints.png "$artifactDir\REAL_07_Hero_A71_SafePoints_AED.png"

# 9. Mo Mang luoi Tiep suc Mau SafeBlood tren A71 (/blood-relay)
Write-Host "`n[BUOC 9] Mo Mang Luoi Tiep Suc Mau SafeBlood Relay tren Galaxy A71..." -ForegroundColor Cyan
& $adb -s $hero shell am start -n "$pkg/.MainActivity" -d "safesolo://app/blood-relay"
Start-Sleep -Seconds 2
& $adb -s $hero shell screencap -p /sdcard/hero_a71_blood.png
& $adb -s $hero pull /sdcard/hero_a71_blood.png "$artifactDir\REAL_08_Hero_A71_Blood_Relay.png"

# 10. Quet toan bo Logcat doi soat loi tren ca 2 may
Write-Host "`n[BUOC 10] Quet Logcat kiem tra Pixel Overflow & Exception tren Galaxy A53 & A71..." -ForegroundColor Cyan
$overflowA53 = & $adb -s $victim logcat -d | Select-String "RenderFlex overflowed"
$overflowA71 = & $adb -s $hero logcat -d | Select-String "RenderFlex overflowed"
$crashA53    = & $adb -s $victim logcat -d | Select-String "FATAL EXCEPTION|CRASH"
$crashA71    = & $adb -s $hero logcat -d | Select-String "FATAL EXCEPTION|CRASH"

Write-Host "`n[KET QUA DO SOAT GALAXY A53 5G - NAN NHAN]" -ForegroundColor Yellow
if ($overflowA53) {
  Write-Host "  ❌ Phat hien $($overflowA53.Count) loi overflow tren A53!" -ForegroundColor Red
} else {
  Write-Host "  ✅ 0 RENDERFLEX OVERFLOW (HOAN HAO) tren Galaxy A53 5G!" -ForegroundColor Green
}
if ($crashA53) {
  Write-Host "  ❌ Phat hien Crash tren A53!" -ForegroundColor Red
} else {
  Write-Host "  ✅ 0 CRASH / 0 FATAL EXCEPTION tren Galaxy A53 5G!" -ForegroundColor Green
}

Write-Host "`n[KET QUA DO SOAT GALAXY A71 - HIEP SI GIAI CUU]" -ForegroundColor Yellow
if ($overflowA71) {
  Write-Host "  ❌ Phat hien $($overflowA71.Count) loi overflow tren A71!" -ForegroundColor Red
} else {
  Write-Host "  ✅ 0 RENDERFLEX OVERFLOW (HOAN HAO) tren Galaxy A71!" -ForegroundColor Green
}
if ($crashA71) {
  Write-Host "  ❌ Phat hien Crash tren A71!" -ForegroundColor Red
} else {
  Write-Host "  ✅ 0 CRASH / 0 FATAL EXCEPTION tren Galaxy A71!" -ForegroundColor Green
}

Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host "       ✅ HOAN TAT KIEM THU THUC TE HE SINH THAI SAFESOLO!               " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
