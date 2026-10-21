#!/usr/bin/env bash
# Rebuilds and restarts the stack after the code on the server was updated.
# Run by the Deploy job in .github/workflows/ci.yml (through AWS SSM); by hand: cd ~/assetStore && deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Deploying $(git log --oneline -1)"
docker compose up -d --build --remove-orphans </dev/null

backend_health() {
  docker compose ps --format '{{.Health}}' backend </dev/null
}
for _ in $(seq 1 60); do
  [ "$(backend_health)" = healthy ] && break
  sleep 3
done
docker compose ps --format '{{.Service}}: {{.Status}}' </dev/null
if [ "$(backend_health)" != healthy ]; then
  echo "Backend is not healthy, last log lines:"
  docker compose logs --tail 40 backend </dev/null
  exit 1
fi

# Old images and build cache would slowly fill the server's disk.
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null
echo "Done"
