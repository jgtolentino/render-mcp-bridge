/**
 * Rate Limiting Middleware
 * Implements rate limiting by sub (client ID) and IP address
 */
const rateLimit = require('express-rate-limit');

/**
 * Create rate limiter with custom key generator
 * Prioritizes authenticated client (sub) over IP
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100,
    message = 'Too many requests',
    skipSuccessfulRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'rate_limit_exceeded',
      message,
      retry_after: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests,

    // Custom key generator: use sub claim or fall back to IP
    keyGenerator: (req) => {
      // Priority 1: Authenticated client (sub claim)
      if (req.auth && req.auth.sub) {
        return `sub:${req.auth.sub}`;
      }

      // Priority 2: IP address
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      return `ip:${ip}`;
    },

    // Handler for rate limit exceeded
    handler: (req, res) => {
      const identifier = req.auth?.sub || req.ip;
      console.warn(`⚠️  Rate limit exceeded - identifier: ${identifier}`);

      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests, please try again later',
        retry_after: Math.ceil(windowMs / 1000)
      });
    }
  });
}

/**
 * Preset rate limiters
 */

// Standard API rate limit: 100 requests per minute per client
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'API rate limit exceeded'
});

// Strict rate limit for sensitive endpoints: 10 requests per minute
const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Rate limit exceeded for sensitive endpoint'
});

// Heavy operations: 5 requests per minute
const heavyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Rate limit exceeded for heavy operation'
});

module.exports = {
  createRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
  heavyRateLimiter
};
