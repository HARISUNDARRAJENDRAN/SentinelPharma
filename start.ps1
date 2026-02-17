# SentinelPharma Startup Script
# ==========================
# Starts all three services in separate PowerShell windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting SentinelPharma Application" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Kill existing processes on the ports
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3001,5174,8000 -State Listen -ErrorAction SilentlyContinue | 
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Start AI Engine (Python)
Write-Host "`n[1/3] Starting AI Engine (Python)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd D:\SentinelPharma\ai_engine; Write-Host 'AI Engine Starting...' -ForegroundColor Green; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)
Start-Sleep -Seconds 5

# Start Server (Node.js)
Write-Host "[2/3] Starting Server (Node.js)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd D:\SentinelPharma\server; Write-Host 'Server Starting...' -ForegroundColor Green; npm start"
)
Start-Sleep -Seconds 3

# Start Client (React)
Write-Host "[3/3] Starting Client (React)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd D:\SentinelPharma\client; Write-Host 'Client Starting...' -ForegroundColor Green; npm run dev"
)

Start-Sleep -Seconds 5

# Check status
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Application Status Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$ports = @(
    @{Port=8000; Name="AI Engine"; URL="http://localhost:8000"},
    @{Port=3001; Name="Server"; URL="http://localhost:3001"},
    @{Port=5174; Name="Client"; URL="http://localhost:5174"}
)

foreach ($service in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "✓ $($service.Name) running on $($service.URL)" -ForegroundColor Green
    } else {
        Write-Host "✗ $($service.Name) not detected on port $($service.Port)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Access the application:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5174" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "  AI Engine: http://localhost:8000" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan
