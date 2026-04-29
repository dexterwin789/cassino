@echo off
title VemNaBet - JSESSIONID Poller
cd /d "%~dp0\.."
echo.
echo === VemNaBet JSESSIONID Poller ===
echo.
node tools\jsession-poller.js
pause
