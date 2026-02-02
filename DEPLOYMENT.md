# Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup

**Backend Environment Variables** (Required):
```bash
DB_HOST=<your-private-mariadb-ip>
DB_PORT=3306
DB_USER=<database-user>
DB_PASS=<database-password>
DB_NAME=allthepreaching
VIDEO_SOURCE=caddy
CADDY_BASE_URL=https://videos.allthepreaching.com
CORS_ORIGIN=https://allthepreaching.com
API_CLONE_KEY=<generate-secure-key>
PORT=3001
NODE_ENV=production
```

**Frontend Environment Variables** (Required):
```bash
NEXT_PUBLIC_API_URL=https://api.allthepreaching.com
NEXT_PUBLIC_SITE_URL=https://allthepreaching.com
```

### 2. Database Migration

Run the migration script before deployment:

```bash
cd be
cp .env.example .env
# Edit .env with production credentials

# Dry run first
node migrate.js --dry-run

# Review output, then apply
node migrate.js
```

### 3. Build Docker Images

```bash
# Backend
cd be
docker build -t atp-backend:v1.0.0 .
docker tag atp-backend:v1.0.0 atp-backend:latest

# Frontend (with build args)
cd fe
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.allthepreaching.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://allthepreaching.com \
  -t atp-frontend:v1.0.0 .
docker tag atp-frontend:v1.0.0 atp-frontend:latest
```

## Deployment Options

### Option 1: Docker Compose (Simple)

1. **Create environment file:**
```bash
cp .env.example .env
# Edit .env with production values
```

2. **Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **Check health:**
```bash
docker-compose ps
docker-compose logs -f
```

### Option 2: Kubernetes (Scalable)

#### Prerequisites
- Kubernetes cluster (1.20+)
- kubectl configured
- Container registry (Docker Hub, etc.)

#### Steps

1. **Push images to registry:**
```bash
docker tag atp-backend:latest <registry>/atp-backend:v1.0.0
docker tag atp-frontend:latest <registry>/atp-frontend:v1.0.0
docker push <registry>/atp-backend:v1.0.0
docker push <registry>/atp-frontend:v1.0.0
```

2. **Create namespace:**
```bash
kubectl create namespace atp
```

3. **Create secrets:**
```bash
# Database credentials
kubectl create secret generic db-credentials \
  --from-literal=host=<db-host> \
  --from-literal=port=3306 \
  --from-literal=user=<db-user> \
  --from-literal=password=<db-pass> \
  --from-literal=database=allthepreaching \
  -n atp

# API keys
kubectl create secret generic api-keys \
  --from-literal=clone-key=<secure-key> \
  -n atp
```

4. **Deploy backend:**
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atp-backend
  namespace: atp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: atp-backend
  template:
    metadata:
      labels:
        app: atp-backend
    spec:
      containers:
      - name: backend
        image: <registry>/atp-backend:v1.0.0
        ports:
        - containerPort: 3001
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_PORT
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: port
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: user
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: database
        - name: VIDEO_SOURCE
          value: "caddy"
        - name: CADDY_BASE_URL
          value: "https://videos.allthepreaching.com"
        - name: CORS_ORIGIN
          value: "https://allthepreaching.com"
        - name: API_CLONE_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: clone-key
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: atp-backend
  namespace: atp
spec:
  selector:
    app: atp-backend
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

Apply:
```bash
kubectl apply -f k8s/backend-deployment.yaml
```

5. **Deploy frontend:**
```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atp-frontend
  namespace: atp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: atp-frontend
  template:
    metadata:
      labels:
        app: atp-frontend
    spec:
      containers:
      - name: frontend
        image: <registry>/atp-frontend:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.allthepreaching.com"
        - name: NEXT_PUBLIC_SITE_URL
          value: "https://allthepreaching.com"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: atp-frontend
  namespace: atp
spec:
  selector:
    app: atp-frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

Apply:
```bash
kubectl apply -f k8s/frontend-deployment.yaml
```

6. **Configure Ingress:**
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: atp-ingress
  namespace: atp
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - allthepreaching.com
    - api.allthepreaching.com
    secretName: atp-tls
  rules:
  - host: allthepreaching.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: atp-frontend
            port:
              number: 3000
  - host: api.allthepreaching.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: atp-backend
            port:
              number: 3001
```

