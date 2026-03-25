$port = 8000

Write-Host "Starting local server at http://localhost:$port" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray

python -m http.server $port
