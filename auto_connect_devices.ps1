# Auto-detect and connect ADB devices (Phone & Galaxy Watch)
param(
    [string]$PhoneIp = "192.168.1.8",
    [string]$WatchIp = "192.168.1.9"
)

$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    $adb = "adb"
}

function Find-AdbPort {
    param([string]$ip)
    
    # 1. Thu port 5555 truoc
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($ip, 5555, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(200, $false)) {
            $client.EndConnect($iar)
            $client.Close()
            return 5555
        }
    } catch {}
    finally {
        $client.Close()
    }

    # 2. Quet nhanh dai cong Wireless Debugging (35000-45000)
    Write-Host "   -> Dang do tim cong ngau nhien tren $ip..." -ForegroundColor Yellow
    $found = [ref]0
    $ports = 35000..45000
    
    [System.Threading.Tasks.Parallel]::ForEach($ports, [System.Threading.Tasks.ParallelOptions]@{ MaxDegreeOfParallelism = 250 }, [System.Action[int]]{
        param($p)
        if ($found.Value -gt 0) { return }
        $c = New-Object System.Net.Sockets.TcpClient
        try {
            $iar = $c.BeginConnect($ip, $p, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(50, $false)) {
                $c.EndConnect($iar)
                [System.Threading.Interlocked]::Exchange($found, $p) | Out-Null
            }
        } catch {}
        finally {
            $c.Close()
        }
    })
    
    return $found.Value
}

Write-Host "=== TU DONG DO TIM VA KET NOI THIET BI SAFESOLO ===" -ForegroundColor Cyan

# 1. DIEN THOAI
Write-Host "1. Kiem tra Dien thoai Samsung ($PhoneIp)..." -ForegroundColor White
$pPort = Find-AdbPort -ip $PhoneIp
if ($pPort -gt 0) {
    Write-Host "   [OK] Phat hien dien thoai dang mo cong: $pPort" -ForegroundColor Green
    & $adb connect "$($PhoneIp):$pPort"
    if ($pPort -ne 5555) {
        Write-Host "   -> Co dinh ve cong 5555 de ghi nho..." -ForegroundColor Yellow
        & $adb -s "$($PhoneIp):$pPort" tcpip 5555
        Start-Sleep -Seconds 1
        & $adb connect "$($PhoneIp):5555"
    }
    & $adb -s "$($PhoneIp):5555" reverse tcp:4000 tcp:4000
} else {
    Write-Host "   [!] Chua thay dien thoai. Hay dam bao 'Go loi qua Wi-Fi' dang BAT." -ForegroundColor Red
}

# 2. DONG HO
Write-Host "2. Kiem tra Dong ho Galaxy Watch ($WatchIp)..." -ForegroundColor White
$wPort = Find-AdbPort -ip $WatchIp
if ($wPort -gt 0) {
    Write-Host "   [OK] Phat hien dong ho dang mo cong: $wPort" -ForegroundColor Green
    & $adb connect "$($WatchIp):$wPort"
    if ($wPort -ne 5555) {
        Write-Host "   -> Co dinh ve cong 5555 de ghi nho..." -ForegroundColor Yellow
        & $adb -s "$($WatchIp):$wPort" tcpip 5555
        Start-Sleep -Seconds 1
        & $adb connect "$($WatchIp):5555"
    }
    & $adb -s "$($WatchIp):5555" reverse tcp:4000 tcp:4000
} else {
    Write-Host "   [!] Chua phat hien dong ho (co the man hinh tat hoac can ghep noi Wi-Fi)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DANH SACH THIET BI DA KET NOI ===" -ForegroundColor Cyan
& $adb devices -l
