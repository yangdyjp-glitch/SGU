$sguPidFile = Join-Path $PSScriptRoot '.data/server-process.json'
if (-not (Test-Path -LiteralPath $sguPidFile)) { Write-Output '没有此启动脚本记录的服务进程。'; exit 0 }
$sguRecord = Get-Content -LiteralPath $sguPidFile | ConvertFrom-Json
$sguProcessId = [int]$sguRecord.pid
$sguProcess = Get-Process -Id $sguProcessId -ErrorAction SilentlyContinue
if ($sguProcess -and $sguProcess.ProcessName -eq 'node' -and $sguRecord.root -eq $PSScriptRoot) {
    if ($sguProcess.StartTime.ToUniversalTime().ToString('o') -eq $sguRecord.started) { Stop-Process -Id $sguProcessId; Write-Output 'SGU服务已停止。'; exit 0 }
}
Write-Output '记录的进程已退出或不匹配，未停止其他进程。'
