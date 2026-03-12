@echo off
chcp 65001 >nul
cls

echo.
echo   ██████╗ ██╗███╗   ███╗
echo   ██╔══██╗██║████╗ ████║
echo   ██████╔╝██║██╔████╔██║
echo   ██╔══██╗██║██║╚██╔╝██║
echo   ██║  ██║██║██║     ██║
echo   ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝
echo.
echo   Remote Incident Management System
echo   Rubjobb Development Team - rub-jobb.com
echo.
echo ============================================
echo.

:: Check Docker
echo [1/5] ตรวจสอบ Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: ไม่พบ Docker Desktop
    echo กรุณาดาวน์โหลดและติดตั้งก่อน:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo OK: Docker พร้อมใช้งาน
echo.

:: Collect Configuration
echo [2/5] ตั้งค่าระบบ...
echo.
echo Server URL หรือ IP Address:
echo (ตัวอย่าง: http://192.168.1.100 หรือ https://rim.yourcompany.com)
set /p APP_URL="  URL: "
if "%APP_URL%"=="" set APP_URL=http://localhost

echo.
echo รหัสผ่าน Database (อย่างน้อย 8 ตัวอักษร):
set /p DB_PASSWORD="  Password: "

echo.
echo บัญชีผู้ดูแลระบบ (Super Admin):
set /p ADMIN_NAME="  ชื่อ-นามสกุล: "
set /p ADMIN_EMAIL="  Email: "
set /p ADMIN_PASSWORD="  Password: "

echo.
echo [3/5] สร้างไฟล์ตั้งค่า...

:: Generate random JWT secret using PowerShell
for /f "delims=" %%i in ('powershell -Command "[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))"') do set JWT_SECRET=%%i

:: Write .env file
(
echo APP_URL=%APP_URL%
echo DB_NAME=rimdb
echo DB_USER=rimuser
echo DB_PASSWORD=%DB_PASSWORD%
echo JWT_SECRET=%JWT_SECRET%
echo SMTP_HOST=
echo SMTP_PORT=587
echo SMTP_USER=
echo SMTP_PASS=
echo SMTP_FROM=
) > .env

echo OK: สร้างไฟล์ .env เรียบร้อย
echo.

:: Build & Start
echo [4/5] Build และเริ่มต้นระบบ (อาจใช้เวลา 3-5 นาที)...
echo.
docker compose build --parallel
docker compose up -d

echo.
echo รอ Database พร้อม...
timeout /t 10 /nobreak >nul

:: Migrations
echo [5/5] ตั้งค่าฐานข้อมูล...
docker compose exec -T backend npx prisma migrate deploy

:: Create admin
docker compose exec -T backend node -e "const{PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const p=new PrismaClient();async function m(){const h=await bcrypt.hash('%ADMIN_PASSWORD%',12);const e=await p.user.findUnique({where:{email:'%ADMIN_EMAIL%'}});if(!e){const n='%ADMIN_NAME%'.split(' ');await p.user.create({data:{email:'%ADMIN_EMAIL%',password:h,firstName:n[0]||'Admin',lastName:n.slice(1).join(' ')||'User',status:'ACTIVE',roles:{create:{role:'SUPER_ADMIN'}}}});console.log('สร้างบัญชี Admin สำเร็จ');}await p.$disconnect();}m();"

echo.
echo ============================================
echo   ติดตั้ง RIM System สำเร็จ!
echo ============================================
echo.
echo   URL ระบบ   : %APP_URL%
echo   Admin Email: %ADMIN_EMAIL%
echo.
echo   คำสั่งที่ใช้บ่อย:
echo     ดู status : docker compose ps
echo     ดู logs   : docker compose logs -f
echo     หยุดระบบ  : docker compose down
echo     อัปเดต    : update.bat
echo.
echo   support@rub-jobb.com
echo.
pause
