@echo off
chcp 65001 >nul
title SafeSolo - Tự Động Kết Nối Thiết Bị
color 0A
python "%~dp0scripts\adb_auto_connect.py"
pause
