const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Watchlist name is required"],
      maxlength: [100, "Name cannot exceed 100 characters"],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    color: {
      type: String,
      enum: [
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
        "pink",
        "indigo",
        "gray",
        "orange",
        "teal",
      ],
      default: "blue",
    },
    icon: {
      type: String,
      maxlength: 50,
      default: "star",
    },
    // Watchlist items
    items: [
      {
        symbol: {
          type: String,
          required: [true, "Symbol is required"],
          uppercase: true,
          trim: true,
          maxlength: [10, "Symbol cannot exceed 10 characters"],
        },
        name: {
          type: String,
          trim: true,
          maxlength: [100, "Name cannot exceed 100 characters"],
        },
        exchange: {
          type: String,
          trim: true,
          maxlength: [50, "Exchange cannot exceed 50 characters"],
        },
        sector: {
          type: String,
          trim: true,
          maxlength: [50, "Sector cannot exceed 50 characters"],
        },
        currency: {
          type: String,
          enum: ["USD", "EUR", "PLN", "GBP"],
          default: "PLN",
        },
        // Price alerts for this symbol
        alerts: [
          {
            type: {
              type: String,
              enum: ["above", "below", "change_percent"],
              required: true,
            },
            value: {
              type: Number,
              required: true,
              min: 0,
            },
            isActive: {
              type: Boolean,
              default: true,
            },
            triggeredAt: {
              type: Date,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        // Last known market data
        lastPrice: {
          type: Number,
          min: 0,
        },
        lastUpdate: {
          type: Date,
        },
        change24h: {
          type: Number,
        },
        changePercent24h: {
          type: Number,
        },
        volume24h: {
          type: Number,
          min: 0,
        },
        // User notes for this symbol
        notes: {
          type: String,
          maxlength: [1000, "Notes cannot exceed 1000 characters"],
          trim: true,
        },
        // Tags for categorization
        tags: [
          {
            type: String,
            trim: true,
            maxlength: [30, "Tag cannot exceed 30 characters"],
          },
        ],
        // When this item was added to watchlist
        addedAt: {
          type: Date,
          default: Date.now,
        },
        // Order/position in the list
        order: {
          type: Number,
          default: 0,
        },
        // Whether user owns this asset
        isOwned: {
          type: Boolean,
          default: false,
        },
        // Performance tracking
        performance: {
          addedPrice: {
            type: Number,
          },
          currentPL: {
            type: Number,
          },
          currentPLPercent: {
            type: Number,
          },
        },
      },
    ],
    // Watchlist settings
    settings: {
      // Notification preferences
      notifications: {
        priceAlerts: {
          type: Boolean,
          default: true,
        },
        email: {
          type: Boolean,
          default: false,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
      // Display preferences
      display: {
        sortBy: {
          type: String,
          enum: ["symbol", "name", "price", "change", "volume", "custom"],
          default: "custom",
        },
        sortOrder: {
          type: String,
          enum: ["asc", "desc"],
          default: "asc",
        },
        showColumns: {
          price: { type: Boolean, default: true },
          change: { type: Boolean, default: true },
          volume: { type: Boolean, default: false },
          marketCap: { type: Boolean, default: false },
          sector: { type: Boolean, default: false },
        },
      },
      // Auto-refresh interval in minutes
      refreshInterval: {
        type: Number,
        min: 1,
        max: 60,
        default: 5,
      },
    },
    // Statistics
    stats: {
      viewCount: {
        type: Number,
        default: 0,
      },
      lastViewed: {
        type: Date,
      },
      itemsCount: {
        type: Number,
        default: 0,
      },
      alertsCount: {
        type: Number,
        default: 0,
      },
    },
    // Sharing and collaboration
    shares: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better performance
watchlistSchema.index({ userId: 1, isDefault: 1 });
watchlistSchema.index({ userId: 1, name: 1 });
watchlistSchema.index({ isPublic: 1, createdAt: -1 });
watchlistSchema.index({ "items.symbol": 1 });
watchlistSchema.index({ "shares.userId": 1 });

// Virtual for item count
watchlistSchema.virtual("itemCount").get(function () {
  return this.items ? this.items.length : 0;
});

// Virtual for active alerts count
watchlistSchema.virtual("activeAlertsCount").get(function () {
  if (!this.items) return 0;
  return this.items.reduce((count, item) => {
    return (
      count +
      (item.alerts ? item.alerts.filter((alert) => alert.isActive).length : 0)
    );
  }, 0);
});

// Pre-save middleware to update stats
watchlistSchema.pre("save", function (next) {
  this.stats.itemsCount = this.items ? this.items.length : 0;

  this.stats.alertsCount = this.items
    ? this.items.reduce((count, item) => {
        return (
          count +
          (item.alerts
            ? item.alerts.filter((alert) => alert.isActive).length
            : 0)
        );
      }, 0)
    : 0;

  next();
});

// Instance method to add symbol
watchlistSchema.methods.addSymbol = function (symbolData) {
  // Check if symbol already exists
  const existingIndex = this.items.findIndex(
    (item) => item.symbol === symbolData.symbol.toUpperCase()
  );

  if (existingIndex >= 0) {
    throw new Error(
      `Symbol ${symbolData.symbol} already exists in this watchlist`
    );
  }

  const newItem = {
    ...symbolData,
    symbol: symbolData.symbol.toUpperCase(),
    addedAt: new Date(),
    order: this.items.length,
  };

  this.items.push(newItem);
  return this.save();
};

// Instance method to remove symbol
watchlistSchema.methods.removeSymbol = function (symbol) {
  const index = this.items.findIndex(
    (item) => item.symbol === symbol.toUpperCase()
  );

  if (index === -1) {
    throw new Error(`Symbol ${symbol} not found in watchlist`);
  }

  this.items.splice(index, 1);
  return this.save();
};

// Instance method to update symbol order
watchlistSchema.methods.reorderSymbols = function (symbolOrders) {
  symbolOrders.forEach(({ symbol, order }) => {
    const item = this.items.find(
      (item) => item.symbol === symbol.toUpperCase()
    );
    if (item) {
      item.order = order;
    }
  });

  // Sort items by order
  this.items.sort((a, b) => a.order - b.order);

  return this.save();
};

// Instance method to add price alert
watchlistSchema.methods.addPriceAlert = function (symbol, alertData) {
  const item = this.items.find((item) => item.symbol === symbol.toUpperCase());

  if (!item) {
    throw new Error(`Symbol ${symbol} not found in watchlist`);
  }

  item.alerts.push({
    ...alertData,
    createdAt: new Date(),
  });

  return this.save();
};

// Instance method to remove price alert
watchlistSchema.methods.removePriceAlert = function (symbol, alertId) {
  const item = this.items.find((item) => item.symbol === symbol.toUpperCase());

  if (!item) {
    throw new Error(`Symbol ${symbol} not found in watchlist`);
  }

  const alertIndex = item.alerts.findIndex(
    (alert) => alert._id.toString() === alertId
  );

  if (alertIndex === -1) {
    throw new Error("Price alert not found");
  }

  item.alerts.splice(alertIndex, 1);
  return this.save();
};

// Instance method to update market data
watchlistSchema.methods.updateMarketData = function (marketData) {
  marketData.forEach((data) => {
    const item = this.items.find(
      (item) => item.symbol === data.symbol.toUpperCase()
    );
    if (item) {
      item.lastPrice = data.price;
      item.change24h = data.change24h;
      item.changePercent24h = data.changePercent24h;
      item.volume24h = data.volume24h;
      item.lastUpdate = new Date();

      // Update performance if we have added price
      if (item.performance.addedPrice) {
        item.performance.currentPL = data.price - item.performance.addedPrice;
        item.performance.currentPLPercent =
          ((data.price - item.performance.addedPrice) /
            item.performance.addedPrice) *
          100;
      }
    }
  });

  return this.save();
};

// Static method to find user's watchlists
watchlistSchema.statics.findUserWatchlists = function (userId) {
  return this.find({ userId }).sort({ isDefault: -1, name: 1 });
};

// Static method to find default watchlist
watchlistSchema.statics.findDefaultWatchlist = function (userId) {
  return this.findOne({ userId, isDefault: true });
};

// Static method to find public watchlists
watchlistSchema.statics.findPublicWatchlists = function (limit = 20, skip = 0) {
  return this.find({ isPublic: true })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to find watchlists containing symbol
watchlistSchema.statics.findWatchlistsWithSymbol = function (userId, symbol) {
  return this.find({
    userId,
    "items.symbol": symbol.toUpperCase(),
  });
};

// Static method to get watchlist statistics
watchlistSchema.statics.getWatchlistStats = async function (userId) {
  const pipeline = [
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalWatchlists: { $sum: 1 },
        totalSymbols: { $sum: { $size: "$items" } },
        totalAlerts: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  { $size: { $ifNull: ["$$this.alerts", []] } },
                ],
              },
            },
          },
        },
        publicWatchlists: {
          $sum: { $cond: [{ $eq: ["$isPublic", true] }, 1, 0] },
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return (
    result[0] || {
      totalWatchlists: 0,
      totalSymbols: 0,
      totalAlerts: 0,
      publicWatchlists: 0,
    }
  );
};

module.exports = mongoose.model("Watchlist", watchlistSchema);
