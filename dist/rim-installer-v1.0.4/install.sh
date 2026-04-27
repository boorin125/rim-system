#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — One-Click Installer (Pre-built Docker Images)
#  สำหรับ server ที่ใช้ Docker Hub images (dist package)
#  Rubjobb Development Team — rub-jobb.com
# ════════════════════════════════════════════════════════════

set -e

RIM_VERSION="1.0.4"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "  ██████╗ ██╗███╗   ███╗"
echo "  ██╔══██╗██║████╗ ████║"
echo "  ██████╔╝██║██╔████╔██║"
echo "  ██╔══██╗██║██║╚██╔╝██║"
echo "  ██║  ██║██║██║ ╚═╝ ██║"
echo "  ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝"
echo -e "${NC}"
echo -e "${BOLD}  Remote Incident Management System v${RIM_VERSION}${NC}"
echo -e "  Rubjobb Development Team — rub-jobb.com"
echo ""
echo "════════════════════════════════════════════"
echo ""

# ── ตรวจสอบว่ารันจาก installer folder ──────────
if [ ! -f "docker-compose.yml" ]; then
  echo -e "${RED}❌ กรุณารันสคริปต์นี้จากโฟลเดอร์ที่มีไฟล์ docker-compose.yml${NC}"
  exit 1
fi

# ── Check Prerequisites ───────────────────────
echo -e "${YELLOW}[1/6] ตรวจสอบ Prerequisites...${NC}"

# Docker
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ ไม่พบ Docker กรุณารัน setup-docker.sh ก่อน:${NC}"
  echo "   bash setup-docker.sh"
  exit 1
fi

# อัปเดต package list ก่อน (เพื่อให้ install ได้)
apt-get update -qq 2>/dev/null || true

# unzip (ใช้สำหรับ update)
if ! command -v unzip &>/dev/null; then
  echo -e "${YELLOW}→ ติดตั้ง unzip...${NC}"
  apt-get install -y unzip -qq 2>/dev/null || yum install -y unzip -q 2>/dev/null || true
fi

# openssl
if ! command -v openssl &>/dev/null; then
  echo -e "${YELLOW}→ ติดตั้ง openssl...${NC}"
  apt-get install -y openssl -qq 2>/dev/null || true
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
  if ! command -v docker-compose &>/dev/null; then
    echo -e "${RED}❌ ไม่พบ Docker Compose${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✅ Docker พร้อมใช้งาน ($(docker --version | cut -d' ' -f3 | tr -d ','))${NC}"
echo ""

# ── Collect Configuration ─────────────────────
echo -e "${YELLOW}[2/6] ตั้งค่าระบบ...${NC}"
echo ""

# APP_URL
echo -e "${BOLD}Server URL หรือ IP Address:${NC}"
echo "  (ตัวอย่าง: http://192.168.1.100  หรือ  https://rim.yourcompany.com)"
read -rp "  URL: " APP_URL
APP_URL="${APP_URL:-http://localhost}"
APP_URL="${APP_URL%/}"

echo ""

# DB Password
echo -e "${BOLD}รหัสผ่าน Database:${NC}"
echo "  (ตั้งรหัสผ่านแข็งแรงอย่างน้อย 8 ตัวอักษร)"
while true; do
  read -rsp "  Password: " DB_PASSWORD
  echo ""
  read -rsp "  ยืนยัน Password: " DB_PASSWORD2
  echo ""
  if [ "$DB_PASSWORD" = "$DB_PASSWORD2" ] && [ ${#DB_PASSWORD} -ge 8 ]; then
    break
  fi
  echo -e "${RED}  รหัสผ่านไม่ตรงกัน หรือสั้นเกินไป (ต้องมีอย่างน้อย 8 ตัว)${NC}"
done

echo ""

# Admin account
echo -e "${BOLD}บัญชีผู้ดูแลระบบ (Super Admin):${NC}"
read -rp "  ชื่อ (First Name): " ADMIN_FIRST
ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
read -rp "  นามสกุล (Last Name): " ADMIN_LAST
ADMIN_LAST="${ADMIN_LAST:-User}"
read -rp "  Email: " ADMIN_EMAIL
while true; do
  read -rsp "  Password: " ADMIN_PASSWORD
  echo ""
  read -rsp "  ยืนยัน Password: " ADMIN_PASSWORD2
  echo ""
  if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD2" ] && [ ${#ADMIN_PASSWORD} -ge 6 ]; then
    break
  fi
  echo -e "${RED}  รหัสผ่านไม่ตรงกัน หรือสั้นเกินไป${NC}"
done

echo ""

# License Key
echo -e "${BOLD}License Key:${NC}"
echo "  (รูปแบบ XXXX-XXXX-XXXX-XXXX — รับจาก Rubjobb Development Team)"
while true; do
  read -rp "  License Key: " LICENSE_KEY
  if [[ "$LICENSE_KEY" =~ ^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$ ]]; then
    break
  fi
  echo -e "${RED}  รูปแบบ License Key ไม่ถูกต้อง (ต้องเป็น XXXX-XXXX-XXXX-XXXX)${NC}"
done

echo ""
echo -e "${GREEN}✅ รับค่าการตั้งค่าครบแล้ว${NC}"
echo ""

# ── Pull Images & Generate .env ───────────────
echo -e "${YELLOW}[3/6] ดาวน์โหลด Docker images และสร้างไฟล์ตั้งค่า...${NC}"

# Pull backend image ก่อน (จำเป็นสำหรับ VAPID key generation)
echo -e "${YELLOW}→ ดาวน์โหลด backend image...${NC}"
docker pull rubjobb/rim-backend:${RIM_VERSION}
echo ""

JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64 2>/dev/null || openssl rand -hex 32)

MACHINE_ID=""
if [ -f /etc/machine-id ]; then
  MACHINE_ID=$(cat /etc/machine-id)
elif command -v uuidgen &>/dev/null; then
  MACHINE_ID=$(uuidgen | tr -d '-')
else
  MACHINE_ID=$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 32)
