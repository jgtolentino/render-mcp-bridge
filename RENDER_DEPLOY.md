# Render Deployment Guide

## Quick Deploy Options

### Option 1: One-Click Deploy (Fastest) ⚡

Click this button to deploy directly to Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jgtolentino/render-mcp-bridge)

**What happens:**
- Render reads `render.json` configuration
- Creates a new Web Service automatically
- Installs dependencies and starts the server
- Provides a public URL

---

### Option 2: Manual Blueprint Deploy 📋

1. **Login to Render:**
   - Go to https://dashboard.render.com/
   - Sign in with GitHub (recommended) or email

2. **Create New Blueprint:**
   - Click **New** (top right)
   - Select **Blueprint**

3. **Connect Repository:**
   - Search for `render-mcp-bridge`
   - Select `jgtolentino/render-mcp-bridge`
   - Click **Connect**

4. **Review Configuration:**
   - Render auto-detects `render.yaml`
   - Service name: `mcp-server`
   - Plan: Free
   - Environment: Node

5. **Deploy:**
   - Click **Apply**
   - Wait 2-5 minutes for build

---

### Option 3: Manual Web Service 🔧

1. **New Web Service:**
   - Dashboard → **New** → **Web Service**

2. **Connect GitHub:**
   - Select `jgtolentino/render-mcp-bridge`
   - Click **Connect**

3. **Configure:**
   ```
   Name:              mcp-bridge
   Region:            Oregon (or closest to you)
   Branch:            main
   Runtime:           Node
   Build Command:     npm ci
   Start Command:     npm start
   Plan:              Free
   ```

4. **Environment Variables:**
   ```
   NODE_VERSION = 20
   NODE_ENV = production
   ```

5. **Advanced Settings:**
   - Health Check Path: `/healthz`
   - Auto-Deploy: Yes

6. **Create Web Service:**
   - Click **Create Web Service**
   - Monitor build logs

---

## Deployment Verification

### 1. Check Build Logs

In Render dashboard:
- Click on your service
- Go to **Logs** tab
- Look for: `🚀 MCP server listening on port 3000`

### 2. Test Health Endpoint

Once deployed, Render provides a URL like:
```
https://mcp-bridge-abc123.onrender.com
```

Test it:
```bash
# Health check
curl -sSf https://mcp-bridge-abc123.onrender.com/healthz

# Service info
curl -sSf https://mcp-bridge-abc123.onrender.com/

# SSE stream (should see ping events)
curl -N https://mcp-bridge-abc123.onrender.com/mcp/events

# Tool invocation
curl -X POST https://mcp-bridge-abc123.onrender.com/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"echo","params":{"message":"test"}}'
```

### 3. Verify Endpoints

Expected responses:

**`/healthz`**
```
ok
```

**`/`**
```json
{
  "service": "Render MCP Server (ChatGPT Bridge)",
  "version": "0.1.0",
  "endpoints": {
    "health": "/healthz",
    "events": "/mcp/events (SSE)",
    "invoke": "/mcp/invoke (POST)"
  },
  "status": "operational"
}
```

**`/mcp/events`** (SSE stream)
```
event: ping
data: {"timestamp":1234567890}

event: ping
data: {"timestamp":1234567895}
```

**`/mcp/invoke`**
```json
{
  "ok": true,
  "tool": "echo",
  "params": {"message": "test"},
  "result": "Stubbed result for tool: echo",
  "timestamp": 1234567890
}
```

---

## Post-Deployment: DNS Setup

### Get Your Render URL

1. In Render dashboard, note your service URL:
   ```
   https://mcp-bridge-abc123.onrender.com
   ```

2. Copy the hostname: `mcp-bridge-abc123.onrender.com`

### Configure Squarespace DNS

1. **Login to Squarespace:**
   - https://account.squarespace.com/domains/managed/pulser-ai.app

2. **Go to DNS Settings:**
   - Click **DNS Settings**
   - Scroll to **Custom Records**

3. **Add CNAME Record:**
   ```
   Record Type: CNAME
   Host:        mcp
   Data:        mcp-bridge-abc123.onrender.com
   TTL:         3600 (1 hour)
   ```

