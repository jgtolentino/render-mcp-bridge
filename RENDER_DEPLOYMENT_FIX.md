# Fix: Deploy OCR Unified Service Separately

## Problem

Your `mcp-server-njax.onrender.com` is deploying the **MCP Bridge** (root directory), not the **OCR Unified** service (services/ocr-unified/).

## Solution: Create New Service for OCR

### Option 1: Manual Deploy via Render Dashboard (Fastest)

1. **Go to**: https://dashboard.render.com
2. **New → Web Service**
3. **Connect Repository**: `jgtolentino/render-mcp-bridge`
4. **Configure**:
   - Name: `ocr-unified`
   - Region: `Oregon`
   - Branch: `main`
   - Root Directory: `services/ocr-unified`
   - Environment: `Docker`
   - Dockerfile Path: `Dockerfile`
   - Plan: `Starter ($7/month)`

5. **Environment Variables**:
   ```
   OCR_LANG=en
   BASIC_AUTH_USER=<set-secret>
   BASIC_AUTH_PASS=<set-secret>
   ```

6. **Click "Create Web Service"**

### Option 2: Use render.yaml Blueprint (Recommended)

The issue is that Blueprint mode is deploying the wrong service. To fix:

1. **Render Dashboard** → mcp-server service → **Settings**
2. **Build & Deploy** → Blueprint Path: `render.yaml`
3. This should create the `ocr-unified` service automatically

**OR**

Delete the current `mcp-server` service and re-create using the Blueprint:

1. Render Dashboard → New → Blueprint
2. Repository: `jgtolentino/render-mcp-bridge`
3. Blueprint file: `render.yaml`
4. This will create `ocr-unified` service per the spec

## After Deployment

You'll have **two services**:

1. **mcp-server** (existing): https://mcp-server-njax.onrender.com
   - Purpose: ChatGPT MCP connector
   - Keep this running

2. **ocr-unified** (new): https://ocr-unified-xxxx.onrender.com
   - Purpose: Receipt OCR processing
   - Use this for your API

## Update API Configuration

Once `ocr-unified` is deployed:

```bash
# Set in your API environment (Render or .env)
OCR_UNIFIED_URL=https://ocr-unified-xxxx.onrender.com

# Update API route to use this
```

## Verify Deployment

```bash
# Test OCR unified service
curl https://ocr-unified-xxxx.onrender.com/health

# Expected response:
{
  "ok": true,
  "service": "ocr-unified",
  "lang": "en",
  "auth_enabled": true
}
```

## Cost

- **mcp-server**: Free (or current plan)
- **ocr-unified**: $7/month (Starter plan)
- **Total**: $7/month for OCR service

## Next Steps

1. Deploy `ocr-unified` service (5 min)
2. Set Basic Auth credentials
3. Update API to point to new URL
4. Run smoke tests