fi

# Generate VAPID keys ก่อน docker compose up (bypass entrypoint เพื่อข้าม prisma)
echo -e "${YELLOW}→ สร้าง VAPID keys...${NC}"
VAPID_RAW=$(docker run --rm --entrypoint node rubjobb/rim-backend:${RIM_VERSION} \
  -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();process.stdout.write(k.publicKey+'|||'+k.privateKey);" 2>/dev/null || echo "")
if [ -n "$VAPID_RAW" ] && echo "$VAPID_RAW" | grep -q "|||"; then
  VAPID_PUBLIC_KEY=$(echo "$VAPID_RAW" | cut -d'|' -f1)
  VAPID_PRIVATE_KEY=$(echo "$VAPID_RAW" | cut -d'|' -f4)
  echo -e "${GREEN}✅ VAPID keys พร้อม${NC}"
else
  echo -e "${RED}❌ ไม่สามารถสร้าง VAPID keys ได้ — ตรวจสอบว่า Docker image ดาวน์โหลดสำเร็จ${NC}"
  exit 1
fi

cat > .env << EOF
# RIM System Configuration — generated by install.sh
RIM_VERSION=${RIM_VERSION}
APP_URL=${APP_URL}
DB_NAME=rimdb
DB_USER=rimuser
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
MACHINE_ID=${MACHINE_ID}
LICENSE_KEY=${LICENSE_KEY}
CENTRAL_LICENSE_URL=https://rim-license-server-production.up.railway.app
VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_EMAIL=mailto:admin@rim-system.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
EOF

# Strip \r (Windows CRLF) ที่อาจติดมากับ heredoc
sed -i 's/\r//' .env

echo -e "${GREEN}✅ สร้างไฟล์ .env เรียบร้อย${NC}"
echo ""

# ── SSL Certificate ───────────────────────────
SSL_DIR="./docker/nginx/ssl"
mkdir -p "$SSL_DIR"
if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
  echo -e "${YELLOW}→ สร้าง SSL Certificate (Self-signed 10 ปี)...${NC}"
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -subj "/C=TH/ST=Bangkok/O=RIM System/CN=localhost" 2>/dev/null
  echo -e "${GREEN}✅ SSL Certificate พร้อม${NC}"
  echo -e "   (ใช้ Self-signed — หากมี domain จริง ให้แทนที่ cert.pem/key.pem ภายหลัง)"
fi
echo ""

# ── Pull remaining images & Start ────────────
echo -e "${YELLOW}[4/6] ดาวน์โหลด images ที่เหลือและเริ่มต้นระบบ...${NC}"
echo ""

$COMPOSE_CMD pull
$COMPOSE_CMD up -d

echo ""

# ── รอ Backend พร้อม ──────────────────────────
echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=240
ELAPSED=0
BACKEND_READY=false
until $COMPOSE_CMD exec -T backend wget -qO- http://localhost:3000/api/version &>/dev/null; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️  Backend ไม่ตอบสนองภายใน ${MAX_WAIT}s${NC}"
    echo -e "${YELLOW}   ดู logs เพื่อตรวจสอบ: docker logs rim-backend --tail 30${NC}"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -e "   รอ... (${ELAPSED}s)"
done
if $COMPOSE_CMD exec -T backend wget -qO- http://localhost:3000/api/version &>/dev/null; then
  BACKEND_READY=true
  echo -e "${GREEN}✅ Backend พร้อม${NC}"
fi

# ── Setup Admin ───────────────────────────────
echo -e "${YELLOW}[5/6] สร้างบัญชี Super Admin...${NC}"

ADMIN_USERNAME=$(echo "$ADMIN_EMAIL" | cut -d'@' -f1 | tr -cd 'a-zA-Z0-9_-')

cat > /tmp/rim_create_admin.js << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  const email    = process.env.A_EMAIL;
  const pass     = process.env.A_PASS;
  const first    = process.env.A_FIRST;
  const last     = process.env.A_LAST;
  const username = process.env.A_USERNAME;
  const hash = await bcrypt.hash(pass, 12);
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email, password: hash,
        firstName: first, lastName: last, username,
        status: 'ACTIVE',
        isProtected: true,
        roles: { create: { role: 'SUPER_ADMIN' } },
      },
    });
    console.log('✅ สร้างบัญชี Super Admin สำเร็จ:', email);
  } else {
    console.log('ℹ️  Email หรือ Username นี้มีอยู่แล้ว:', email);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
JSEOF

docker cp /tmp/rim_create_admin.js rim-backend:/app/rim_create_admin.js

# รอ container running ก่อน exec
RETRY=0
until docker inspect -f '{{.State.Status}}' rim-backend 2>/dev/null | grep -q "^running$"; do
  if [ $RETRY -ge 60 ]; then
    echo -e "${RED}❌ Backend container ไม่ได้อยู่ในสถานะ running — ดู: docker logs rim-backend --tail 30${NC}"
    break
  fi
  sleep 3
  RETRY=$((RETRY + 3))
done

docker exec \
  -e A_EMAIL="$ADMIN_EMAIL" \
  -e A_PASS="$ADMIN_PASSWORD" \
  -e A_FIRST="$ADMIN_FIRST" \
  -e A_LAST="$ADMIN_LAST" \
  -e A_USERNAME="$ADMIN_USERNAME" \
  rim-backend node /app/rim_create_admin.js || \
  echo -e "${YELLOW}⚠️  สร้าง Admin อัตโนมัติไม่สำเร็จ — ทำด้วยตนเองได้ตาม INSTALL.md (สร้าง Super Admin ด้วยตนเอง)${NC}"

# ── Install Update Watchdog (systemd) ─────────
echo ""
echo -e "${YELLOW}[6/6] ติดตั้ง Update Watchdog service...${NC}"

INSTALL_DIR="$(pwd)"

# สร้าง watchdog script
cat > /tmp/rim-watchdog.sh << WEOF
#!/bin/bash
# RIM System Update Watchdog — ตรวจสอบ flag file และรัน update
FLAG_FILE="${INSTALL_DIR}/signals/.update-flag"
LOG_FILE="${INSTALL_DIR}/watchdog.log"
if [ -f "\$FLAG_FILE" ]; then
  VERSION=\$(cat "\$FLAG_FILE" 2>/dev/null | tr -d '[:space:]')
  echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Update triggered: v\${VERSION}" >> "\$LOG_FILE"
  rm -f "\$FLAG_FILE"
  cd "${INSTALL_DIR}"
  bash update.sh "\${VERSION}" >> "\$LOG_FILE" 2>&1
  echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Update complete" >> "\$LOG_FILE"
fi
WEOF

if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
  sudo cp /tmp/rim-watchdog.sh /usr/local/bin/rim-watchdog.sh
  sudo chmod +x /usr/local/bin/rim-watchdog.sh

  # systemd timer
  sudo tee /etc/systemd/system/rim-watchdog.service > /dev/null << SEOF
[Unit]
Description=RIM System Update Watchdog

[Service]
Type=oneshot
ExecStart=/usr/local/bin/rim-watchdog.sh
SEOF

  sudo tee /etc/systemd/system/rim-watchdog.timer > /dev/null << TEOF
[Unit]
Description=RIM System Update Watchdog Timer

[Timer]
OnBootSec=60
OnUnitActiveSec=30s
Unit=rim-watchdog.service

[Install]
WantedBy=timers.target
TEOF

  sudo systemctl daemon-reload
  sudo systemctl enable --now rim-watchdog.timer
  echo -e "${GREEN}✅ Update Watchdog ติดตั้งแล้ว (ตรวจสอบทุก 30 วินาที)${NC}"
else
  echo -e "${YELLOW}⚠️  ไม่พบ systemd — ข้ามการติดตั้ง Watchdog${NC}"
  echo -e "   (อัปเดตด้วยตนเอง: bash update.sh)${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ ติดตั้ง RIM System v${RIM_VERSION} สำเร็จ!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 URL ระบบ   : ${BOLD}${APP_URL}${NC}"
echo -e "  👤 Admin Email: ${BOLD}${ADMIN_EMAIL}${NC}"
echo -e "  📦 Version    : ${BOLD}v${RIM_VERSION}${NC}"
echo ""
echo -e "  คำสั่งที่ใช้บ่อย:"
echo -e "    ดู status  : ${YELLOW}${COMPOSE_CMD} ps${NC}"
echo -e "    ดู logs    : ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
echo -e "    หยุดระบบ   : ${YELLOW}${COMPOSE_CMD} down${NC}"
echo -e "    อัปเดต     : ${YELLOW}./update.sh${NC}"
echo ""
echo -e "  📞 support@rub-jobb.com | 061-228-2879"
echo ""
