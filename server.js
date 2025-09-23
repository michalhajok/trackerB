/**
 * Portfolio Manager Backend Server
 * Express.js + MongoDB + JWT Authentication
 *
 * @author Portfolio Manager Team
 * @version 1.0.0
 */

// Core dependencies
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

// Database utilities
const {
  connectDB,
  setupDatabaseEvents,
  initializeDatabase,
  checkDatabaseHealth,
  getDatabaseStats,
} = require("./utils/database");

// Middleware
const { sanitizeInput } = require("./middleware/validation");
const {
  globalErrorHandler,
  notFoundHandler,
  gracefulShutdown,
  handleUnhandledRejections,
  handleUncaughtExceptions,
  handleDatabaseErrors,
  requestTimeout,
} = require("./middleware/errorHandler");

// Routes
const authRoutes = require("./routes/auth");
const positionsRoutes = require("./routes/positions");
const cashOperationsRoutes = require("./routes/cashOperations");
const pendingOrdersRoutes = require("./routes/pendingOrders");
const analyticsRoutes = require("./routes/analytics");
const fileImportRoutes = require("./routes/fileImport");

// Configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isDevelopment = NODE_ENV === "development";
const isProduction = NODE_ENV === "production";

// Initialize Express app
const app = express();

/**
 * Security Middleware Configuration
 */
console.log("🔒 Configuring security middleware...");

// Helmet for security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:3001"];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-API-Key",
  ],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/api/health";
  },
});

app.use(limiter);

// Trust proxy (important for rate limiting and getting real IP)
app.set("trust proxy", 1);

/**
 * General Middleware Configuration
 */
console.log("⚙️ Configuring general middleware...");

// Request timeout
app.use(requestTimeout(30000)); // 30 seconds timeout

// Compression
app.use(compression());

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Cookie parser
app.use(cookieParser());

// Input sanitization
app.use(sanitizeInput);

// Request logging
if (isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Static files for uploads (if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/**
 * API Routes Configuration
 */
console.log("🛣️ Configuring API routes...");

// API Documentation route
app.get("/api", (req, res) => {
  res.json({
    name: "Portfolio Manager API",
    version: "1.0.0",
    description: "RESTful API for portfolio management system",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      positions: "/api/positions",
      cashOperations: "/api/cash-operations",
      pendingOrders: "/api/pending-orders",
      analytics: "/api/analytics",
      fileImport: "/api/import",
    },
    documentation: "/api/docs",
    health: "/health",
  });
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/cash-operations", cashOperationsRoutes);
app.use("/api/pending-orders", pendingOrdersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/import", fileImportRoutes);

/**
 * Health Check Endpoints
 */
console.log("🏥 Configuring health check endpoints...");

// Basic health check
app.get("/health", async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const dbStats = await getDatabaseStats();

    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: "1.0.0",
      database: dbHealth,
      statistics: dbStats,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        total:
          Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      },
      cpu: process.cpuUsage(),
    };

    // Return 503 if database is unhealthy
    if (dbHealth.status !== "healthy") {
      return res.status(503).json({
        ...healthData,
        status: "unhealthy",
      });
    }

    res.json(healthData);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed health check for monitoring services
app.get("/api/health/detailed", async (req, res) => {
  try {
    const [dbHealth, dbStats] = await Promise.all([
      checkDatabaseHealth(),
      getDatabaseStats(),
    ]);

    const detailedHealth = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: "healthy",
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        database: dbHealth,
        statistics: dbStats,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        nodeEnv: NODE_ENV,
      },
    };

    // Check if any service is unhealthy
    const isUnhealthy = Object.values(detailedHealth.services).some(
      (service) => service.status !== "healthy"
    );

    if (isUnhealthy) {
      detailedHealth.status = "degraded";
      return res.status(503).json(detailedHealth);
    }

    res.json(detailedHealth);
  } catch (error) {
    console.error("Detailed health check error:", error);
    res.status(503).json({
      status: "error",
      message: "Detailed health check failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Development Routes
 */
if (isDevelopment) {
  console.log("🔧 Configuring development routes...");

  // Reset database endpoint (development only)
  app.post("/api/dev/reset-db", async (req, res) => {
    try {
      const { clearDatabase } = require("./utils/database");
      await clearDatabase();
      await initializeDatabase();

      res.json({
        success: true,
        message: "Database reset successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Database reset failed",
        error: error.message,
      });
    }
  });

  // Get all environment variables (development only)
  app.get("/api/dev/env", (req, res) => {
    const safeEnvVars = Object.keys(process.env)
      .filter((key) => !key.includes("SECRET") && !key.includes("PASSWORD"))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {});

    res.json(safeEnvVars);
  });
}

/**
 * Error Handling Middleware
 */
console.log("❌ Configuring error handling...");

// Handle 404 - Route not found
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

/**
 * Server Startup Function
 */
const startServer = async () => {
  try {
    console.log("🚀 Starting Portfolio Manager Backend...");
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🔧 Port: ${PORT}`);

    // Handle uncaught exceptions before anything else
    handleUncaughtExceptions();

    // Connect to database
    console.log("🔄 Connecting to database...");
    await connectDB();
    setupDatabaseEvents();
    handleDatabaseErrors();

    // Initialize database with sample data (if empty)
    if (isDevelopment || process.env.INIT_DATABASE === "true") {
      console.log("🌱 Initializing database...");
      await initializeDatabase();
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log("✅ Server started successfully!");
      console.log(`🌐 Server is running on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log("📊 Available endpoints:");
      console.log("  • POST /api/auth/register - User registration");
      console.log("  • POST /api/auth/login - User login");
      console.log("  • GET  /api/positions - Get positions");
      console.log("  • GET  /api/analytics/dashboard - Dashboard data");
      console.log("  • POST /api/import/upload - Upload Excel file");
      console.log("");
      console.log("🎯 Server is ready to accept connections!");
    });

    // Set server timeout
    server.timeout = 30000; // 30 seconds

    // Setup graceful shutdown
    gracefulShutdown(server);
    handleUnhandledRejections(server);

    return server;
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Give the server some time to finish existing requests
  setTimeout(() => {
    console.log("⏰ Forcing shutdown after timeout");
    process.exit(1);
  }, 10000); // 10 seconds timeout
};

// Listen for shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle process warnings
process.on("warning", (warning) => {
  console.warn("⚠️ Process warning:", warning.name, warning.message);
});

/**
 * Production Optimizations
 */
if (isProduction) {
  console.log("🏭 Applying production optimizations...");

  // Disable X-Powered-By header
  app.disable("x-powered-by");

  // Enable view cache
  app.set("view cache", true);

  // Set secure cookies
  app.use((req, res, next) => {
    res.set({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
    });
    next();
  });
}

/**
 * Export app for testing
 */
module.exports = app;

/**
 * Start server if this file is run directly
 */
if (require.main === module) {
  startServer();
}
