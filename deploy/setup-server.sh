#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu EC2 instance: Docker, swap, repository.
# Run on the server: bash setup-server.sh
set -euo pipefail

REPO_URL=https://github.com/Unicorn-University-Team/assetStore.git
APP_DIR="$HOME/assetStore"

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

# The micro instance has 1 GB RAM; swap keeps npm ci and tsc from running out of memory.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

echo
echo "Done. Log out and back in (for the docker group), then:"
echo "  cd $APP_DIR && cp .env.example .env && nano .env"
echo "  docker compose up -d --build"
