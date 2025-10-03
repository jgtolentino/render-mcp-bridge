# ChatGPT MCP Connector Setup Guide

## Prerequisites
- ✅ ChatGPT Pro, Business, Enterprise, or Edu account
- ✅ MCP server deployed at: https://mcp-server-njax.onrender.com

## Step 1: Enable Developer Mode

1. **Open ChatGPT Settings**
   - Click your profile icon (bottom left)
   - Select **Settings**

2. **Enable Developer Mode**
   - Go to **Connectors** section
   - Enable **Developer Mode** toggle
   - Accept the beta terms

## Step 2: Add Custom MCP Connector

### For Chat Mode (Recommended for Testing):

1. **In Connectors Settings:**
   - Click **Add Custom MCP**

2. **Enter Configuration:**
   ```
   Name: Pulser MCP Bridge
   URL: https://mcp-server-njax.onrender.com
   ```

3. **Connection Test:**
   - ChatGPT will attempt to connect
   - If timeout occurs, see troubleshooting below

### For Deep Research Mode:

**Note:** Requires `search` and `fetch` tools (not yet implemented in our server)

## Troubleshooting Timeout Errors

### Issue: "Connection timed out"

**Causes:**
1. **Developer Mode not enabled** - Enable it first
2. **Missing tool definitions** - Our server needs MCP protocol tools
3. **Render cold start** - Free tier spins down after 15 min

**Solutions:**

#### Solution A: Wake up the server first
```bash
# Wake up the server before connecting
curl https://mcp-server-njax.onrender.com/healthz
```
Then try adding the connector again.

#### Solution B: Retry with faster connection
1. Open new tab: https://mcp-server-njax.onrender.com/
2. Keep tab open (keeps server awake)
3. In ChatGPT, add connector again

#### Solution C: Upgrade Render plan (if persistent timeout)
Free tier sleeps after 15 min. Consider:
- Render Starter Plan: $7/month (always-on)
- Or use a keep-alive service (cron-job.org)

### Issue: "Server doesn't meet requirements"

**This means missing MCP tools.** Our server needs to implement:
- Tools listing endpoint
- Proper MCP protocol responses
- Tool definitions (search, fetch, or custom tools)

**Fix:** See `IMPLEMENT_MCP_PROTOCOL.md` for adding proper tools.

## What Works Now

**Current server capabilities:**
- ✅ Health check (`/healthz`)
- ✅ Service info (`/`)
- ✅ SSE events (`/mcp/events`)
- ✅ Tool invocation (`/mcp/invoke`)

**What's missing for ChatGPT:**
- ❌ MCP tools listing endpoint
- ❌ Tool definitions/metadata
- ❌ Search/fetch tools (for Deep Research)

## Alternative: Use for Custom Integration

Since full ChatGPT MCP integration requires proper protocol implementation, you can:

1. **Use as API bridge** - Call endpoints directly from your apps
2. **Implement proper MCP tools** - Add tool definitions (see next section)
3. **Use with other MCP clients** - Claude Desktop, Continue.dev, etc.

## Next Steps

### Option 1: Add MCP Tools (Proper Fix)
See `IMPLEMENT_MCP_PROTOCOL.md` for:
- Adding tools listing endpoint
- Implementing search/fetch tools
- Proper MCP JSON-RPC protocol

### Option 2: Use Alternative MCP Client
While we implement full protocol:
- **Claude Desktop**: Full MCP support
- **Continue.dev**: VSCode extension with MCP
- **Other MCP clients**: See modelcontextprotocol.io

## Testing Without ChatGPT

You can test your MCP server works:

```bash
# Health check
curl https://mcp-server-njax.onrender.com/healthz

# Service info
curl https://mcp-server-njax.onrender.com/

# SSE stream
curl -N https://mcp-server-njax.onrender.com/mcp/events

# Tool invocation
curl -X POST https://mcp-server-njax.onrender.com/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"echo","params":{"message":"test"}}'
```

## Support

- **MCP Spec**: https://modelcontextprotocol.io/
- **ChatGPT Connectors**: https://help.openai.com/en/articles/11487775
- **OpenAI Community**: https://community.openai.com/
