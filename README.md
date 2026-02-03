# ALLthePREACHING.com - Rebuild Project

A modern, scalable rebuild of ALLthePREACHING.com featuring separate frontend and backend, PWA support, and cloud-native architecture.

**📖 Key Documentation:**
- **[Configuration Guide](CONFIGURATION.md)** - Unified config for all environments
- **[Kubernetes Guide](k8s/README.md)** - Production deployment with K8s
- **[Project Summary](PROJECT_SUMMARY.md)** - Quick answers and overview

## 🎯 Project Overview

This is a complete rebuild of the ALLthePREACHING website with:
- **Frontend**: Next.js with React, Tailwind CSS, Video.js player
- **Backend**: Node.js/Express API with MariaDB
- **Features**: PWA, light/dark mode, video recommendations, RSS feeds, search
- **Architecture**: Containerized, cloud-native, Kubernetes-ready

## 📋 Quick Start

### Prerequisites

- **For Containerized Run**: Podman or Docker
- **For Local Development**: Node.js 20+, Yarn 1.22+, MariaDB (optional with mock DB)

### 🐳 Quick Run with Podman/Docker (Recommended)

The fastest way to try the application with sample data:

1. **Build and run backend with mock database**
   ```bash
   # Build backend image
   podman build -t atp-backend:local -f be/Dockerfile be/
   
   # Run with mock database (20 sample videos)
   podman run -d --name atp-backend --network=host \
     -e USE_MOCK_DB=true \
     -e CORS_ORIGIN=http://localhost:3000 \
     atp-backend:local
   
   # Check it's working
   curl http://localhost:3001/api/videos
   ```

2. **Build and run frontend**
   ```bash
   # Build frontend image
   podman build -t atp-frontend:local \
     --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
     --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
     -f fe/Dockerfile fe/
   
   # Run frontend
   podman run -d --name atp-frontend --network=host atp-frontend:local
   ```

3. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:3001
   - **API Health**: http://localhost:3001/health

4. **Stop/restart containers**
   ```bash
   # Stop
   podman stop atp-backend atp-frontend
   
   # Start
   podman start atp-backend atp-frontend
   
   # Remove
   podman rm -f atp-backend atp-frontend
   ```

**To use your own database:** Create a `local.env` file with your database credentials and run:
```bash
podman run -d --name atp-backend --network=host \
  --env-file local.env \
  atp-backend:local
```

### 💻 Local Development (without containers)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd allthepreaching
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   
   Backend (`be/.env`):
   ```bash
   cp be/.env.example be/.env
   # Edit be/.env with your database credentials and settings
   # Or set USE_MOCK_DB=true for testing
   ```
   
   Frontend (`fe/.env.local`):
   ```bash
   cp fe/.env.local.example fe/.env.local
   # Edit fe/.env.local with API URL
   ```
   
   **See [CONFIGURATION.md](CONFIGURATION.md) for detailed configuration guide.**

4. **Run development servers**
   ```bash
   # Start both FE and BE concurrently
   yarn dev
   
   # Or run separately:
   cd be && yarn dev  # Backend on :3001
   cd fe && yarn dev  # Frontend on :3000
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Health: http://localhost:3001/health

### Database Migration (Optional)

**⚠️ Only needed if you're importing videos from file system or consolidating categories.**

If your database already exists with data, **skip this step** - the backend will connect and fetch data automatically.

For new imports or data consolidation:

```bash
cd be
node migrate.js --dry-run  # Test migration
node migrate.js            # Apply migration
```

## 🐳 Docker Deployment

### Build Images

```bash
# Backend
cd be
docker build -t atp-backend:latest .

# Frontend
cd fe
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.allthepreaching.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://allthepreaching.com \
  -t atp-frontend:latest .
```

### Run with Docker Compose

```bash
# Create .env file with DB credentials
cp .env.example .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Container Runs

```bash
# Backend
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=your-db-host \
  -e DB_USER=your-user \
  -e DB_PASS=your-pass \
  -e DB_NAME=allthepreaching \
  --name atp-backend \
  atp-backend:latest

# Frontend
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3001 \
  --name atp-frontend \
  atp-frontend:latest
```

## 🚀 Production Deployment

### Environment Configuration

