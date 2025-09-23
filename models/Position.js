const mongoose = require("mongoose");

const positionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    positionId: {
      type: Number,
      required: [true, "Position ID is required"],
      unique: true,
      index: true,
    },
    symbol: {
      type: String,
      required: [true, "Symbol is required"],
      uppercase: true,
      trim: true,
      minlength: [1, "Symbol must be at least 1 character"],
      maxlength: [10, "Symbol cannot exceed 10 characters"],
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    type: {
      type: String,
      required: [true, "Position type is required"],
      enum: {
        values: ["BUY", "SELL"],
        message: "Type must be either BUY or SELL",
      },
      default: "BUY",
    },
    volume: {
      type: Number,
      required: [true, "Volume is required"],
      min: [0.0001, "Volume must be greater than 0"],
      validate: {
        validator: function (v) {
          return v > 0;
        },
        message: "Volume must be a positive number",
      },
    },
    openTime: {
      type: Date,
      required: [true, "Open time is required"],
      index: true,
    },
    openPrice: {
      type: Number,
      required: [true, "Open price is required"],
      min: [0, "Open price must be positive"],
      validate: {
        validator: function (v) {
          return v > 0;
        },
        message: "Open price must be a positive number",
      },
    },
    closeTime: {
      type: Date,
      default: null,
      index: true,
    },
    closePrice: {
      type: Number,
      default: null,
      min: [0, "Close price must be positive"],
      validate: {
        validator: function (v) {
          return v === null || v > 0;
        },
        message: "Close price must be a positive number or null",
      },
    },
    marketPrice: {
      type: Number,
      default: null,
      min: [0, "Market price must be positive"],
    },
    purchaseValue: {
      type: Number,
      required: [true, "Purchase value is required"],
      min: [0, "Purchase value must be positive"],
    },
    saleValue: {
      type: Number,
      default: null,
      min: [0, "Sale value must be positive"],
    },
    grossPL: {
      type: Number,
      required: [true, "Gross P&L is required"],
      default: 0,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["open", "closed"],
        message: "Status must be either open or closed",
      },
      default: "open",
      index: true,
    },
    // Additional fields for enhanced functionality
    commission: {
      type: Number,
      default: 0,
      min: [0, "Commission must be non-negative"],
    },
    swap: {
      type: Number,
      default: 0,
    },
    taxes: {
      type: Number,
      default: 0,
      min: [0, "Taxes must be non-negative"],
    },
    netPL: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      enum: ["USD", "EUR", "PLN", "GBP"],
      default: "PLN",
    },
    exchange: {
      type: String,
      trim: true,
      maxlength: [50, "Exchange name cannot exceed 50 characters"],
    },
    sector: {
      type: String,
      trim: true,
      maxlength: [50, "Sector cannot exceed 50 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [20, "Tag cannot exceed 20 characters"],
      },
    ],
    // Metadata
    importedFrom: {
      type: String,
      enum: ["manual", "excel", "api"],
      default: "manual",
    },
    lastPriceUpdate: {
      type: Date,
      default: Date.now,
    },
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
positionSchema.index({ userId: 1, status: 1 });
positionSchema.index({ userId: 1, symbol: 1 });
positionSchema.index({ userId: 1, openTime: -1 });
positionSchema.index({ userId: 1, closeTime: -1 });

