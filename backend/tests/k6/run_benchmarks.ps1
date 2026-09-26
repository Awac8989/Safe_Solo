# ============================================================================
# SAFESOLO BENCHMARK RUNNER SCRIPT (POWERSHELL)
# Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
# ============================================================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   SAFESOLO BACKEND PERFORMANCE BENCHMARK AUTOMATION TOOL        " -ForegroundColor Green
Write-Host "   SV: Doan Minh Quan - MSSV: 2224801030137 - Lop: KTPM03        " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

$k6Installed = Get-Command k6 -ErrorAction SilentlyContinue

if ($k6Installed) {
    Write-Host "[1/2] Phat hien Grafana k6 tren he thong. Dang chay test scenarios..." -ForegroundColor Green
    & k6 run scenarios/01_health_smoke.js
    & k6 run scenarios/02_vitals_telemetry_load.js
    & k6 run scenarios/03_emergency_spike_test.js
} else {
    Write-Host "[1/2] Chua cai dat k6 CLI. Su dung Native Node Benchmark Engine..." -ForegroundColor Yellow
    node benchmark_runner.js
}

Write-Host "`n[2/2] Dang tao bieu do SVG va Dashboard HTML cho Khoa luan..." -ForegroundColor Cyan
node generate_charts.js

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "HOAN THANH BENCHMARK! Ket qua nam tai backend/tests/k6/results/" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
