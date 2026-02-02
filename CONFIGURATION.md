# Configuration Guide

## Overview

This project uses a **unified configuration approach** with separate config files for frontend and backend:

- **Backend**: `be/config.js` - Centralized configuration loaded from environment variables
- **Frontend**: `fe/config/index.ts` - Centralized configuration with TypeScript support

## Backend Configuration

### File: `be/config.js`

All backend configuration is loaded from environment variables and validated on startup.

**Environment Variables:**
```bash
# Database (REQUIRED)
DB_HOST=10.0.0.5          # Your MariaDB host
DB_PORT=3306              # Database port
DB_USER=atp_user          # Database user
DB_PASS=secure_password   # Database password
DB_NAME=allthepreaching   # Database name

# Server
PORT=3001                 # API server port
NODE_ENV=production       # Environment: development/production

# CORS
CORS_ORIGIN=https://allthepreaching.com  # Allowed frontend origin

# Video Provider
VIDEO_SOURCE=caddy        # Source: 'caddy' or 'minio'
CADDY_BASE_URL=https://videos.allthepreaching.com

# MinIO/S3 (if using)
MINIO_ENDPOINT=s3.example.com
MINIO_ACCESS_KEY=your_key
MINIO_SECRET_KEY=your_secret
MINIO_BUCKET=atp-videos

# Security
API_CLONE_KEY=secure_random_key  # For clone/mirror endpoints

# External Services (optional)
SEARCH_SERVICE_URL=http://search:8080
```

**Usage in Code:**
```javascript
const config = require('./config');

// Access configuration
console.log(config.database.host);
console.log(config.server.port);
console.log(config.video.source);
```

**Validation:**
- Required fields are validated on startup
- Missing critical config throws error
- Production-specific warnings for missing optional config

## Frontend Configuration

### File: `fe/config/index.ts`

Frontend configuration uses `NEXT_PUBLIC_*` environment variables (available in browser).

**Environment Variables:**
```bash
# API (REQUIRED)
NEXT_PUBLIC_API_URL=https://api.allthepreaching.com

# Site
NEXT_PUBLIC_SITE_URL=https://allthepreaching.com
```

**Usage in Code:**
```typescript
import config from '@/config';

// Access configuration
const apiUrl = config.api.baseUrl;
const siteName = config.site.name;
```

**Important:** Next.js `NEXT_PUBLIC_*` variables are **baked into the build**. You must set them at build time:

```bash
# During build
NEXT_PUBLIC_API_URL=https://api.example.com yarn build
```

## Configuration by Environment

### Local Development

**Backend** (`be/.env`):
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=allthepreaching
VIDEO_SOURCE=caddy
CADDY_BASE_URL=http://localhost:8080
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**Frontend** (`fe/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Docker Compose

Configuration via `.env` file in project root:
```bash
# Copy template
cp .env.example .env

# Edit values
nano .env
```

Docker Compose automatically loads `.env` and passes to containers.

### Kubernetes

Configuration via **Secrets** and **ConfigMaps**:

**Secrets** (sensitive data):
```bash
kubectl create secret generic atp-db-credentials \
  --from-literal=host=10.0.0.5 \
  --from-literal=user=atp_user \
  --from-literal=password=secure_pass \
  --from-literal=database=allthepreaching \
  -n atp
```

**ConfigMaps** (non-sensitive):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: atp-backend-config
data:
  video.source: "caddy"
  cors.origin: "https://allthepreaching.com"
```

See `k8s/README.md` for complete K8s configuration guide.

## Using Custom Database

The configuration **fully supports custom databases** with the same schema:

### Local Development with Remote DB

```bash
# be/.env
DB_HOST=remote-db.example.com  # Your remote database
DB_PORT=3306
DB_USER=your_user
DB_PASS=your_pass
DB_NAME=your_database
```

### Multiple Environments

**Development:**
```bash
DB_HOST=dev-db.internal
DB_NAME=allthepreaching_dev
```

**Staging:**
```bash
DB_HOST=staging-db.internal
DB_NAME=allthepreaching_staging
```

**Production:**
```bash
DB_HOST=10.20.30.40
DB_NAME=allthepreaching
```

## Configuration Validation

### Backend Validation

On startup, `config.js` validates:
- ✅ Required fields present (DB_HOST, DB_USER, etc.)
- ⚠️ Production warnings (missing password, API keys)
- ❌ Throws error if critical config missing

### Frontend Validation

On load, `config/index.ts` validates:
- ⚠️ Logs warnings for missing config
- ✅ Checks URL format validity

## Migration Note

### Q: Why does the DB need migration?

**A: It doesn't!** The migration script (`be/migrate.js`) is **optional** and only needed if:
- You're consolidating old preacher categories
- You're importing videos from file system to database
- You're cleaning up legacy data

If your database already exists and is populated, **skip migration** and just:
1. Configure DB credentials in `.env`
2. Start the backend
3. Backend connects and fetches data

The migration script is for data transformation, not required for normal operation.

## Quick Setup Checklist

- [ ] Copy environment templates
  ```bash
  cp be/.env.example be/.env
  cp fe/.env.local.example fe/.env.local
  ```

- [ ] Configure database connection in `be/.env`
  ```bash
  DB_HOST=your-db-host
  DB_USER=your-user
  DB_PASS=your-password
  DB_NAME=allthepreaching
  ```

- [ ] Configure API URL in `fe/.env.local`
  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```

- [ ] Verify video provider settings in `be/.env`
  ```bash
  VIDEO_SOURCE=caddy
  CADDY_BASE_URL=https://videos.example.com
  ```

- [ ] Install dependencies and run
  ```bash
  yarn install
  yarn dev
  ```

## Troubleshooting

### Backend can't connect to database
- ✅ Verify DB_HOST is accessible from backend server/container
- ✅ Check firewall allows port 3306
- ✅ Verify credentials are correct
- ✅ Check database name exists

### Frontend can't reach backend
- ✅ Verify NEXT_PUBLIC_API_URL is correct
- ✅ Check CORS_ORIGIN matches frontend URL
- ✅ Ensure backend is running
- ✅ Check network connectivity

### Configuration not updating
- ✅ Restart services after changing `.env`
- ✅ For Next.js: rebuild after changing `NEXT_PUBLIC_*` vars
- ✅ For K8s: restart pods after updating ConfigMaps/Secrets

## Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use different databases per environment** - Dev, staging, prod
3. **Rotate secrets regularly** - API keys, database passwords
4. **Validate configuration** - Use provided validation functions
5. **Document custom config** - Add comments for non-standard settings

---

For Kubernetes-specific configuration, see [k8s/README.md](k8s/README.md)
