const mongoose = require("mongoose");

const pendingOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    orderId: {
      type: Number,
      required: [true, "Order ID is required"],
      unique: true,
      index: true,
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: [true, "Portfolio ID is required"],
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
      required: [true, "Order type is required"],
      enum: {
        values: ["market", "limit", "stop", "stop_limit", "trailing_stop"],
        message: "Invalid order type",
      },
      default: "limit",
      index: true,
    },
    side: {
      type: String,
      required: [true, "Order side is required"],
      enum: {
        values: ["buy", "sell"],
        message: "Side must be either buy or sell",
      },
      index: true,
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
    price: {
      type: Number,
      required: function () {
        return this.type !== "market";
      },
      min: [0, "Price must be positive"],
      validate: {
        validator: function (v) {
          return this.type === "market" || v > 0;
        },
        message: "Price must be a positive number for non-market orders",
      },
    },
    stopPrice: {
      type: Number,
      min: [0, "Stop price must be positive"],
      validate: {
        validator: function (v) {
          return !v || v > 0;
        },
        message: "Stop price must be a positive number",
      },
    },
    trailingAmount: {
      type: Number,
      min: [0, "Trailing amount must be positive"],
      validate: {
        validator: function (v) {
          return this.type !== "trailing_stop" || v > 0;
        },
        message: "Trailing amount is required for trailing stop orders",
      },
    },
    trailingPercent: {
      type: Number,
      min: [0.01, "Trailing percent must be at least 0.01%"],
      max: [100, "Trailing percent cannot exceed 100%"],
    },
    purchaseValue: {
      type: Number,
      required: [true, "Purchase value is required"],
      min: [0, "Purchase value must be positive"],
    },
    openTime: {
      type: Date,
      required: [true, "Order creation time is required"],
      default: Date.now,
      index: true,
    },
    expiryTime: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      required: [true, "Order status is required"],
      enum: {
        values: [
          "pending",
          "partial",
          "executed",
          "cancelled",
          "expired",
          "rejected",
        ],
        message: "Invalid order status",
      },
      default: "pending",
      index: true,
    },

    // Execution details
    execution: {
      executedTime: {
        type: Date,
      },
      executedPrice: {
        type: Number,
        min: 0,
      },
      executedVolume: {
        type: Number,
        min: 0,
        default: 0,
      },
      remainingVolume: {
        type: Number,
        min: 0,
      },
      commission: {
        type: Number,
        default: 0,
        min: 0,
      },
      fees: {
        type: Number,
        default: 0,
        min: 0,
      },
      resultingPositionId: {
        type: Number,
      },
    },

    // Order conditions
    conditions: {
      timeInForce: {
        type: String,
        enum: ["GTC", "IOC", "FOK", "DAY", "GTD"], // Good Till Cancelled, Immediate or Cancel, Fill or Kill, Day, Good Till Date
        default: "GTC",
      },
      reduceOnly: {
        type: Boolean,
        default: false,
      },
      postOnly: {
        type: Boolean,
        default: false,
      },
      iceberg: {
        visibleSize: {
          type: Number,
          min: 0,
        },
      },
    },

    // Risk management
    riskManagement: {
      stopLoss: {
        price: {
          type: Number,
          min: 0,
        },
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      takeProfit: {
        price: {
          type: Number,
          min: 0,
        },
        enabled: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Market data at order creation
    marketData: {
      bidPrice: {
        type: Number,
        min: 0,
      },
      askPrice: {
        type: Number,
        min: 0,
      },
      lastPrice: {
        type: Number,
        min: 0,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
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

    // Metadata
    source: {
      type: String,
      enum: ["manual", "api", "strategy", "copy_trading"],
      default: "manual",
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

    // Strategy information
    strategy: {
      name: {
        type: String,
        trim: true,
        maxlength: [50, "Strategy name cannot exceed 50 characters"],
      },
      id: {
        type: String,
        trim: true,
      },
    },

    // Parent order for complex order types
    parentOrderId: {
      type: Number,
      index: true,
    },
    childOrderIds: [
      {
        type: Number,
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
pendingOrderSchema.index({ userId: 1, status: 1 });
pendingOrderSchema.index({ userId: 1, symbol: 1 });
pendingOrderSchema.index({ userId: 1, openTime: -1 });
pendingOrderSchema.index({ userId: 1, type: 1, side: 1 });
pendingOrderSchema.index({ status: 1, expiryTime: 1 }); // For cleanup jobs

// Pre-save middleware for validations and calculations
pendingOrderSchema.pre("save", function (next) {
  // Calculate remaining volume
  if (this.execution && this.execution.executedVolume) {
    this.execution.remainingVolume =
      this.volume - this.execution.executedVolume;
  } else {
    this.execution = this.execution || {};
    this.execution.remainingVolume = this.volume;
  }

  // Set purchase value if not provided
  if (!this.purchaseValue && this.price) {
    this.purchaseValue = this.price * this.volume;
  }

  // Validate order type specific fields
  if (this.type === "stop_limit" && !this.stopPrice) {
    return next(new Error("Stop price is required for stop limit orders"));
  }

  if (
    this.type === "trailing_stop" &&
    !this.trailingAmount &&
    !this.trailingPercent
  ) {
    return next(
      new Error(
        "Either trailing amount or trailing percent is required for trailing stop orders"
      )
    );
  }

  // Set expiry time for DAY orders
  if (this.conditions.timeInForce === "DAY" && !this.expiryTime) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    this.expiryTime = endOfDay;
  }

  next();
});

// Virtual for order value
pendingOrderSchema.virtual("orderValue").get(function () {
  const price = this.price || this.marketData?.lastPrice || 0;
  return price * this.volume;
});

// Virtual for fill percentage
pendingOrderSchema.virtual("fillPercentage").get(function () {
  if (!this.execution?.executedVolume) return 0;
  return (this.execution.executedVolume / this.volume) * 100;
});

// Virtual for order age in hours
pendingOrderSchema.virtual("ageHours").get(function () {
  return Math.floor((new Date() - this.openTime) / (1000 * 60 * 60));
});

// Virtual for is expired
pendingOrderSchema.virtual("isExpired").get(function () {
  return this.expiryTime && new Date() > this.expiryTime;
});

// Instance method to execute order (full or partial)
pendingOrderSchema.methods.executeOrder = function (
  executedPrice,
  executedVolume = null,
  commission = 0,
  fees = 0
) {
  const volumeToExecute = executedVolume || this.volume;

  if (volumeToExecute > this.execution.remainingVolume) {
    throw new Error("Executed volume cannot exceed remaining volume");
  }

  this.execution.executedTime = new Date();
  this.execution.executedPrice = executedPrice;
  this.execution.executedVolume =
    (this.execution.executedVolume || 0) + volumeToExecute;
  this.execution.remainingVolume = this.volume - this.execution.executedVolume;
  this.execution.commission = (this.execution.commission || 0) + commission;
  this.execution.fees = (this.execution.fees || 0) + fees;

  // Update status
  if (this.execution.remainingVolume === 0) {
    this.status = "executed";
  } else {
    this.status = "partial";
  }

  return this.save();
};

// Instance method to cancel order
pendingOrderSchema.methods.cancelOrder = function (reason = null) {
  this.status = "cancelled";
  if (reason) {
    this.notes = this.notes
      ? `${this.notes}. Cancelled: ${reason}`
      : `Cancelled: ${reason}`;
  }
  return this.save();
};

// Instance method to expire order
pendingOrderSchema.methods.expireOrder = function () {
  this.status = "expired";
  return this.save();
};

// Instance method to reject order
pendingOrderSchema.methods.rejectOrder = function (reason) {
  this.status = "rejected";
  this.notes = this.notes
    ? `${this.notes}. Rejected: ${reason}`
    : `Rejected: ${reason}`;
  return this.save();
};

// Static method to find user's orders
pendingOrderSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  // Add filters
  if (options.status) query.status = options.status;
  if (options.symbol) query.symbol = options.symbol;
  if (options.type) query.type = options.type;
  if (options.side) query.side = options.side;

  const sort = options.sort || { openTime: -1 };
  const limit = options.limit || 100;

  return this.find(query).sort(sort).limit(limit);
};

// Static method to find active orders
pendingOrderSchema.statics.findActiveOrders = function (userId = null) {
  const query = { status: { $in: ["pending", "partial"] } };
  if (userId) query.userId = userId;

  return this.find(query).sort({ openTime: -1 });
};

// Static method to find expired orders
pendingOrderSchema.statics.findExpiredOrders = function () {
  const now = new Date();
  return this.find({
    status: { $in: ["pending", "partial"] },
    expiryTime: { $lt: now },
  });
};

// Static method to get order statistics
pendingOrderSchema.statics.getOrderStatistics = async function (
  userId,
  period = 30
) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - period);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        openTime: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: {
          status: "$status",
          side: "$side",
        },
        count: { $sum: 1 },
        totalVolume: { $sum: "$volume" },
        avgPrice: { $avg: "$price" },
      },
    },
    {
      $group: {
        _id: "$_id.status",
        sides: {
          $push: {
            side: "$_id.side",
            count: "$count",
            totalVolume: "$totalVolume",
            avgPrice: "$avgPrice",
          },
        },
        totalCount: { $sum: "$count" },
      },
    },
  ]);

  return result;
};

// Static method to cleanup expired orders
pendingOrderSchema.statics.cleanupExpiredOrders = async function () {
  const expiredOrders = await this.findExpiredOrders();
  const results = [];

  for (const order of expiredOrders) {
    try {
      await order.expireOrder();
      results.push({ orderId: order.orderId, status: "expired" });
    } catch (error) {
      results.push({
        orderId: order.orderId,
        status: "error",
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = mongoose.model("PendingOrder", pendingOrderSchema);
