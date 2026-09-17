@echo off
title SafeSolo Backend Server (Port 4000)
cd /d "%~dp0backend"
echo ========================================================
echo   SAFESOLO BACKEND SERVER (Node.js / Express / MongoDB)
echo ========================================================
echo Server dang khoi chay tai http://localhost:4000
npm start
pause
