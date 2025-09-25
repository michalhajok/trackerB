const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    reportId: {
      type: String,
      required: [true, "Report ID is required"],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Report name is required"],
      maxlength: [200, "Name cannot exceed 200 characters"],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Report type is required"],
      enum: {
        values: [
          "tax_report",
          "performance_report",
          "portfolio_summary",
          "trading_activity",
          "profit_loss",
          "risk_analysis",
          "sector_analysis",
          "monthly_summary",
          "yearly_summary",
          "custom",
        ],
        message: "Invalid report type",
      },
      index: true,
    },
    format: {
      type: String,
      enum: ["pdf", "csv", "excel", "json"],
      default: "pdf",
    },
    status: {
      type: String,
      enum: ["pending", "generating", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    // Date range for the report
    dateRange: {
      startDate: {
        type: Date,
        required: [true, "Start date is required"],
        index: true,
      },
      endDate: {
        type: Date,
        required: [true, "End date is required"],
        index: true,
      },
    },
    // Report configuration/parameters
    configuration: {
      // Include/exclude sections
      includeSections: {
        overview: { type: Boolean, default: true },
        positions: { type: Boolean, default: true },
        cashFlow: { type: Boolean, default: true },
        performance: { type: Boolean, default: true },
        taxes: { type: Boolean, default: false },
        charts: { type: Boolean, default: true },
        transactions: { type: Boolean, default: true },
      },
      // Filters
      filters: {
        symbols: [String], // Specific symbols to include
        exchanges: [String], // Specific exchanges
        sectors: [String], // Specific sectors
        minPL: Number, // Minimum P&L threshold
        maxPL: Number, // Maximum P&L threshold
        currencies: [String], // Specific currencies
        positionTypes: [String], // BUY/SELL
      },
      // Formatting options
      formatting: {
        currency: {
          type: String,
          enum: ["USD", "EUR", "PLN", "GBP"],
          default: "PLN",
        },
        dateFormat: {
          type: String,
          enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
          default: "DD/MM/YYYY",
        },
        numberFormat: {
          type: String,
          enum: ["decimal", "accounting"],
          default: "decimal",
        },
        timezone: {
          type: String,
          default: "Europe/Warsaw",
        },
      },
      // Tax-specific settings
      taxSettings: {
        taxYear: Number,
        includeForeignTax: { type: Boolean, default: true },
        groupByDate: { type: Boolean, default: true },
        includeDividends: { type: Boolean, default: true },
      },
    },
    // Generation progress and results
    generation: {
      startedAt: {
        type: Date,
      },
      completedAt: {
        type: Date,
      },
      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      currentStep: {
        type: String,
        enum: [
          "initializing",
          "fetching_data",
          "processing_positions",
          "calculating_metrics",
          "generating_charts",
          "formatting_report",
          "finalizing",
          "completed",
        ],
      },
      stepMessage: {
        type: String,
        maxlength: 200,
      },
      errorMessage: {
        type: String,
      },
      // Data metrics
      dataMetrics: {
        positionsProcessed: { type: Number, default: 0 },
        transactionsProcessed: { type: Number, default: 0 },
        totalRecords: { type: Number, default: 0 },
        processingTimeMs: { type: Number, default: 0 },
      },
    },
    // File storage information
    file: {
      filename: {
        type: String,
      },
      originalName: {
        type: String,
      },
      path: {
        type: String,
      },
      size: {
        type: Number, // in bytes
        min: 0,
      },
      mimeType: {
        type: String,
      },
      downloadCount: {
        type: Number,
        default: 0,
      },
      lastDownload: {
        type: Date,
      },
    },
    // Scheduling for recurring reports
    schedule: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      },
      dayOfMonth: {
        // For monthly/quarterly reports
        type: Number,
        min: 1,
        max: 31,
      },
      dayOfWeek: {
        // For weekly reports (0 = Sunday)
        type: Number,
        min: 0,
        max: 6,
      },
      time: {
        // HH:MM format
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        default: "09:00",
      },
      nextRun: {
        type: Date,
        index: true,
      },
      lastRun: {
        type: Date,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    // Email delivery settings
    delivery: {
      email: {
        enabled: {
          type: Boolean,
          default: false,
        },
        recipients: [
          {
            type: String,
            match: [
              /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
              "Please provide a valid email",
            ],
          },
        ],
        subject: {
          type: String,
          maxlength: 200,
        },
        lastSent: {
          type: Date,
        },
        sendCount: {
          type: Number,
          default: 0,
        },
      },
    },
    // Report metadata
    metadata: {
      tags: [
        {
          type: String,
          trim: true,
          maxlength: [30, "Tag cannot exceed 30 characters"],
        },
      ],
      category: {
        type: String,
        enum: ["tax", "performance", "compliance", "analysis", "summary"],
        default: "summary",
      },
      visibility: {
        type: String,
        enum: ["private", "shared", "public"],
        default: "private",
      },
      version: {
        type: String,
        default: "1.0",
      },
      template: {
        type: String, // Template used for generation
        maxlength: 100,
      },
    },
    // Access and sharing
    access: {
      sharedWith: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          permission: {
            type: String,
            enum: ["view", "download"],
            default: "view",
          },
          sharedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      publicLink: {
        enabled: {
          type: Boolean,
          default: false,
        },
        token: {
          type: String,
          unique: true,
          sparse: true,
        },
        expiresAt: {
          type: Date,
        },
        accessCount: {
          type: Number,
          default: 0,
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.file?.path; // Don't expose file system path
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better performance
reportSchema.index({ userId: 1, type: 1 });
reportSchema.index({ userId: 1, status: 1 });
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ "dateRange.startDate": 1, "dateRange.endDate": 1 });
reportSchema.index({ "schedule.nextRun": 1 }, { sparse: true });
reportSchema.index({ "access.publicLink.token": 1 }, { sparse: true });

// Virtual for report age
reportSchema.virtual("ageInDays").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for generation time
reportSchema.virtual("generationTimeMs").get(function () {
  if (!this.generation.startedAt || !this.generation.completedAt) return null;
  return this.generation.completedAt - this.generation.startedAt;
});

// Virtual for file size formatted
reportSchema.virtual("fileSizeFormatted").get(function () {
  if (!this.file.size) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(this.file.size) / Math.log(1024));

  return `${(this.file.size / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
});

// Pre-save middleware
reportSchema.pre("save", function (next) {
  if (!this.reportId) {
    this.reportId = `report_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Validate date range
  if (this.dateRange.startDate >= this.dateRange.endDate) {
    return next(new Error("Start date must be before end date"));
  }

  next();
});

// Instance method to update progress
reportSchema.methods.updateProgress = function (progress, step, message) {
  this.generation.progress = Math.min(100, Math.max(0, progress));
  this.generation.currentStep = step;
  this.generation.stepMessage = message;

  if (progress === 0 && !this.generation.startedAt) {
    this.generation.startedAt = new Date();
    this.status = "generating";
  }

  return this.save();
};

// Instance method to mark as completed
reportSchema.methods.markCompleted = function (fileInfo) {
  this.status = "completed";
  this.generation.completedAt = new Date();
  this.generation.progress = 100;
  this.generation.currentStep = "completed";
  this.generation.stepMessage = "Report generated successfully";

  if (fileInfo) {
    this.file = {
      ...this.file,
      ...fileInfo,
    };
  }

  return this.save();
};

// Instance method to mark as failed
reportSchema.methods.markFailed = function (errorMessage) {
  this.status = "failed";
  this.generation.errorMessage = errorMessage;
  this.generation.currentStep = "failed";
  this.generation.stepMessage = errorMessage;

  return this.save();
};

// Instance method to record download
reportSchema.methods.recordDownload = function () {
  this.file.downloadCount += 1;
  this.file.lastDownload = new Date();
  return this.save();
};

// Instance method to generate public link
reportSchema.methods.generatePublicLink = function (expiresInDays = 7) {
  const token = require("crypto").randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  this.access.publicLink = {
    enabled: true,
    token,
    expiresAt,
    accessCount: 0,
  };

  return this.save();
};

// Instance method to revoke public link
reportSchema.methods.revokePublicLink = function () {
  this.access.publicLink.enabled = false;
  this.access.publicLink.token = undefined;
  this.access.publicLink.expiresAt = undefined;

  return this.save();
};

// Static method to find user reports
reportSchema.statics.findUserReports = function (userId, options = {}) {
  const query = { userId };

  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Static method to find scheduled reports
reportSchema.statics.findScheduledReports = function () {
  const now = new Date();

  return this.find({
    "schedule.isRecurring": true,
    "schedule.isActive": true,
    "schedule.nextRun": { $lte: now },
  });
};

// Static method to find reports to cleanup
reportSchema.statics.findReportsToCleanup = function (daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.find({
    status: "completed",
    createdAt: { $lt: cutoffDate },
    "file.downloadCount": 0, // Only cleanup never-downloaded reports
  });
};

// Static method to get report statistics
reportSchema.statics.getReportStatistics = async function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        completedReports: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        failedReports: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        totalDownloads: { $sum: "$file.downloadCount" },
        byType: {
          $push: "$type",
        },
        byFormat: {
          $push: "$format",
        },
        avgGenerationTime: {
          $avg: {
            $cond: [
              { $and: ["$generation.startedAt", "$generation.completedAt"] },
              {
                $subtract: ["$generation.completedAt", "$generation.startedAt"],
              },
              null,
            ],
          },
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);

  if (result.length === 0) {
    return {
      totalReports: 0,
      completedReports: 0,
      failedReports: 0,
      totalDownloads: 0,
      byType: {},
      byFormat: {},
      avgGenerationTimeMs: 0,
    };
  }

  const stats = result[0];

  // Count by type
  const typeStats = {};
  stats.byType.forEach((type) => {
    typeStats[type] = (typeStats[type] || 0) + 1;
  });

  // Count by format
  const formatStats = {};
  stats.byFormat.forEach((format) => {
    formatStats[format] = (formatStats[format] || 0) + 1;
  });

  return {
    totalReports: stats.totalReports,
    completedReports: stats.completedReports,
    failedReports: stats.failedReports,
    totalDownloads: stats.totalDownloads,
    successRate:
      stats.totalReports > 0
        ? (stats.completedReports / stats.totalReports) * 100
        : 0,
    byType: typeStats,
    byFormat: formatStats,
    avgGenerationTimeMs: stats.avgGenerationTime || 0,
  };
};

// Static method to cleanup old reports
reportSchema.statics.cleanupOldReports = async function (daysOld = 90) {
  const fs = require("fs").promises;
  const path = require("path");

  const reportsToDelete = await this.findReportsToCleanup(daysOld);

  const results = {
    deletedCount: 0,
    fileCleanupCount: 0,
    errors: [],
  };

  for (const report of reportsToDelete) {
    try {
      // Try to delete physical file
      if (report.file.path) {
        try {
          await fs.unlink(report.file.path);
          results.fileCleanupCount++;
        } catch (fileError) {
          results.errors.push(
            `Failed to delete file for report ${report.reportId}: ${fileError.message}`
          );
        }
      }

      // Delete database record
      await report.deleteOne();
      results.deletedCount++;
    } catch (error) {
      results.errors.push(
        `Failed to delete report ${report.reportId}: ${error.message}`
      );
    }
  }

  return results;
};

// Static method to create tax report
reportSchema.statics.createTaxReport = function (
  userId,
  taxYear,
  options = {}
) {
  const startDate = new Date(taxYear, 0, 1); // January 1st
  const endDate = new Date(taxYear, 11, 31, 23, 59, 59); // December 31st

  return new this({
    userId,
    name: `Tax Report ${taxYear}`,
    description: `Annual tax report for year ${taxYear}`,
    type: "tax_report",
    format: options.format || "pdf",
    dateRange: { startDate, endDate },
    configuration: {
      includeSections: {
        overview: true,
        positions: true,
        cashFlow: true,
        taxes: true,
        transactions: true,
        performance: false,
        charts: false,
      },
      taxSettings: {
        taxYear,
        includeForeignTax: true,
        groupByDate: true,
        includeDividends: true,
      },
      formatting: {
        currency: options.currency || "PLN",
        dateFormat: "DD/MM/YYYY",
      },
    },
  });
};

// Static method to schedule next run for recurring reports
reportSchema.statics.calculateNextRun = function (schedule) {
  const now = new Date();
  const nextRun = new Date();

  switch (schedule.frequency) {
    case "daily":
      nextRun.setDate(now.getDate() + 1);
      break;
    case "weekly":
      nextRun.setDate(now.getDate() + 7);
      if (schedule.dayOfWeek !== undefined) {
        const daysUntilTarget = (schedule.dayOfWeek - now.getDay() + 7) % 7;
        nextRun.setDate(
          now.getDate() + daysUntilTarget + (daysUntilTarget === 0 ? 7 : 0)
        );
      }
      break;
    case "monthly":
      nextRun.setMonth(now.getMonth() + 1);
      if (schedule.dayOfMonth) {
        nextRun.setDate(schedule.dayOfMonth);
      }
      break;
    case "quarterly":
      nextRun.setMonth(now.getMonth() + 3);
      if (schedule.dayOfMonth) {
        nextRun.setDate(schedule.dayOfMonth);
      }
      break;
    case "yearly":
      nextRun.setFullYear(now.getFullYear() + 1);
      if (schedule.dayOfMonth) {
        nextRun.setDate(schedule.dayOfMonth);
      }
      break;
  }

  // Set time
  if (schedule.time) {
    const [hours, minutes] = schedule.time.split(":").map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
  }

  return nextRun;
};

module.exports = mongoose.model("Report", reportSchema);
