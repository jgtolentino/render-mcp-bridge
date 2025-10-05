# FINAL FIX: Use Blueprint to Create New Service

## Why Everything Failed

Your current service (`mcp-server-njax`) was created **manually** as a Web Service, NOT from the Blueprint. That's why it ignores `render.yaml` and keeps looking in the wrong place.

## Solution: Create New Service from Blueprint

### Step 1: Delete Current Service (Optional but Recommended)

**Render Dashboard** → `mcp-server` → **Settings** → **Danger Zone** → **Delete Web Service**

### Step 2: Create from Blueprint

**Render Dashboard** → **New** → **Blueprint**

1. **Repository**: `jgtolentino/render-mcp-bridge`
2. **Branch**: `main`
3. **Blueprint file**: `render.yaml` (auto-detected)
4. Click **"Apply"**

Render will create a service named `mcp-server` with:
- ✅ `rootDir: services/mcp-server`
- ✅ Node.js 20 environment
- ✅ Correct build/start commands
- ✅ Health check at `/health`

### Step 3: Set Environment Variables

After Blueprint creates the service, add these in **Environment**:

```
OCR_BASE_URL=https://mcp-server-njax.onrender.com
EXTRACT_BASE_URL=https://mcp-server-njax.onrender.com
BASIC_AUTH_USER=<your-secret>
BASIC_AUTH_PASS=<your-secret>
```

### Step 4: Verify

```bash
curl https://mcp-server-XXXX.onrender.com/health

# Should return:
{
  "ok": true,
  "service": "mcp-server",
  "upstreams": {
    "ocr": "...",
    "extract": "..."
  }
}
```

---

## Alternative: Fix Existing Service Manually

If you want to keep `mcp-server-njax`, manually configure it:

**Render Dashboard** → `mcp-server` → **Settings**

1. **Build & Deploy** → **Build Command**: `cd services/mcp-server && npm ci`
2. **Build & Deploy** → **Start Command**: `cd services/mcp-server && node index.js`
3. **Environment** → **Add Variables**: (same as above)
4. **Manual Deploy** → Deploy latest commit

---

## Why This Matters

**Blueprint Mode**: Render reads `render.yaml` and auto-configures everything
**Manual Mode**: You have to set every setting in the Dashboard

Your service is in Manual Mode, which is why all our `render.yaml` changes were ignored.

The fastest path forward: **Create from Blueprint** (2 minutes) instead of fighting the manual configuration.
