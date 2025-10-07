/**
 * Bearer Token Extraction Middleware
 * Utility functions for extracting and parsing Bearer tokens
 */

/**
 * Extract Bearer token from Authorization header
 * @param {object} req - Express request object
 * @returns {string|null} - Token or null
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return null;
  }

  // Handle Bearer format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Handle lowercase bearer
  if (authHeader.startsWith('bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Extract token from multiple sources
 * Checks: Authorization header, query param, cookie
 * @param {object} req - Express request object
 * @param {object} options - Extraction options
 * @returns {string|null} - Token or null
 */
function extractToken(req, options = {}) {
  const {
    headerName = 'authorization',
    queryParam = 'access_token',
    cookieName = 'access_token',
    checkHeader = true,
    checkQuery = false,
    checkCookie = false
  } = options;

  // Try Authorization header first
  if (checkHeader) {
    const token = extractBearerToken(req);
    if (token) return token;
  }

  // Try query parameter
  if (checkQuery && req.query && req.query[queryParam]) {
    return req.query[queryParam];
  }

  // Try cookie
  if (checkCookie && req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  return null;
}

/**
 * Parse JWT payload without verification (for inspection only)
 * WARNING: Do not trust this data - always verify signature first
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded payload or null
 */
function parseJwtPayload(token) {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

/**
 * Parse JWT header without verification
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded header or null
 */
function parseJwtHeader(token) {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = parts[0];
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

/**
 * Check if token is expired (without verification)
 * WARNING: This only checks expiration, not signature validity
 * @param {string} token - JWT token
 * @returns {boolean} - True if expired
 */
function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Middleware to extract and attach bearer token to request
 * Does NOT verify - only extracts and parses
 */
function bearerTokenExtractor(options = {}) {
  return (req, res, next) => {
    const token = extractToken(req, options);

    if (token) {
      req.token = token;
      req.tokenHeader = parseJwtHeader(token);
      req.tokenPayload = parseJwtPayload(token);
      req.isTokenExpired = isTokenExpired(token);
    }

    next();
  };
}

module.exports = {
  extractBearerToken,
  extractToken,
  parseJwtPayload,
  parseJwtHeader,
  isTokenExpired,
  bearerTokenExtractor
};
