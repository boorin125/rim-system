#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Update Script
#  ใช้อัปเดตระบบเมื่อมีเวอร์ชั่นใหม่
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Backup DB ก่อน update
echo -e "${YELLOW}→ Backup ฐานข้อมูลก่อนอัปเดต...${NC}"
BACKUP_FILE="rim_backup_$(date +%Y%m%d_%H%M%S).sql"
$COMPOSE_CMD exec -T postgres pg_dump -U rimuser rimdb > "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup: ${BACKUP_FILE}${NC}"

# เก็บไว้แค่ 3 backup ล่าสุด ลบเก่ากว่านั้นทิ้ง
ls -t rim_backup_*.sql 2>/dev/null | tail -n +4 | xargs -r rm -f
BACKUP_COUNT=$(ls rim_backup_*.sql 2>/dev/null | wc -l)
echo -e "${GREEN}   (เก็บ backup ล่าสุด ${BACKUP_COUNT} ไฟล์)${NC}"
echo ""

# Pull new code
echo -e "${YELLOW}→ ดาวน์โหลดเวอร์ชั่นใหม่...${NC}"
if [ -d ".git" ]; then
  git pull origin main
fi
echo ""

# Rebuild
echo -e "${YELLOW}→ Build ใหม่...${NC}"
$COMPOSE_CMD build --parallel --no-cache
echo ""

# Restart with zero downtime (backend first, then frontend)
echo -e "${YELLOW}→ อัปเดต Backend...${NC}"
$COMPOSE_CMD up -d --no-deps backend

echo -e "${YELLOW}→ รอ Backend พร้อม...${NC}"
MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$($COMPOSE_CMD ps --format json backend 2>/dev/null | grep -o '"State":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
  if [ "$STATUS" = "running" ]; then
    # Container is running — wait a moment for the process to initialize
    sleep 3
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -e "   รอ... ($ELAPSED/${MAX_WAIT}s)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠️  Backend ใช้เวลานานผิดปกติ — ลองต่อไปเลย${NC}"
fi

echo -e "${YELLOW}→ อัปเดต Database Schema...${NC}"
$COMPOSE_CMD exec -T backend npx prisma db push --skip-generate

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
echo -e "  (เก็บไว้ก่อน ลบได้หลังจากทดสอบแล้ว)"
echo ""
