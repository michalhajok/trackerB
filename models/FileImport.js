const mongoose = require("mongoose");

const fileImportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    filename: {
      type: String,
      required: [true, "Filename is required"],
      trim: true,
      maxlength: [255, "Filename cannot exceed 255 characters"],
    },
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
      maxlength: [255, "Original filename cannot exceed 255 characters"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size must be positive"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      enum: {
        values: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
          "application/vnd.ms-excel", // .xls
          "text/csv", // .csv
          "text/plain", // .txt
        ],
        message: "Unsupported file type",
      },
    },
    importDate: {
      type: Date,
      required: [true, "Import date is required"],
      default: Date.now,
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: [
          "pending",
          "processing",
          "completed",
          "failed",
          "cancelled",
          "partial",
        ],
        message: "Invalid import status",
      },
      default: "pending",
      index: true,
    },

    // Import configuration
    importType: {
      type: String,
      required: [true, "Import type is required"],
      enum: {
        values: [
          "positions",
          "cash_operations",
          "orders",
          "mixed",
          "portfolio_export",
        ],
        message: "Invalid import type",
      },
      index: true,
    },

    // Data processing summary
    processing: {
      totalRows: {
        type: Number,
        default: 0,
      },
      processedRows: {
        type: Number,
        default: 0,
      },
      successfulRows: {
        type: Number,
        default: 0,
      },
      errorRows: {
        type: Number,
        default: 0,
      },
      skippedRows: {
        type: Number,
        default: 0,
      },
      duplicateRows: {
        type: Number,
        default: 0,
      },
    },

    // Records count by type
    recordsCount: {
      positions: {
        type: Number,
        default: 0,
      },
      cashOperations: {
        type: Number,
        default: 0,
      },
      pendingOrders: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
      },
    },

    // Import configuration settings
    configuration: {
      hasHeaders: {
        type: Boolean,
        default: true,
      },
      delimiter: {
        type: String,
        enum: [",", ";", "\t", "|"],
        default: ",",
      },
      encoding: {
        type: String,
        enum: ["utf8", "utf16le", "latin1"],
        default: "utf8",
      },
      dateFormat: {
        type: String,
        enum: ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "auto"],
        default: "auto",
      },
      decimalSeparator: {
        type: String,
        enum: [".", ","],
        default: ".",
      },
      thousandsSeparator: {
        type: String,
        enum: ["", " ", ",", "."],
        default: "",
      },
    },

    // Column mapping
    columnMapping: {
      symbol: String,
      type: String,
      volume: String,
      openTime: String,
      openPrice: String,
      closeTime: String,
      closePrice: String,
      amount: String,
      comment: String,
      // Add more mappings as needed
    },

    // Validation rules applied
    validationRules: {
      allowDuplicates: {
        type: Boolean,
        default: false,
      },
      validateSymbols: {
        type: Boolean,
        default: true,
      },
      validateDates: {
        type: Boolean,
        default: true,
      },
      validateAmounts: {
        type: Boolean,
        default: true,
      },
      skipInvalidRows: {
        type: Boolean,
        default: true,
      },
    },

    // Processing progress
    progress: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      currentStep: {
        type: String,
        enum: [
          "uploading",
          "parsing",
          "validating",
          "importing",
          "completed",
          "failed",
        ],
        default: "uploading",
      },
      message: {
        type: String,
        maxlength: [200, "Progress message cannot exceed 200 characters"],
      },
    },

    // Error tracking
    errors: [
      {
        row: {
          type: Number,
          required: true,
        },
        column: {
          type: String,
        },
        field: {
          type: String,
        },
        value: {
          type: mongoose.Schema.Types.Mixed,
        },
        error: {
          type: String,
          required: true,
          maxlength: [500, "Error message cannot exceed 500 characters"],
        },
        severity: {
          type: String,
          enum: ["warning", "error", "critical"],
          default: "error",
        },
      },
    ],

    // Sample data for preview (first few rows)
    preview: {
      headers: [String],
      rows: [[mongoose.Schema.Types.Mixed]],
      maxRows: {
        type: Number,
        default: 5,
      },
    },

    // Statistics
    statistics: {
      averageProcessingTimePerRow: {
        type: Number, // milliseconds
      },
      memoryUsage: {
        type: Number, // bytes
      },
      duplicatesFound: [
        {
          row: Number,
          duplicateOf: Number,
          fields: [String],
        },
      ],
    },

    // File storage information
    storage: {
      path: {
        type: String,
        maxlength: [500, "File path cannot exceed 500 characters"],
      },
      cloudUrl: {
        type: String,
        maxlength: [500, "Cloud URL cannot exceed 500 characters"],
      },
      checksum: {
        type: String,
        maxlength: [128, "Checksum cannot exceed 128 characters"],
      },
      compressed: {
        type: Boolean,
        default: false,
      },
      encrypted: {
        type: Boolean,
        default: false,
      },
    },

    // Cleanup information
    cleanup: {
      deleteFileAfterImport: {
        type: Boolean,
        default: false,
      },
      retentionDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 365,
      },
      scheduledDeletion: {
        type: Date,
      },
    },

    // Additional metadata
    metadata: {
      userAgent: String,
      ipAddress: String,
      source: {
        type: String,
        enum: ["web_upload", "api", "scheduled", "bulk_import"],
        default: "web_upload",
      },
      tags: [String],
    },

    // Rollback information
    rollback: {
      canRollback: {
        type: Boolean,
        default: true,
      },
      rollbackData: {
        type: mongoose.Schema.Types.Mixed,
      },
      isRolledBack: {
        type: Boolean,
        default: false,
      },
      rollbackTime: {
        type: Date,
      },
      rollbackReason: {
        type: String,
        maxlength: [200, "Rollback reason cannot exceed 200 characters"],
      },
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

// Indexes for better performance
fileImportSchema.index({ userId: 1, importDate: -1 });
fileImportSchema.index({ userId: 1, status: 1 });
fileImportSchema.index({ status: 1, importDate: 1 });
fileImportSchema.index({ "cleanup.scheduledDeletion": 1 });

// Virtual for processing duration
fileImportSchema.virtual("processingDuration").get(function () {
  if (!this.endTime || !this.startTime) return null;
  return this.endTime - this.startTime; // milliseconds
});

// Virtual for success rate
fileImportSchema.virtual("successRate").get(function () {
  if (this.processing.totalRows === 0) return 0;
  return (this.processing.successfulRows / this.processing.totalRows) * 100;
});

// Virtual for error rate
fileImportSchema.virtual("errorRate").get(function () {
  if (this.processing.totalRows === 0) return 0;
  return (this.processing.errorRows / this.processing.totalRows) * 100;
});

// Virtual for file size in human readable format
fileImportSchema.virtual("fileSizeHuman").get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});