// Pre-save middleware to calculate derived values
positionSchema.pre("save", function (next) {
  // Calculate purchase value if not provided
  if (!this.purchaseValue) {
    this.purchaseValue = this.openPrice * this.volume;
  }

  // Calculate sale value for closed positions
  if (this.status === "closed" && this.closePrice && !this.saleValue) {
    this.saleValue = this.closePrice * this.volume;
  }

  // Calculate gross P&L
  if (this.status === "closed" && this.closePrice) {
    // For closed positions
    if (this.type === "BUY") {
      this.grossPL = (this.closePrice - this.openPrice) * this.volume;
    } else {
      this.grossPL = (this.openPrice - this.closePrice) * this.volume;
    }
  } else if (this.status === "open" && this.marketPrice) {
    // For open positions
    if (this.type === "BUY") {
      this.grossPL = (this.marketPrice - this.openPrice) * this.volume;
    } else {
      this.grossPL = (this.openPrice - this.marketPrice) * this.volume;
    }
  }

  // Calculate net P&L
  this.netPL = this.grossPL - this.commission - this.taxes - this.swap;

  // Update last price update timestamp
  if (this.isModified("marketPrice") || this.isModified("closePrice")) {
    this.lastPriceUpdate = new Date();
  }

  next();
});

// Instance method to close position
positionSchema.methods.closePosition = function (closePrice, closeTime = null) {
  this.status = "closed";
  this.closePrice = closePrice;
  this.closeTime = closeTime || new Date();
  this.saleValue = closePrice * this.volume;

  // Calculate final P&L
  if (this.type === "BUY") {
    this.grossPL = (closePrice - this.openPrice) * this.volume;
  } else {
    this.grossPL = (this.openPrice - closePrice) * this.volume;
  }

  this.netPL = this.grossPL - this.commission - this.taxes - this.swap;

  return this.save();
};

// Instance method to update market price
positionSchema.methods.updateMarketPrice = function (newPrice) {
  if (this.status === "open") {
    this.marketPrice = newPrice;
    this.lastPriceUpdate = new Date();

    // Recalculate gross P&L
    if (this.type === "BUY") {
      this.grossPL = (newPrice - this.openPrice) * this.volume;
    } else {
      this.grossPL = (this.openPrice - newPrice) * this.volume;
    }

    this.netPL = this.grossPL - this.commission - this.taxes - this.swap;

    return this.save();
  }
  throw new Error("Cannot update market price for closed position");
};

// Virtual for current value
positionSchema.virtual("currentValue").get(function () {
  if (this.status === "closed") {
    return this.saleValue;
  }
  return this.marketPrice ? this.marketPrice * this.volume : this.purchaseValue;
});

// Virtual for P&L percentage
positionSchema.virtual("plPercentage").get(function () {
  if (this.purchaseValue === 0) return 0;
  return (this.grossPL / this.purchaseValue) * 100;
});

// Virtual for position duration
positionSchema.virtual("duration").get(function () {
  const endDate = this.closeTime || new Date();
  return Math.floor((endDate - this.openTime) / (1000 * 60 * 60 * 24)); // days
});

// Static method to find user's positions
positionSchema.statics.findByUser = function (userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  return this.find(query).sort({ openTime: -1 });
};

// Static method to find positions by symbol
positionSchema.statics.findBySymbol = function (userId, symbol) {
  return this.find({ userId, symbol }).sort({ openTime: -1 });
};

// Static method to calculate portfolio value
positionSchema.statics.calculatePortfolioValue = async function (userId) {
  const openPositions = await this.find({ userId, status: "open" });
  return openPositions.reduce((total, position) => {
    const currentValue = position.marketPrice
      ? position.marketPrice * position.volume
      : position.purchaseValue;
    return total + currentValue;
  }, 0);
};

// Static method to calculate total P&L
positionSchema.statics.calculateTotalPL = async function (
  userId,
  status = null
) {
  const query = { userId };
  if (status) query.status = status;

  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalGrossPL: { $sum: "$grossPL" },
        totalNetPL: { $sum: "$netPL" },
        totalCommission: { $sum: "$commission" },
        totalTaxes: { $sum: "$taxes" },
        totalSwap: { $sum: "$swap" },
      },
    },
  ]);

  return (
    result[0] || {
      totalGrossPL: 0,
      totalNetPL: 0,
      totalCommission: 0,
      totalTaxes: 0,
      totalSwap: 0,
    }
  );
};

module.exports = mongoose.model("Position", positionSchema);
