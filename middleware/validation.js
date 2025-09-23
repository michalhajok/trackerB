const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validation Result Middleware
 * Checks express-validator results and returns errors if any
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
      errorCount: formattedErrors.length,
    });
  }

  next();
};

/**
 * Sanitization Middleware
 * Sanitizes request body data
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Recursively sanitize object
    const sanitizeObject = (obj) => {
      if (obj === null || obj === undefined) return obj;

      if (typeof obj === "string") {
        // Remove dangerous characters and trim whitespace
        return obj
          .replace(/[<>]/g, "") // Remove basic XSS characters
          .replace(/javascript:/gi, "") // Remove javascript protocol
          .replace(/on\w+\s*=/gi, "") // Remove event handlers
          .trim();
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (typeof obj === "object") {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          // Sanitize key names too
          const sanitizedKey = key.replace(/[^a-zA-Z0-9_.$]/g, "");
          sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
      }

      return obj;
    };

    // Sanitize request body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    console.error("Sanitization error:", error);
    res.status(500).json({
      success: false,
      message: "Input sanitization error",
    });
  }
};

/**
 * MongoDB ObjectId Validation Helper
 *
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Custom Validation Functions
 */
const customValidators = {
  /**
   * Validates if symbol follows proper format
   * @param {string} symbol - Trading symbol
   * @returns {boolean}
   */
  isValidSymbol: (symbol) => {
    if (!symbol || typeof symbol !== "string") return false;
    return /^[A-Z0-9.]{1,10}$/.test(symbol.toUpperCase());
  },

  /**
   * Validates if email domain is allowed
   * @param {string} email - Email address
   * @returns {boolean}
   */
  isAllowedEmailDomain: (email) => {
    if (!email || typeof email !== "string") return false;

    // List of allowed domains (can be moved to env vars)
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(",") || [];

    if (allowedDomains.length === 0) return true; // No restrictions

    const domain = email.split("@")[1]?.toLowerCase();
    return allowedDomains.includes(domain);
  },

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @returns {object} Validation result with score and feedback
   */
  validatePasswordStrength: (password) => {
    if (!password || typeof password !== "string") {
      return { isValid: false, score: 0, feedback: ["Password is required"] };
    }

    const feedback = [];
    let score = 0;

    // Length check
    if (password.length < 6) {
      feedback.push("Password must be at least 6 characters long");
    } else if (password.length >= 8) {
      score += 1;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      feedback.push("Password must contain at least one uppercase letter");
    } else {
      score += 1;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      feedback.push("Password must contain at least one lowercase letter");
    } else {
      score += 1;
    }

    // Number check
    if (!/\d/.test(password)) {
      feedback.push("Password must contain at least one number");
    } else {
      score += 1;
    }

    // Special character check
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push("Password should contain at least one special character");
    } else {
      score += 1;
    }

    // Common patterns check
    const commonPatterns = [
      /(.)\1{2,}/, // Repeated characters
      /123|abc|qwe/i, // Sequential characters
      /password|admin|user|login/i, // Common words
    ];

    if (commonPatterns.some((pattern) => pattern.test(password))) {
      feedback.push("Password contains common patterns");
      score -= 1;
    }

    return {
      isValid: feedback.length === 0 && score >= 3,
      score: Math.max(0, score),
      feedback,
    };
  },

  /**
   * Validates if amount is a valid financial amount
   * @param {number|string} amount - Amount to validate
   * @returns {boolean}
   */
  isValidAmount: (amount) => {
    if (amount === null || amount === undefined) return false;

    const num = parseFloat(amount);
    return !isNaN(num) && isFinite(num) && num !== 0;
  },

  /**
   * Validates if price is positive
   * @param {number|string} price - Price to validate
   * @returns {boolean}
   */
  isValidPrice: (price) => {
    if (price === null || price === undefined) return false;

    const num = parseFloat(price);
    return !isNaN(num) && isFinite(num) && num > 0;
  },

  /**
   * Validates if volume is positive
   * @param {number|string} volume - Volume to validate
   * @returns {boolean}
   */
  isValidVolume: (volume) => {
    if (volume === null || volume === undefined) return false;

    const num = parseFloat(volume);
    return !isNaN(num) && isFinite(num) && num > 0;
  },

  /**
   * Validates date range
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {boolean}
   */
  isValidDateRange: (startDate, endDate) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return false;
      }

      return start <= end;
    } catch {
      return false;
    }
  },

  /**
   * Validates if date is not in the future
   * @param {string|Date} date - Date to validate
   * @returns {boolean}
   */
  isNotFutureDate: (date) => {
    try {
      const inputDate = new Date(date);
      const now = new Date();

      if (isNaN(inputDate.getTime())) {
        return false;
      }

      return inputDate <= now;
    } catch {
      return false;
    }
  },
};

