#!/bin/bash
# ════════════════════════════════════════════════════════════
#  RIM System — Release Packager
#  สร้าง installer zip สำหรับอัพโหลดขึ้น GitHub Releases
#
#  การใช้งาน:
#    ./scripts/release.sh 1.2.0
#
#  Output: dist/rim-installer-v1.2.0.zip
# ════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo -e "${RED}❌ กรุณาระบุ version${NC}"
  echo "   การใช้งาน: ./scripts/release.sh 1.2.0"
  exit 1
fi

DIST_DIR="dist"
PACKAGE_NAME="rim-installer-v${VERSION}"
PACKAGE_DIR="${DIST_DIR}/${PACKAGE_NAME}"
ZIP_FILE="${DIST_DIR}/${PACKAGE_NAME}.zip"

echo ""
echo -e "${BOLD}RIM System — Release Packager v${VERSION}${NC}"
echo "════════════════════════════════════════"
echo ""

# ── Clean & Create ────────────────────────────
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/docker/nginx"

# ── Copy Files ────────────────────────────────
echo -e "${YELLOW}→ Copying files...${NC}"

cp install.sh         "$PACKAGE_DIR/install.sh"
cp update.sh          "$PACKAGE_DIR/update.sh"
cp manage.sh          "$PACKAGE_DIR/manage.sh"
cp .env.example       "$PACKAGE_DIR/.env.example"
cp docker/nginx/nginx.conf "$PACKAGE_DIR/docker/nginx/nginx.conf"

# Use installer docker-compose (image: instead of build:)
cp docker/installer/docker-compose.yml "$PACKAGE_DIR/docker-compose.yml"

# Inject version into docker-compose.yml
sed -i "s/RIM_VERSION:-latest/RIM_VERSION:-${VERSION}/g" "$PACKAGE_DIR/docker-compose.yml"

# Make scripts executable
chmod +x "$PACKAGE_DIR/install.sh"
chmod +x "$PACKAGE_DIR/update.sh"
chmod +x "$PACKAGE_DIR/manage.sh"

# ── Create ZIP ────────────────────────────────
echo -e "${YELLOW}→ Creating zip...${NC}"

cd "$DIST_DIR"
zip -r "${PACKAGE_NAME}.zip" "${PACKAGE_NAME}/"
cd ..

ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)

# ── Summary ───────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Package พร้อมแล้ว!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "  ไฟล์  : ${YELLOW}${ZIP_FILE}${NC} (${ZIP_SIZE})"
echo ""
echo "  เนื้อหาใน zip:"
unzip -l "$ZIP_FILE" | grep -v "^Archive" | grep -v "^---" | awk '{print "    " $NF}' | grep -v "^    $"
echo ""
echo "  ขั้นตอนถัดไป:"
echo -e "  1. ไปที่ ${YELLOW}https://github.com/boorin125/rim-system/releases/new${NC}"
echo -e "  2. Tag: ${YELLOW}v${VERSION}${NC}"
echo -e "  3. แนบไฟล์: ${YELLOW}${ZIP_FILE}${NC}"
echo -e "  4. Publish release"
echo ""
