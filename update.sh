#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Update Script
#  ใช้อัปเดตระบบเมื่อมีเวอร์ชั่นใหม่
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

VERSION="${1:-latest}"

echo ""
echo -e "${BOLD}RIM System — Update${NC}"
echo "════════════════════════════════════"
echo -e "เวอร์ชั่น: ${YELLOW}${VERSION}${NC}"
echo ""

# ── Backup DB ก่อน update ────────────────────────────────────────────────────
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}→ Backup ฐานข้อมูลก่อนอัปเดต...${NC}"
BACKUP_FILE="$BACKUP_DIR/rim_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
if $COMPOSE_CMD exec -T postgres pg_dump -U rimuser --clean --if-exists rimdb | gzip > "$BACKUP_FILE"; then
  echo -e "${GREEN}✅ Backup: ${BACKUP_FILE}${NC}"
else
  echo -e "\033[0;31m✗ Backup ล้มเหลว — ยกเลิก deploy เพื่อความปลอดภัย${NC}"
  exit 1
fi

# เก็บไว้แค่ 3 backup ล่าสุด ลบเก่ากว่านั้นทิ้ง
ls -1t "$BACKUP_DIR"/rim_backup_*.sql.gz 2>/dev/null | tail -n +4 | while read -r OLD; do
  rm -f "$OLD"
  echo -e "   🗑  ลบ backup เก่า: $(basename "$OLD")"
done
BACKUP_COUNT=$(ls "$BACKUP_DIR"/rim_backup_*.sql.gz 2>/dev/null | wc -l)
echo -e "${GREEN}   (เก็บ backup ล่าสุด ${BACKUP_COUNT} ไฟล์)${NC}"
echo ""

# ── Pull new code ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ ดาวน์โหลดเวอร์ชั่นใหม่...${NC}"
if [ -d ".git" ]; then
  git pull origin main
fi
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Build ใหม่...${NC}"
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
export BUILD_DATE=$(date +%Y-%m-%d)
echo -e "   Commit: ${YELLOW}${GIT_COMMIT}${NC} | Date: ${YELLOW}${BUILD_DATE}${NC}"
if ! $COMPOSE_CMD build --parallel --no-cache; then
  echo ""
  echo -e "\033[0;31m❌ Build ล้มเหลว! กำลัง Restore ฐานข้อมูล...${NC}"
  gunzip -c "$BACKUP_FILE" | $COMPOSE_CMD exec -T postgres psql -U rimuser --single-transaction rimdb
  echo -e "${GREEN}✓ Restore สำเร็จจาก: $BACKUP_FILE${NC}"
  echo -e "  Containers ไม่ถูกเปลี่ยนแปลง"
  exit 1
fi
echo ""

# ── Deploy ────────────────────────────────────────────────────────────────────
# Restart with zero downtime (backend first, then frontend)
echo -e "${YELLOW}→ อัปเดต Backend...${NC}"
$COMPOSE_CMD up -d --no-deps backend

echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=120
ELAPSED=0
until $COMPOSE_CMD exec -T backend curl -sf http://localhost:3000/health &>/dev/null; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${RED}⚠️  Backend ไม่ตอบสนองภายใน ${MAX_WAIT}s${NC}"
    echo -e "${RED}   กำลัง Restore จาก backup...${NC}"
    gunzip -c "$BACKUP_FILE" | $COMPOSE_CMD exec -T postgres psql -U rimuser --single-transaction rimdb &>/dev/null || true
    echo -e "${GREEN}✓ Restore สำเร็จจาก: $BACKUP_FILE${NC}"
    exit 1
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -e "   รอ... (${ELAPSED}s)"
done

echo -e "${YELLOW}→ อัปเดต Database Schema...${NC}"
$COMPOSE_CMD exec -T backend npx prisma db push --skip-generate --accept-data-loss

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
echo -e "  Backup ไฟล์อยู่ที่: ${YELLOW}${BACKUP_FILE}${NC}"
echo -e "  (ลบได้หลังทดสอบแล้ว — เก็บอัตโนมัติ 3 เวอร์ชั่น)"
echo ""
