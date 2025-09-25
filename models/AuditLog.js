const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    // Session information
    sessionId: {
      type: String,
      required: [true, "Session ID is required"],
      index: true,
    },
    // What action was performed
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: [
          // Authentication actions
          "login",
          "logout",
          "register",
          "password_change",
          "password_reset",
          "token_refresh",

          // CRUD operations
          "create",
          "read",
          "update",
          "delete",

          // Business actions
          "position_open",
          "position_close",
          "position_update",
          "order_create",
          "order_execute",
          "order_cancel",
          "cash_operation_create",
          "cash_operation_update",
          "cash_operation_delete",
          "file_import",
          "file_export",
          "report_generate",
          "report_download",

          // Admin actions
          "user_ban",
          "user_unban",
          "user_role_change",
          "system_maintenance",

          // Security events
          "unauthorized_access",
          "suspicious_activity",
          "rate_limit_exceeded",
          "invalid_token",

          // Data operations
          "bulk_update",
          "data_export",
          "data_import",
          "database_reset",
        ],
        message: "Invalid action type",
      },
      index: true,
    },
    // What resource was affected
    resource: {
      type: {
        type: String,
        required: [true, "Resource type is required"],
        enum: [
          "user",
          "position",
          "cash_operation",
          "pending_order",
          "file_import",
          "report",
          "notification",
          "watchlist",
          "market_data",
          "system",
        ],
        index: true,
      },
      id: {
        type: String, // Can be ObjectId or custom ID
        index: true,
      },
      identifier: {
        type: String, // Human-readable identifier (symbol, email, name)
        index: true,
      },
    },
    // Details of what changed
    changes: {
      // Previous values (before the change)
      before: {
        type: mongoose.Schema.Types.Mixed,
      },
      // New values (after the change)
      after: {
        type: mongoose.Schema.Types.Mixed,
      },
      // Specific fields that changed
      fields: [String],
    },
    // Request context
    request: {
      method: {
        type: String,
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        index: true,
      },
      path: {
        type: String,
        maxlength: 500,
        index: true,
      },
      query: {
        type: mongoose.Schema.Types.Mixed,
      },
      body: {
        type: mongoose.Schema.Types.Mixed,
      },
      headers: {
        userAgent: String,
        referer: String,
        contentType: String,
      },
    },
    // Client information
    client: {
      ipAddress: {
        type: String,
        required: [true, "IP address is required"],
        index: true,
      },
      userAgent: {
        type: String,
        maxlength: 1000,
      },
      platform: {
        type: String,
        enum: ["web", "mobile", "api", "system"],
        default: "web",
        index: true,
      },
      location: {
        country: String,
        city: String,
        timezone: String,
      },
    },
    // Result of the action
    result: {
      success: {
        type: Boolean,
        required: [true, "Result success status is required"],
        index: true,
      },
      statusCode: {
        type: Number,
        min: 100,
        max: 599,
        index: true,
      },
      message: {
        type: String,
        maxlength: 1000,
      },
      errorCode: {
        type: String,
        maxlength: 50,
      },
      executionTime: {
        // in milliseconds
        type: Number,
        min: 0,
      },
    },
    // Security and risk assessment
    security: {
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "low",
        index: true,
      },
      flags: [
        {
          type: String,
          enum: [
            "unusual_time",
            "new_location",
            "high_frequency",
            "large_transaction",
            "suspicious_pattern",
            "failed_auth",
            "privilege_escalation",
            "data_breach_attempt",
          ],
        },
      ],
      threatScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    // Additional metadata
    metadata: {
      // For financial operations
      amount: {
        type: Number,
      },
      currency: {
        type: String,
        enum: ["USD", "EUR", "PLN", "GBP"],
      },
      symbol: {
        type: String,
        uppercase: true,
      },

      // For file operations
      filename: String,
      fileSize: Number,

      // For system operations
      systemComponent: String,
      version: String,

      // Custom data
      extra: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    // Correlation with other events
    correlationId: {
      type: String,
      index: true,
    },
    parentLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuditLog",
      index: true,
    },
    // Administrative fields
    retention: {
      expiresAt: {
        type: Date,
        index: { expires: 0 },
      },
      retentionReason: {
        type: String,
        enum: ["legal", "compliance", "security", "business"],
        default: "business",
      },
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [30, "Tag cannot exceed 30 characters"],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        // Sanitize sensitive data in output
        if (ret.request?.body?.password) {
          ret.request.body.password = "[REDACTED]";
        }
        if (ret.changes?.before?.password) {
          ret.changes.before.password = "[REDACTED]";
        }
        if (ret.changes?.after?.password) {
          ret.changes.after.password = "[REDACTED]";
        }
        return ret;
      },
    },
  }
);

