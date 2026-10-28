#!/usr/bin/env bash
# =============================================================
#  RIM-System — one-time setup of the update button (Settings › System Update)
#  Copy this folder to the server (e.g. next to docker-compose.yml) and run:
#     ./setup-updater.sh latest     # Test Server  (every build)
#     ./setup-updater.sh stable     # Customers    (after build-release.ps1 -Promote)
#  Safe to run again (keeps the secret; rebuilds the updater with the files in this folder).
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
step() { echo -e "\n${YELLOW}→ $*${NC}"; }

CHANNEL="${1:-}"
[[ "$CHANNEL" =~ ^(latest|stable)$ ]] || fail "ใส่ช่องทาง: ./setup-updater.sh latest (Test) หรือ ./setup-updater.sh stable (ลูกค้า)"
cd "$(dirname "$0")"
HERE="$(pwd)"

# ── 1. Find the running app ──────────────────────────────────
step "[1/5] หา RIM ที่รันอยู่"
docker inspect rim-backend >/dev/null 2>&1 || fail "ไม่พบ container rim-backend"
label() { docker inspect rim-backend --format "{{index .Config.Labels \"$1\"}}"; }
RIM_DIR="$(label com.docker.compose.project.working_dir)"
RIM_PROJECT="$(label com.docker.compose.project)"
RIM_NETWORK="$(docker inspect rim-backend --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"
[ -f "$RIM_DIR/docker-compose.yml" ] || fail "ไม่พบ $RIM_DIR/docker-compose.yml"
[ -f "$RIM_DIR/.env" ] || fail "ไม่พบ $RIM_DIR/.env"
echo "  App folder : $RIM_DIR"
echo "  Project    : $RIM_PROJECT"
echo "  Network    : $RIM_NETWORK"
DOCKER_CONFIG_DIR="${DOCKER_CONFIG:-$HOME/.docker}"
if [ ! -f "$DOCKER_CONFIG_DIR/config.json" ] || ! grep -q 'index.docker.io\|docker.io' "$DOCKER_CONFIG_DIR/config.json"; then
  echo -e "${YELLOW}  (ยังไม่ได้ docker login บนเครื่องนี้ — ไม่เป็นไรถ้า image บน Docker Hub เป็น public; ถ้า pull ไม่ได้ให้ docker login แล้วรันใหม่)${NC}"
fi
mkdir -p "$DOCKER_CONFIG_DIR"
ok "พบ RIM"

# ── 2. Settings for the updater ──────────────────────────────
step "[2/5] ตั้งค่า updater (ช่องทาง: $CHANNEL)"
SECRET="$(grep -s '^UPDATER_SECRET=' .env | cut -d= -f2- || true)"
if [ -z "$SECRET" ]; then
  SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi
umask 077
cat > .env <<EOF
UPDATER_SECRET=$SECRET
UPDATE_CHANNEL=$CHANNEL
RIM_DIR=$RIM_DIR
RIM_PROJECT=$RIM_PROJECT
RIM_NETWORK=$RIM_NETWORK
DOCKER_CONFIG_DIR=$DOCKER_CONFIG_DIR
EOF
umask 022
mkdir -p data
ok "เขียน $HERE/.env"

# ── 3. Start the updater ─────────────────────────────────────
step "[3/5] Build + start rim-updater"
docker compose up -d --build
for i in $(seq 1 20); do
  docker exec rim-updater wget -qO- http://127.0.0.1:3090/health >/dev/null 2>&1 && break
  sleep 2
done
docker exec rim-updater wget -qO- http://127.0.0.1:3090/health >/dev/null 2>&1 || fail "rim-updater ไม่ตอบ — ดู: docker logs rim-updater"
ok "rim-updater ทำงาน"

# ── 4. Connect the backend to the updater ────────────────────
step "[4/5] เชื่อม backend กับ updater"
cd "$RIM_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
cp docker-compose.yml "docker-compose.yml.bak_updater_$STAMP"
cp .env ".env.bak_updater_$STAMP"
if ! grep -q 'UPDATER_SECRET:' docker-compose.yml; then
  grep -q 'CENTRAL_LICENSE_URL:' docker-compose.yml || fail "หา backend environment (CENTRAL_LICENSE_URL) ใน docker-compose.yml ไม่เจอ"
  sed -i '/CENTRAL_LICENSE_URL:/a\      UPDATER_SECRET: ${UPDATER_SECRET:-}' docker-compose.yml
  sed -i '/CENTRAL_LICENSE_URL:/a\      UPDATER_URL: ${UPDATER_URL:-http://rim-updater:3090}' docker-compose.yml
fi
if grep -q '^UPDATER_SECRET=' .env; then
  sed -i "s/^UPDATER_SECRET=.*/UPDATER_SECRET=$SECRET/" .env
else
  printf '\nUPDATER_SECRET=%s\n' "$SECRET" >> .env
fi
grep -n -B1 -A1 'UPDATER_' docker-compose.yml | sed 's/^/  /'
docker compose up -d --no-deps --force-recreate backend
for i in $(seq 1 40); do
  S=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' rim-backend 2>/dev/null || echo starting)
  [ "$S" = "healthy" ] || [ "$S" = "running" ] && break
  sleep 3
done
docker compose up -d --no-deps --force-recreate nginx
ok "backend + nginx restart แล้ว (backup: docker-compose.yml.bak_updater_$STAMP, .env.bak_updater_$STAMP)"

# ── 5. Verify ────────────────────────────────────────────────
step "[5/5] ตรวจ"
[ -n "$(docker exec rim-backend printenv UPDATER_SECRET 2>/dev/null)" ] || fail "backend ไม่เห็น UPDATER_SECRET"
docker exec rim-backend curl -sf http://rim-updater:3090/health >/dev/null || fail "backend เรียก rim-updater ไม่ได้"
ok "backend ↔ rim-updater เชื่อมกันแล้ว"

echo -e "\n${GREEN}🎉 พร้อมใช้งาน — Settings › System Update (SUPER_ADMIN)${NC}"
echo "  ช่องทาง: $CHANNEL   ·   log: docker logs rim-updater"
