/**
 * Fixed Auth Middleware - Handles JWT malformed errors
 * /Users/michalhajok/Projects/tracker/backend/middleware/auth.js
 */

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    // 1. Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No Authorization header provided",
      });
    }

    // 2. Check Bearer format
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization header must start with Bearer",
      });
    }

    // 3. Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token || token.trim().length === 0) {
      return res.status(401).json({
        success: false,
        message: "Token is empty",
      });
    }

    // 4. Validate token format BEFORE jwt.verify
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return res.status(401).json({
        success: false,
        message: `Invalid token format: expected 3 parts, got ${tokenParts.length}`,
      });
    }

    // 5. Check if token parts are not empty
    for (let i = 0; i < tokenParts.length; i++) {
      if (!tokenParts[i] || tokenParts[i].trim().length === 0) {
        return res.status(401).json({
          success: false,
          message: `Invalid token: part ${i + 1} is empty`,
        });
      }
    }

    // 6. Try to decode header and payload (without verification)
    try {
      const header = JSON.parse(
        Buffer.from(tokenParts[0], "base64").toString()
      );
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], "base64").toString()
      );
    } catch (decodeError) {
      return res.status(401).json({
        success: false,
        message: "Invalid token encoding",
      });
    }

    // 7. Get JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("❌ JWT_SECRET not set in environment variables");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // 8. Verify token with proper error handling
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      console.error(
        "❌ JWT verification failed:",
        jwtError.name,
        jwtError.message
      );

      // Handle specific JWT errors
      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token signature or format",
          debug: jwtError.message,
        });
      } else if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      } else if (jwtError.name === "NotBeforeError") {
        return res.status(401).json({
          success: false,
          message: "Token not active yet",
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Token verification failed",
          debug: jwtError.message,
        });
      }
    }

    // 9. Attach user info to request
    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    console.error("❌ Auth middleware unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication processing error",
      debug: error.message,
    });
  }
};

module.exports = authMiddleware;
