const mongoose = require("mongoose");

const cashOperationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    operationId: {
      type: Number,
      required: [true, "Operation ID is required"],
      unique: true,
      index: true,
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: [true, "Portfolio ID is required"],
      index: true,
    },
    type: {
      type: String,
      required: [true, "Operation type is required"],
      enum: {
        values: [
          "deposit",
          "withdrawal",
          "dividend",
          "interest",
          "fee",
          "bonus",
          "transfer",
          "adjustment",
          "tax", // ogólny podatek
          "withholding_tax", // podatek u źródła
          "stock_purchase", // zakup akcji
          "stock_sale", // sprzedaż akcji
          "close_trade", // zamknięcie pozycji
          "fractional_shares", // akcje ułamkowe
          "correction", // korekty
          "subaccount_transfer", // transfer między kontami
        ],
        message: "Invalid operation type",
      },
      index: true,
    },
    time: {
      type: Date,
      required: [true, "Operation time is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      validate: {
        validator: function (v) {
          return v !== 0;
        },
        message: "Amount cannot be zero",
      },
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      enum: ["USD", "EUR", "PLN", "GBP"],
      default: "PLN",
    },
    comment: {
      type: String,
      required: [true, "Comment is required"],
      trim: true,
      maxlength: [200, "Comment cannot exceed 200 characters"],
    },
    symbol: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, "Symbol cannot exceed 10 characters"],
    },
    // Additional details for specific operation types
    details: {
      // For dividends
      dividendPerShare: {
        type: Number,
        min: 0,
      },
      sharesCount: {
        type: Number,
        min: 0,
      },
      exDividendDate: {
        type: Date,
      },
      paymentDate: {
        type: Date,
      },

      // For deposits/withdrawals
      bankAccount: {
        type: String,
        trim: true,
        maxlength: [50, "Bank account info cannot exceed 50 characters"],
      },
      paymentMethod: {
        type: String,
        enum: ["bank_transfer", "card", "blik", "paypal", "crypto", "other"],
        default: "bank_transfer",
      },
      transactionId: {
        type: String,
        trim: true,
        maxlength: [100, "Transaction ID cannot exceed 100 characters"],
      },

      // For fees
      feeType: {
        type: String,
        enum: [
          "commission",
          "spread",
          "overnight",
          "inactivity",
          "currency_conversion",
          "other",
        ],
      },
      relatedPositionId: {
        type: Number,
      },

      // For interests
      interestRate: {
        type: Number,
        min: 0,
      },
      period: {
        from: Date,
        to: Date,
      },
    },

    // Status tracking
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "completed",
      index: true,
    },

    // Metadata
    source: {
      type: String,
      enum: ["manual", "import", "api", "automatic"],
      default: "manual",
    },

    // Running balance after this operation
    balanceAfter: {
      type: Number,
      default: null,
    },

    // Tax information
    taxInfo: {
      taxable: {
        type: Boolean,
        default: false,
      },
      taxAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      taxRate: {
        type: Number,
        min: 0,
        max: 100,
      },
    },

    // Additional notes and tags
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

    // For imported operations
    importBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FileImport",
      default: null,
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
cashOperationSchema.index({ userId: 1, type: 1 });
cashOperationSchema.index({ userId: 1, time: -1 });
cashOperationSchema.index({ userId: 1, status: 1 });
cashOperationSchema.index({ userId: 1, currency: 1 });

// Pre-save middleware for additional validations and calculations
cashOperationSchema.pre("save", function (next) {
  // Ensure dividend operations have symbol
  if (this.type === "dividend" && !this.symbol) {
    return next(new Error("Symbol is required for dividend operations"));
  }

  // Ensure positive amounts for deposits, dividends, bonuses, interests
  const positiveTypes = ["deposit", "dividend", "bonus", "interest"];
  if (positiveTypes.includes(this.type) && this.amount < 0) {
    return next(new Error(`${this.type} amount must be positive`));
  }

  // Ensure negative amounts for withdrawals and fees
  const negativeTypes = ["withdrawal", "fee"];
  if (negativeTypes.includes(this.type) && this.amount > 0) {
    this.amount = -Math.abs(this.amount);
  }

  // Calculate tax amount if taxable
  if (this.taxInfo.taxable && this.taxInfo.taxRate && this.amount > 0) {
    this.taxInfo.taxAmount = (this.amount * this.taxInfo.taxRate) / 100;
  }

  next();
});

