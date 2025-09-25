const mongoose = require("mongoose");

const marketDataSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: [true, "Symbol is required"],
      uppercase: true,
      trim: true,
      maxlength: [10, "Symbol cannot exceed 10 characters"],
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    // Current price data
    currentPrice: {
      type: Number,
      required: [true, "Current price is required"],
      min: [0, "Price cannot be negative"],
    },
    previousClose: {
      type: Number,
      min: [0, "Previous close cannot be negative"],
    },
    // Daily statistics
    dailyData: {
      open: {
        type: Number,
        min: [0, "Open price cannot be negative"],
      },
      high: {
        type: Number,
        min: [0, "High price cannot be negative"],
      },
      low: {
        type: Number,
        min: [0, "Low price cannot be negative"],
      },
      volume: {
        type: Number,
        min: [0, "Volume cannot be negative"],
        default: 0,
      },
      change: {
        type: Number,
      },
      changePercent: {
        type: Number,
      },
      vwap: {
        // Volume Weighted Average Price
        type: Number,
        min: [0, "VWAP cannot be negative"],
      },
    },
    // Bid/Ask data
    bidAsk: {
      bid: {
        type: Number,
        min: [0, "Bid price cannot be negative"],
      },
      ask: {
        type: Number,
        min: [0, "Ask price cannot be negative"],
      },
      spread: {
        type: Number,
        min: [0, "Spread cannot be negative"],
      },
      spreadPercent: {
        type: Number,
      },
    },
    // Market info
    marketInfo: {
      exchange: {
        type: String,
        trim: true,
        maxlength: [50, "Exchange name cannot exceed 50 characters"],
        index: true,
      },
      currency: {
        type: String,
        enum: ["USD", "EUR", "PLN", "GBP", "JPY", "CHF", "CAD", "AUD"],
        default: "USD",
        index: true,
      },
      sector: {
        type: String,
        trim: true,
        maxlength: [50, "Sector cannot exceed 50 characters"],
        index: true,
      },
      industry: {
        type: String,
        trim: true,
        maxlength: [100, "Industry cannot exceed 100 characters"],
      },
      country: {
        type: String,
        trim: true,
        maxlength: [50, "Country cannot exceed 50 characters"],
      },
      marketCap: {
        type: Number,
        min: [0, "Market cap cannot be negative"],
      },
      sharesOutstanding: {
        type: Number,
        min: [0, "Shares outstanding cannot be negative"],
      },
      floatShares: {
        type: Number,
        min: [0, "Float shares cannot be negative"],
      },
    },
    // Technical indicators
    technicalData: {
      sma20: {
        type: Number,
        min: [0, "SMA20 cannot be negative"],
      },
      sma50: {
        type: Number,
        min: [0, "SMA50 cannot be negative"],
      },
      sma200: {
        type: Number,
        min: [0, "SMA200 cannot be negative"],
      },
      ema12: {
        type: Number,
        min: [0, "EMA12 cannot be negative"],
      },
      ema26: {
        type: Number,
        min: [0, "EMA26 cannot be negative"],
      },
      rsi: {
        type: Number,
        min: [0, "RSI cannot be negative"],
        max: [100, "RSI cannot exceed 100"],
      },
      macd: {
        line: { type: Number },
        signal: { type: Number },
        histogram: { type: Number },
      },
      bollinger: {
        upper: { type: Number, min: 0 },
        middle: { type: Number, min: 0 },
        lower: { type: Number, min: 0 },
      },
      atr: {
        // Average True Range
        type: Number,
        min: [0, "ATR cannot be negative"],
      },
    },
    // Historical data snapshots (last N periods)
    historicalData: [
      {
        timestamp: {
          type: Date,
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        volume: {
          type: Number,
          min: 0,
          default: 0,
        },
        high: {
          type: Number,
          min: 0,
        },
        low: {
          type: Number,
          min: 0,
        },
        open: {
          type: Number,
          min: 0,
        },
      },
    ],
    // Data source information
    dataSource: {
      provider: {
        type: String,
        enum: ["yahoo", "alpha_vantage", "iex", "polygon", "finnhub", "manual"],
        default: "manual",
      },
      lastUpdate: {
        type: Date,
        default: Date.now,
        index: true,
      },
      updateFrequency: {
        type: Number, // in minutes
        min: [1, "Update frequency must be at least 1 minute"],
        max: [1440, "Update frequency cannot exceed 24 hours"],
        default: 5,
      },
      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },
      errorCount: {
        type: Number,
        default: 0,
      },
      lastError: {
        message: String,
        timestamp: Date,
      },
    },
    // Additional metadata
    metadata: {
      isin: {
        type: String,
        trim: true,
        maxlength: 12,
      },
      cusip: {
        type: String,
        trim: true,
        maxlength: 9,
      },
      ticker: {
        type: String,
        trim: true,
        maxlength: 10,
      },
      assetType: {
        type: String,
        enum: ["stock", "etf", "crypto", "forex", "commodity", "bond", "fund"],
        default: "stock",
        index: true,
      },
      tradingHours: {
        open: String, // "09:00"
        close: String, // "16:00"
        timezone: {
          type: String,
          default: "UTC",
        },
      },
      isHalted: {
        type: Boolean,
        default: false,
      },
      haltReason: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        // Limit historical data in JSON output
        if (ret.historicalData && ret.historicalData.length > 100) {
          ret.historicalData = ret.historicalData.slice(-100);
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better performance
marketDataSchema.index({ symbol: 1, "dataSource.lastUpdate": -1 });
marketDataSchema.index({ "marketInfo.exchange": 1, "dataSource.isActive": 1 });
marketDataSchema.index({ "marketInfo.sector": 1 });
marketDataSchema.index({ "metadata.assetType": 1 });

// TTL index for historical data cleanup (keep data for 1 year)
marketDataSchema.index(
  { "historicalData.timestamp": 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

// Virtual for price change
marketDataSchema.virtual("priceChange").get(function () {
  if (!this.previousClose || !this.currentPrice) return 0;
  return this.currentPrice - this.previousClose;
});

// Virtual for price change percentage
marketDataSchema.virtual("priceChangePercent").get(function () {
  if (!this.previousClose || !this.currentPrice) return 0;
  return ((this.currentPrice - this.previousClose) / this.previousClose) * 100;
});

// Virtual for market status
marketDataSchema.virtual("marketStatus").get(function () {
  if (this.metadata.isHalted) return "halted";

  const now = new Date();
  const lastUpdate = this.dataSource.lastUpdate;
  const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

  if (minutesSinceUpdate > this.dataSource.updateFrequency * 2) {
    return "stale";
  }

  if (minutesSinceUpdate > this.dataSource.updateFrequency * 1.5) {
    return "delayed";
  }

  return "active";
});

// Virtual for spread in percentage
marketDataSchema.virtual("spreadPercent").get(function () {
  if (!this.bidAsk.bid || !this.bidAsk.ask) return 0;
  const midPrice = (this.bidAsk.bid + this.bidAsk.ask) / 2;
  if (midPrice === 0) return 0;
  return ((this.bidAsk.ask - this.bidAsk.bid) / midPrice) * 100;
});

// Pre-save middleware to calculate derived values
marketDataSchema.pre("save", function (next) {
  // Calculate daily change
  if (this.currentPrice && this.previousClose) {
    this.dailyData.change = this.currentPrice - this.previousClose;
    this.dailyData.changePercent =
      ((this.currentPrice - this.previousClose) / this.previousClose) * 100;
  }

  // Calculate bid/ask spread
  if (this.bidAsk.bid && this.bidAsk.ask) {
    this.bidAsk.spread = this.bidAsk.ask - this.bidAsk.bid;
    const midPrice = (this.bidAsk.bid + this.bidAsk.ask) / 2;
    if (midPrice > 0) {
      this.bidAsk.spreadPercent =
        ((this.bidAsk.ask - this.bidAsk.bid) / midPrice) * 100;
    }
  }

  // Update last update timestamp
  this.dataSource.lastUpdate = new Date();

  next();
});

// Instance method to update price data
marketDataSchema.methods.updatePrice = function (priceData) {
  this.currentPrice = priceData.price;

  if (priceData.bid) this.bidAsk.bid = priceData.bid;
  if (priceData.ask) this.bidAsk.ask = priceData.ask;

  if (priceData.volume) this.dailyData.volume = priceData.volume;
  if (priceData.high) this.dailyData.high = priceData.high;
  if (priceData.low) this.dailyData.low = priceData.low;
  if (priceData.open) this.dailyData.open = priceData.open;

  // Add to historical data (keep last 1000 points)
  this.historicalData.push({
    timestamp: new Date(),
    price: priceData.price,
    volume: priceData.volume || 0,
    high: priceData.high || priceData.price,
    low: priceData.low || priceData.price,
    open: priceData.open || priceData.price,
  });

  // Keep only last 1000 historical points
  if (this.historicalData.length > 1000) {
    this.historicalData = this.historicalData.slice(-1000);
  }

  this.dataSource.errorCount = 0; // Reset error count on successful update
  this.dataSource.lastError = undefined;

  return this.save();
};

// Instance method to record error
marketDataSchema.methods.recordError = function (errorMessage) {
  this.dataSource.errorCount += 1;
  this.dataSource.lastError = {
    message: errorMessage,
    timestamp: new Date(),
  };

  // Deactivate if too many errors
  if (this.dataSource.errorCount >= 10) {
    this.dataSource.isActive = false;
  }

  return this.save();
};

// Instance method to get price history
marketDataSchema.methods.getPriceHistory = function (periods = 50) {
  return this.historicalData.slice(-periods).map((point) => ({
    timestamp: point.timestamp,
    price: point.price,
    volume: point.volume,
  }));
};

// Static method to find by symbol
marketDataSchema.statics.findBySymbol = function (symbol) {
  return this.findOne({ symbol: symbol.toUpperCase() });
};

// Static method to find active symbols
marketDataSchema.statics.findActiveSymbols = function (exchange = null) {
  const query = { "dataSource.isActive": true };
  if (exchange) query["marketInfo.exchange"] = exchange;

  return this.find(query).sort({ symbol: 1 });
};

// Static method to find symbols needing update
marketDataSchema.statics.findSymbolsNeedingUpdate = function () {
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - 5); // 5 minutes ago

  return this.find({
    "dataSource.isActive": true,
    "dataSource.lastUpdate": { $lt: cutoffTime },
  });
};

// Static method to get market summary
marketDataSchema.statics.getMarketSummary = async function (exchange = null) {
  const matchStage = { "dataSource.isActive": true };
  if (exchange) matchStage["marketInfo.exchange"] = exchange;

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: "$marketInfo.exchange",
        totalSymbols: { $sum: 1 },
        avgPrice: { $avg: "$currentPrice" },
        totalVolume: { $sum: "$dailyData.volume" },
        gainers: {
          $sum: { $cond: [{ $gt: ["$dailyData.change", 0] }, 1, 0] },
        },
        losers: {
          $sum: { $cond: [{ $lt: ["$dailyData.change", 0] }, 1, 0] },
        },
        unchanged: {
          $sum: { $cond: [{ $eq: ["$dailyData.change", 0] }, 1, 0] },
        },
        topGainer: { $max: "$dailyData.changePercent" },
        topLoser: { $min: "$dailyData.changePercent" },
      },
    },
  ];

  return this.aggregate(pipeline);
};

