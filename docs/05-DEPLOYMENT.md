# Global Radio Explorer — Deployment Guide

> Version: 1.0  
> Date: 2026-07-20  
> Status: Approved

---

## 1. Deployment Overview

| Component | Service | Configuration |
|-----------|---------|---------------|
| **Hosting** | GitHub Pages | Static file hosting |
| **Domain** | Cloudflare DNS | DNS-only mode (grey cloud) |
| **SSL** | Let's Encrypt | Auto-provisioned by GitHub Pages |
| **CI/CD** | GitHub Actions | Auto-deploy on push to main |

---

## 2. GitHub Pages Setup

### 2.1 Repository Settings

1. Go to: `https://github.com/ragavellur/GlobalRadio/settings/pages`
2. Under **Source**, select **GitHub Actions**
3. Click **Save**

### 2.2 Custom Domain Configuration

1. Go to: `https://github.com/ragavellur/GlobalRadio/settings/pages`
2. Under **Custom domain**, enter: `radio.vellur.in`
3. Click **Save**
4. Wait for DNS check to complete (may take a few minutes)

### 2.3 Enabling HTTPS

1. After DNS check passes, check **Enforce HTTPS**
2. GitHub will provision a Let's Encrypt SSL certificate
3. This may take up to 24 hours in rare cases

---

## 3. Cloudflare DNS Configuration

### 3.1 Adding the Domain to Cloudflare

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Add a Site**
3. Enter: `vellur.in`
4. Select **Free** plan
5. Cloudflare will scan existing DNS records
6. Update your domain registrar's nameservers to Cloudflare's provided nameservers

### 3.2 DNS Records

**⚠️ CRITICAL: Use DNS-only (grey cloud) for all records**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| CNAME | radio | `ragavellur.github.io` | DNS only (grey) | Auto |

### 3.3 SSL/TLS Settings

Navigate to **SSL/TLS** in Cloudflare dashboard:

| Setting | Value | Notes |
|---------|-------|-------|
| **SSL/TLS encryption mode** | **Full** | Not Full (Strict) |
| **Always Use HTTPS** | **On** | Redirects HTTP to HTTPS |
| **Automatic HTTPS Rewrites** | **On** | Fixes mixed content |
| **Min TLS version** | **1.2** | Standard security baseline |

### 3.4 Why DNS-Only (Grey Cloud)?

**The Problem with Proxied (Orange Cloud):**

1. Cloudflare proxy replaces GitHub's IPs with its own Anycast IPs
2. Let's Encrypt cannot verify domain ownership through Cloudflare
3. Certificate renewal fails after 90 days
4. Site goes down when certificate expires

**Why DNS-Only Works:**

- DNS resolves directly to GitHub's IPs (`185.199.x.x`)
- Let's Encrypt can complete verification challenges
- Certificate provisioning and renewal work automatically
- "Enforce HTTPS" checkbox becomes available and stays enabled
- GitHub Pages already uses Fastly CDN for content delivery

### 3.5 Verify DNS Configuration

After setting up records, verify they resolve correctly:

```bash
# Should show GitHub's CNAME, not Cloudflare's IPs
dig radio.vellur.in CNAME +short
# Expected: ragavellur.github.io.

# Or use nslookup
nslookup radio.vellur.in 8.8.8.8
```

---

## 4. GitHub Actions Workflow

### 4.1 Workflow File

Location: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Copy 404.html for SPA routing
        run: cp dist/index.html dist/404.html

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 4.2 Workflow Explanation

| Step | Purpose |
|------|---------|
| `actions/checkout@v4` | Clones your repository |
| `actions/setup-node@v4` | Installs Node.js and caches npm |
| `npm ci` | Clean install from lockfile |
| `npm run build` | Runs Vite production build |
| `cp dist/index.html dist/404.html` | SPA fallback for GitHub Pages |
| `actions/configure-pages@v5` | Configures Pages deployment |
| `actions/upload-pages-artifact@v3` | Packages dist/ folder |
| `actions/deploy-pages@v4` | Deploys to GitHub Pages |

### 4.3 Required Permissions

| Permission | Purpose |
|------------|---------|
| `contents: read` | Allows checkout to read repository |
| `pages: write` | Allows writing to GitHub Pages |
| `id-token: write` | Required for OIDC token verification |

---

## 5. Build Configuration

### 5.1 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',  // Custom domain, not subdirectory

  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-maplibre': ['maplibre-gl'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
});
```

### 5.2 Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "type-check": "tsc --noEmit"
  }
}
```

### 5.3 SPA Routing Setup

GitHub Pages serves `404.html` for unknown paths. Copy `index.html` to `404.html` after build:

```bash
# In build script or workflow
cp dist/index.html dist/404.html
```

---

## 6. Static Files

### 6.1 CNAME File

Location: `public/CNAME`

Content:
```
radio.vellur.in
```

**Note:** This file must be in `public/` so it's copied to `dist/` during build.

### 6.2 .nojekyll File

Location: `public/.nojekyll`

Content: (empty file)

**Purpose:** Prevents GitHub Pages from processing files through Jekyll, which ignores files starting with `_`.

### 6.3 favicon.ico

Location: `public/favicon.ico`

---

## 7. Deployment Steps

### 7.1 Initial Deployment

```bash
# 1. Clone the repository
git clone https://github.com/ragavellur/GlobalRadio.git
cd GlobalRadio

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Make your changes

# 5. Build for production
npm run build

# 6. Commit and push
git add .
git commit -m "Initial deployment"
git push origin main
```

### 7.2 Subsequent Deployments

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm ci

# 3. Build
npm run build

