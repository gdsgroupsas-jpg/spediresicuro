@echo off
echo Test PowerShell...
echo.
powershell -ExecutionPolicy Bypass -Command "Write-Host 'PowerShell FUNZIONA!' -ForegroundColor Green; Get-Date"
echo.
echo Se vedi il messaggio sopra, PowerShell funziona!
echo.
pause