// Pre-save middleware
fileImportSchema.pre("save", function (next) {
  // Update total records count
  this.recordsCount.total =
    this.recordsCount.positions +
    this.recordsCount.cashOperations +
    this.recordsCount.pendingOrders;

  // Set end time when status changes to completed or failed
  if (
    (this.status === "completed" || this.status === "failed") &&
    !this.endTime
  ) {
    this.endTime = new Date();
  }

  // Calculate processing time per row
  if (this.endTime && this.startTime && this.processing.totalRows > 0) {
    const duration = this.endTime - this.startTime;
    this.statistics.averageProcessingTimePerRow =
      duration / this.processing.totalRows;
  }

  // Set scheduled deletion date
  if (!this.cleanup.scheduledDeletion) {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + this.cleanup.retentionDays);
    this.cleanup.scheduledDeletion = deletionDate;
  }

  next();
});

// Instance method to update progress
fileImportSchema.methods.updateProgress = function (
  percentage,
  step,
  message = null
) {
  this.progress.percentage = Math.min(100, Math.max(0, percentage));
  this.progress.currentStep = step;
  if (message) this.progress.message = message;
  return this.save();
};

// Instance method to add error
fileImportSchema.methods.addError = function (row, error, options = {}) {
  this.errors.push({
    row: row,
    column: options.column,
    field: options.field,
    value: options.value,
    error: error,
    severity: options.severity || "error",
  });

  this.processing.errorRows = this.processing.errorRows + 1;
  return this.save();
};

// Instance method to mark as completed
fileImportSchema.methods.markCompleted = function (summary = {}) {
  this.status = "completed";
  this.endTime = new Date();
  this.progress.percentage = 100;
  this.progress.currentStep = "completed";

  // Update processing summary
  Object.assign(this.processing, summary);

  return this.save();
};

// Instance method to mark as failed
fileImportSchema.methods.markFailed = function (error) {
  this.status = "failed";
  this.endTime = new Date();
  this.progress.currentStep = "failed";
  this.progress.message = error;
  return this.save();
};

// Instance method to perform rollback
fileImportSchema.methods.performRollback = async function (reason) {
  if (!this.rollback.canRollback) {
    throw new Error("This import cannot be rolled back");
  }

  if (this.rollback.isRolledBack) {
    throw new Error("This import has already been rolled back");
  }

  // Here you would implement the actual rollback logic
  // This would involve deleting the imported records

  this.rollback.isRolledBack = true;
  this.rollback.rollbackTime = new Date();
  this.rollback.rollbackReason = reason;

  return this.save();
};

// Static method to find user's imports
fileImportSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  if (options.status) query.status = options.status;
  if (options.importType) query.importType = options.importType;

  // Date range filter
  if (options.dateFrom || options.dateTo) {
    query.importDate = {};
    if (options.dateFrom) query.importDate.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.importDate.$lte = new Date(options.dateTo);
  }

  const sort = options.sort || { importDate: -1 };
  const limit = options.limit || 50;

  return this.find(query).sort(sort).limit(limit);
};

// Static method to get import statistics
fileImportSchema.statics.getImportStatistics = async function (
  userId,
  period = 30
) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - period);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        importDate: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: {
          status: "$status",
          importType: "$importType",
        },
        count: { $sum: 1 },
        totalRecords: { $sum: "$recordsCount.total" },
        avgSuccessRate: {
          $avg: {
            $multiply: [
              {
                $divide: [
                  "$processing.successfulRows",
                  "$processing.totalRows",
                ],
              },
              100,
            ],
          },
        },
        totalFileSize: { $sum: "$fileSize" },
      },
    },
    {
      $group: {
        _id: "$_id.status",
        types: {
          $push: {
            importType: "$_id.importType",
            count: "$count",
            totalRecords: "$totalRecords",
            avgSuccessRate: "$avgSuccessRate",
            totalFileSize: "$totalFileSize",
          },
        },
        totalImports: { $sum: "$count" },
        grandTotalRecords: { $sum: "$totalRecords" },
      },
    },
  ]);

  return result;
};

// Static method to cleanup old files
fileImportSchema.statics.cleanupOldFiles = async function () {
  const now = new Date();
  const filesToDelete = await this.find({
    "cleanup.scheduledDeletion": { $lt: now },
    status: { $in: ["completed", "failed"] },
  });

  const results = [];
  for (const fileImport of filesToDelete) {
    try {
      // Here you would implement the actual file deletion logic
      // Delete from filesystem or cloud storage

      await this.deleteOne({ _id: fileImport._id });
      results.push({ id: fileImport._id, status: "deleted" });
    } catch (error) {
      results.push({
        id: fileImport._id,
        status: "error",
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = mongoose.model("FileImport", fileImportSchema);