// Virtual for absolute amount (always positive)
cashOperationSchema.virtual("absoluteAmount").get(function () {
  return Math.abs(this.amount);
});

// Virtual for operation direction
cashOperationSchema.virtual("direction").get(function () {
  return this.amount >= 0 ? "credit" : "debit";
});

// Virtual for display amount with currency
cashOperationSchema.virtual("displayAmount").get(function () {
  const sign = this.amount >= 0 ? "+" : "";
  return `${sign}${this.amount.toFixed(2)} ${this.currency}`;
});

// Instance method to mark as completed
cashOperationSchema.methods.markCompleted = function (balanceAfter = null) {
  this.status = "completed";
  if (balanceAfter !== null) {
    this.balanceAfter = balanceAfter;
  }
  return this.save();
};

// Instance method to mark as failed
cashOperationSchema.methods.markFailed = function (reason = null) {
  this.status = "failed";
  if (reason) {
    this.notes = this.notes
      ? `${this.notes}. Failed: ${reason}`
      : `Failed: ${reason}`;
  }
  return this.save();
};

// Static method to find operations by user
cashOperationSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  // Add filters
  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;
  if (options.currency) query.currency = options.currency;
  if (options.symbol) query.symbol = options.symbol;

  // Date range filter
  if (options.dateFrom || options.dateTo) {
    query.time = {};
    if (options.dateFrom) query.time.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.time.$lte = new Date(options.dateTo);
  }

  const sort = options.sort || { time: -1 };
  const limit = options.limit || 100;

  return this.find(query).sort(sort).limit(limit);
};

// Static method to calculate balance
cashOperationSchema.statics.calculateBalance = async function (
  userId,
  currency = null,
  upToDate = null
) {
  const matchQuery = { userId, status: "completed" };
  if (currency) matchQuery.currency = currency;
  if (upToDate) matchQuery.time = { $lte: new Date(upToDate) };

  const result = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: currency ? "$currency" : null,
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (currency) {
    return result[0] ? result[0].totalAmount : 0;
  }

  // Return balance by currency if no specific currency requested
  return result.reduce((acc, item) => {
    acc[item._id] = item.totalAmount;
    return acc;
  }, {});
};

// Static method to get cash flow summary
cashOperationSchema.statics.getCashFlowSummary = async function (
  userId,
  period = 30
) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - period);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        time: { $gte: fromDate },
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]);

  return result;
};

// Static method to get monthly summary
cashOperationSchema.statics.getMonthlySummary = async function (
  userId,
  year = null,
  month = null
) {
  const currentDate = new Date();
  const targetYear = year || currentDate.getFullYear();
  const targetMonth = month || currentDate.getMonth() + 1;

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        time: { $gte: startDate, $lte: endDate },
        status: "completed",
      },
    },
    {
      $group: {
        _id: {
          type: "$type",
          currency: "$currency",
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.currency",
        operations: {
          $push: {
            type: "$_id.type",
            totalAmount: "$totalAmount",
            count: "$count",
          },
        },
        totalFlow: { $sum: "$totalAmount" },
      },
    },
  ]);

  return result;
};

// Statyczna metoda obliczająca bilans: sumuje depozyty, odejmuje wypłaty
cashOperationSchema.statics.calculateBalance = async function (userId) {
  const ops = await this.find({
    userId,
    type: { $in: ["deposit", "withdrawal", "dividend"] },
  });
  return ops.reduce((sum, op) => {
    if (op.type === "deposit" || op.type === "dividend") return sum + op.amount;
    if (op.type === "withdrawal") return sum - op.amount;
    return sum;
  }, 0);
};

module.exports = mongoose.model("CashOperation", cashOperationSchema);