4. **Save Changes**

5. **Wait for Propagation:**
   - Usually takes 5-60 minutes
   - Check status: https://dnschecker.org/#CNAME/mcp.pulser-ai.app

### Add Custom Domain in Render

1. **In Render Service:**
   - Settings → **Custom Domains**
   - Click **Add Custom Domain**

2. **Enter Domain:**
   ```
   mcp.pulser-ai.app
   ```

3. **Verify DNS:**
   - Render checks for CNAME record
   - Once verified, Render provisions SSL certificate (free)

4. **Wait for SSL:**
   - Usually takes 1-5 minutes
   - Certificate auto-renews

---

## Verify Custom Domain

After DNS propagation + SSL provisioning:

```bash
# Health check
curl -sSf https://mcp.pulser-ai.app/healthz

# Service info
curl -sSf https://mcp.pulser-ai.app/

# SSE test
curl -N https://mcp.pulser-ai.app/mcp/events
```

---

## Troubleshooting

### Build Fails

**Check Logs:**
- Render Dashboard → Service → Logs

**Common Issues:**
- Missing `package.json` → Check repository
- Node version mismatch → Set `NODE_VERSION=20`
- Build timeout → Free tier has limits

### Health Check Fails

**Symptoms:**
- Service shows "Unhealthy"
- Deploys but restarts continuously

**Solutions:**
1. Check `/healthz` returns 200 OK
2. Verify server starts on `process.env.PORT`
3. Check logs for startup errors

### DNS Not Resolving

**Check:**
```bash
dig mcp.pulser-ai.app CNAME
```

**Should return:**
```
mcp.pulser-ai.app. 3600 IN CNAME mcp-bridge-abc123.onrender.com.
```

**If not:**
- Wait longer (up to 1 hour)
- Verify CNAME record in Squarespace
- Check TTL isn't too high

### SSL Certificate Issues

**Symptoms:**
- HTTPS doesn't work
- Certificate warnings

**Solutions:**
1. Wait 5-10 minutes after adding custom domain
2. Check Render dashboard for certificate status
3. Verify DNS CNAME is correct
4. Try "Retry SSL" in Render if stuck

### ChatGPT Can't Connect

**Check:**
1. HTTPS works (not HTTP)
2. CORS is enabled (✅ in `server.js`)
3. SSE endpoint streams properly
4. ChatGPT plan supports custom connectors (Pro/Business/Enterprise)

---

## Monitoring

### Render Dashboard

- **Metrics:** CPU, Memory, Request count
- **Logs:** Real-time and historical
- **Events:** Deploys, restarts, errors

### Free Tier Limits

- **Spin down:** After 15 min inactivity
- **Spin up:** 10-30 seconds first request
- **Bandwidth:** 100 GB/month
- **Build time:** 500 hours/month

**Note:** First request after spin-down will be slow. Consider upgrading to paid plan for always-on service.

---

## Next Steps After Deployment

1. ✅ Verify all endpoints work
2. ✅ Configure DNS
3. ✅ Test custom domain
4. 🔄 Connect to ChatGPT (see main README)
5. 🔄 Implement real MCP tools
6. 🔄 Add authentication (optional)
7. 🔄 Monitor and iterate

---

## Useful Commands

### Check Render Status
```bash
# Install Render CLI (optional)
npm install -g @renderinc/cli

# Login
render login

# View service logs
render logs mcp-bridge

# View service info
render services list
```

### Update Repository Trigger Re-deploy
```bash
# Make changes locally
git add .
git commit -m "Update MCP handlers"
git push origin main

# Render auto-deploys (if enabled)
```

---

## Support

- **Render Status:** https://status.render.com/
- **Render Docs:** https://render.com/docs
- **Community:** https://community.render.com/

---

## Cost Estimate

**Current Setup (Free Tier):**
- Web Service: Free
- SSL Certificate: Free
- Custom Domain: Free (Squarespace DNS already paid)
- Bandwidth: 100 GB/month free

**If Upgrading:**
- **Starter Plan:** $7/month
  - Always on (no spin-down)
  - Faster
  - Email support

- **Standard Plan:** $25/month
  - More resources
  - Priority support
  - Advanced features
