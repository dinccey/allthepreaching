# Kubernetes Deployment Guide

## Quick Reference

### Required Configuration Points

| Component | What to Configure | Where |
|-----------|------------------|-------|
| **Image Registry** | `YOUR_REGISTRY/atp-backend:VERSION` | `k8s/backend-deployment.yaml` |
| **Image Registry** | `YOUR_REGISTRY/atp-frontend:VERSION` | `k8s/frontend-deployment.yaml` |
| **Database Host** | Your MariaDB IP/hostname | `k8s/secrets.yaml.template` |
| **Database Credentials** | User, password, database name | `k8s/secrets.yaml.template` |
| **Domain Names** | Your actual domains | `k8s/ingress.yaml` |
| **API URL** | Backend API URL | Build-time arg for frontend image |
| **Video Provider** | Caddy URL or MinIO config | `k8s/configmaps.yaml` |

## Step-by-Step Deployment

### 1. Build and Push Images

```bash
# Set your registry
export REGISTRY="ghcr.io/your-org"  # or docker.io/username, etc.
export VERSION="1.0.0"

# Build backend
cd be
docker build -t ${REGISTRY}/atp-backend:${VERSION} .
docker push ${REGISTRY}/atp-backend:${VERSION}

# Build frontend (with correct API URL)
cd ../fe
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.allthepreaching.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://allthepreaching.com \
  -t ${REGISTRY}/atp-frontend:${VERSION} .
docker push ${REGISTRY}/atp-frontend:${VERSION}
```

### 2. Update Image References

Edit `k8s/backend-deployment.yaml`:
```yaml
image: ghcr.io/your-org/atp-backend:1.0.0  # Replace YOUR_REGISTRY
```

Edit `k8s/frontend-deployment.yaml`:
```yaml
image: ghcr.io/your-org/atp-frontend:1.0.0  # Replace YOUR_REGISTRY
```

### 3. Configure Secrets

```bash
# Create secrets from command line (recommended):
kubectl create namespace atp

kubectl create secret generic atp-db-credentials \
  --from-literal=host=10.0.0.5 \
  --from-literal=port=3306 \
  --from-literal=user=atp_user \
  --from-literal=password=your_secure_password \
  --from-literal=database=allthepreaching \
  -n atp

kubectl create secret generic atp-api-keys \
  --from-literal=clone-key=$(openssl rand -base64 32) \
  -n atp
```

**OR** use the template:
```bash
cp k8s/secrets.yaml.template k8s/secrets.yaml
# Edit secrets.yaml with base64-encoded values
# DON'T commit secrets.yaml!
kubectl apply -f k8s/secrets.yaml
```

### 4. Configure Non-Sensitive Settings

Edit `k8s/configmaps.yaml` and set:
- Video provider URLs
- CORS origin
- Site URLs (for reference)

Apply:
```bash
kubectl apply -f k8s/configmaps.yaml
```

### 5. Configure Ingress

Edit `k8s/ingress.yaml` and replace:
- `allthepreaching.com` → your domain
- `api.allthepreaching.com` → your API subdomain
- Adjust annotations for your ingress controller

Apply:
```bash
kubectl apply -f k8s/ingress.yaml
```

### 6. Deploy Applications

```bash
# Deploy in order:
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps.yaml
# (secrets already created in step 3)
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 7. Verify Deployment

```bash
# Check pods are running
kubectl get pods -n atp

# Check services
kubectl get svc -n atp

# Check ingress
kubectl get ingress -n atp

# View logs
kubectl logs -f deployment/atp-backend -n atp
kubectl logs -f deployment/atp-frontend -n atp

# Test health endpoints
kubectl port-forward svc/atp-backend 3001:3001 -n atp
curl http://localhost:3001/health
```

## Configuration Management

### Using Different Databases

The setup fully supports custom database configurations:

**Local Development:**
```bash
# be/.env
DB_HOST=localhost
DB_PORT=3306
DB_USER=dev_user
DB_PASS=dev_pass
DB_NAME=allthepreaching_dev
```

**Staging Environment:**
```bash
# Kubernetes secret
kubectl create secret generic atp-db-credentials \
  --from-literal=host=staging-db.internal \
  --from-literal=user=staging_user \
  --from-literal=password=staging_pass \
  --from-literal=database=allthepreaching_staging \
  -n atp-staging
