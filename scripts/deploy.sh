#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REMOTE_NAME="${REMOTE_NAME:-origin}"
BRANCH_NAME="${BRANCH_NAME:-main}"
SERVICE_NAME="${SERVICE_NAME:-bot}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-${PROJECT_ROOT}/docker-compose.yml}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but was not found." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_COMMAND=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_COMMAND=(docker-compose)
else
  echo "docker compose is required but was not found." >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

echo "Fetching latest code from ${REMOTE_NAME}/${BRANCH_NAME}..."
git fetch --prune "${REMOTE_NAME}"

echo "Checking out ${BRANCH_NAME}..."
git checkout "${BRANCH_NAME}"

echo "Resetting local branch to ${REMOTE_NAME}/${BRANCH_NAME}..."
git reset --hard "${REMOTE_NAME}/${BRANCH_NAME}"

echo "Rebuilding and restarting ${SERVICE_NAME}..."
"${COMPOSE_COMMAND[@]}" -f "${COMPOSE_FILE_PATH}" up -d --build "${SERVICE_NAME}"

echo "Deployment completed successfully."
