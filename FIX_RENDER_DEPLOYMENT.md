# Fix Render Deployment (Use Blueprint)

## Problem

Render is deploying `server.js` (MCP Bridge) at root instead of `services/ocr-unified` (OCR service) defined in `render.yaml`.

## Root Cause

The service was created manually instead of using the Blueprint, so it's ignoring `render.yaml`.

## Solution: Force Blueprint Mode

### Step 1: Update Existing Service to Use Blueprint

**Go to**: https://dashboard.render.com/web/srv-d3fvatvfte5s73drbj30/settings

**Settings → Build & Deploy**:
1. Set **Dockerfile Path**: `services/ocr-unified/Dockerfile`
2. Set **Docker Build Context Directory**: `services/ocr-unified`
3. **Save Changes**

### Step 2: Add Environment Variables

**Settings → Environment**:
```
OCR_LANG=en
BASIC_AUTH_USER=<set-secret>
BASIC_AUTH_PASS=<set-secret>
```

### Step 3: Manual Deploy

**Dashboard** → **Manual Deploy** → **Deploy latest commit**

## After Deployment

```bash
# Verify OCR service (not MCP bridge)
curl https://mcp-server-njax.onrender.com/health

# Expected:
{
  "ok": true,
  "service": "ocr-unified",  # ← Should say ocr-unified, not "Pulser MCP Bridge"
  "lang": "en",
  "auth_enabled": true
}
```

## If You Want to Keep MCP Bridge Too

If you need BOTH services:

1. **Rename current service**: mcp-server → mcp-bridge
2. **Create new service from Blueprint**:
   - New → Blueprint
   - Repo: `render-mcp-bridge`
   - Blueprint: `render.yaml`
   - This creates `ocr-unified` service

**Result**: Two services
- `mcp-bridge`: ChatGPT connector (free/existing plan)
- `ocr-unified`: Receipt OCR ($7/month)

## Simplest Solution (Recommended)

Just update the existing service settings to point to `services/ocr-unified/` and redeploy. This keeps it as a single $7/month service.