```

**Production Environment:**
```bash
# Kubernetes secret
kubectl create secret generic atp-db-credentials \
  --from-literal=host=10.20.30.40 \
  --from-literal=user=prod_user \
  --from-literal=password=prod_secure_pass \
  --from-literal=database=allthepreaching \
  -n atp
```

### Configuration Hierarchy

**Backend:**
```
Environment Variables → config.js → Application
```

**Frontend:**
```
Build-time: NEXT_PUBLIC_* → Baked into bundle
Runtime: Server-side only env vars (if using SSR)
```

## Updating Deployments

### Update Backend

```bash
# Build new version
docker build -t ${REGISTRY}/atp-backend:1.1.0 ./be
docker push ${REGISTRY}/atp-backend:1.1.0

# Update deployment
kubectl set image deployment/atp-backend \
  backend=${REGISTRY}/atp-backend:1.1.0 \
  -n atp

# Or edit deployment.yaml and apply
kubectl apply -f k8s/backend-deployment.yaml
```

### Update Frontend

```bash
# Build new version (rebuild with updated env vars if needed)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.allthepreaching.com \
  -t ${REGISTRY}/atp-frontend:1.1.0 \
  ./fe
docker push ${REGISTRY}/atp-frontend:1.1.0

# Update deployment
kubectl set image deployment/atp-frontend \
  frontend=${REGISTRY}/atp-frontend:1.1.0 \
  -n atp
```

### Update Configuration

```bash
# Update ConfigMap
kubectl edit configmap atp-backend-config -n atp
# Or edit configmaps.yaml and:
kubectl apply -f k8s/configmaps.yaml

# Restart pods to pick up changes
kubectl rollout restart deployment/atp-backend -n atp
```

### Update Secrets

```bash
# Update secret
kubectl create secret generic atp-db-credentials \
  --from-literal=host=new-host \
  --from-literal=password=new-password \
  --dry-run=client -o yaml | kubectl apply -f - -n atp

# Restart pods
kubectl rollout restart deployment/atp-backend -n atp
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment atp-backend --replicas=5 -n atp

# Scale frontend
kubectl scale deployment atp-frontend --replicas=10 -n atp
```

### Auto-scaling (HPA)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: atp-backend-hpa
  namespace: atp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: atp-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Monitoring

```bash
# Watch pods
kubectl get pods -n atp -w

# View logs
kubectl logs -f deployment/atp-backend -n atp --tail=100

# Describe pod for issues
kubectl describe pod <pod-name> -n atp

# Execute commands in pod
kubectl exec -it <pod-name> -n atp -- /bin/sh
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n atp
kubectl logs <pod-name> -n atp
```

### Database connection issues
```bash
# Check secrets
kubectl get secret atp-db-credentials -n atp -o yaml

# Test from pod
kubectl exec -it <backend-pod> -n atp -- /bin/sh
# Inside pod:
# nc -zv $DB_HOST $DB_PORT
```

### Image pull errors
```bash
# Check image name is correct
kubectl describe pod <pod-name> -n atp

# If private registry, create pull secret:
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<pass> \
  -n atp

# Add to deployment:
# spec.template.spec.imagePullSecrets:
# - name: regcred
```

## Security Best Practices

1. **Never commit secrets to git**
   - Use `.gitignore` for `k8s/secrets.yaml`
   - Use secret management tools (Vault, Sealed Secrets)

2. **Use RBAC**
   - Limit who can access secrets
   - Create service accounts with minimal permissions

3. **Network Policies**
   - Restrict pod-to-pod communication
   - Only allow backend to access database

4. **TLS/SSL**
   - Use cert-manager for automatic certificate renewal
   - Force HTTPS in ingress

5. **Regular Updates**
   - Keep base images updated
   - Scan images for vulnerabilities
   - Update dependencies regularly
