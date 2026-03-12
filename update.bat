@echo off
chcp 65001 >nul
echo.
echo RIM System — Update
echo ====================================
echo.

:: Backup DB
echo Backup ฐานข้อมูลก่อนอัปเดต...
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATE=%%d%%b%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME=%%a%%b
set BACKUP_FILE=rim_backup_%DATE%_%TIME%.sql
docker compose exec -T postgres pg_dump -U rimuser rimdb > %BACKUP_FILE%
echo OK: Backup -> %BACKUP_FILE%
echo.

:: Build
echo Build ใหม่...
docker compose build --parallel --no-cache
echo.

:: Restart
echo อัปเดต services...
docker compose up -d --no-deps backend
timeout /t 8 /nobreak >nul
docker compose exec -T backend npx prisma migrate deploy
docker compose up -d --no-deps frontend
timeout /t 3 /nobreak >nul
docker compose up -d --no-deps nginx

echo.
echo ====================================
echo   อัปเดตสำเร็จ!
echo ====================================
echo.
docker compose ps
echo.
echo Backup file: %BACKUP_FILE%
echo.
pause
