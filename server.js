const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const app = express();
app.use(express.json());

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

// Register MCP tools
mcpServer.setRequestHandler('tools/list', async () => ({
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
  ],
}));

// Register tool call handlers
mcpServer.setRequestHandler('tools/call', async (request) => {
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Main MCP endpoint - Streamable-HTTP transport
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
