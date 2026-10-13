# =============================================================
#  RIM-System - build & push Docker images for a release
#  Usage:  .\build-release.ps1 -Version 1.0.28
#          .\build-release.ps1 -Version 1.0.28 -VerifyOnly   (check Docker Hub only)
#
#  Guards:
#   - version format (no "v" prefix)
#   - newest Release Note in Settings == version
#   - backend/frontend committed and pushed (image commit == GitHub)
#   - build failure stops the script
#   - pushed :X.X.X and :latest are the same image, APP_VERSION/GIT_COMMIT baked in
# =============================================================
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Fail($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "OK:   $msg" -ForegroundColor Green }

if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fail "Version must look like 1.0.28 (no 'v')" }

# 1. Release Notes
$rnFile = 'frontend\src\app\(dashboard)\dashboard\settings\page.tsx'
$rn = (Select-String -Path $rnFile -Pattern "version: '(\d+\.\d+\.\d+)'" | Select-Object -First 1).Matches[0].Groups[1].Value
if ($rn -ne $Version) { Fail "Newest Release Note is $rn, not $Version - add/update the entry in $rnFile" }
Ok "Release Note = $rn"

# 2. Git: committed + pushed
$dirty = git status --porcelain --untracked-files=no -- backend frontend
if ($dirty) { Fail "Uncommitted changes in backend/frontend:`n$dirty" }
git fetch -q origin
$branch = git rev-parse --abbrev-ref HEAD
$head = git rev-parse HEAD
$remote = git rev-parse "origin/$branch"
if ($head -ne $remote) { Fail "HEAD ($branch) is not pushed to origin - git push first" }
$commit = git rev-parse --short HEAD
$date = Get-Date -Format 'yyyy-MM-dd'
Ok "Git clean & pushed - commit $commit"

# 3. Build
if (-not $VerifyOnly) {
  Write-Host "`nBuilding backend $Version ($commit, $date)..." -ForegroundColor Yellow
  docker buildx build --no-cache --platform linux/amd64 `
    --build-arg GIT_COMMIT=$commit --build-arg BUILD_DATE=$date --build-arg APP_VERSION=$Version `
    -t rubjobb/rim-backend:$Version -t rubjobb/rim-backend:latest --push ./backend
  if ($LASTEXITCODE -ne 0) { Fail "Backend build failed" }

  Write-Host "`nBuilding frontend $Version..." -ForegroundColor Yellow
  docker buildx build --no-cache --platform linux/amd64 `
    --build-arg NEXT_PUBLIC_API_URL=/api `
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
Ok ":$Version == :latest, APP_VERSION=$Version, GIT_COMMIT=$commit"

Write-Host "`nNext:" -ForegroundColor Cyan
Write-Host "  Test Server : cd ~/rim && chmod +x update.sh && ./update.sh"
Write-Host "  WS Server   : cd /root && ./ws-update.sh $Version $commit"
Write-Host "  Then check Settings > Info: Version=$Version Commit=$commit Build Date=$date"
