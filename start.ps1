$ErrorActionPreference = 'Stop'
$sguRoot = $PSScriptRoot
$sguUrl = 'http://127.0.0.1:3210'
try { $sguStatus = Invoke-RestMethod -Uri ($sguUrl + '/api/auth/state') -TimeoutSec 2; if ($null -ne $sguStatus.setup) { Start-Process $sguUrl; exit 0 } } catch {}
$sguNode = (Get-Command node -ErrorAction Stop).Source
$sguData = Join-Path $sguRoot '.data'
New-Item -ItemType Directory -Path $sguData -Force | Out-Null
$sguProcess = Start-Process -FilePath $sguNode -ArgumentList @('--env-file-if-exists=.env', 'server.mjs') -WorkingDirectory $sguRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $sguData 'server.log') -RedirectStandardError (Join-Path $sguData 'server-error.log')
Set-Content -LiteralPath (Join-Path $sguData 'server.pid') -Value $sguProcess.Id
@{ pid = $sguProcess.Id; started = $sguProcess.StartTime.ToUniversalTime().ToString('o'); root = $sguRoot } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $sguData 'server-process.json')
for ($sguTry = 0; $sguTry -lt 120; $sguTry++) {
    try { $sguStatus = Invoke-RestMethod -Uri ($sguUrl + '/api/auth/state') -TimeoutSec 1; if ($null -ne $sguStatus.setup) { Start-Process $sguUrl; Write-Output "SGU: $sguUrl"; exit 0 } } catch {}
    Start-Sleep -Milliseconds 500
}
throw '启动未完成，请查看 .data/server-error.log。'
