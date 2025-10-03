const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Liveness probe for Render health checks
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// SSE event stream - MCP event channel
app.get('/mcp/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection event immediately
  res.write(`: Connected to MCP server\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), status: 'ready' })}\n\n`);

  // Send periodic ping to keep connection alive (reduced to 10s for Render compatibility)
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
  }, 10000);

  req.on('close', () => {
    clearInterval(ping);
  });
});

// MCP tool invocation endpoint
app.post('/mcp/invoke', (req, res) => {
  const { tool, params } = req.body || {};

  console.log(`MCP invoke: tool=${tool}, params=${JSON.stringify(params)}`);

  // Tool registry with actual implementations
  const tools = {
    echo: (params) => {
      if (!params || !params.message) {
        throw new Error('Missing required parameter: message');
      }
      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${params.message}`
          }
        ]
      };
    },

    get_time: () => {
      const now = new Date();
      return {
        content: [
          {
            type: 'text',
            text: `Current server time: ${now.toISOString()}\nTimezone: UTC\nUnix timestamp: ${now.getTime()}`
          }
        ]
      };
    },

    status: () => {
      return {
        content: [
          {
            type: 'text',
            text: `Server Status:\n- Service: MCP Bridge\n- Version: 0.1.0\n- Uptime: ${process.uptime().toFixed(2)}s\n- Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n- Status: Operational`
          }
        ]
      };
    }
  };

  // Validate tool exists
  if (!tool || !tools[tool]) {
    return res.status(400).json({
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Unknown tool: ${tool}. Available tools: ${Object.keys(tools).join(', ')}`
      }
    });
  }

  try {
    const result = tools[tool](params);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'TOOL_EXECUTION_ERROR',
        message: error.message
      }
    });
  }
});

// MCP tools listing endpoint (required by ChatGPT)
app.get('/mcp/tools', (_req, res) => {
  res.json({
    tools: [
      {
        name: 'echo',
        description: 'Echo back the provided message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo back'
            }
          },
          required: ['message']
        }
      },
      {
        name: 'get_time',
        description: 'Get the current server time',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'status',
        description: 'Get server status information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  });
});

// Root endpoint - service info
app.get('/', (_req, res) => {
  res.json({
    service: 'Render MCP Server (ChatGPT Bridge)',
    version: '0.1.0',
    protocol: 'MCP/1.0',
    endpoints: {
      health: '/healthz',
      tools: '/mcp/tools (GET)',
      events: '/mcp/events (SSE)',
      invoke: '/mcp/invoke (POST)'
    },
    status: 'operational',
    capabilities: {
      tools: true,
      sse: true,
      streaming: true
    }
  });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Internal server error'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 MCP server listening on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/healthz`);
  console.log(`🔄 SSE stream: http://localhost:${port}/mcp/events`);
  console.log(`⚡ Invoke: http://localhost:${port}/mcp/invoke`);
});
