/**
 * JWT Authentication Middleware
 * Verifies RS256 JWT tokens using JWKS (JSON Web Key Set)
 *
 * Supports:
 * - Auth0, Okta, Keycloak, Supabase Auth
 * - RS256 signature verification
 * - Audience, issuer, expiration validation
 * - Scope-based authorization
 * - Token caching for performance
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Environment configuration
const AUTH_DOMAIN = process.env.AUTH_DOMAIN;           // e.g., your-tenant.auth0.com
const AUTH_AUDIENCE = process.env.AUTH_AUDIENCE;       // REQUIRED: e.g., mcp-api
const AUTH_ISSUER = process.env.AUTH_ISSUER;           // REQUIRED: e.g., https://your-tenant.auth0.com/
const JWKS_URI = process.env.JWKS_URI;                 // REQUIRED: e.g., https://your-tenant.auth0.com/.well-known/jwks.json
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_BASIC_AUTH_FALLBACK = process.env.ENABLE_BASIC_AUTH_FALLBACK === 'true';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS;

// Production safety check
if (NODE_ENV === 'production' && ENABLE_BASIC_AUTH_FALLBACK) {
  console.error('🚨 CRITICAL: Basic Auth fallback MUST be disabled in production');
  console.error('   Set ENABLE_BASIC_AUTH_FALLBACK=false');
  process.exit(1);
}

// JWKS client for fetching public keys
let jwksClientInstance = null;

function getJwksClient() {
  if (!jwksClientInstance && JWKS_URI) {
    jwksClientInstance = jwksClient({
      cache: true,
      cacheMaxAge: 900000, // 15 minutes (increased for better performance)
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: JWKS_URI,
      // Handle key rotation gracefully
      jwksRequestsPerMinute: 10,
      timeout: 30000 // 30 second timeout
    });
  }
  return jwksClientInstance;
}

/**
 * Get signing key from JWKS
 */
