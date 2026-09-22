@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup.ps1" -Mode Install
set "setupExit=%errorlevel%"
echo.
pause
exit /b %setupExit%
