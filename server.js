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

  // TODO: Replace with real MCP tool routing
  // Example tool registry:
  // const tools = {
  //   'echo': (params) => ({ result: params }),
  //   'get_time': () => ({ result: new Date().toISOString() }),
  //   'calculate': (params) => ({ result: eval(params.expression) })
  // };

  console.log(`MCP invoke: tool=${tool}, params=${JSON.stringify(params)}`);

  res.json({
    ok: true,
    tool,
    params,
    result: `Stubbed result for tool: ${tool || 'unknown'}`,
    timestamp: Date.now()
  });
});

// Root endpoint - service info
app.get('/', (_req, res) => {
  res.json({
    service: 'Render MCP Server (ChatGPT Bridge)',
    version: '0.1.0',
    endpoints: {
      health: '/healthz',
      events: '/mcp/events (SSE)',
      invoke: '/mcp/invoke (POST)'
    },
    status: 'operational',
    note: 'Replace stub handlers with real MCP tool implementations'
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
