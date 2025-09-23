const mongoose = require("mongoose");

/**
 * Error Types Classification
 */
const ErrorTypes = {
  VALIDATION_ERROR: "ValidationError",
  CAST_ERROR: "CastError",
  DUPLICATE_KEY: "DuplicateKeyError",
  JWT_ERROR: "JsonWebTokenError",
  JWT_EXPIRED: "TokenExpiredError",
  MULTER_ERROR: "MulterError",
  RATE_LIMIT: "RateLimitError",
  NOT_FOUND: "NotFoundError",
  FORBIDDEN: "ForbiddenError",
  UNAUTHORIZED: "UnauthorizedError",
};

/**
 * Custom Error Classes
 */
class AppError extends Error {
  constructor(message, statusCode, errorType = "AppError") {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errorType = errorType;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, ErrorTypes.VALIDATION_ERROR);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, ErrorTypes.NOT_FOUND);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, ErrorTypes.UNAUTHORIZED);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, ErrorTypes.FORBIDDEN);
  }
}

/**
 * Error Logger
 */
const logError = (error, req) => {
  const timestamp = new Date().toISOString();
  const method = req?.method || "UNKNOWN";
  const url = req?.originalUrl || "UNKNOWN";
  const ip = req?.ip || "UNKNOWN";
  const userId = req?.user?.id || "ANONYMOUS";

  console.error("=".repeat(80));
  console.error(`[${timestamp}] ERROR OCCURRED`);
  console.error(`Method: ${method}`);
  console.error(`URL: ${url}`);
  console.error(`IP: ${ip}`);
  console.error(`User: ${userId}`);
  console.error(`Error Type: ${error.errorType || error.name || "Unknown"}`);
  console.error(`Status Code: ${error.statusCode || 500}`);
  console.error(`Message: ${error.message}`);

  if (error.stack) {
    console.error(`Stack: ${error.stack}`);
  }

  if (error.errors) {
    console.error(`Validation Errors:`, error.errors);
  }

  console.error("=".repeat(80));

  // In production, you might want to send errors to external logging service
  // like Sentry, LogRocket, or CloudWatch
  if (process.env.NODE_ENV === "production") {
    // Example: Sentry.captureException(error);
    // Example: sendToLogService(error, req);
  }
};

/**
 * Handle MongoDB Validation Errors
 */
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map((val) => ({
    field: val.path,
    message: val.message,
    value: val.value,
    kind: val.kind,
  }));

  return new ValidationError("Validation failed", errors);
};

/**
 * Handle MongoDB Cast Errors (Invalid ObjectId, etc.)
 */
const handleCastError = (error) => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400, ErrorTypes.CAST_ERROR);
};

/**
 * Handle MongoDB Duplicate Key Errors
 */
const handleDuplicateKeyError = (error) => {
  // Extract field name and value from error
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];

  const message = `${
    field.charAt(0).toUpperCase() + field.slice(1)
  } '${value}' already exists`;
  return new AppError(message, 409, ErrorTypes.DUPLICATE_KEY);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new UnauthorizedError("Invalid token. Please log in again.");
};

const handleJWTExpiredError = () => {
  return new UnauthorizedError("Your token has expired. Please log in again.");
};

/**
 * Handle Multer Errors (File Upload)
 */
const handleMulterError = (error) => {
  let message = "File upload error";
  let statusCode = 400;

  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      message = `File too large. Maximum size is ${formatBytes(error.limit)}`;
      break;
    case "LIMIT_FILE_COUNT":
      message = `Too many files. Maximum count is ${error.limit}`;
      break;
    case "LIMIT_FIELD_KEY":
      message = "Field name too long";
      break;
    case "LIMIT_FIELD_VALUE":
      message = "Field value too long";
      break;
    case "LIMIT_FIELD_COUNT":
      message = "Too many fields";
      break;
    case "LIMIT_UNEXPECTED_FILE":
      message = "Unexpected field";
      break;
    default:
      message = error.message;
  }

  return new AppError(message, statusCode, ErrorTypes.MULTER_ERROR);
};

/**
 * Format bytes helper
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Send Error Response in Development
 */
const sendErrorDev = (err, req, res) => {
  // Log the error
  logError(err, req);

  // Send detailed error info in development
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      type: err.errorType || err.name,
      message: err.message,
      stack: err.stack,
      ...(err.errors && { validationErrors: err.errors }),
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
    },
  });
};

/**
 * Send Error Response in Production
 */
const sendErrorProd = (err, req, res) => {
  // Log the error (but don't expose to client)
  logError(err, req);

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
    };

    // Include validation errors if present
    if (err.errors && Array.isArray(err.errors)) {
      response.errors = err.errors;
    }

    res.status(err.statusCode).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Something went wrong on our end. Please try again later.",
    });
  }
};

/**
 * Main Error Handling Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Handle different error types
  let error = { ...err };
  error.message = err.message;

  // MongoDB Validation Error
  if (err.name === "ValidationError") {
    error = handleValidationError(err);
  }

  // MongoDB Cast Error (Invalid ObjectId)
  if (err.name === "CastError") {
    error = handleCastError(err);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  }

  if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  }

  // Multer Errors (File Upload)
  if (err.name === "MulterError") {
    error = handleMulterError(err);
  }

  // Send error response based on environment
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

/**
 * Handle Async Errors
 * Wrapper function to catch async errors in route handlers
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Handle 404 - Route Not Found
 */
const notFoundHandler = (req, res, next) => {
  const err = new NotFoundError(`Can't find ${req.originalUrl} on this server`);
  next(err);
};

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = (server) => {
  const signals = ["SIGTERM", "SIGINT"];

  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`Received ${signal}. Starting graceful shutdown...`);

      server.close(() => {
        console.log("HTTP server closed.");

        // Close database connections
        mongoose.connection.close(false, () => {
          console.log("MongoDB connection closed.");
          process.exit(0);
        });
      });
    });
  });
};

/**
 * Unhandled Promise Rejections
 */
const handleUnhandledRejections = (server) => {
  process.on("unhandledRejection", (err, promise) => {
    console.error("UNHANDLED PROMISE REJECTION! 💥 Shutting down...");
    console.error("Error:", err.message);
    console.error("Promise:", promise);

    server.close(() => {
      process.exit(1);
    });
  });
};

/**
 * Uncaught Exceptions
 */
const handleUncaughtExceptions = () => {
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);

    process.exit(1);
  });
};

/**
 * Database Connection Error Handler
 */
const handleDatabaseErrors = () => {
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected. Attempting to reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected successfully.");
  });
};

/**
 * Request Timeout Handler
 */
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      const err = new AppError("Request timeout", 408);
      next(err);
    });

    res.setTimeout(timeout, () => {
      const err = new AppError("Response timeout", 408);
      next(err);
    });

    next();
  };
};

module.exports = {
  // Error Classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,

  // Error Types
  ErrorTypes,

  // Middleware
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  requestTimeout,

  // Error Handlers
  gracefulShutdown,
  handleUnhandledRejections,
  handleUncaughtExceptions,
  handleDatabaseErrors,

  // Utilities
  logError,
};
