#!/usr/bin/env bash
# =============================================================
#  RIM-System — WS Server (Production) update, pinned version tag
#  Usage:  ./ws-update.sh <version> [expected-commit]
#  e.g.    ./ws-update.sh 1.0.28 a0c16db
#
#  Guards against the usual release mistakes:
#   - version with "v" prefix / typo
#   - hardcoded BUILD_DATE / GIT_COMMIT in docker-compose.yml
#   - compose tag or RIM_VERSION in .env not updated
#   - pulled image built with a different APP_VERSION / commit
#   - nginx not recreated after backend (502)
# =============================================================
set -euo pipefail

V="${1:-}"
EXPECT_COMMIT="${2:-}"
cd "$(dirname "$0")"
COMPOSE_FILE=docker-compose.yml
ENV_FILE=.env

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
step() { echo -e "\n${YELLOW}→ $*${NC}"; }

[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "ใส่ version เช่น ./ws-update.sh 1.0.28 (ตัวเลขล้วน ไม่มี v)"
[ -f "$COMPOSE_FILE" ] || fail "ไม่พบ $COMPOSE_FILE ใน $(pwd)"
[ -f "$ENV_FILE" ] || fail "ไม่พบ $ENV_FILE ใน $(pwd)"

# ── 1. Pre-checks ────────────────────────────────────────────
step "[1/7] ตรวจ config"
if grep -nE '^\s*(BUILD_DATE|GIT_COMMIT):\s*"?[0-9a-f-]' "$COMPOSE_FILE"; then
  fail "พบ BUILD_DATE/GIT_COMMIT hardcoded ใน $COMPOSE_FILE (บรรทัดด้านบน) — ลบออกก่อน: sed -i '/BUILD_DATE:/d; /GIT_COMMIT:/d' $COMPOSE_FILE"
fi
CURRENT=$(grep -oE 'rim-backend:[0-9.]+' "$COMPOSE_FILE" | head -1 | cut -d: -f2 || true)
echo "  ปัจจุบัน: ${CURRENT:-<ใช้ RIM_VERSION ใน .env>} → ใหม่: $V"
df -h / | tail -1 | awk '{print "  Disk: ใช้ "$5" ว่าง "$4}'
ok "config ผ่าน"

# ── 2. Backup DB ─────────────────────────────────────────────
step "[2/7] Backup ฐานข้อมูลก่อน update"
mkdir -p backups
BK="backups/before_${V}_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T postgres pg_dump -U rimuser --clean --if-exists \
  --exclude-table-data=licenses --exclude-table-data=license_activation_logs \
  --exclude-table-data=refresh_tokens --exclude-table-data=password_reset_tokens \
  --exclude-table-data=push_subscriptions rimdb | gzip > "$BK"
[ "$(stat -c%s "$BK")" -gt 100000 ] || fail "ไฟล์ backup เล็กผิดปกติ ($BK) — หยุดก่อน"
ok "Backup: $BK ($(du -h "$BK" | cut -f1))"

# ── 3. Set version (compose tag + .env) ─────────────────────
step "[3/7] ตั้ง version = $V"
sed -i -E "s#rubjobb/rim-backend:[0-9.]+#rubjobb/rim-backend:${V}#g; s#rubjobb/rim-frontend:[0-9.]+#rubjobb/rim-frontend:${V}#g" "$COMPOSE_FILE"
if grep -q '^RIM_VERSION=' "$ENV_FILE"; then
  sed -i "s/^RIM_VERSION=.*/RIM_VERSION=${V}/" "$ENV_FILE"
else
  echo "RIM_VERSION=${V}" >> "$ENV_FILE"
fi
IMAGES=$(docker compose config --images | grep -E 'rim-(backend|frontend)')
echo "$IMAGES" | sed 's/^/  /'
[ "$(echo "$IMAGES" | grep -c ":${V}$")" -eq 2 ] || fail "image tag ใน compose ไม่ใช่ $V ครบทั้ง backend + frontend"
ok "compose + .env = $V"

# ── 4. Pull & verify image ───────────────────────────────────
step "[4/7] Pull image"
docker compose pull backend frontend
IMG_ENV=$(docker image inspect "rubjobb/rim-backend:${V}" --format '{{range .Config.Env}}{{println .}}{{end}}')
IMG_VER=$(echo "$IMG_ENV" | sed -n 's/^APP_VERSION=//p')
IMG_COMMIT=$(echo "$IMG_ENV" | sed -n 's/^GIT_COMMIT=//p')
IMG_DATE=$(echo "$IMG_ENV" | sed -n 's/^BUILD_DATE=//p')
echo "  image: APP_VERSION=$IMG_VER  GIT_COMMIT=$IMG_COMMIT  BUILD_DATE=$IMG_DATE"
[ "$IMG_VER" = "$V" ] || fail "backend image APP_VERSION=$IMG_VER ไม่ใช่ $V — build ผิด version"
if [ -n "$EXPECT_COMMIT" ] && [ "$IMG_COMMIT" != "$EXPECT_COMMIT" ]; then
  fail "backend image commit=$IMG_COMMIT ไม่ใช่ $EXPECT_COMMIT — Docker Hub ยังไม่ได้ build ล่าสุด"
fi
ok "image ถูกต้อง"

# ── 5. Recreate backend → wait healthy ───────────────────────
step "[5/7] Restart backend"
docker compose up -d --no-deps --force-recreate backend
for i in $(seq 1 40); do
  S=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' rim-backend 2>/dev/null || echo starting)
  # "running" only appears when the image has no HEALTHCHECK
  [ "$S" = "healthy" ] || [ "$S" = "running" ] && break
  sleep 3
done
[ "$S" = "healthy" ] || [ "$S" = "running" ] || fail "backend ไม่ healthy ใน 120 วินาที — ดู: docker logs rim-backend --tail 50  (rollback: ./ws-update.sh ${CURRENT:-<version เดิม>})"
ok "backend healthy"

# ── 6. Recreate frontend + nginx (nginx must follow backend) ─
step "[6/7] Restart frontend + nginx"
docker compose up -d --no-deps --force-recreate frontend
docker compose up -d --no-deps --force-recreate nginx
RUN_VER=$(docker exec rim-backend printenv RIM_VERSION || true)
[ "$RUN_VER" = "$V" ] || fail "container RIM_VERSION=$RUN_VER ไม่ใช่ $V — ตรวจว่า docker-compose.yml มี RIM_VERSION: \${RIM_VERSION:-} ใน backend environment"
ok "running: RIM_VERSION=$RUN_VER"

# ── 7. Cleanup ───────────────────────────────────────────────
step "[7/7] ลบ image เก่า (ไม่แตะ volume)"
docker image prune -af >/dev/null
df -h / | tail -1 | awk '{print "  Disk: ใช้ "$5" ว่าง "$4}'

echo -e "\n${GREEN}🎉 Update เป็น $V เรียบร้อย${NC}"
echo "  ตรวจบนเว็บ: Settings → Info  Version=$V  Commit=$IMG_COMMIT  Build Date=$IMG_DATE"
echo "  และ Release Notes บนสุดต้องเป็น v$V"
echo "  Backup ก่อน update: $BK"
