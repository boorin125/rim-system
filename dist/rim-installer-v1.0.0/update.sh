#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Update Script (Pre-built Docker Images)
#  ใช้อัปเดตระบบเมื่อมีเวอร์ชั่นใหม่จาก Docker Hub
#  Rubjobb Development Team — rub-jobb.com
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# ── ตรวจสอบว่ารันจากโฟลเดอร์ที่ถูกต้อง ─────────
if [ ! -f "docker-compose.yml" ] || [ ! -f ".env" ]; then
  echo -e "${RED}❌ กรุณารันสคริปต์นี้จากโฟลเดอร์ที่ติดตั้ง RIM System${NC}"
  echo "   (ต้องมีไฟล์ docker-compose.yml และ .env)"
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

VERSION="${1:-latest}"

echo ""
echo -e "${BOLD}RIM System — Update${NC}"
echo "════════════════════════════════════"
echo -e "เวอร์ชั่น: ${YELLOW}${VERSION}${NC}"
echo ""

# ── Backup DB ─────────────────────────────────
echo -e "${YELLOW}→ Backup ฐานข้อมูลก่อนอัปเดต...${NC}"
BACKUP_FILE="rim_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

if ! $COMPOSE_CMD exec -T postgres pg_dump -U rimuser rimdb 2>/dev/null | gzip > "$BACKUP_FILE"; then
  echo -e "${RED}❌ Backup ล้มเหลว — ยกเลิกการอัปเดต${NC}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" 2>/dev/null | cut -f1)
echo -e "${GREEN}✅ Backup: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"

# เก็บไว้แค่ 3 backup ล่าสุด
ls -t rim_backup_*.sql.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
BACKUP_COUNT=$(ls rim_backup_*.sql.gz 2>/dev/null | wc -l)
echo -e "${GREEN}   (เก็บ backup ล่าสุด ${BACKUP_COUNT} ไฟล์)${NC}"
echo ""

# ── Pull new images ───────────────────────────
echo -e "${YELLOW}→ ดาวน์โหลด images เวอร์ชั่นใหม่...${NC}"

# ถ้าระบุ version ให้อัปเดต docker-compose.yml tag
if [ "$VERSION" != "latest" ]; then
  # อัปเดต image tag ใน docker-compose.yml (sed แทน ถ้ามี tag อยู่แล้ว)
  sed -i "s|rubjobb/rim-backend:[^[:space:]]*|rubjobb/rim-backend:${VERSION}|g" docker-compose.yml
  sed -i "s|rubjobb/rim-frontend:[^[:space:]]*|rubjobb/rim-frontend:${VERSION}|g" docker-compose.yml
fi

$COMPOSE_CMD pull
echo ""

# ── Restart services ──────────────────────────
echo -e "${YELLOW}→ อัปเดต Backend...${NC}"
$COMPOSE_CMD up -d --no-deps backend

# รอ backend พร้อม
echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=90
ELAPSED=0
until $COMPOSE_CMD exec -T backend wget -qO- http://localhost:3000/health &>/dev/null; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️  Backend ไม่ตอบสนองภายใน ${MAX_WAIT}s${NC}"
    echo -e "${RED}   กำลัง Restore จาก backup...${NC}"
    # Restore DB
    zcat "$BACKUP_FILE" | $COMPOSE_CMD exec -T postgres psql -U rimuser rimdb &>/dev/null || true
    echo -e "${RED}❌ อัปเดตล้มเหลว — กรุณาตรวจสอบ logs: ${COMPOSE_CMD} logs backend${NC}"
    exit 1
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -e "   รอ... (${ELAPSED}s)"
done
echo -e "${GREEN}✅ Backend พร้อม${NC}"

# ── Apply DB migrations ───────────────────────
echo -e "${YELLOW}→ อัปเดต Database Schema...${NC}"
$COMPOSE_CMD exec -T backend npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || \
  $COMPOSE_CMD exec -T backend npx prisma db push --skip-generate
echo -e "${GREEN}✅ Schema อัปเดตแล้ว${NC}"

# ── Update frontend & nginx ───────────────────
echo -e "${YELLOW}→ อัปเดต Frontend...${NC}"
$COMPOSE_CMD up -d --no-deps frontend
sleep 3

echo -e "${YELLOW}→ อัปเดต Nginx...${NC}"
$COMPOSE_CMD up -d --no-deps nginx

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ อัปเดตสำเร็จ!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
$COMPOSE_CMD ps
echo ""
echo -e "  Backup ไฟล์: ${YELLOW}${BACKUP_FILE}${NC}"
echo -e "  (ลบได้หลังทดสอบระบบแล้ว)"
echo ""