**Backend Environment Variables:**
```env
DB_HOST=<private-db-ip>
DB_PORT=3306
DB_USER=<db-user>
DB_PASS=<db-password>
DB_NAME=allthepreaching
VIDEO_SOURCE=caddy  # or 'minio' for S3
CADDY_BASE_URL=https://videos.allthepreaching.com
CORS_ORIGIN=https://allthepreaching.com
API_CLONE_KEY=<secure-random-key>
```

**Frontend Environment Variables:**
```env
NEXT_PUBLIC_API_URL=https://api.allthepreaching.com
NEXT_PUBLIC_SITE_URL=https://allthepreaching.com
```

### Kubernetes Deployment

See `k8s/` directory for deployment manifests:

```bash
# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Configure ingress
kubectl apply -f k8s/ingress.yaml
```

## 📁 Project Structure

```
allthepreaching/
├── be/                    # Backend (Node.js/Express)
│   ├── routes/           # API route handlers
│   ├── providers/        # Video provider abstraction
│   ├── db.js            # Database connection
│   ├── server.js        # Express server
│   ├── migrate.js       # Migration script
│   └── Dockerfile
├── fe/                   # Frontend (Next.js/React)
│   ├── pages/           # Next.js pages
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts
│   ├── lib/             # Utilities
│   ├── styles/          # Global styles
│   ├── public/          # Static assets
│   └── Dockerfile
├── .github/
│   └── copilot-instructions.md  # Project guidelines
├── package.json         # Root package (monorepo)
└── docker-compose.yml   # Docker Compose config
```

## 🔧 Key Features

### Video Player
- Video.js with speed control, captions, PiP
- Wake lock during playback
- Progress tracking (localStorage)
- Audio-only mode
- Portrait video support

### PWA Support
- Offline caching via service worker
- Installable on mobile devices
- Background sync
- App manifest with shortcuts

### Theme System
- Light and dark modes
- System preference detection
- User preference storage
- Smooth transitions

### Frontend UX Highlights
- Active nav highlighting per page
- Latest/Popular sorting, length/language filters
- Collapsible category filter with search
- Jump-to-page pagination
- Compact mobile video cards with thumbnail-left layout

### Search & Discovery
- Real-time search
- Preacher-specific pages
- Category filtering
- Popular/Latest sorting
- Video recommendations
- RSS feeds per preacher/category

### Backend APIs
- RESTful video endpoints
- RSS feed generation
- Search proxy
- Clone/mirror endpoints (for mirrors)
- Video provider abstraction (Caddy/S3)

## 🔌 API Documentation

### Video Endpoints

```
GET  /api/videos                 List videos (paginated)
GET  /api/videos/:id             Get single video
GET  /api/videos/:id/recommendations  Get recommended videos
```

Query parameters:
- `preacher` - Filter by preacher name
- `category` - Filter by category
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `sort` - Sort by 'date' or 'views'

### Preacher Endpoints

```
GET  /api/preachers              List all preachers
GET  /api/preachers/:slug        Get preacher info
```

### RSS Endpoints

```
GET  /api/rss                    General RSS feed
GET  /api/rss/preacher/:slug     Preacher-specific RSS
```

### Search Endpoint

```
GET  /api/search?q=<query>       Search videos
```

### Clone/Mirror Endpoints (Secured)

```
GET  /api/clone/db               Export database
GET  /api/clone/files            List files for mirroring
GET  /api/clone/status           Get sync status
```

Requires `X-API-Key` header.

## 🧪 Testing

```bash
# Backend tests
cd be
yarn test

# Frontend tests
cd fe
yarn test

# E2E tests (if configured)
yarn test:e2e
```

## 📊 Monitoring & Logs

### Health Checks
- Backend: `GET /health`
- Kubernetes liveness/readiness probes included

### Logging
- Backend: Console logs (structured)
- Frontend: Browser console + server logs

## 🔒 Security

- Helmet.js for security headers
- CORS configured for specific origin
- Rate limiting on API endpoints
- API key authentication for clone endpoints
- Environment variables for secrets (never committed)

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License

See project documentation for licensing information.

## 🤝 Contributing

1. Follow the coding style (ESLint/Prettier)
2. Write tests for new features
3. Update documentation
4. Submit pull requests to `develop` branch

## 💬 Support

For issues or questions, please open a GitHub issue or contact the maintainers.

---

**Built with ❤️ for the glory of God and the spreading of His Word.**
