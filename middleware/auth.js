const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * JWT Authentication Middleware
 * Verifies JWT token and adds user to request object
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format. Use Bearer <token>",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database (exclude password and refreshToken)
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is valid but user no longer exists",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Add user to request object
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    // Handle specific JWT errors
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    if (error.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        message: "Token not active",
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: "Authentication error",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * Optional Authentication Middleware
 * Similar to authMiddleware but doesn't fail if no token is provided
 * Useful for endpoints that work for both authenticated and non-authenticated users
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    // If no token provided, continue without authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          preferences: user.preferences,
        };
      } else {
        req.user = null;
      }
    } catch (tokenError) {
      // Token is invalid, but we don't fail - just set user to null
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    // In case of any error, set user to null and continue
    req.user = null;
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role
 *
 * @param {string|array} roles - Required role(s)
 * @returns {Function} Express middleware function
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

/**
 * Admin Only Middleware
 * Shortcut for requireRole(['admin'])
 */
const requireAdmin = requireRole(["admin"]);

/**
 * User or Admin Middleware
 * Allows both regular users and admins
 */
const requireUserOrAdmin = requireRole(["user", "admin"]);

/**
 * Self or Admin Middleware
 * Allows users to access their own data or admins to access any data
 * Requires userId parameter in the route
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Admin can access anything
  if (req.user.role === "admin") {
    return next();
  }

  // Regular user can only access their own data
  const targetUserId = req.params.userId || req.body.userId || req.query.userId;

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  if (req.user.id !== targetUserId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Access denied. You can only access your own data.",
    });
  }

  next();
};

/**
 * API Key Authentication Middleware
 * For server-to-server communication or external services
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.header("X-API-Key") || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "API key required",
    });
  }

  // In production, you should store API keys securely (database, env vars, etc.)
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    return res.status(500).json({
      success: false,
      message: "API key authentication not configured",
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
    });
  }

  // Set a flag to indicate API key authentication
  req.apiAuth = true;
  next();
};

/**
 * Rate Limiting Middleware
 * Basic rate limiting by IP address
 * For production, consider using redis-based solutions like express-rate-limit
 *
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean up old entries
    for (const [key, data] of requests.entries()) {
      if (now - data.resetTime > windowMs) {
        requests.delete(key);
      }
    }

    // Get or create request data for this IP
    let requestData = requests.get(ip);
    if (!requestData) {
      requestData = {
        count: 0,
        resetTime: now,
      };
      requests.set(ip, requestData);
    }

    // Reset count if window has passed
    if (now - requestData.resetTime > windowMs) {
      requestData.count = 0;
      requestData.resetTime = now;
    }

    // Check if limit exceeded
    if (requestData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: Math.ceil(
          (windowMs - (now - requestData.resetTime)) / 1000
        ),
      });
    }

    // Increment counter
    requestData.count++;

    // Add rate limit headers
    res.set({
      "X-RateLimit-Limit": maxRequests,
      "X-RateLimit-Remaining": maxRequests - requestData.count,
      "X-RateLimit-Reset": new Date(
        requestData.resetTime + windowMs
      ).toISOString(),
    });

    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireUserOrAdmin,
  requireSelfOrAdmin,
  apiKeyAuth,
  rateLimit,
};
