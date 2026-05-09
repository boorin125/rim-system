#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — One-Click Installer (Docker Image)
#  Pull pre-built images จาก Docker Hub + setup อัตโนมัติ
#  Rubjobb Development Team — rub-jobb.com
# ════════════════════════════════════════════════════════════

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# ── Detect sudo/root ───────────────────────────
if [ "$EUID" -eq 0 ]; then
  SUDO=""
else
  if ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}Script นี้ต้องการ sudo สำหรับ SSL Certificate${NC}"
    echo -e "${YELLOW}กรุณาใส่รหัสผ่าน sudo:${NC}"
    sudo true || { echo -e "${RED}❌ sudo ไม่สำเร็จ${NC}"; exit 1; }
  fi
  SUDO="sudo"
fi

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

# ── [1/5] ตรวจสอบ Docker ──────────────────────
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

# ── [2/5] ตั้งค่าระบบ ──────────────────────────
echo -e "${YELLOW}[2/5] ตั้งค่าระบบ...${NC}"
echo ""

# Organization Name
echo -e "${BOLD}ชื่อบริษัท / Organization Name:${NC}"
read -rp "  ชื่อ: " ORG_NAME
ORG_NAME="${ORG_NAME:-My Organization}"
echo ""

# APP_URL
echo -e "${BOLD}Server URL หรือ IP Address:${NC}"
echo "  (ตัวอย่าง: http://192.168.1.100  หรือ  https://rim.yourcompany.com)"
read -rp "  URL: " APP_URL
APP_URL="${APP_URL:-http://localhost}"
APP_URL="${APP_URL%/}"
echo ""

# ตรวจว่าใช้ HTTPS + domain จริงหรือเปล่า
USE_LETSENCRYPT=false
LE_EMAIL=""
DOMAIN="localhost"
if [[ "$APP_URL" == https://* ]]; then
  DOMAIN=$(echo "$APP_URL" | sed 's|https://||' | sed 's|/.*||')
  echo -e "${BOLD}SSL Certificate สำหรับ ${DOMAIN}:${NC}"
  echo "  1. Self-signed  — ทดสอบได้ทันที (browser จะแสดง security warning)"
  echo "  2. Let's Encrypt — cert จริง ไม่มี warning (ต้องมี port 80/443 เปิดสู่ internet)"
  read -rp "  เลือก [1/2]: " SSL_CHOICE
  if [ "${SSL_CHOICE:-1}" = "2" ]; then
    USE_LETSENCRYPT=true
    read -rp "  Email สำหรับ Let's Encrypt notifications: " LE_EMAIL
  fi
  echo ""
fi

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

echo ""
echo -e "${GREEN}✅ รับค่าการตั้งค่าครบแล้ว${NC}"
echo ""

# ── [3/5] สร้าง .env + SSL ─────────────────────
echo -e "${YELLOW}[3/5] สร้างไฟล์ตั้งค่าและ SSL Certificate...${NC}"

JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64 2>/dev/null || openssl rand -hex 32)

MACHINE_ID=""
if [ -f /etc/machine-id ]; then
  MACHINE_ID=$(cat /etc/machine-id)
elif command -v uuidgen &>/dev/null; then
  MACHINE_ID=$(uuidgen | tr -d '-')
else
  MACHINE_ID=$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 32)
fi

# ── Auto-register Trial License ────────────────
echo -e "${YELLOW}→ ขอ Trial License อัตโนมัติ...${NC}"
LICENSE_KEY=""
REGISTER_RESPONSE=""
if command -v curl &>/dev/null; then
  ORG_NAME_SAFE=$(printf '%s' "$ORG_NAME" | sed 's/["\\]/\\&/g')
  REGISTER_RESPONSE=$(curl -sf --max-time 15 \
    -X POST "https://license.rub-jobb.com/api/register" \
    -H "Content-Type: application/json" \
    -d "{\"organizationName\":\"${ORG_NAME_SAFE}\",\"contactEmail\":\"${ADMIN_EMAIL}\",\"machineId\":\"${MACHINE_ID}\",\"product\":\"RIM\"}" \
    2>/dev/null || echo "")
  if [ -n "$REGISTER_RESPONSE" ]; then
    LICENSE_KEY=$(echo "$REGISTER_RESPONSE" | grep -o '"licenseKey":"[^"]*"' | cut -d'"' -f4)
  fi
fi

if [ -n "$LICENSE_KEY" ]; then
  echo -e "${GREEN}✅ ได้รับ Trial License Key: ${BOLD}${LICENSE_KEY}${NC}"
  TRIAL_DAYS=$(echo "$REGISTER_RESPONSE" | grep -o '"trialDays":[0-9]*' | cut -d':' -f2)
  echo -e "   (ทดลองใช้ ${TRIAL_DAYS:-30} วัน — ต่ออายุได้ที่ support@rub-jobb.com)"