// Compound indexes for better performance
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ "resource.type": 1, "resource.id": 1 });
auditLogSchema.index({ "client.ipAddress": 1, createdAt: -1 });
auditLogSchema.index({ sessionId: 1, createdAt: -1 });
auditLogSchema.index({ "security.riskLevel": 1, createdAt: -1 });
auditLogSchema.index({ correlationId: 1 });

// Virtual for formatted timestamp
auditLogSchema.virtual("formattedTimestamp").get(function () {
  return this.createdAt.toISOString();
});

// Virtual for duration in human readable format
auditLogSchema.virtual("executionTimeFormatted").get(function () {
  if (!this.result.executionTime) return "N/A";

  const ms = this.result.executionTime;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
});

// Pre-save middleware
auditLogSchema.pre("save", function (next) {
  // Set default retention period (1 year for security events, 90 days for others)
  if (!this.retention.expiresAt) {
    const expiryDate = new Date();

    if (
      this.security.riskLevel === "critical" ||
      this.security.riskLevel === "high"
    ) {
      expiryDate.setFullYear(expiryDate.getFullYear() + 7); // 7 years for security
      this.retention.retentionReason = "security";
    } else if (
      this.action.includes("tax") ||
      this.action.includes("compliance")
    ) {
      expiryDate.setFullYear(expiryDate.getFullYear() + 7); // 7 years for tax
      this.retention.retentionReason = "legal";
    } else {
      expiryDate.setDate(expiryDate.getDate() + 90); // 90 days default
    }

    this.retention.expiresAt = expiryDate;
  }

  // Calculate threat score based on flags
  if (this.security.flags && this.security.flags.length > 0) {
    const flagScores = {
      unusual_time: 10,
      new_location: 15,
      high_frequency: 20,
      large_transaction: 25,
      suspicious_pattern: 30,
      failed_auth: 35,
      privilege_escalation: 40,
      data_breach_attempt: 50,
    };

    this.security.threatScore = this.security.flags.reduce((score, flag) => {
      return score + (flagScores[flag] || 5);
    }, 0);

    // Set risk level based on threat score
    if (this.security.threatScore >= 40) {
      this.security.riskLevel = "critical";
    } else if (this.security.threatScore >= 25) {
      this.security.riskLevel = "high";
    } else if (this.security.threatScore >= 10) {
      this.security.riskLevel = "medium";
    }
  }

  next();
});

// Static method to log user action
auditLogSchema.statics.logAction = async function (logData) {
  try {
    const auditLog = new this({
      userId: logData.userId,
      sessionId: logData.sessionId || `session_${Date.now()}`,
      action: logData.action,
      resource: {
        type: logData.resourceType,
        id: logData.resourceId,
        identifier: logData.resourceIdentifier,
      },
      changes: logData.changes || {},
      request: logData.request || {},
      client: {
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        platform: logData.platform || "web",
        location: logData.location || {},
      },
      result: {
        success: logData.success !== false, // Default to true
        statusCode: logData.statusCode || 200,
        message: logData.message,
        errorCode: logData.errorCode,
        executionTime: logData.executionTime,
      },
      security: {
        flags: logData.securityFlags || [],
        riskLevel: logData.riskLevel || "low",
      },
      metadata: logData.metadata || {},
      correlationId: logData.correlationId,
      parentLogId: logData.parentLogId,
      tags: logData.tags || [],
    });

    return await auditLog.save();
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break app flow
    return null;
  }
};

