/**
 * Prometheus Metrics Middleware
 * Exposes metrics at /metrics endpoint (requires mcp:admin scope)
 */
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'path', 'status', 'sub'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
});
register.registerMetric(httpRequestDuration);

// HTTP request counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status', 'sub']
});
register.registerMetric(httpRequestCounter);

// Authentication success/failure counter
const authCounter = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['result', 'method'] // result: success|failure, method: jwt|basic|none
});
register.registerMetric(authCounter);

// JWT verification duration
const jwtVerifyDuration = new client.Histogram({
  name: 'jwt_verify_duration_ms',
  help: 'Duration of JWT verification in ms',
  buckets: [5, 10, 25, 50, 100, 200, 500]
});
register.registerMetric(jwtVerifyDuration);

// Rate limit counter
const rateLimitCounter = new client.Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['identifier_type'] // sub|ip
});
register.registerMetric(rateLimitCounter);

// Active connections gauge
const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});
register.registerMetric(activeConnections);

// Request body size histogram
const requestBodySize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP request bodies in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
});
register.registerMetric(requestBodySize);

// Response body size histogram
const responseBodySize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response bodies in bytes',
  labelNames: ['method', 'path', 'status'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
});
register.registerMetric(responseBodySize);

/**
 * Metrics collection middleware
 * Collects metrics for all HTTP requests
 */
function collectMetrics() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Increment active connections
    activeConnections.inc();

    // Intercept res.end to collect metrics
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Extract labels
      const method = req.method;
      const path = req.path || req.url;
      const status = res.statusCode;
      const sub = req.auth?.sub || 'anonymous';

      // Record metrics
      httpRequestDuration.labels(method, path, status, sub).observe(duration);
      httpRequestCounter.labels(method, path, status, sub).inc();

      // Record request/response sizes
      const reqSize = parseInt(req.headers['content-length']) || 0;
      const resSize = parseInt(res.get('content-length')) || 0;

      if (reqSize > 0) {
        requestBodySize.labels(method, path).observe(reqSize);
      }
      if (resSize > 0) {
        responseBodySize.labels(method, path, status).observe(resSize);
      }

      // Decrement active connections
      activeConnections.dec();
    };

    next();
  };
}

/**
 * Record auth attempt
 */
function recordAuthAttempt(result, method = 'jwt') {
  authCounter.labels(result, method).inc();
}

/**
 * Record JWT verification duration
 */
function recordJwtVerifyDuration(durationMs) {
  jwtVerifyDuration.observe(durationMs);
}

/**
 * Record rate limit exceeded
 */
function recordRateLimitExceeded(identifierType) {
  rateLimitCounter.labels(identifierType).inc();
}

/**
 * Get metrics endpoint handler
 * Returns Prometheus-formatted metrics
 */
async function getMetrics(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to generate metrics'
    });
  }
}

module.exports = {
  register,
  collectMetrics,
  recordAuthAttempt,
  recordJwtVerifyDuration,
  recordRateLimitExceeded,
  getMetrics
};
