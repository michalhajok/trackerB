const mongoose = require("mongoose");

/**
 * Database Configuration
 */
const dbConfig = {
  development: {
    uri:
      process.env.MONGODB_URI ||
      "mongodb+srv://hajokmichal_db_user:gQDD930AR1sC1W0S@cluster0.hbxccjh.mongodb.net/tracker",
    options: {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // bufferMaxEntries: 0,
      // bufferCommands: false,
    },
  },
  test: {
    uri:
      process.env.MONGODB_TEST_URI ||
      "mongodb+srv://hajokmichal_db_user:gQDD930AR1sC1W0S@cluster0.hbxccjh.mongodb.net/tracker",
    options: {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  production: {
    uri: process.env.MONGODB_URI,
    options: {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000,
      // bufferMaxEntries: 0,
      // bufferCommands: false,
      retryWrites: true,
      w: "majority",
    },
  },
};

/**
 * Get database configuration for current environment
 */
const getCurrentConfig = () => {
  const env = process.env.NODE_ENV || "development";
  return dbConfig[env] || dbConfig.development;
};

/**
 * Connect to MongoDB
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async () => {
  try {
    const config = getCurrentConfig();

    console.log(
      `🔄 Connecting to MongoDB (${process.env.NODE_ENV || "development"})...`
    );

    if (!config.uri) {
      throw new Error(
        "MongoDB URI is not defined. Please set MONGODB_URI environment variable."
      );
    }

    // Connect to MongoDB
    await mongoose.connect(config.uri, config.options);

    console.log(`✅ MongoDB connected successfully`);
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log(
      `🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`
    );

    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("🔌 MongoDB disconnected successfully");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error.message);
    throw error;
  }
};

/**
 * Setup database event listeners
 */
const setupDatabaseEvents = () => {
  const connection = mongoose.connection;

  connection.on("connected", () => {
    console.log("🟢 Mongoose connected to MongoDB");
  });

  connection.on("error", (err) => {
    console.error("🔴 Mongoose connection error:", err.message);
  });

  connection.on("disconnected", () => {
    console.log("🟡 Mongoose disconnected from MongoDB");
  });

  connection.on("reconnected", () => {
    console.log("🔄 Mongoose reconnected to MongoDB");
  });

  connection.on("reconnectFailed", () => {
    console.error("❌ Mongoose reconnection failed");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    try {
      await connection.close();
      console.log("🛑 MongoDB connection closed through app termination");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during graceful shutdown:", error.message);
      process.exit(1);
    }
  });
};

/**
 * Check database connection health
 * @returns {Promise<Object>} Health status
 */
const checkDatabaseHealth = async () => {
  try {
    const connection = mongoose.connection;

    if (connection.readyState !== 1) {
      throw new Error("Database not connected");
    }

    // Ping database
    await connection.db.admin().ping();

    // Get database stats
    const stats = await connection.db.stats();

    return {
      status: "healthy",
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
      collections: stats.collections,
      dataSize: formatBytes(stats.dataSize),
      storageSize: formatBytes(stats.storageSize),
      indexes: stats.indexes,
      uptime: process.uptime(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
      readyState: mongoose.connection.readyState,
    };
  }
};

/**
 * Initialize database with seed data
 */
const initializeDatabase = async () => {
  try {
    console.log("🌱 Initializing database with seed data...");

    // Import models
    const User = require("../models/User");
    const Position = require("../models/Position");
    const CashOperation = require("../models/CashOperation");
    const PendingOrder = require("../models/PendingOrder");

    // Check if data already exists
    const userCount = await User.countDocuments();
    const positionCount = await Position.countDocuments();

    if (userCount > 0 || positionCount > 0) {
      console.log("📊 Database already contains data, skipping seed");
      return;
    }

    // Create admin user
    const adminUser = new User({
      name: "Admin User",
      email: "admin@portfoliomanager.com",
      password: "Admin123!",
      role: "admin",
      preferences: {
        currency: "PLN",
        theme: "light",
      },
    });
    await adminUser.save();
    console.log("👤 Admin user created");

    // Create demo user
    const demoUser = new User({
      name: "Demo User",
      email: "demo@portfoliomanager.com",
      password: "Demo123!",
      role: "user",
      preferences: {
        currency: "PLN",
        theme: "light",
      },
    });
    await demoUser.save();
    console.log("👤 Demo user created");

    // Create sample positions
    const samplePositions = [
      {
        userId: demoUser._id,
        positionId: 1863734201,
        symbol: "AAPL.US",
        name: "Apple Inc.",
        type: "BUY",
        volume: 10,
        openTime: new Date("2024-01-15T09:30:00Z"),
        openPrice: 185.5,
        marketPrice: 195.25,
        purchaseValue: 1855.0,
        commission: 5.0,
        currency: "USD",
        exchange: "NASDAQ",
        sector: "Technology",
        status: "open",
      },
      {
        userId: demoUser._id,
        positionId: 1863734202,
        symbol: "MSFT.US",
        name: "Microsoft Corporation",
        type: "BUY",
        volume: 5,
        openTime: new Date("2024-02-01T10:15:00Z"),
        openPrice: 380.0,
        marketPrice: 395.75,
        purchaseValue: 1900.0,
        commission: 5.0,
        currency: "USD",
        exchange: "NASDAQ",
        sector: "Technology",
        status: "open",
      },
      {
        userId: demoUser._id,
        positionId: 1863734203,
        symbol: "GOOGL.US",
        name: "Alphabet Inc.",
        type: "BUY",
        volume: 2,
        openTime: new Date("2024-01-20T11:00:00Z"),
        openPrice: 140.25,
        closeTime: new Date("2024-03-15T15:30:00Z"),
        closePrice: 155.8,
        purchaseValue: 280.5,
        saleValue: 311.6,
        commission: 8.0,
        currency: "USD",
        exchange: "NASDAQ",
        sector: "Technology",
        status: "closed",
      },
    ];

    await Position.insertMany(samplePositions);
    console.log("📈 Sample positions created");

    // Create sample cash operations
    const sampleCashOps = [
      {
        userId: demoUser._id,
        operationId: Date.now() + 1,
        type: "deposit",
        time: new Date("2024-01-10T08:00:00Z"),
        amount: 5000.0,
        currency: "USD",
        comment: "Initial deposit",
        details: {
          paymentMethod: "bank_transfer",
          bankAccount: "Account ending in 1234",
        },
      },
      {
        userId: demoUser._id,
        operationId: Date.now() + 2,
        type: "dividend",
        time: new Date("2024-02-15T12:00:00Z"),
        amount: 25.5,
        currency: "USD",
        comment: "AAPL dividend payment",
        symbol: "AAPL.US",
        details: {
          dividendPerShare: 2.55,
          sharesCount: 10,
          exDividendDate: new Date("2024-02-01"),
          paymentDate: new Date("2024-02-15"),
        },
      },
    ];

    await CashOperation.insertMany(sampleCashOps);
    console.log("💰 Sample cash operations created");

    // Create sample pending order
    const sampleOrder = new PendingOrder({
      userId: demoUser._id,
      orderId: Date.now() + 100,
      symbol: "TSLA.US",
      name: "Tesla Inc.",
      type: "limit",
      side: "buy",
      volume: 3,
      price: 180.0,
      currency: "USD",
      exchange: "NASDAQ",
      conditions: {
        timeInForce: "GTC",
      },
    });

    await sampleOrder.save();
    console.log("📋 Sample pending order created");

    console.log("✅ Database initialization completed successfully");

    return {
      users: 2,
      positions: samplePositions.length,
      cashOperations: sampleCashOps.length,
      pendingOrders: 1,
    };
  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
    throw error;
  }
};

/**
 * Clear all data from database (use with caution!)
 */
const clearDatabase = async () => {
  try {
    console.log("🗑️ Clearing database...");

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).deleteMany({});
      console.log(`🧹 Cleared collection: ${collection.name}`);
    }

    console.log("✅ Database cleared successfully");
  } catch (error) {
    console.error("❌ Error clearing database:", error.message);
    throw error;
  }
};

/**
 * Create database backup (exports collections to JSON)
 */
const backupDatabase = async () => {
  try {
    console.log("💾 Creating database backup...");

    const User = require("../models/User");
    const Position = require("../models/Position");
    const CashOperation = require("../models/CashOperation");
    const PendingOrder = require("../models/PendingOrder");
    const FileImport = require("../models/FileImport");

    const backup = {
      timestamp: new Date().toISOString(),
      users: await User.find({}).lean(),
      positions: await Position.find({}).lean(),
      cashOperations: await CashOperation.find({}).lean(),
      pendingOrders: await PendingOrder.find({}).lean(),
      fileImports: await FileImport.find({}).lean(),
    };

    console.log("✅ Database backup created");
    return backup;
  } catch (error) {
    console.error("❌ Error creating backup:", error.message);
    throw error;
  }
};

/**
 * Restore database from backup
 */
const restoreDatabase = async (backup) => {
  try {
    console.log("🔄 Restoring database from backup...");

    // Clear existing data
    await clearDatabase();

    const User = require("../models/User");
    const Position = require("../models/Position");
    const CashOperation = require("../models/CashOperation");
    const PendingOrder = require("../models/PendingOrder");
    const FileImport = require("../models/FileImport");

    // Restore data
    if (backup.users?.length) {
      await User.insertMany(backup.users);
      console.log(`👤 Restored ${backup.users.length} users`);
    }

    if (backup.positions?.length) {
      await Position.insertMany(backup.positions);
      console.log(`📈 Restored ${backup.positions.length} positions`);
    }

    if (backup.cashOperations?.length) {
      await CashOperation.insertMany(backup.cashOperations);
      console.log(
        `💰 Restored ${backup.cashOperations.length} cash operations`
      );
    }

    if (backup.pendingOrders?.length) {
      await PendingOrder.insertMany(backup.pendingOrders);
      console.log(`📋 Restored ${backup.pendingOrders.length} pending orders`);
    }

    if (backup.fileImports?.length) {
      await FileImport.insertMany(backup.fileImports);
      console.log(`📁 Restored ${backup.fileImports.length} file imports`);
    }

    console.log("✅ Database restore completed");
  } catch (error) {
    console.error("❌ Error restoring database:", error.message);
    throw error;
  }
};

/**
 * Get database statistics
 */
const getDatabaseStats = async () => {
  try {
    const User = require("../models/User");
    const Position = require("../models/Position");
    const CashOperation = require("../models/CashOperation");
    const PendingOrder = require("../models/PendingOrder");
    const FileImport = require("../models/FileImport");

    const [
      totalUsers,
      activeUsers,
      totalPositions,
      openPositions,
      closedPositions,
      totalCashOps,
      totalOrders,
      activeOrders,
      totalImports,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Position.countDocuments(),
      Position.countDocuments({ status: "open" }),
      Position.countDocuments({ status: "closed" }),
      CashOperation.countDocuments(),
      PendingOrder.countDocuments(),
      PendingOrder.countDocuments({ status: { $in: ["pending", "partial"] } }),
      FileImport.countDocuments(),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      positions: {
        total: totalPositions,
        open: openPositions,
        closed: closedPositions,
      },
      cashOperations: {
        total: totalCashOps,
      },
      orders: {
        total: totalOrders,
        active: activeOrders,
        inactive: totalOrders - activeOrders,
      },
      imports: {
        total: totalImports,
      },
    };
  } catch (error) {
    console.error("❌ Error getting database stats:", error.message);
    throw error;
  }
};

/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Optimize database performance
 */
const optimizeDatabase = async () => {
  try {
    console.log("⚡ Optimizing database performance...");

    const db = mongoose.connection.db;

    // Create indexes if they don't exist
    const collections = [
      "users",
      "positions",
      "cashoperations",
      "pendingorders",
    ];

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        await collection.createIndexes([
          { key: { userId: 1 } },
          { key: { createdAt: -1 } },
          { key: { updatedAt: -1 } },
        ]);
        console.log(`📊 Indexes created for ${collectionName}`);
      } catch (error) {
        console.log(`ℹ️ Indexes already exist for ${collectionName}`);
      }
    }

    console.log("✅ Database optimization completed");
  } catch (error) {
    console.error("❌ Error optimizing database:", error.message);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  setupDatabaseEvents,
  checkDatabaseHealth,
  initializeDatabase,
  clearDatabase,
  backupDatabase,
  restoreDatabase,
  getDatabaseStats,
  optimizeDatabase,
  getCurrentConfig,
};
