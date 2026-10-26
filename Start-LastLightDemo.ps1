param(
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source,
    [string]$CloudflaredPath = (Join-Path $PSScriptRoot 'tmp/cloudflared.exe')
)
$ErrorActionPreference = 'Stop'
$env:PORT = '3000'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/server/index.js'))) { throw 'Run corepack pnpm build first.' }
if (-not (Test-Path -LiteralPath $CloudflaredPath)) { throw 'Install cloudflared from Cloudflare, then pass its full path with -CloudflaredPath.' }
$logDirectory = Join-Path $PSScriptRoot 'tmp'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$server = Start-Process -FilePath $NodePath -ArgumentList @('dist/server/index.js', '--production') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'demo-server.log') -RedirectStandardError (Join-Path $logDirectory 'demo-server-error.log') -PassThru
$tunnel = Start-Process -FilePath $CloudflaredPath -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:3000', '--protocol', 'http2', '--no-autoupdate') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'demo-tunnel-out.log') -RedirectStandardError (Join-Path $logDirectory 'demo-tunnel.log') -PassThru
[PSCustomObject]@{ ServerPID = $server.Id; TunnelPID = $tunnel.Id; URLLog = (Join-Path $logDirectory 'demo-tunnel.log') }
Write-Host 'Wait for Registered tunnel connection in the URLLog before opening its temporary HTTPS URL. Keep both processes running while people play.'
