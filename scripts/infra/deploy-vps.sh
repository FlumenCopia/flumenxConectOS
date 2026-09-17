#!/usr/bin/env bash
# ==============================================================================
# flumenxConectOS — Hostinger CloudPanel Zero-Impact VPS Deployment Script
# ==============================================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}🚀 flumenxConectOS — Production Deployment for Hostinger VPS${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Resolve Script and Project Root Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"
echo -e "${GREEN}✓ Project directory:${NC} ${PROJECT_ROOT}"

# 2. Pre-Flight Safety Verification: Verify Assigned Ports are Available
BACKEND_PORT=5020
FRONTEND_PORT=3020

echo -e "\n${CYAN}>>> Step 1: Pre-flight Port Conflict Check...${NC}"
check_port() {
  local port=$1
  local service_name=$2
  if command -v ss >/dev/null 2>&1; then
    OCCUPIED=$(ss -tulpn | grep ":${port} " || true)
  elif command -v netstat >/dev/null 2>&1; then
    OCCUPIED=$(netstat -tuln | grep ":${port} " || true)
  else
    OCCUPIED=""
  fi

  if [ -n "$OCCUPIED" ]; then
    echo -e "${YELLOW}Notice: Port ${port} is currently bound.${NC}"
    # Check if it's already our PM2 process
    if command -v pm2 >/dev/null 2>&1; then
      if pm2 list | grep -q "${service_name}"; then
        echo -e "${GREEN}✓ Port ${port} is already owned by ${service_name} (safe to reload).${NC}"
      else
        echo -e "${RED}⚠️ WARNING: Port ${port} is occupied by another process!${NC}"
        echo -e "${RED}Output: ${OCCUPIED}${NC}"
        echo -e "${RED}Aborting to prevent colliding with other VPS projects.${NC}"
        exit 1
      fi
    fi
  else
    echo -e "${GREEN}✓ Port ${port} is available for ${service_name}.${NC}"
  fi
}

check_port "${BACKEND_PORT}" "conectos-backend"
check_port "${FRONTEND_PORT}" "conectos-frontend"

# 3. Verify Isolation from Existing Projects (3000, 3010, 5000)
echo -e "\n${CYAN}>>> Step 2: Verifying existing live projects integrity...${NC}"
for existing_port in 3000 3001 3004 3005 3010 5000; do
  if command -v ss >/dev/null 2>&1; then
    if ss -tulpn | grep -q ":${existing_port} "; then
      echo -e "${GREEN}✓ Preserved existing service on port ${existing_port} (untouched).${NC}"
    fi
  fi
done

# 4. Ensure Logs Directory Exists
mkdir -p "${PROJECT_ROOT}/logs"

# 5. Check Environment Files
echo -e "\n${CYAN}>>> Step 3: Checking Environment Configurations...${NC}"
if [ ! -f "${PROJECT_ROOT}/backend/.env" ]; then
  echo -e "${YELLOW}Warning: backend/.env not found! Creating from .env.example...${NC}"
  cp "${PROJECT_ROOT}/backend/.env.example" "${PROJECT_ROOT}/backend/.env"
  echo -e "${YELLOW}Please review and configure backend/.env before proceeding.${NC}"
fi

if [ ! -f "${PROJECT_ROOT}/frontend/.env.local" ]; then
  echo -e "${YELLOW}Notice: frontend/.env.local not found. Creating default production config...${NC}"
  cat << 'EOF' > "${PROJECT_ROOT}/frontend/.env.local"
NEXT_PUBLIC_API_URL=https://connect.flumenx.in/api/v1
BACKEND_INTERNAL_URL=http://127.0.0.1:5020
PORT=3020
EOF
fi

# 6. Install Dependencies and Build
echo -e "\n${CYAN}>>> Step 4: Installing Dependencies and Building Backend...${NC}"
cd "${PROJECT_ROOT}/backend"
npm install
npm run build

echo -e "\n${CYAN}>>> Step 5: Installing Dependencies and Building Frontend...${NC}"
cd "${PROJECT_ROOT}/frontend"
npm install
npm run build

# 7. PM2 Process Launch or Zero-Downtime Reload
echo -e "\n${CYAN}>>> Step 6: Managing PM2 Processes...${NC}"
cd "${PROJECT_ROOT}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}PM2 is not installed globally. Installing pm2...${NC}"
  npm install -g pm2
fi

if pm2 describe conectos-backend >/dev/null 2>&1; then
  echo -e "${GREEN}Reloading conectos-backend & conectos-frontend with zero downtime...${NC}"
  pm2 reload ecosystem.config.js --update-env
else
  echo -e "${GREEN}Starting conectos-backend & conectos-frontend via PM2...${NC}"
  pm2 start ecosystem.config.js
fi

pm2 save

# 8. Post-Deployment Verification
echo -e "\n${CYAN}>>> Step 7: Performing Local Health Checks...${NC}"
sleep 3

echo -n "Checking Backend Health (http://127.0.0.1:5020/api/v1/health)... "
BACKEND_HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5020/api/v1/health || true)
if [ "$BACKEND_HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}OK (HTTP 200)${NC}"
else
  echo -e "${YELLOW}Returned HTTP $BACKEND_HTTP_STATUS (check logs at logs/backend-error.log)${NC}"
fi

echo -n "Checking Frontend Response (http://127.0.0.1:3020)... "
FRONTEND_HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3020 || true)
if [ "$FRONTEND_HTTP_STATUS" = "200" ] || [ "$FRONTEND_HTTP_STATUS" = "307" ] || [ "$FRONTEND_HTTP_STATUS" = "308" ]; then
  echo -e "${GREEN}OK (HTTP $FRONTEND_HTTP_STATUS)${NC}"
else
  echo -e "${YELLOW}Returned HTTP $FRONTEND_HTTP_STATUS (check logs at logs/frontend-error.log)${NC}"
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 Deployment finished!${NC}"
echo -e "${GREEN}Backend:  http://127.0.0.1:5020${NC}"
echo -e "${GREEN}Frontend: http://127.0.0.1:3020${NC}"
echo -e "${GREEN}Domain:   https://connect.flumenx.in${NC}"
echo -e "${GREEN}================================================================${NC}"
