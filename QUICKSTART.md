# Quick Start Guide

## TL;DR - Get Running in 3 Steps

```bash
# 1. Configure (copy and edit)
cp be/.env.example be/.env
cp fe/.env.local.example fe/.env.local
# Edit be/.env with your database credentials

# 2. Install and run
yarn install
yarn dev

# 3. Open browser
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

## Configuration Requirements

### Backend (`be/.env`)
```bash
# REQUIRED - Your existing database
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=allthepreaching

# REQUIRED - Video source
VIDEO_SOURCE=caddy
CADDY_BASE_URL=https://videos.allthepreaching.com

# Optional
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

### Frontend (`fe/.env.local`)
```bash
# REQUIRED - Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Common Issues

### ❌ Database connection failed
**Solution:** Check `DB_HOST`, `DB_USER`, `DB_PASS` in `be/.env`

### ❌ Frontend can't reach backend
**Solution:** Verify `NEXT_PUBLIC_API_URL` matches backend port

### ❌ Videos not loading
**Solution:** Check `VIDEO_SOURCE` and `CADDY_BASE_URL` in `be/.env`

### ⚠️ Do I need to run migration?
**NO** - Only if importing videos from files. If your DB has data, skip it.

## What's Running?

- **Backend** (port 3001): REST API that connects to your MariaDB
- **Frontend** (port 3000): Next.js React app that calls the backend
- **Database**: Your existing MariaDB (connected via backend only)

## Next Steps

1. ✅ Got it running? Great! Browse to http://localhost:3000
2. 📖 Need more config help? See [CONFIGURATION.md](CONFIGURATION.md)
3. 🚀 Ready for production? See [k8s/README.md](k8s/README.md)
4. ❓ Questions? Check [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## Directory Structure

```
allthepreaching/
├── be/                  Backend (Node.js/Express)
│   ├── .env            ← Configure this
│   ├── config.js       ← Centralized config
│   ├── server.js       ← Main server
│   └── routes/         ← API endpoints
├── fe/                  Frontend (Next.js/React)
│   ├── .env.local      ← Configure this
│   ├── config/         ← Centralized config
│   ├── pages/          ← Website pages
│   └── components/     ← React components
└── k8s/                 Kubernetes manifests
```

## Key Commands

```bash
# Development
yarn dev              # Run both FE and BE
cd be && yarn dev     # Backend only
cd fe && yarn dev     # Frontend only

# Build
yarn build            # Build both

# Docker
docker-compose up     # Run in containers

# Tests
yarn test             # Run tests
```

---

**Everything configured through .env files. No database migration needed if DB exists.**
