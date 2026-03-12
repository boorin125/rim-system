#!/bin/bash
# ════════════════════════════════════════════════════════════
#  สร้าง Installer Package สำหรับส่งให้ลูกค้า
#  ใช้รันบน machine ของ Developer ก่อนส่ง
# ════════════════════════════════════════════════════════════

set -e

VERSION="${1:-$(date +%Y.%m.%d)}"
OUTPUT_DIR="releases"
PACKAGE_NAME="RIM-System-v${VERSION}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"

echo "Building installer package: ${PACKAGE_NAME}"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
mkdir -p "$OUTPUT_DIR"

# Copy installer files
cp docker-compose.yml "$TEMP_DIR/"
cp .env.example "$TEMP_DIR/"
cp install.sh "$TEMP_DIR/"
cp install.bat "$TEMP_DIR/"
cp update.sh "$TEMP_DIR/"
cp update.bat "$TEMP_DIR/"
cp -r docker "$TEMP_DIR/"

# Copy source (exclude unnecessary files)
rsync -a --exclude='node_modules' --exclude='.next' --exclude='dist' \
  --exclude='.env' --exclude='.env.*' --exclude='*.log' \
  --exclude='build-manifest.jsonl' \
  backend/ "$TEMP_DIR/backend/"

rsync -a --exclude='node_modules' --exclude='.next' \
  --exclude='.env' --exclude='.env.*' --exclude='*.log' \
  frontend/ "$TEMP_DIR/frontend/"

# Make scripts executable
chmod +x "$TEMP_DIR/install.sh"
chmod +x "$TEMP_DIR/update.sh"

# Create README
cat > "$TEMP_DIR/README.txt" << EOF
════════════════════════════════════════════
  RIM System v${VERSION}
  Remote Incident Management
  by Rubjobb Development Team
════════════════════════════════════════════

วิธีติดตั้ง (Linux/macOS):
  1. ติดตั้ง Docker: https://docs.docker.com/engine/install/
  2. แตกไฟล์ ZIP
  3. เปิด Terminal ใน folder นี้
  4. รัน: ./install.sh
  5. ทำตาม prompt ที่ปรากฏ

วิธีติดตั้ง (Windows):
  1. ติดตั้ง Docker Desktop: https://www.docker.com/products/docker-desktop/
  2. แตกไฟล์ ZIP
  3. ดับเบิลคลิก install.bat (Run as Administrator)
  4. ทำตาม prompt ที่ปรากฏ

Requirement:
  - RAM: 4GB ขึ้นไป (แนะนำ 8GB)
  - Disk: 20GB ขึ้นไป
  - OS: Ubuntu 20.04+, Windows 10/11, macOS 12+
  - Docker: 24.0+

อัปเดต:
  Linux: ./update.sh
  Windows: update.bat (double-click)

ติดต่อสนับสนุน:
  Email : support@rub-jobb.com
  โทร   : 061-228-2879 (คุณเหมียว)
         081-822-6788 (คุณบอย)
  เว็บ  : https://rub-jobb.com
EOF

# Create ZIP
cd /tmp
zip -r "${OLDPWD}/${OUTPUT_DIR}/${PACKAGE_NAME}.zip" "${PACKAGE_NAME}/"

echo ""
echo "✅ Package ready: ${OUTPUT_DIR}/${PACKAGE_NAME}.zip"
echo "   Size: $(du -sh "${OUTPUT_DIR}/${PACKAGE_NAME}.zip" | cut -f1)"
echo ""
echo "📦 อัปโหลดไปที่ rub-jobb.com/download เพื่อให้ลูกค้า download"

# Cleanup
rm -rf "$TEMP_DIR"
