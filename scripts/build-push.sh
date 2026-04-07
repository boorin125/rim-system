#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Build & Push Docker Images to Docker Hub
#  ใช้รันก่อน release เพื่อ build images และ push ขึ้น Docker Hub
#
#  ต้องการ:
#    - Docker Desktop (พร้อม buildx)
#    - docker login ก่อนรัน
#
#  การใช้งาน:
#    ./scripts/build-push.sh 1.2.0       # build + push version 1.2.0
#    ./scripts/build-push.sh 1.2.0 --latest  # build + push + tag as latest
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

DOCKER_USER="rubjobb"
VERSION="${1:-}"
TAG_LATEST=false

if [ "$2" = "--latest" ]; then
  TAG_LATEST=true
fi

# ── Validate ──────────────────────────────────
if [ -z "$VERSION" ]; then
  echo -e "${RED}❌ กรุณาระบุ version${NC}"
  echo "   การใช้งาน: ./scripts/build-push.sh 1.2.0 [--latest]"
  exit 1
fi

if ! docker info &>/dev/null; then
  echo -e "${RED}❌ Docker ไม่ทำงาน กรุณาเปิด Docker Desktop ก่อน${NC}"
  exit 1
fi

echo ""
echo -e "${BOLD}RIM System — Build & Push v${VERSION}${NC}"
echo "════════════════════════════════════════"
echo -e "  Backend : ${YELLOW}${DOCKER_USER}/rim-backend:${VERSION}${NC}"
echo -e "  Frontend: ${YELLOW}${DOCKER_USER}/rim-frontend:${VERSION}${NC}"
echo -e "  Platform: linux/amd64"
if $TAG_LATEST; then
  echo -e "  Tag latest: ${GREEN}yes${NC}"
fi
echo ""

# ── Build Backend ─────────────────────────────
echo -e "${YELLOW}→ Building Backend...${NC}"

BACKEND_TAGS="-t ${DOCKER_USER}/rim-backend:${VERSION}"
if $TAG_LATEST; then
  BACKEND_TAGS="${BACKEND_TAGS} -t ${DOCKER_USER}/rim-backend:latest"
fi

docker buildx build \
  --platform linux/amd64 \
  --progress=plain \
  $BACKEND_TAGS \
  --push \
  ./backend

echo -e "${GREEN}✅ Backend pushed: ${DOCKER_USER}/rim-backend:${VERSION}${NC}"
echo ""

# ── Build Frontend ────────────────────────────
echo -e "${YELLOW}→ Building Frontend (NEXT_PUBLIC_API_URL=/api)...${NC}"

FRONTEND_TAGS="-t ${DOCKER_USER}/rim-frontend:${VERSION}"
if $TAG_LATEST; then
  FRONTEND_TAGS="${FRONTEND_TAGS} -t ${DOCKER_USER}/rim-frontend:latest"
fi

docker buildx build \
  --platform linux/amd64 \
  --progress=plain \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  $FRONTEND_TAGS \
  --push \
  ./frontend

echo -e "${GREEN}✅ Frontend pushed: ${DOCKER_USER}/rim-frontend:${VERSION}${NC}"
echo ""

# ── Summary ───────────────────────────────────
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Build & Push สำเร็จ! v${VERSION}${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  Images:"
echo -e "    docker pull ${YELLOW}${DOCKER_USER}/rim-backend:${VERSION}${NC}"
echo -e "    docker pull ${YELLOW}${DOCKER_USER}/rim-frontend:${VERSION}${NC}"
echo ""
echo "  ขั้นตอนถัดไป:"
echo -e "    รัน ${YELLOW}./scripts/release.sh ${VERSION}${NC} เพื่อสร้างไฟล์ installer"
echo ""
