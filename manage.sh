#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Management Script
#  ใช้จัดการระบบประจำวัน
# ════════════════════════════════════════════════════════════

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

# ── Helper functions ──────────────────────────
print_header() {
  echo ""
  echo -e "${BOLD}RIM System — Management${NC}"
  echo "════════════════════════════════════"
  echo ""
}

cmd_status() {
  print_header
  echo -e "${YELLOW}Services:${NC}"
  $COMPOSE_CMD ps
  echo ""
  echo -e "${YELLOW}Resource Usage:${NC}"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
    rim-db rim-backend rim-frontend rim-nginx 2>/dev/null || true
  echo ""
}

cmd_logs() {
  SERVICE="${2:-}"
  LINES="${3:-100}"
  if [ -n "$SERVICE" ]; then
    $COMPOSE_CMD logs --tail="$LINES" -f "$SERVICE"
  else
    $COMPOSE_CMD logs --tail="$LINES" -f
  fi
}

cmd_restart() {
  SERVICE="${2:-}"
  if [ -n "$SERVICE" ]; then
    echo -e "${YELLOW}→ Restart $SERVICE...${NC}"
    $COMPOSE_CMD restart "$SERVICE"
  else
    echo -e "${YELLOW}→ Restart ทุก services...${NC}"
    $COMPOSE_CMD restart
  fi
  echo -e "${GREEN}✅ Restart สำเร็จ${NC}"
  echo ""
  $COMPOSE_CMD ps
}

cmd_stop() {
  echo -e "${YELLOW}→ หยุดระบบ...${NC}"
  $COMPOSE_CMD down
  echo -e "${GREEN}✅ ระบบหยุดแล้ว${NC}"
}

cmd_start() {
  echo -e "${YELLOW}→ เริ่มระบบ...${NC}"
  $COMPOSE_CMD up -d
  echo -e "${GREEN}✅ ระบบเริ่มแล้ว${NC}"
  echo ""
  $COMPOSE_CMD ps
}

cmd_backup() {
  BACKUP_DIR="${2:-./backups}"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="${BACKUP_DIR}/rim_backup_$(date +%Y%m%d_%H%M%S).sql"
  echo -e "${YELLOW}→ Backup ฐานข้อมูล...${NC}"
  $COMPOSE_CMD exec -T postgres pg_dump -U rimuser rimdb > "$BACKUP_FILE"
  BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup เรียบร้อย: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"

  # เก็บไว้แค่ 10 backup ล่าสุด
  ls -t "${BACKUP_DIR}"/rim_backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm -f
  BACKUP_COUNT=$(ls "${BACKUP_DIR}"/rim_backup_*.sql 2>/dev/null | wc -l)
  echo -e "   (มี backup ทั้งหมด ${BACKUP_COUNT} ไฟล์)"
  echo ""
}

cmd_restore() {
  BACKUP_FILE="$2"
  if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ กรุณาระบุไฟล์ backup${NC}"
    echo "   ตัวอย่าง: ./manage.sh restore backups/rim_backup_20260101_120000.sql"
    exit 1
  fi
  if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ ไม่พบไฟล์: ${BACKUP_FILE}${NC}"
    exit 1
  fi
  echo -e "${RED}⚠️  คำเตือน: การ restore จะลบข้อมูลปัจจุบันทั้งหมด${NC}"
  read -rp "  ยืนยัน? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "ยกเลิก"
    exit 0
  fi
  echo -e "${YELLOW}→ Restore จาก ${BACKUP_FILE}...${NC}"
  $COMPOSE_CMD exec -T postgres psql -U rimuser -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" rimdb
  $COMPOSE_CMD exec -T postgres psql -U rimuser rimdb < "$BACKUP_FILE"
  echo -e "${GREEN}✅ Restore เรียบร้อย${NC}"
}

cmd_shell() {
  SERVICE="${2:-backend}"
  echo -e "${YELLOW}→ เข้า shell ของ ${SERVICE}...${NC}"
  $COMPOSE_CMD exec "$SERVICE" sh
}

cmd_db() {
  echo -e "${YELLOW}→ เข้า PostgreSQL shell...${NC}"
  $COMPOSE_CMD exec postgres psql -U rimuser rimdb
}

cmd_help() {
  print_header
  echo -e "  ${BOLD}การใช้งาน:${NC} ./manage.sh <command> [options]"
  echo ""
  echo -e "  ${BOLD}Commands:${NC}"
  echo -e "    ${GREEN}status${NC}                  แสดงสถานะ services ทั้งหมด"
  echo -e "    ${GREEN}logs${NC} [service] [lines]  ดู logs (default: ทุก services, 100 บรรทัด)"
  echo -e "    ${GREEN}start${NC}                   เริ่มระบบ"
  echo -e "    ${GREEN}stop${NC}                    หยุดระบบ"
  echo -e "    ${GREEN}restart${NC} [service]       Restart services (default: ทุก services)"
  echo -e "    ${GREEN}backup${NC} [dir]            Backup ฐานข้อมูล (default: ./backups)"
  echo -e "    ${GREEN}restore${NC} <file>          Restore ฐานข้อมูลจาก backup file"
  echo -e "    ${GREEN}shell${NC} [service]         เข้า shell (default: backend)"
  echo -e "    ${GREEN}db${NC}                      เข้า PostgreSQL shell"
  echo ""
  echo -e "  ${BOLD}ตัวอย่าง:${NC}"
  echo -e "    ./manage.sh logs backend 200"
  echo -e "    ./manage.sh restart frontend"
  echo -e "    ./manage.sh backup /home/user/rim-backups"
  echo -e "    ./manage.sh restore backups/rim_backup_20260101_120000.sql"
  echo ""
}

# ── Main ──────────────────────────────────────
COMMAND="${1:-help}"

case "$COMMAND" in
  status)   cmd_status "$@" ;;
  logs)     cmd_logs "$@" ;;
  start)    cmd_start "$@" ;;
  stop)     cmd_stop "$@" ;;
  restart)  cmd_restart "$@" ;;
  backup)   cmd_backup "$@" ;;
  restore)  cmd_restore "$@" ;;
  shell)    cmd_shell "$@" ;;
  db)       cmd_db "$@" ;;
  help|*)   cmd_help ;;
esac