/**
 * Database Validation Helpers
 */
const dbValidators = {
  /**
   * Check if user exists
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>}
   */
  userExists: async (userId) => {
    try {
      if (!isValidObjectId(userId)) return false;

      const User = require("../models/User");
      const user = await User.findById(userId);
      return !!user;
    } catch {
      return false;
    }
  },

  /**
   * Check if email is already taken
   * @param {string} email - Email to check
   * @param {string} excludeUserId - User ID to exclude from check
   * @returns {Promise<boolean>}
   */
  emailTaken: async (email, excludeUserId = null) => {
    try {
      const User = require("../models/User");
      const query = { email: email.toLowerCase() };

      if (excludeUserId && isValidObjectId(excludeUserId)) {
        query._id = { $ne: excludeUserId };
      }

      const user = await User.findOne(query);
      return !!user;
    } catch {
      return false;
    }
  },

  /**
   * Check if position exists and belongs to user
   * @param {string} positionId - Position ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  positionBelongsToUser: async (positionId, userId) => {
    try {
      if (!isValidObjectId(positionId) || !isValidObjectId(userId)) {
        return false;
      }

      const Position = require("../models/Position");
      const position = await Position.findOne({ _id: positionId, userId });
      return !!position;
    } catch {
      return false;
    }
  },

  /**
   * Check if symbol exists in database
   * @param {string} symbol - Trading symbol
   * @returns {Promise<boolean>}
   */
  symbolExists: async (symbol) => {
    try {
      const Position = require("../models/Position");
      const position = await Position.findOne({ symbol: symbol.toUpperCase() });
      return !!position;
    } catch {
      return false;
    }
  },
};

/**
 * Request Validation Helpers
 */
const requestHelpers = {
  /**
   * Extract pagination parameters
   * @param {Object} query - Request query object
   * @returns {Object} Pagination parameters
   */
  extractPagination: (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  },

  /**
   * Extract sorting parameters
   * @param {Object} query - Request query object
   * @param {Array} allowedFields - Allowed sort fields
   * @param {string} defaultField - Default sort field
   * @returns {Object} Sort parameters
   */
  extractSorting: (query, allowedFields = [], defaultField = "createdAt") => {
    const sortBy = allowedFields.includes(query.sortBy)
      ? query.sortBy
      : defaultField;
    const sortOrder = ["asc", "desc"].includes(query.sortOrder)
      ? query.sortOrder
      : "desc";
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    return { sortBy, sortOrder, sort };
  },

  /**
   * Extract date range parameters
   * @param {Object} query - Request query object
   * @returns {Object} Date range parameters
   */
  extractDateRange: (query) => {
    const dateRange = {};

    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        dateRange.$gte = fromDate;
      }
    }

    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999); // End of day
        dateRange.$lte = toDate;
      }
    }

    return Object.keys(dateRange).length > 0 ? dateRange : null;
  },

  /**
   * Validate required fields
   * @param {Object} data - Data object to validate
   * @param {Array} requiredFields - Array of required field names
   * @returns {Object} Validation result
   */
  validateRequiredFields: (data, requiredFields) => {
    const missing = [];

    for (const field of requiredFields) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        missing.push(field);
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
    };
  },
};

/**
 * Response Helpers
 */
const responseHelpers = {
  /**
   * Format validation error response
   * @param {Array} errors - Array of error objects
   * @returns {Object} Formatted error response
   */
  formatValidationError: (errors) => {
    return {
      success: false,
      message: "Validation failed",
      errors: Array.isArray(errors) ? errors : [errors],
      errorCount: Array.isArray(errors) ? errors.length : 1,
    };
  },

  /**
   * Format success response
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @returns {Object} Formatted success response
   */
  formatSuccessResponse: (data, message = "Success") => {
    return {
      success: true,
      message,
      data,
    };
  },

  /**
   * Format paginated response
   * @param {Array} data - Response data array
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {number} total - Total items count
   * @returns {Object} Formatted paginated response
   */
  formatPaginatedResponse: (data, page, limit, total) => {
    return {
      success: true,
      data,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },
};

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  isValidObjectId,
  customValidators,
  dbValidators,
  requestHelpers,
  responseHelpers,
};
