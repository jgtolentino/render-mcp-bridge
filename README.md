# Render MCP Bridge for ChatGPT

MCP (Model Context Protocol) HTTP/SSE server for ChatGPT integration, deployed on Render.

## Architecture

```
ChatGPT → https://mcp.pulser-ai.app (Squarespace DNS)
           ↓ CNAME
          https://<app-name>.onrender.com (Render)
           ↓
          Express.js MCP Server (SSE + HTTP)
```

## Features

- ✅ SSE (Server-Sent Events) streaming for real-time MCP events
- ✅ HTTP POST endpoint for MCP tool invocation
- ✅ Health check endpoint for Render monitoring
- ✅ CORS enabled for ChatGPT web access
- ✅ Docker support (optional)
- ✅ Free tier compatible

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [GitHub account](https://github.com/)
- [Render account](https://render.com/) (free tier available)
- [Squarespace DNS access](https://account.squarespace.com/domains)
- ChatGPT Pro/Business/Enterprise (for custom MCP connectors)

## 🚀 Quick Deploy

### One-Click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jgtolentino/render-mcp-bridge)

Click the button above to deploy directly to Render. The deployment will:
- Create a new Web Service automatically
- Install dependencies and start the server
- Provide a public HTTPS URL

**For detailed deployment options and troubleshooting, see [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)**

---

## Deployment Guide

### Option A: One-Click Deploy (Fastest)

Use the button above for instant deployment.

### Option B: Render Blueprint (Manual)

1. **Repository is already on GitHub:**
   ```
   https://github.com/jgtolentino/render-mcp-bridge
   ```

2. **Deploy via Render Blueprint**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click **New → Blueprint**
   - Connect repository: `jgtolentino/render-mcp-bridge`
   - Render auto-detects `render.yaml` and provisions the service
   - Wait for deployment (check `/healthz` endpoint)

3. **Note Your Render URL**
   - Format: `https://<app-name>.onrender.com`
   - Example: `https://mcp-server-abc123.onrender.com`

### Option B: Manual Render Deployment

1. **New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click **New → Web Service**
   - Connect GitHub repository

2. **Configure Service**
   - **Name:** `mcp-server`
   - **Environment:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Plan:** Free
   - **Health Check Path:** `/healthz`

3. **Environment Variables**
   ```
   NODE_VERSION=20
   NODE_ENV=production
   ```

4. **Deploy**
   - Click **Create Web Service**
   - Wait for build and health check to pass

## DNS Configuration (Squarespace)

1. **Login to Squarespace**
   - Go to https://account.squarespace.com/domains/managed/pulser-ai.app

2. **Add CNAME Record**
   ```
   Type:  CNAME
   Host:  mcp
   Value: <your-app>.onrender.com
   TTL:   3600
   ```
   Example:
   ```
   mcp → mcp-server-abc123.onrender.com
   ```

3. **Wait for DNS Propagation**
   - Check: `dig mcp.pulser-ai.app CNAME`
   - Or: https://dnschecker.org/#CNAME/mcp.pulser-ai.app
   - Usually takes 5-60 minutes

4. **Add Custom Domain in Render (Optional)**
   - In Render service settings → **Custom Domains**
   - Add `mcp.pulser-ai.app`
   - Render provisions free TLS certificate

## Verification

### 1. Health Check
```bash
curl -sSf https://mcp.pulser-ai.app/healthz
# Expected: "ok"
```

### 2. Service Info
```bash
curl -sSf https://mcp.pulser-ai.app/
# Expected: JSON with service details
```

### 3. SSE Stream
```bash
curl -N https://mcp.pulser-ai.app/mcp/events
# Expected: periodic ping events
```

### 4. Tool Invocation
```bash
curl -X POST https://mcp.pulser-ai.app/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"echo","params":{"message":"Hello MCP"}}'
# Expected: JSON response with result
```

## ChatGPT Integration

### Enable Developer Mode
1. ChatGPT → **Settings** → **Connectors**
2. Enable **Developer Mode**
3. Click **Add Custom MCP**

### Connector Configuration
```json
{
  "name": "Pulser MCP",
  "url": "https://mcp.pulser-ai.app",
  "endpoints": {
    "events": "/mcp/events",
    "invoke": "/mcp/invoke"
  },
  "auth": {
    "mode": "none"
  }
}
```

### Test in ChatGPT
1. Start a new conversation
2. Try: "Use the Pulser MCP to echo a message"
3. ChatGPT should invoke your MCP server

## Implementation Guide

### Current State (Stub)
The server currently returns stubbed responses. Replace with real MCP tool handlers.

### Example: Add Real Tools

Edit `server.js`:

```javascript
// Tool registry
const tools = {
  echo: (params) => {
    return { result: params };
  },

  get_time: () => {
    return { result: new Date().toISOString() };
  },

  calculate: (params) => {
    const { expression } = params;
    try {
      // Use a safe eval alternative like mathjs
      const result = eval(expression); // UNSAFE - replace with mathjs
      return { result };
    } catch (error) {
      return { error: error.message };
    }
  }
};

// Update /mcp/invoke handler
app.post('/mcp/invoke', (req, res) => {
  const { tool, params } = req.body || {};

  if (!tool || !tools[tool]) {
    return res.status(400).json({
      ok: false,
      error: `Unknown tool: ${tool}`
    });
  }

  try {
    const result = tools[tool](params);
    res.json({
      ok: true,
      tool,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
```

### MCP Tool Best Practices

1. **Input Validation**
   - Validate all `params` before processing
   - Return clear error messages

2. **Error Handling**
   - Catch and return errors gracefully
   - Use appropriate HTTP status codes

3. **Async Operations**
   - Use `async/await` for database/API calls
   - Implement timeouts

4. **Security**
   - Sanitize inputs
   - Rate limit requests
   - Add authentication (OAuth) for production

## Security Considerations

### Current Setup (Development)
- ⚠️ No authentication
- ✅ HTTPS via Render
- ✅ CORS enabled

### Production Recommendations

1. **Add Authentication**
   ```javascript
   app.use((req, res, next) => {
     const apiKey = req.headers['x-api-key'];
     if (apiKey !== process.env.MCP_API_KEY) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     next();
   });
   ```

2. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use('/mcp', rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   }));
   ```

3. **OAuth 2.0**
   - Implement OAuth flow for ChatGPT
   - Store tokens securely
   - Update connector config with OAuth settings

## Monitoring & Debugging

### Render Logs
```bash
# View live logs in Render dashboard
# Or use Render CLI
render logs -s mcp-server -f
```

### Common Issues

**Health Check Failing**
- Check `/healthz` endpoint returns 200
- Verify server starts without errors
- Check Render build logs

**DNS Not Resolving**
- Wait up to 1 hour for propagation
- Verify CNAME record in Squarespace
- Use `dig mcp.pulser-ai.app` to check

**ChatGPT Can't Connect**
- Verify HTTPS works (not HTTP)
- Check CORS headers
- Test SSE endpoint manually
- Ensure ChatGPT plan supports custom connectors

**SSE Connection Drops**
- Check Render keeps connection alive
- Verify ping interval (15s recommended)
- Test with `curl -N` locally

## Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Test endpoints
curl http://localhost:3000/healthz
curl -N http://localhost:3000/mcp/events
curl -X POST http://localhost:3000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"echo","params":{"x":1}}'
```

## File Structure

```
render-mcp-bridge/
├── server.js           # Main Express server
├── package.json        # Dependencies and scripts
├── render.yaml         # Render blueprint config
├── Dockerfile          # Optional Docker build
├── README.md           # This file
└── .gitignore          # Git ignore patterns
```

## Next Steps

1. ✅ Deploy to Render
2. ✅ Configure DNS
3. ✅ Test ChatGPT integration
4. ⏳ Implement real MCP tools
5. ⏳ Add authentication
6. ⏳ Monitor and iterate

## Resources

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Render Documentation](https://render.com/docs)
- [ChatGPT MCP Connectors](https://platform.openai.com/docs/guides/mcp)
- [Express.js SSE Guide](https://expressjs.com/en/guide/routing.html)

## Support

For issues or questions:
- [Create GitHub Issue](https://github.com/yourusername/render-mcp-bridge/issues)
- Check Render status: https://status.render.com/

## License

MIT
