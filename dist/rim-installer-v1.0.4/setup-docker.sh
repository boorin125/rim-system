#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Docker Pre-installer
#  รันก่อน install.sh เพื่อติดตั้ง Docker บน Ubuntu/Debian
#  Rubjobb Development Team — rub-jobb.com
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}RIM System — Docker Setup${NC}"
echo "════════════════════════════════════"
echo ""

# ── ตรวจสอบว่าเป็น root หรือมี sudo ──────────────
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
  if ! command -v sudo &>/dev/null; then
    echo -e "${RED}❌ กรุณารันด้วย root หรือติดตั้ง sudo ก่อน${NC}"
    exit 1
  fi
else
  SUDO=""
fi

# ── ตรวจสอบ OS ────────────────────────────────────
if ! grep -qiE "ubuntu|debian" /etc/os-release 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Script นี้รองรับ Ubuntu และ Debian เท่านั้น${NC}"
  echo "   สำหรับ OS อื่น: https://docs.docker.com/engine/install/"
  exit 1
fi

# ── ตรวจสอบว่ามี Docker อยู่แล้วหรือไม่ ──────────
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  echo -e "${GREEN}✅ Docker พร้อมใช้งานแล้ว ($(docker --version | cut -d' ' -f3 | tr -d ','))${NC}"
  echo ""
  echo -e "   สามารถรัน ${BOLD}./install.sh${NC} ได้เลยครับ"
  exit 0
fi

echo -e "${YELLOW}→ ติดตั้ง Docker...${NC}"
echo ""

# ── ติดตั้ง Docker (official script) ─────────────
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq curl ca-certificates

curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
$SUDO sh /tmp/get-docker.sh --quiet
rm -f /tmp/get-docker.sh

# ── เพิ่ม current user เข้า docker group ─────────
CURRENT_USER="${SUDO_USER:-$(whoami)}"
if [ "$CURRENT_USER" != "root" ]; then
  $SUDO usermod -aG docker "$CURRENT_USER"
  echo ""
  echo -e "${YELLOW}⚠️  เพิ่ม user '${CURRENT_USER}' เข้า docker group แล้ว${NC}"
  echo -e "   ${BOLD}กรุณา logout แล้ว login ใหม่ก่อนรัน install.sh${NC}"
fi

# ── เปิด Docker service ───────────────────────────
$SUDO systemctl enable docker --quiet
$SUDO systemctl start docker

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ ติดตั้ง Docker สำเร็จ!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo -e "  Docker  : $(docker --version)"
echo -e "  Compose : $(docker compose version)"
echo ""
if [ "$CURRENT_USER" != "root" ]; then
  echo -e "  ${YELLOW}→ logout แล้ว login ใหม่ จากนั้นรัน: ${BOLD}./install.sh${NC}"
else
  echo -e "  → รัน: ${BOLD}./install.sh${NC}"
fi
echo ""
