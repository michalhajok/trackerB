// models/Portfolio.js - NOWY MODEL
const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    // Basic Info
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
      index: true,
    },

    name: {
      type: String,
      // required: [true, "Portfolio name is required"],
      trim: true,
      minlength: [2, "Portfolio name must be at least 2 characters"],
      maxlength: [100, "Portfolio name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      trim: true,
    },

    // Broker Configuration
    broker: {
      type: String,
      // required: [true, "Broker is required"],
      enum: ["XTB", "PKO", "BINANCE", "BYBIT", "ING", "MANUAL"],
      uppercase: true,
    },

    brokerConfig: {
      accountId: {
        type: String,
        // required: [false, "Broker account ID is required"],
      },

      accountType: {
        type: String,
        enum: ["trading", "investment", "spot", "futures", "savings", "manual"],
        default: "trading",
      },

      // Encrypted API credentials
      apiCredentials: {
        apiKey: { type: String, select: false },
        secretKey: { type: String, select: false },
        passphrase: { type: String, select: false },
        additionalParams: { type: Object, select: false },
      },

      // Sync configuration
      syncEnabled: {
        type: Boolean,
        default: true,
      },

      syncInterval: {
        type: Number,
        default: 5, // minutes
        min: 1,
        max: 1440, // max 24 hours
      },

      lastSync: {
        type: Date,
        default: null,
      },

      lastSyncStatus: {
        type: String,
        enum: ["success", "error", "in_progress", "never"],
        default: "never",
      },

      lastSyncError: {
        type: String,
        default: null,
      },
    },

    // Financial Configuration
    currency: {
      type: String,
      required: [true, "Portfolio currency is required"],
      enum: ["USD", "EUR", "PLN", "GBP", "USDT", "BTC"],
      uppercase: true,
    },

    // Settings
    settings: {
      autoSync: {
        type: Boolean,
        default: true,
      },

      notificationsEnabled: {
        type: Boolean,
        default: true,
      },

      riskManagement: {
        maxPositionSize: { type: Number, default: 0 }, // 0 = no limit
        stopLossDefault: { type: Number, default: 0 },
        takeProfitDefault: { type: Number, default: 0 },
      },

      displayPreferences: {
        showInDashboard: { type: Boolean, default: true },
        colorCode: { type: String, default: "#3B82F6" },
        sortOrder: { type: Number, default: 0 },
      },
    },

    // Statistics (calculated fields)
    stats: {
      totalValue: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalPL: {
        type: Number,
        default: 0,
      },

      totalPLPercent: {
        type: Number,
        default: 0,
      },

      openPositionsCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      closedPositionsCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "error", "syncing"],
      default: "active",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
portfolioSchema.index({ userId: 1, broker: 1 });
portfolioSchema.index({ userId: 1, status: 1 });
portfolioSchema.index({ "brokerConfig.lastSync": 1 });

// Virtual for positions
portfolioSchema.virtual("positions", {
  ref: "Position",
  localField: "_id",
  foreignField: "portfolioId",
});

// Methods
portfolioSchema.methods.updateStats = async function () {
  const Position = mongoose.model("Position");
  const stats = await Position.aggregate([
    { $match: { portfolioId: this._id, status: { $ne: "deleted" } } },
    {
      $group: {
        _id: null,
        totalValue: { $sum: "$marketValue" },
        totalPL: { $sum: "$grossPL" },
        openCount: {
          $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] },
        },
        closedCount: {
          $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
        },
      },
    },
  ]);

  if (stats.length > 0) {
    const stat = stats[0];
    this.stats.totalValue = stat.totalValue || 0;
    this.stats.totalPL = stat.totalPL || 0;
    this.stats.totalPLPercent =
      stat.totalValue > 0 ? (stat.totalPL / stat.totalValue) * 100 : 0;
    this.stats.openPositionsCount = stat.openCount || 0;
    this.stats.closedPositionsCount = stat.closedCount || 0;
    this.stats.lastUpdated = new Date();
  }

  return this.save();
};

portfolioSchema.methods.canSync = function () {
  return (
    this.brokerConfig.syncEnabled &&
    this.status === "active" &&
    this.broker !== "MANUAL"
  );
};

module.exports = mongoose.model("Portfolio", portfolioSchema);
