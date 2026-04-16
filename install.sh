#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — One-Click Installer (Source Build)
#  สำหรับ server ที่ git clone source code มา
#  Rubjobb Development Team — rub-jobb.com
# ════════════════════════════════════════════════════════════

set -e

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
echo -e "${BOLD}  Remote Incident Management System${NC}"
echo -e "  Rubjobb Development Team — rub-jobb.com"
echo ""
echo "════════════════════════════════════════════"
echo ""

# ── ตรวจสอบว่ารันจาก project root ──────────────
if [ ! -f "docker-compose.yml" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo -e "${RED}❌ กรุณารันสคริปต์นี้จากโฟลเดอร์ root ของ RIM System${NC}"
  exit 1
fi

# ── Check Docker ──────────────────────────────
echo -e "${YELLOW}[1/5] ตรวจสอบ Docker...${NC}"
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ ไม่พบ Docker กรุณาติดตั้งก่อน:${NC}"
  echo "   https://docs.docker.com/engine/install/"
  exit 1
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
echo -e "${YELLOW}[2/5] ตั้งค่าระบบ...${NC}"
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
echo "  (ตั้งรหัสผ่านแข็งแรงอย่างน้อย 12 ตัวอักษร)"
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
  if [[ "$LICENSE_KEY" =~ ^[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}$ ]]; then
    break
  fi
  echo -e "${RED}  รูปแบบ License Key ไม่ถูกต้อง (ต้องเป็น XXXX-XXXX-XXXX-XXXX)${NC}"
done

echo ""
echo -e "${GREEN}✅ รับค่าการตั้งค่าครบแล้ว${NC}"
echo ""

# ── Generate .env ─────────────────────────────
echo -e "${YELLOW}[3/5] สร้างไฟล์ตั้งค่า...${NC}"

JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64 2>/dev/null || openssl rand -hex 32)

MACHINE_ID=""
if [ -f /etc/machine-id ]; then
  MACHINE_ID=$(cat /etc/machine-id)
elif command -v uuidgen &>/dev/null; then
  MACHINE_ID=$(uuidgen | tr -d '-')
else
  MACHINE_ID=$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 32)
fi

# Generate VAPID keys via Node.js (in Docker if local node unavailable)
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
if command -v node &>/dev/null; then
  VAPID_KEYS=$(node -e "
    const crypto = require('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pub = publicKey.export({ type: 'spki', format: 'der' }).slice(-65).toString('base64url');
    const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('base64url');
    console.log(pub + ' ' + priv);
  " 2>/dev/null || echo "")
  if [ -n "$VAPID_KEYS" ]; then
    VAPID_PUBLIC_KEY=$(echo "$VAPID_KEYS" | cut -d' ' -f1)
    VAPID_PRIVATE_KEY=$(echo "$VAPID_KEYS" | cut -d' ' -f2)
  fi
fi
VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-REPLACE_WITH_VAPID_PUBLIC_KEY}"
VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-REPLACE_WITH_VAPID_PRIVATE_KEY}"

cat > .env << EOF
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

echo -e "${GREEN}✅ สร้างไฟล์ .env เรียบร้อย${NC}"
echo ""

# ── Build & Start ─────────────────────────────
echo -e "${YELLOW}[4/5] Build และเริ่มต้นระบบ (อาจใช้เวลา 5-15 นาที)...${NC}"
echo ""

$COMPOSE_CMD up -d --build

echo ""

# ── รอ Backend พร้อม ──────────────────────────
echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=120
ELAPSED=0
until $COMPOSE_CMD exec -T backend wget -qO- http://localhost:3000/api/version &>/dev/null; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️  Backend ไม่ตอบสนองภายใน ${MAX_WAIT}s — ลองต่อไปเลย${NC}"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -e "   รอ... (${ELAPSED}s)"
done
echo -e "${GREEN}✅ Backend พร้อม${NC}"

# ── Setup Admin ───────────────────────────────
echo -e "${YELLOW}[5/5] สร้างบัญชี Super Admin...${NC}"

ADMIN_USERNAME=$(echo "$ADMIN_EMAIL" | cut -d'@' -f1 | tr -cd 'a-zA-Z0-9_-')

# เขียน script เป็นไฟล์ (หลีกเลี่ยงปัญหา $ escaping ใน node -e "...")
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
docker exec \
  -e A_EMAIL="$ADMIN_EMAIL" \
  -e A_PASS="$ADMIN_PASSWORD" \
  -e A_FIRST="$ADMIN_FIRST" \
  -e A_LAST="$ADMIN_LAST" \
  -e A_USERNAME="$ADMIN_USERNAME" \
  rim-backend node /app/rim_create_admin.js

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ ติดตั้ง RIM System สำเร็จ!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 URL ระบบ   : ${BOLD}${APP_URL}${NC}"
echo -e "  👤 Admin Email: ${BOLD}${ADMIN_EMAIL}${NC}"
echo ""
echo -e "  คำสั่งที่ใช้บ่อย:"
echo -e "    ดู status  : ${YELLOW}${COMPOSE_CMD} ps${NC}"
echo -e "    ดู logs    : ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
echo -e "    หยุดระบบ   : ${YELLOW}${COMPOSE_CMD} down${NC}"
echo -e "    อัปเดต     : ${YELLOW}./update.sh${NC}"
echo ""
echo -e "  📞 support@rub-jobb.com | 061-228-2879"
echo ""
