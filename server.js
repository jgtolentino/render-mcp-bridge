const express = require('express');
const crypto = require('crypto');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { InitializeRequestSchema, ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const app = express();

// Capture raw body for HMAC verification
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// Security: Origin verification
function verifyOrigin(origin) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://chat.openai.com,https://chatgpt.com')
    .split(',')
    .map((o) => o.trim());

  if (!origin) {
    return false; // No origin header = reject
  }

  return allowedOrigins.includes(origin);
}

// Security: HMAC signature verification
function verifyHmac(rawBody, signature) {
  const secret = process.env.MCP_HMAC_SECRET;

  if (!secret) {
    // No secret configured = skip verification (development mode)
    return true;
  }

  if (!signature) {
    return false; // Secret exists but no signature provided
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Fast health check for Render (sub-100ms response)
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Create MCP server instance
const mcpServer = new Server(
  {
    name: 'pulser-mcp-bridge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register initialize handler (required by MCP protocol)
mcpServer.setRequestHandler(InitializeRequestSchema, async () => ({
  protocolVersion: '2025-03-26',
  capabilities: {
    tools: {},
  },
  serverInfo: {
    name: 'pulser-mcp-bridge',
    version: '1.0.0',
  },
}));

// Register tools/list handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo',
      description: 'Echo back the provided message',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo back',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'get_time',
      description: 'Get the current server time in UTC',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'status',
      description: 'Get server status and health information',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'fetch',
      description: 'Fetch content from a URL via HTTP GET',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch (must be valid HTTP/HTTPS)',
          },
        },
        required: ['url'],
      },
    },
  ],
}));

// Register tools/call handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo':
      if (!args?.message) {
        throw new Error('Missing required parameter: message');
      }
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${args.message}`,
          },
        ],
      };

    case 'get_time':
      const now = new Date();
      return {
        content: [
          {
            type: 'text',
            text: `Current server time: ${now.toISOString()}\nTimezone: UTC\nUnix timestamp: ${now.getTime()}`,
          },
        ],
      };

    case 'status':
      return {
        content: [
          {
            type: 'text',
            text: `Server Status:
- Service: Pulser MCP Bridge
- Version: 1.0.0
- Protocol: MCP Streamable-HTTP
- Uptime: ${process.uptime().toFixed(2)}s
- Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
- Node: ${process.version}
- Status: Operational ✅`,
          },
        ],
      };

    case 'fetch':
      if (!args?.url) {
        throw new Error('Missing required parameter: url');
      }

      try {
        const url = new URL(args.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('URL must use HTTP or HTTPS protocol');
        }

        const response = await fetch(args.url);
        const text = await response.text();

        return {
          content: [
            {
              type: 'text',
              text: `Status: ${response.status} ${response.statusText}\nContent-Type: ${response.headers.get('content-type')}\n\n${text.slice(0, 5000)}${text.length > 5000 ? '\n... (truncated)' : ''}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Fetch failed: ${error.message}`);
      }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Main MCP endpoint - Streamable-HTTP transport
// Note: Custom HMAC/origin security disabled for ChatGPT Responses API compatibility
// Authentication handled by OpenAI via 'authorization' parameter in API request
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  // Clean up transport on connection close
  res.on('close', () => {
    transport.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
        id: req.body?.id || null,
      });
    }
  }
});

// Root endpoint - service info
app.get('/', (_req, res) => {
  res.json({
    service: 'Pulser MCP Bridge',
    version: '1.0.0',
    protocol: 'MCP Streamable-HTTP',
    endpoints: {
      mcp: 'POST /mcp',
      health: 'GET /healthz',
    },
    status: 'operational',
    capabilities: ['tools'],
    documentation: 'https://modelcontextprotocol.io/',
  });
});

// Error handling
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 MCP server listening on port ${port}`);
  console.log(`📍 Health: http://localhost:${port}/healthz`);
  console.log(`⚡ MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`📋 Protocol: MCP Streamable-HTTP`);
});