# 4. Test locally
npm run preview

# 5. Push (triggers automatic deployment)
git push origin main
```

### 7.3 Manual Deployment Trigger

If you need to trigger a deployment without pushing:

1. Go to: `https://github.com/ragavellur/GlobalRadio/actions`
2. Click on **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

---

## 8. Verification Checklist

### 8.1 DNS Verification

```bash
# Check CNAME record
dig radio.vellur.in CNAME +short
# Expected: ragavellur.github.io.

# Check A records (should NOT show these if using CNAME)
dig radio.vellur.in A +short
# Expected: empty or GitHub's IPs
```

### 8.2 HTTPS Verification

```bash
# Check HTTPS is working
curl -I https://radio.vellur.in
# Look for: HTTP/2 200

# Check SSL certificate
openssl s_client -connect radio.vellur.in:443 -servername radio.vellur.in < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### 8.3 Site Verification

| Check | URL | Expected |
|-------|-----|----------|
| Homepage | `https://radio.vellur.in/` | Globe with dots |
| SPA routing | `https://radio.vellur.in/visit/london/42` | City page (not 404) |
| Search | `https://radio.vellur.in/search` | Search panel |
| Settings | `https://radio.vellur.in/settings` | Settings panel |
| CNAME | `https://radio.vellur.in/CNAME` | `radio.vellur.in` |

### 8.4 GitHub Actions Verification

1. Go to: `https://github.com/ragavellur/GlobalRadio/actions`
2. Verify the latest workflow run completed successfully
3. Check the deployment URL in the workflow output

---

## 9. Troubleshooting

### 9.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| DNS check fails | DNS not propagated | Wait up to 30 minutes, verify with `dig` |
| "Enforce HTTPS" greyed out | Cloudflare proxy enabled | Set DNS records to DNS-only (grey cloud) |
| 404 on direct URL | Missing 404.html | Ensure `cp dist/index.html dist/404.html` in build |
| Assets 404 | Wrong `base` path | Set `base: '/'` in vite.config.ts |
| Deployment fails | Node.js version | Ensure `node-version: 22` in workflow |
| Build fails | Missing lockfile | Commit `package-lock.json` |

### 9.2 Cloudflare Proxy Issues

If you accidentally enable Cloudflare proxy (orange cloud):

1. Go to Cloudflare Dashboard → DNS → Records
2. Click **Edit** on the `radio` CNAME record
3. Toggle **Proxy status** to **DNS only** (grey cloud)
4. Wait for GitHub Pages to re-provision SSL certificate
5. Re-enable "Enforce HTTPS" in GitHub Pages settings

### 9.3 Certificate Renewal Issues

If HTTPS stops working after 90 days:

1. Check Cloudflare DNS is set to DNS-only (grey cloud)
2. Go to GitHub Pages settings
3. Disable "Enforce HTTPS"
4. Wait 5 minutes
5. Re-enable "Enforce HTTPS"
6. Wait for certificate to be provisioned (may take a few minutes)

---

## 10. Performance Optimization

### 10.1 Cloudflare Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Browser Cache TTL** | **4 hours** | Balances freshness and performance |
| **Always Online** | **On** | Serves cached version if GitHub is down |
| **Minification** | **Off** | Vite already minifies |
| **Brotli** | **On** | Better compression than gzip |

### 10.2 GitHub Pages Caching

GitHub Pages automatically sets cache headers for static assets:

- **HTML files:** `Cache-Control: max-age=0` (always revalidate)
- **Hashed assets:** `Cache-Control: max-age=31536000` (cache for 1 year)

---

## 11. Rollback Procedure

If a deployment breaks the site:

### 11.1 Quick Rollback

```bash
# Revert to previous commit
git revert HEAD

# Push to trigger deployment
git push origin main
```

### 11.2 Manual Rollback

1. Go to: `https://github.com/ragavellur/GlobalRadio/actions`
2. Find a successful previous deployment
3. Click on the workflow run
4. Click **Re-run all jobs**

---

## 12. Monitoring

### 12.1 GitHub Pages Status

- Status page: `https://www.githubstatus.com/`
- Repository actions: `https://github.com/ragavellur/GlobalRadio/actions`

### 12.2 Uptime Monitoring

Consider adding uptime monitoring (optional):

- **UptimeRobot** (free): `https://uptimerobot.com/`
- **Better Stack** (free tier): `https://betterstack.com/`

---

## 13. DNS Record Summary

### For radio.vellur.in

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| CNAME | radio | `ragavellur.github.io` | DNS only | Auto |

### Cloudflare SSL/TLS Settings

| Setting | Value |
|---------|-------|
| SSL/TLS encryption mode | Full |
| Always Use HTTPS | On |
| Automatic HTTPS Rewrites | On |
| Min TLS version | 1.2 |

### GitHub Pages Settings

| Setting | Value |
|---------|-------|
| Source | GitHub Actions |
| Custom domain | radio.vellur.in |
| Enforce HTTPS | ✅ Enabled |

---

## 14. Post-Deployment Checklist

- [ ] DNS resolves correctly (`dig radio.vellur.in CNAME +short`)
- [ ] HTTPS is working (`curl -I https://radio.vellur.in`)
- [ ] Homepage loads (`https://radio.vellur.in/`)
- [ ] SPA routing works (`https://radio.vellur.in/visit/london/42`)
- [ ] Globe renders with dots
- [ ] Audio playback works
- [ ] Search returns results
- [ ] Mobile responsive
- [ ] GitHub Actions workflow completed successfully
- [ ] CNAME file preserved in deployment

---

*Document maintained in `docs/05-DEPLOYMENT.md`*