// Static method to find suspicious activities
auditLogSchema.statics.findSuspiciousActivities = function (days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    createdAt: { $gte: startDate },
    $or: [
      { "security.riskLevel": { $in: ["high", "critical"] } },
      { "security.flags": { $exists: true, $ne: [] } },
      {
        "result.success": false,
        "result.statusCode": { $in: [401, 403, 429] },
      },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("userId", "name email");
};

// Static method to get user activity summary
auditLogSchema.statics.getUserActivitySummary = async function (
  userId,
  days = 30
) {
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
        totalActions: { $sum: 1 },
        successfulActions: {
          $sum: { $cond: [{ $eq: ["$result.success", true] }, 1, 0] },
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ["$result.success", false] }, 1, 0] },
        },
        uniqueSessions: { $addToSet: "$sessionId" },
        actionsByType: {
          $push: "$action",
        },
        resourcesByType: {
          $push: "$resource.type",
        },
        ipAddresses: {
          $addToSet: "$client.ipAddress",
        },
        avgExecutionTime: {
          $avg: "$result.executionTime",
        },
        highRiskActions: {
          $sum: {
            $cond: [
              { $in: ["$security.riskLevel", ["high", "critical"]] },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);

  if (result.length === 0) {
    return {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      uniqueSessions: 0,
      actionsByType: {},
      resourcesByType: {},
      uniqueIpAddresses: 0,
      avgExecutionTimeMs: 0,
      highRiskActions: 0,
      successRate: 0,
    };
  }

  const stats = result[0];

  // Count actions by type
  const actionStats = {};
  stats.actionsByType.forEach((action) => {
    actionStats[action] = (actionStats[action] || 0) + 1;
  });

  // Count resources by type
  const resourceStats = {};
  stats.resourcesByType.forEach((resource) => {
    resourceStats[resource] = (resourceStats[resource] || 0) + 1;
  });

  return {
    totalActions: stats.totalActions,
    successfulActions: stats.successfulActions,
    failedActions: stats.failedActions,
    uniqueSessions: stats.uniqueSessions.length,
    actionsByType: actionStats,
    resourcesByType: resourceStats,
    uniqueIpAddresses: stats.ipAddresses.length,
    avgExecutionTimeMs: Math.round(stats.avgExecutionTime || 0),
    highRiskActions: stats.highRiskActions,
    successRate:
      stats.totalActions > 0
        ? (stats.successfulActions / stats.totalActions) * 100
        : 0,
  };
};

// Static method to get system activity overview
auditLogSchema.statics.getSystemActivity = async function (days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        totalActions: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" },
        successfulActions: {
          $sum: { $cond: [{ $eq: ["$result.success", true] }, 1, 0] },
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ["$result.success", false] }, 1, 0] },
        },
        highRiskActions: {
          $sum: {
            $cond: [
              { $in: ["$security.riskLevel", ["high", "critical"]] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { "_id.date": 1 } },
  ];

  const dailyStats = await this.aggregate(pipeline);

  return dailyStats.map((day) => ({
    date: day._id.date,
    totalActions: day.totalActions,
    uniqueUsers: day.uniqueUsers.length,
    successfulActions: day.successfulActions,
    failedActions: day.failedActions,
    highRiskActions: day.highRiskActions,
    successRate:
      day.totalActions > 0
        ? (day.successfulActions / day.totalActions) * 100
        : 0,
  }));
};

// Static method to find logs by IP address
auditLogSchema.statics.findByIpAddress = function (ipAddress, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    "client.ipAddress": ipAddress,
    createdAt: { $gte: startDate },
  })
    .sort({ createdAt: -1 })
    .populate("userId", "name email");
};

// Static method to find failed login attempts
auditLogSchema.statics.findFailedLogins = function (days = 7, limit = 100) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    action: "login",
    "result.success": false,
    createdAt: { $gte: startDate },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name email");
};

// Static method to detect unusual activity
auditLogSchema.statics.detectUnusualActivity = async function (
  userId,
  hours = 24
) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  const recentActivity = await this.find({
    userId: mongoose.Types.ObjectId(userId),
    createdAt: { $gte: startDate },
  });

  const analysis = {
    totalActions: recentActivity.length,
    uniqueIpAddresses: new Set(
      recentActivity.map((log) => log.client.ipAddress)
    ).size,
    failureRate: 0,
    newLocations: 0,
    highFrequency: false,
    suspiciousPatterns: [],
  };

  if (recentActivity.length > 0) {
    const failures = recentActivity.filter((log) => !log.result.success);
    analysis.failureRate = (failures.length / recentActivity.length) * 100;

    // Detect high frequency (more than 100 actions in 1 hour)
    analysis.highFrequency = recentActivity.length > 100;

    // Detect new locations (more than 3 different IPs)
    analysis.newLocations = analysis.uniqueIpAddresses > 3;

    // Detect suspicious patterns
    if (analysis.failureRate > 20) {
      analysis.suspiciousPatterns.push("high_failure_rate");
    }

    if (analysis.highFrequency) {
      analysis.suspiciousPatterns.push("high_frequency_access");
    }

    if (analysis.newLocations) {
      analysis.suspiciousPatterns.push("multiple_locations");
    }
  }

  return analysis;
};

// Static method to cleanup old logs
auditLogSchema.statics.cleanupOldLogs = async function () {
  const result = await this.deleteMany({
    "retention.expiresAt": { $lte: new Date() },
  });

  return {
    deletedCount: result.deletedCount,
    cleanupDate: new Date(),
  };
};

// Static method to export logs for compliance
auditLogSchema.statics.exportLogsForCompliance = function (
  userId,
  startDate,
  endDate
) {
  return this.find({
    userId: mongoose.Types.ObjectId(userId),
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .sort({ createdAt: 1 })
    .populate("userId", "name email")
    .lean();
};

module.exports = mongoose.model("AuditLog", auditLogSchema);
