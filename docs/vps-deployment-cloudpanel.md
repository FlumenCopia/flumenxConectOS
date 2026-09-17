# flumenxConectOS — Hostinger CloudPanel Production Deployment Guide

This guide details the step-by-step procedure to deploy **flumenxConectOS** on your Hostinger VPS using CloudPanel, ensuring **zero disruption** to your other running websites and services.

---

## 1. Port & Subdomain Architecture

| Domain | Backend Port / Target | Status |
|---|---:|---|
| `erp.flumenx.in` | `3000` | Existing Project (Preserved) |
| `swarasaakhi.com`, `www.swarasaakhi.com` | `3001` | Existing Project (Preserved) |
| `flumenx.com`, `www.flumenx.com` | `3004` | Existing Project (Preserved) |
| `anoopkrishna.com`, `www.anoopkrishna.com` | `3005` | Existing Project (Preserved) |
| `susrutha.flumenx.in` | `3010` | Existing Project (Preserved) |
| `api.susrutha.flumenx.in` | `5000` | Existing Project (Preserved) |
| `default` | `8000` | Existing Project (Preserved) |
| `ananthapuricdc.com`, `www.ananthapuricdc.com` | `8787` | Existing Project (Preserved) |
| **`connect.flumenx.in` (Frontend)** | **`3020`** | **flumenxConectOS Next.js (New)** |
| **`connect.flumenx.in/api` (Backend)** | **`5020`** | **flumenxConectOS Express (New)** |

---

## 2. DNS Configuration

In your DNS manager (Hostinger, Cloudflare, or your domain registrar for `flumenx.in`):

1. Add an **A Record**:
   - **Type**: `A`
   - **Name / Host**: `connect` (or `connect.flumenx.in`)
   - **Points to / Value**: `<YOUR_VPS_PUBLIC_IP>`
   - **TTL**: Auto / 300 seconds
2. Wait 1–2 minutes for DNS propagation.

---

## 3. CloudPanel Site Setup (Zero-Impact Reverse Proxy)

CloudPanel isolates each domain inside its own Virtual Host configuration without touching other sites.

1. Log in to your **CloudPanel** dashboard (`https://<vps-ip>:8443`).
2. Click **+ Add Site** in the top right.
3. Select **Create a Reverse Proxy**.
4. Fill in the fields:
   - **Domain Name**: `connect.flumenx.in`
   - **Reverse Proxy URL**: `http://127.0.0.1:3020`
   - **Site User**: Create a new user (e.g. `conectos`) or choose an existing user.
5. Click **Create**.
6. Once created, open the site `connect.flumenx.in`:
   - Navigate to the **SSL/TLS** tab.
   - Click **New Let's Encrypt Certificate** -> **Create and Install**.

---

## 4. CloudPanel Nginx Vhost Configuration (Unified Routing)

To ensure the backend API and uploads are routed seamlessly under the same domain (guaranteeing first-party cookies without CORS issues):

1. In CloudPanel, click on `connect.flumenx.in` -> **Vhost** tab.
2. Locate the existing `location /` block:
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3020;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
3. Add the following directives immediately above or below it:
   ```nginx
   # API Reverse Proxy to Backend (Port 5020)
   location /api/ {
       proxy_pass http://127.0.0.1:5020;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
       client_max_body_size 50M;
       proxy_read_timeout 300s;
       proxy_connect_timeout 300s;
   }

   # Static Uploads Proxy (Port 5020)
   location /uploads/ {
       proxy_pass http://127.0.0.1:5020;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       client_max_body_size 50M;
   }
   ```
4. Click **Save**. CloudPanel automatically runs `nginx -t` and applies the changes only if valid.

---

## 5. Clone and Configure the Application on the VPS

SSH into your VPS as your system user or `root`:

```bash
# Navigate to the htdocs directory created by CloudPanel
cd /home/<system-user>/htdocs/connect.flumenx.in

# If CloudPanel created a default index.html, remove it
rm -f index.html

# Clone your repository (or pull updates)
git clone <YOUR_GIT_REPO_URL> .
```

### Configure Backend Environment
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Ensure the following production values are configured:
```env
PORT=5020
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/flumenx_conect_os
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
JWT_EXPIRES_IN=7d
ENCRYPTION_SECRET_KEY=a_64_character_hex_key_for_aes_256_gcm_encryption_here
CORS_ORIGIN=https://connect.flumenx.in
INITIAL_ADMIN_NAME=FlumenX Administrator
INITIAL_ADMIN_EMAIL=admin@flumenx.in
INITIAL_ADMIN_PASSWORD=YourStrongBootstrapPassword123!
```

> **MongoDB Note**: If using a local MongoDB on the VPS, verify it is running with `systemctl status mongod`. If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string.

### Configure Frontend Environment
```bash
nano frontend/.env.local
```
Add:
```env
NEXT_PUBLIC_API_URL=https://connect.flumenx.in/api/v1
BACKEND_INTERNAL_URL=http://127.0.0.1:5020
PORT=3020
```

---

## 6. Build and Start Services with PM2

We have included a pre-configured `ecosystem.config.js` and an automated deployment script:

```bash
# Make deploy script executable
chmod +x scripts/infra/deploy-vps.sh

# Run the zero-impact deployment script
./scripts/infra/deploy-vps.sh
```

The script will:
1. Verify that ports `3020` and `5020` are unallocated.
2. Confirm existing services on ports `3000`, `3010`, `5000` are untouched.
3. Install dependencies and compile TypeScript for both backend and frontend.
4. Launch `conectos-backend` and `conectos-frontend` under PM2 with memory limits.
5. Perform instant health checks.

### Bootstrap Initial Super Admin (One-Time)
```bash
npm --prefix backend run seed
```

---

## 7. Ensure Auto-Restart on VPS Reboot

To guarantee that `flumenxConectOS` restarts automatically if the VPS is ever rebooted:

```bash
pm2 save
pm2 startup
# (Run the generated sudo env command if prompted by PM2)
```

---

## 8. Verification & Diagnostics

### Check Service Health
```bash
# 1. Check PM2 status
pm2 status

# 2. Check Backend API locally
curl -i http://127.0.0.1:5020/api/v1/health

# 3. Check Frontend locally
curl -i http://127.0.0.1:3020

# 4. Check Public SSL URL
curl -i https://connect.flumenx.in/api/v1/health

# 5. Verify existing websites remain 100% operational
curl -i http://127.0.0.1:3000    # erp.flumenx.in
curl -i http://127.0.0.1:3010    # susrutha.flumenx.in
curl -i http://127.0.0.1:5000    # api.susrutha.flumenx.in
```

### Viewing Logs
```bash
# View all combined logs
pm2 logs

# View backend logs only
tail -f logs/backend-out.log
tail -f logs/backend-error.log

# View frontend logs only
tail -f logs/frontend-out.log
```