else
  echo -e "${YELLOW}⚠️  ไม่สามารถรับ License อัตโนมัติได้ กรุณาใส่ License Key ด้วยตนเอง${NC}"
  echo "  (รูปแบบ XXXX-XXXX-XXXX-XXXX — รับจาก Rubjobb Development Team)"
  while true; do
    read -rp "  License Key: " LICENSE_KEY
    if [[ "$LICENSE_KEY" =~ ^[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}$ ]]; then
      break
    fi
    echo -e "${RED}  รูปแบบ License Key ไม่ถูกต้อง (ต้องเป็น XXXX-XXXX-XXXX-XXXX)${NC}"
  done
fi
echo ""

# Generate VAPID keys
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
CENTRAL_LICENSE_URL=https://license.rub-jobb.com
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

# ── SSL Certificate ────────────────────────────
SSL_DIR="./docker/nginx/ssl"
mkdir -p "$SSL_DIR"

if $USE_LETSENCRYPT; then
  echo -e "${YELLOW}→ ติดตั้ง Certbot...${NC}"
  if ! command -v certbot &>/dev/null; then
    $SUDO snap install certbot --classic 2>/dev/null && $SUDO ln -sf /snap/bin/certbot /usr/bin/certbot 2>/dev/null || \
    $SUDO apt-get install -y certbot 2>/dev/null || {
      echo -e "${RED}❌ ติดตั้ง certbot ไม่ได้ — ใช้ Self-signed แทน${NC}"
      USE_LETSENCRYPT=false
    }
  fi
fi

if $USE_LETSENCRYPT && command -v certbot &>/dev/null; then
  echo -e "${YELLOW}→ ขอ Let's Encrypt Certificate สำหรับ ${DOMAIN}...${NC}"
  echo -e "   (certbot จะฟัง port 80 ชั่วคราว — ต้องแน่ใจว่าไม่มีอะไรใช้ port 80 อยู่)${NC}"
  $SUDO certbot certonly --standalone -d "$DOMAIN" \
    --email "$LE_EMAIL" --agree-tos --non-interactive --quiet
  # Copy certs to nginx ssl dir
  $SUDO cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem "$SSL_DIR/cert.pem"
  $SUDO cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem  "$SSL_DIR/key.pem"
  $SUDO chmod 644 "$SSL_DIR/cert.pem"
  $SUDO chmod 600 "$SSL_DIR/key.pem"
  echo -e "${GREEN}✅ Let's Encrypt Certificate สำเร็จ!${NC}"
  echo -e "   ต่ออายุ cert (รันทุก 60 วัน): ${YELLOW}sudo certbot renew && docker compose restart nginx${NC}"
else
  echo -e "${YELLOW}→ สร้าง Self-signed SSL Certificate...${NC}"
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -subj "/C=TH/ST=Bangkok/O=RIM System/CN=${DOMAIN}" 2>/dev/null
  echo -e "${GREEN}✅ SSL Certificate พร้อม (Self-signed)${NC}"
fi
echo ""

# ── [4/5] Pull Images & Start ──────────────────
echo -e "${YELLOW}[4/5] Download Docker Images และเริ่มต้นระบบ...${NC}"
echo ""

$COMPOSE_CMD pull
echo ""
$COMPOSE_CMD up -d
echo ""

# ── รอ Backend พร้อม (ใช้ Docker healthcheck status) ────────────────
echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=180
ELAPSED=0
until [ "$(docker inspect --format='{{.State.Health.Status}}' rim-backend 2>/dev/null)" = "healthy" ]; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️  Backend ไม่ตอบสนองภายใน ${MAX_WAIT}s${NC}"
    echo -e "${YELLOW}   ดู logs: docker logs rim-backend --tail 30${NC}"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  STATUS=$(docker inspect --format='{{.State.Status}}' rim-backend 2>/dev/null || echo "unknown")
  echo -e "   รอ... (${ELAPSED}s) [${STATUS}]"
done
BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' rim-backend 2>/dev/null || echo "unknown")
if [ "$BACKEND_HEALTH" = "healthy" ]; then
  echo -e "${GREEN}✅ Backend พร้อม${NC}"
else
  echo -e "${RED}⚠️  Backend ยังไม่พร้อม (${BACKEND_HEALTH}) — ข้ามขั้นตอนสร้าง Admin${NC}"
  echo -e "${YELLOW}   หลัง backend พร้อม ให้รัน: docker logs rim-backend --tail 50${NC}"
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  ✅ ติดตั้ง RIM System เสร็จแล้ว (รอ backend พร้อมก่อนใช้งาน)${NC}"
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  🌐 URL ระบบ   : ${BOLD}${APP_URL}${NC}"
  echo -e "  📞 support@rub-jobb.com | 061-228-2879"
  echo ""
  exit 0
fi

# ── [5/5] Setup Admin ───────────────────────────
echo -e "${YELLOW}[5/5] สร้างบัญชี Super Admin...${NC}"

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