function getKey(header, callback) {
  const client = getJwksClient();
  if (!client) {
    return callback(new Error('JWKS client not configured'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify JWT token with strict validation
 * @param {string} token - JWT token
 * @returns {Promise<object>} - Decoded token payload
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    // Production mode: Require all auth configuration
    if (NODE_ENV === 'production') {
      if (!AUTH_AUDIENCE || !AUTH_ISSUER || !JWKS_URI) {
        return reject(new Error('Auth configuration incomplete in production mode'));
      }
    }

    // Verify with JWKS and strict claim validation
    jwt.verify(
      token,
      getKey,
      {
        audience: AUTH_AUDIENCE,
        issuer: AUTH_ISSUER,
        algorithms: ['RS256'],
        clockTolerance: 10, // Allow 10 second clock skew
        ignoreExpiration: false, // Never ignore expiration
        ignoreNotBefore: false // Validate nbf claim
      },
      (err, decoded) => {
        if (err) {
          // Enhanced error messages for debugging
          if (err.name === 'TokenExpiredError') {
            return reject(new Error('Token expired'));
          } else if (err.name === 'JsonWebTokenError') {
            return reject(new Error('Invalid token'));
          } else if (err.name === 'NotBeforeError') {
            return reject(new Error('Token not yet valid'));
          }
          return reject(err);
        }

        // Additional validation: Ensure required claims exist
        if (!decoded.sub) {
          return reject(new Error('Token missing required sub claim'));
        }
        if (!decoded.aud) {
          return reject(new Error('Token missing required aud claim'));
        }
        if (!decoded.iss) {
          return reject(new Error('Token missing required iss claim'));
        }

        // Pin audience and issuer (strict validation)
        if (decoded.aud !== AUTH_AUDIENCE) {
          return reject(new Error(`Invalid audience: expected ${AUTH_AUDIENCE}, got ${decoded.aud}`));
        }
        if (decoded.iss !== AUTH_ISSUER) {
          return reject(new Error(`Invalid issuer: expected ${AUTH_ISSUER}, got ${decoded.iss}`));
        }

        resolve(decoded);
      }
    );
  });
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null
 */
function extractBearerToken(authHeader) {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Basic Auth credentials (fallback for migration period)
 * @param {string} authHeader - Authorization header value
 * @returns {boolean} - True if valid
 */
function verifyBasicAuth(authHeader) {
  if (!ENABLE_BASIC_AUTH_FALLBACK || !BASIC_AUTH_USER || !BASIC_AUTH_PASS) {
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS;
  } catch (err) {
    return false;
  }
}

/**
 * Check if request has required scopes
 * @param {object} decodedToken - Decoded JWT payload
 * @param {string[]} requiredScopes - Array of required scopes
 * @returns {boolean} - True if has all required scopes
 */
function hasRequiredScopes(decodedToken, requiredScopes) {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  const tokenScopes = decodedToken.scope ? decodedToken.scope.split(' ') : [];
  return requiredScopes.every(scope => tokenScopes.includes(scope));
}

/**
 * Main authentication middleware with production hardening
 * @param {object} options - Middleware options
 * @param {string[]} options.requiredScopes - Array of required scopes (optional)
 * @param {boolean} options.optional - If true, allows unauthenticated requests
 * @param {boolean} options.enforceAuth - If true, always require auth (ignores dev mode)
 */
function authenticate(options = {}) {
  const { requiredScopes = [], optional = false, enforceAuth = false } = options;

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const startTime = Date.now();

    // PRODUCTION MODE: Always enforce authentication
    if (NODE_ENV === 'production' || enforceAuth) {
      if (!AUTH_AUDIENCE || !AUTH_ISSUER || !JWKS_URI) {
        console.error('🚨 Auth configuration missing in production mode');
        return res.status(500).json({
          error: 'internal_error',
          message: 'Authentication not configured'
        });
      }
    }

    // Development mode: Allow optional auth if not configured
    if (!enforceAuth && NODE_ENV !== 'production' && !AUTH_ISSUER && !ENABLE_BASIC_AUTH_FALLBACK) {
      console.warn('⚠️  Authentication not configured - allowing request (DEVELOPMENT MODE ONLY)');
      req.user = { sub: 'dev-user', scope: 'mcp:tools.exec mcp:tools.read mcp:admin' };
      req.auth = { sub: 'dev-user', scopes: ['mcp:tools.exec', 'mcp:tools.read', 'mcp:admin'] };
      return next();
    }

    // No Authorization header
    if (!authHeader) {
      if (optional) {
        return next();
      }
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing Authorization header'
      });
    }

    // Try Basic Auth fallback first (if enabled)
    if (ENABLE_BASIC_AUTH_FALLBACK && authHeader.startsWith('Basic ')) {
      if (verifyBasicAuth(authHeader)) {
        console.log('✅ Basic Auth verified (fallback mode)');
        req.user = { sub: 'basic-auth-user', scope: 'mcp:tools.exec mcp:tools.read', auth_method: 'basic' };
        req.auth = { sub: 'basic-auth-user', scopes: ['mcp:tools.exec', 'mcp:tools.read'], auth_method: 'basic' };
        return next();
      }

      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid Basic Auth credentials'
      });
    }

    // Extract Bearer token
    const token = extractBearerToken(authHeader);
    if (!token) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>'
      });
    }

    // Verify JWT
    try {
      const decoded = await verifyToken(token);

      // Check required scopes
      if (!hasRequiredScopes(decoded, requiredScopes)) {
        const latency = Date.now() - startTime;
        console.warn(`❌ Scope check failed - sub: ${decoded.sub}, latency: ${latency}ms`);

        return res.status(403).json({
          error: 'forbidden',
          message: `Missing required scopes`,
          required_scopes: requiredScopes
        });
      }

      // Attach user info to request
      req.user = decoded;
      req.auth = {
        sub: decoded.sub,
        scopes: decoded.scope ? decoded.scope.split(' ') : [],
        iss: decoded.iss,
        aud: decoded.aud,
        exp: decoded.exp,
        jti: decoded.jti || null,
        auth_method: 'jwt'
      };

      const latency = Date.now() - startTime;
      console.log(`✅ JWT verified - sub: ${decoded.sub}, scopes: ${decoded.scope || 'none'}, latency: ${latency}ms`);
      next();
    } catch (err) {
      const latency = Date.now() - startTime;
      console.error(`❌ JWT verification failed: ${err.message}, latency: ${latency}ms`);

      // Error taxonomy: 401 for auth failures, no stack traces
      return res.status(401).json({
        error: 'unauthorized',
        message: err.message || 'Invalid or expired token'
      });
    }
  };
}

module.exports = {
  authenticate,
  verifyToken,
  extractBearerToken,
  hasRequiredScopes,
  verifyBasicAuth
};
