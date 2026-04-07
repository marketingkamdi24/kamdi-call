# kamdi24 Video Call System Startup Script
Write-Host "Starting kamdi24 Video Call System..." -ForegroundColor Green
Write-Host ""

$nodePath = "$env:USERPROFILE\nodejs\node-v20.10.0-win-x64\node.exe"
$npmPath = "$env:USERPROFILE\nodejs\node-v20.10.0-win-x64\npm.cmd"

# Check if node_modules exists, if not install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & $npmPath install
}

# Start the server
& $nodePath server/index.js
