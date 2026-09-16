@echo off
title SafeSolo Docker Stack Launcher
echo ====================================================================
echo   SAFESOLO - KHOI DONG HE THONG CONTAINER 24/7 (DOCKER COMPOSE)
echo ====================================================================

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [!] CHUA PHAT HIEN DOCKER TRONG HE THONG:
    echo   1. Vui long cai dat Docker Desktop tu file vua tai ve trong Downloads
    echo   2. Mo ung dung Docker Desktop tren Windows (doi bieu tuong ca voi chuyen sang xanh)
    echo   3. Chay lai file nay!
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0backend"

echo [1/3] Dang khoi chay cac Container (Node.js API, MongoDB 7, Redis Cache)...
docker compose up -d --build

echo.
echo [2/3] Danh sach Container dang hoat dong:
docker compose ps

echo.
echo [3/3] Kiem tra API Health:
curl -s http://127.0.0.1:4000/health
echo.

echo ====================================================================
echo   HOAN TAT! He thong SafeSolo Backend da san sang chay 24/7!
echo   - Node.js & Socket.IO: http://127.0.0.1:4000
echo   - Telegram Bot: Dang tuc truc ket noi @SFESOLOBot
echo   - Xem log truc tiep: docker logs -f safesolo-backend
echo ====================================================================
pause