Apply:
```bash
kubectl apply -f k8s/ingress.yaml
```

### Option 3: Direct Server Deployment

1. **Install dependencies:**
```bash
# On server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g yarn pm2
```

2. **Clone and build:**
```bash
git clone <repo> /opt/allthepreaching
cd /opt/allthepreaching
yarn install

# Build backend
cd be
yarn install
cp .env.example .env
# Edit .env

# Build frontend
cd ../fe
yarn install
cp .env.local.example .env.local
# Edit .env.local
yarn build
```

3. **Run with PM2:**
```bash
# Backend
pm2 start be/server.js --name atp-backend

# Frontend
pm2 start fe/yarn --name atp-frontend -- start

# Save PM2 config
pm2 save
pm2 startup
```

4. **Configure Nginx reverse proxy:**
```nginx
# /etc/nginx/sites-available/allthepreaching
server {
    listen 80;
    server_name allthepreaching.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name allthepreaching.com;
    
    ssl_certificate /etc/letsencrypt/live/allthepreaching.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/allthepreaching.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name api.allthepreaching.com;
    
    ssl_certificate /etc/letsencrypt/live/allthepreaching.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/allthepreaching.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/allthepreaching /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Post-Deployment

### 1. Verify Health

```bash
# Backend
curl https://api.allthepreaching.com/health

# Frontend
curl https://allthepreaching.com

# Test API
curl https://api.allthepreaching.com/api/videos?limit=5
```

### 2. Monitor Logs

**Docker:**
```bash
docker logs -f atp-backend
docker logs -f atp-frontend
```

**Kubernetes:**
```bash
kubectl logs -f deployment/atp-backend -n atp
kubectl logs -f deployment/atp-frontend -n atp
```

**PM2:**
```bash
pm2 logs atp-backend
pm2 logs atp-frontend
```

### 3. Set Up Monitoring

Consider adding:
- Prometheus + Grafana for metrics
- Sentry for error tracking
- Uptime monitoring (UptimeRobot, etc.)

### 4. Backups

Set up automated database backups:
```bash
# Daily backup cron
0 2 * * * mysqldump -h <db-host> -u <user> -p<pass> allthepreaching | gzip > /backups/atp_$(date +\%Y\%m\%d).sql.gz
```

## Rollback Procedure

### Docker Compose:
```bash
docker-compose down
docker-compose up -d --force-recreate
```

### Kubernetes:
```bash
kubectl rollout undo deployment/atp-backend -n atp
kubectl rollout undo deployment/atp-frontend -n atp
```

### PM2:
```bash
cd /opt/allthepreaching
git checkout <previous-commit>
yarn install
cd be && yarn install
cd ../fe && yarn build
pm2 restart all
```

## Troubleshooting

### Backend won't connect to database:
- Verify DB host is accessible from container/server
- Check firewall rules for port 3306
- Verify credentials in environment variables

### Frontend can't reach backend:
- Check CORS_ORIGIN matches frontend URL
- Verify API URL in frontend env vars
- Check network connectivity

### Videos not loading:
- Verify VIDEO_SOURCE and CADDY_BASE_URL
- Check video file permissions
- Test video URLs directly

### PWA not installing:
- Verify manifest.json is accessible
- Check HTTPS is enabled
- Ensure service worker is registered

## Security Hardening

1. **Enable firewall:**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Regular updates:**
```bash
# Update dependencies monthly
yarn upgrade-interactive --latest
```

3. **Rotate secrets:**
- Change API_CLONE_KEY regularly
- Update DB passwords periodically

4. **Monitor access logs:**
```bash
tail -f /var/log/nginx/access.log
```

---

For issues or questions, refer to the main README.md or open a GitHub issue.
