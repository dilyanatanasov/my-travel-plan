# Open the Umami analytics dashboard.
#
# The dashboard is deliberately not on the internet - it listens on the
# droplet's localhost only. This script does the whole login dance:
#   1. copies the admin password to the clipboard (stored in the local
#      ~/.ssh/contrail-server.env companion file, never in the repo),
#   2. opens http://localhost:3001 in the browser,
#   3. holds the SSH tunnel open until you press Ctrl+C or close the window.
#
# ASCII only in this file: PowerShell 5.1 reads BOM-less files as ANSI, and
# fancy dashes decode into curly-quote bytes that break the parser.
#
# Usage:  umami   (via the shim in ~\bin)  or  .\scripts\umami.ps1

$envFile = Join-Path $env:USERPROFILE '.ssh\contrail-server.env'
$keyFile = Join-Path $env:USERPROFILE '.ssh\contrail_deploy'
$droplet = '157.230.227.115'

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: $envFile not found - the admin password lives there." -ForegroundColor Red
    exit 1
}

$line = Select-String -Path $envFile -Pattern '^UMAMI_ADMIN_PASSWORD=' | Select-Object -Last 1
if (-not $line) {
    Write-Host "ERROR: no UMAMI_ADMIN_PASSWORD line in $envFile" -ForegroundColor Red
    exit 1
}
$password = $line.Line.Split('=', 2)[1]
Set-Clipboard -Value $password

Write-Host ''
Write-Host '  Umami dashboard' -ForegroundColor Cyan
Write-Host '  ---------------'
Write-Host '  URL:      http://localhost:3001'
Write-Host '  Username: admin'
Write-Host '  Password: (already on your clipboard - just paste)'
Write-Host ''
Write-Host '  Opening browser; the tunnel stays up until Ctrl+C.' -ForegroundColor DarkGray
Write-Host ''

# Give the tunnel a moment to bind before the browser asks for the page.
Start-Job -ScriptBlock { Start-Sleep -Seconds 2; Start-Process 'http://localhost:3001' } | Out-Null

ssh -i $keyFile -L 3001:localhost:3001 root@$droplet 'echo "Tunnel up - leave this window open. Ctrl+C to close."; sleep infinity'
