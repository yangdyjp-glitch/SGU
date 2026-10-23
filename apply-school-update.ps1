$ErrorActionPreference = 'Stop'
$sguRoot = $PSScriptRoot
$sguPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $sguPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $sguRoot 'stop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the recorded SGU process.' }
$sguStillRunning = $false
try {
    $sguState = Invoke-RestMethod -Uri 'http://127.0.0.1:3210/api/auth/state' -TimeoutSec 2
    $sguStillRunning = $null -ne $sguState.setup
} catch {}
if ($sguStillRunning) { throw 'SGU is still running. Stop its npm terminal, then run this update again.' }
Push-Location $sguRoot
try {
    & $sguPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $sguRoot 'start.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'SGU startup failed. Check .data/server-error.log.' }
    $sguResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3210/api/auth/state' -TimeoutSec 5
    Write-Output "SGU update completed. HTTP $($sguResponse.StatusCode): http://127.0.0.1:3210/#programs"
} finally { Pop-Location }
