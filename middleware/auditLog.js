/**
 * Structured Audit Logging Middleware
 * Logs: {ts, sub, jti, aud, path, status, latency_ms, bytes_in, bytes_out}
 */

/**
 * Create audit log entry
 */
function createAuditLog(req, res, startTime, bytesIn) {
  const endTime = Date.now();
  const latency = endTime - startTime;

  // Extract auth info
  const auth = req.auth || {};
  const sub = auth.sub || 'anonymous';
  const jti = auth.jti || null;
  const aud = auth.aud || null;

  // Extract request info
  const method = req.method;
  const path = req.path || req.url;
  const status = res.statusCode;

  // Calculate bytes
  const bytes_in = bytesIn || parseInt(req.headers['content-length']) || 0;
  const bytes_out = parseInt(res.get('content-length')) || 0;

  // Extract IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // User agent
  const user_agent = req.headers['user-agent'] || 'unknown';

  // Create structured log entry
  const logEntry = {
    ts: new Date().toISOString(),
    sub,
    jti,
    aud,
    method,
    path,
    status,
    latency_ms: latency,
    bytes_in,
    bytes_out,
    ip,
    user_agent,
    auth_method: auth.auth_method || 'none'
  };

  return logEntry;
}

/**
 * Audit logging middleware
 * Logs all requests with structured format
 */
function auditLog() {
  return (req, res, next) => {
    const startTime = Date.now();
    let bytesIn = 0;

    // Capture request body size
    if (req.headers['content-length']) {
      bytesIn = parseInt(req.headers['content-length']);
    }

    // Intercept res.end to log after response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);

      // Create and log audit entry
      const logEntry = createAuditLog(req, res, startTime, bytesIn);

      // Log to console (in production, send to logging service)
      if (res.statusCode >= 400) {
        // Errors: log as error
        console.error('[AUDIT]', JSON.stringify(logEntry));
      } else {
        // Success: log as info
        console.log('[AUDIT]', JSON.stringify(logEntry));
      }

      // Optional: Send to external logging service
      // sendToLoggingService(logEntry);
    };

    next();
  };
}

/**
 * Audit log for specific events (login, logout, admin actions)
 */
function logSecurityEvent(req, eventType, details = {}) {
  const auth = req.auth || {};

  const logEntry = {
    ts: new Date().toISOString(),
    event_type: eventType,
    sub: auth.sub || 'anonymous',
    jti: auth.jti || null,
    path: req.path || req.url,
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    details
  };

  console.log('[SECURITY]', JSON.stringify(logEntry));
}

/**
 * Log authentication failures
 */
function logAuthFailure(req, reason) {
  logSecurityEvent(req, 'auth_failure', { reason });
}

/**
 * Log authorization failures (scope checks)
 */
function logAuthzFailure(req, requiredScopes) {
  logSecurityEvent(req, 'authz_failure', {
    required_scopes: requiredScopes,
    user_scopes: req.auth?.scopes || []
  });
}

/**
 * Log rate limit exceeded
 */
function logRateLimitExceeded(req) {
  logSecurityEvent(req, 'rate_limit_exceeded', {
    identifier: req.auth?.sub || req.ip
  });
}

/**
 * Log admin actions
 */
function logAdminAction(req, action, details = {}) {
  logSecurityEvent(req, 'admin_action', {
    action,
    ...details
  });
}

module.exports = {
  auditLog,
  createAuditLog,
  logSecurityEvent,
  logAuthFailure,
  logAuthzFailure,
  logRateLimitExceeded,
  logAdminAction
};
