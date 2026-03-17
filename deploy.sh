#!/bin/bash
# RIM System Deploy/Patch Script
# Usage: ./deploy.sh [backend|frontend|all]

set -e

APP_DIR="/var/www/rim"
TARGET="${1:-all}"

echo "======================================"
echo "  RIM System Deploy — $(date)"
echo "  Target: $TARGET"
echo "======================================"

cd "$APP_DIR"

# Pull latest code
echo "→ Pulling latest code..."
git pull origin main

if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "→ [Backend] Installing dependencies..."
  cd "$APP_DIR/backend"
  npm install --production

  echo "→ [Backend] Running database migrations..."
  npx prisma migrate deploy

  echo "→ [Backend] Building..."
  npm run build

  echo "→ [Backend] Restarting..."
  pm2 restart rim-backend
  echo "✅ Backend deployed"
fi

if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
  echo ""
  echo "→ [Frontend] Installing dependencies..."
  cd "$APP_DIR/frontend"
  npm install

  echo "→ [Frontend] Building..."
  npm run build

  echo "→ [Frontend] Restarting..."
  pm2 restart rim-frontend
  echo "✅ Frontend deployed"
fi

echo ""
echo "======================================"
echo "  Deploy สำเร็จ!"
pm2 status
echo "======================================"