// Static method to get top movers
marketDataSchema.statics.getTopMovers = function (limit = 10) {
  return {
    gainers: this.find({ "dataSource.isActive": true })
      .sort({ "dailyData.changePercent": -1 })
      .limit(limit)
      .select(
        "symbol name currentPrice dailyData.change dailyData.changePercent"
      ),
    losers: this.find({ "dataSource.isActive": true })
      .sort({ "dailyData.changePercent": 1 })
      .limit(limit)
      .select(
        "symbol name currentPrice dailyData.change dailyData.changePercent"
      ),
    mostActive: this.find({ "dataSource.isActive": true })
      .sort({ "dailyData.volume": -1 })
      .limit(limit)
      .select(
        "symbol name currentPrice dailyData.volume dailyData.changePercent"
      ),
  };
};

// Static method to update multiple symbols
marketDataSchema.statics.bulkUpdatePrices = async function (priceUpdates) {
  const bulkOps = priceUpdates.map((update) => ({
    updateOne: {
      filter: { symbol: update.symbol.toUpperCase() },
      update: {
        currentPrice: update.price,
        "dailyData.volume": update.volume || 0,
        "dailyData.high": update.high || update.price,
        "dailyData.low": update.low || update.price,
        "dailyData.open": update.open || update.price,
        "bidAsk.bid": update.bid,
        "bidAsk.ask": update.ask,
        "dataSource.lastUpdate": new Date(),
        $inc: { "dataSource.errorCount": 0 }, // Reset error count
        $push: {
          historicalData: {
            $each: [
              {
                timestamp: new Date(),
                price: update.price,
                volume: update.volume || 0,
                high: update.high || update.price,
                low: update.low || update.price,
                open: update.open || update.price,
              },
            ],
            $slice: -1000, // Keep only last 1000 points
          },
        },
      },
      upsert: true,
    },
  }));

  return this.bulkWrite(bulkOps);
};

// Static method to cleanup old historical data
marketDataSchema.statics.cleanupOldData = function (daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return this.updateMany(
    {},
    {
      $pull: {
        historicalData: {
          timestamp: { $lt: cutoffDate },
        },
      },
    }
  );
};

// Static method to get symbols by sector
marketDataSchema.statics.findBySector = function (sector, limit = 50) {
  return this.find({
    "marketInfo.sector": new RegExp(sector, "i"),
    "dataSource.isActive": true,
  })
    .sort({ "marketInfo.marketCap": -1 })
    .limit(limit);
};

// Static method to search symbols
marketDataSchema.statics.searchSymbols = function (searchTerm, limit = 20) {
  const regex = new RegExp(searchTerm, "i");

  return this.find({
    $or: [{ symbol: regex }, { name: regex }],
    "dataSource.isActive": true,
  })
    .sort({ "marketInfo.marketCap": -1 })
    .limit(limit)
    .select(
      "symbol name currentPrice dailyData.change dailyData.changePercent marketInfo.exchange"
    );
};

module.exports = mongoose.model("MarketData", marketDataSchema);
