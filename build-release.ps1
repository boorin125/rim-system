# =============================================================
#  RIM-System - build & push Docker images for a release
#  Usage:  .\build-release.ps1 -Version 1.0.29                       build + push :1.0.29 and :latest (Test channel)
#          .\build-release.ps1 -Version 1.0.29 -VerifyOnly           check Docker Hub only
#          .\build-release.ps1 -Version 1.0.29 -VerifyOnly -Promote  after testing: :stable = :1.0.29 (customers)
#
#  Guards:
#   - version format (no "v" prefix)
#   - newest entry in frontend/src/data/releases.json == version
#   - backend/frontend committed and pushed (image commit == GitHub)
#   - build failure stops the script
#   - pushed :X.X.X and :latest are the same image, APP_VERSION/GIT_COMMIT baked in
#
#  Channels (Settings > update screen, see deploy/updater):
#   :latest  -> Test Server   (every build)
#   :stable  -> customers/WS  (only after -Promote)
# =============================================================
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$VerifyOnly,
  [switch]$Promote
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Fail($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "OK:   $msg" -ForegroundColor Green }

if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fail "Version must look like 1.0.28 (no 'v')" }

# 1. Release Notes
$rnFile = 'frontend\src\data\releases.json'
$rnPath = Join-Path $PSScriptRoot $rnFile
$releases = ([System.IO.File]::ReadAllText($rnPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json).releases
$rn = $releases[0].version
if ($rn -ne $Version) { Fail "Newest Release Note is $rn, not $Version - add/update the entry in $rnFile" }
Ok "Release Note = $rn ($($releases[0].changes.Count) changes)"
if ($releases[0].manual) {
  Write-Host "      Manual steps shown on the update screen:" -ForegroundColor Yellow
  $releases[0].manual | ForEach-Object { Write-Host "        - $_" -ForegroundColor Yellow }
}

# 2. Git: committed + pushed
$dirty = git status --porcelain --untracked-files=no -- backend frontend
if ($dirty) { Fail "Uncommitted changes in backend/frontend:`n$dirty" }
git fetch -q origin
$branch = git rev-parse --abbrev-ref HEAD
$head = git rev-parse HEAD
$remote = git rev-parse "origin/$branch"
if ($head -ne $remote) { Fail "HEAD ($branch) is not pushed to origin - git push first" }
# Last commit that changed app code (commits touching only scripts/docs don't need a rebuild)
$commit = git log -1 --format=%h --abbrev=7 -- backend frontend
$date = Get-Date -Format 'yyyy-MM-dd'
Ok "Git clean & pushed - app code commit $commit"

# 3. Build
if (-not $VerifyOnly) {
  # Release notes travel inside the backend image (/app/releases.json) for the update screen
  Copy-Item $rnPath (Join-Path $PSScriptRoot 'backend\releases.json') -Force

  Write-Host "`nBuilding backend $Version ($commit, $date)..." -ForegroundColor Yellow
  docker buildx build --no-cache --platform linux/amd64 `
    --build-arg GIT_COMMIT=$commit --build-arg BUILD_DATE=$date --build-arg APP_VERSION=$Version `
    --label rim.version=$Version --label rim.commit=$commit --label rim.build-date=$date `
    -t rubjobb/rim-backend:$Version -t rubjobb/rim-backend:latest --push ./backend
  if ($LASTEXITCODE -ne 0) { Fail "Backend build failed" }

  Write-Host "`nBuilding frontend $Version..." -ForegroundColor Yellow
  docker buildx build --no-cache --platform linux/amd64 `
    --build-arg NEXT_PUBLIC_API_URL=/api `
    --label rim.version=$Version --label rim.commit=$commit --label rim.build-date=$date `
    -t rubjobb/rim-frontend:$Version -t rubjobb/rim-frontend:latest --push ./frontend
  if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
}

# 4. Verify Docker Hub
Write-Host "`nVerifying Docker Hub..." -ForegroundColor Yellow
function Digest($ref) {
  $d = docker buildx imagetools inspect $ref --format '{{.Manifest.Digest}}' 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $d) { Fail "Image $ref not found on Docker Hub" }
  return ($d | Out-String).Trim()
}
foreach ($repo in 'rim-backend', 'rim-frontend') {
  if ((Digest "rubjobb/${repo}:$Version") -ne (Digest "rubjobb/${repo}:latest")) {
    Fail "rubjobb/${repo}:$Version and :latest are different images"
  }
}
$cfg = (docker buildx imagetools inspect "rubjobb/rim-backend:$Version" --format '{{json .Image}}') | Out-String
if ($cfg -notmatch "APP_VERSION=$([regex]::Escape($Version))`"") { Fail "Backend image APP_VERSION is not $Version" }
if ($cfg -notmatch "GIT_COMMIT=$commit`"") { Fail "Backend image GIT_COMMIT is not $commit (Docker Hub has an older build)" }
if ($cfg -match 'BUILD_DATE=([0-9-]+)') { $date = $Matches[1] }
Ok ":$Version == :latest, APP_VERSION=$Version, GIT_COMMIT=$commit, BUILD_DATE=$date"

# 5. Promote to the customer channel
if ($Promote) {
  Write-Host "`nPromoting $Version to :stable..." -ForegroundColor Yellow
  foreach ($repo in 'rim-backend', 'rim-frontend') {
    docker buildx imagetools create -t "rubjobb/${repo}:stable" "rubjobb/${repo}:$Version"
    if ($LASTEXITCODE -ne 0) { Fail "Promote of $repo failed" }
    if ((Digest "rubjobb/${repo}:stable") -ne (Digest "rubjobb/${repo}:$Version")) { Fail "rubjobb/${repo}:stable is not $Version" }
  }
  Ok ":stable = $Version - customers (WS) can now install it from Settings > update screen"
}

Write-Host "`nNext:" -ForegroundColor Cyan
if ($Promote) {
  Write-Host "  WS Server   : Settings > update screen > check + install   (fallback: cd /root && ./ws-update.sh $Version $commit)"
} else {
  Write-Host "  Test Server : Settings > update screen > check + install   (fallback: cd ~/rim && ./update.sh)"
  Write-Host "  After testing: .\build-release.ps1 -Version $Version -VerifyOnly -Promote"
}
Write-Host "  Then check Settings > Info: Version=$Version Commit=$commit Build Date=$date"
