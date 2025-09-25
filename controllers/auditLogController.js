const AuditLog = require("../models/AuditLog");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get audit logs (Admin only)
 * @route GET /api/audit-logs
 * @access Private (Admin)
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      resourceType,
      success,
      riskLevel,
      ipAddress,
      days = 7,
      page = 1,
      limit = 50,
    } = req.query;

    // Build query
    const query = {};

    // Date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    query.createdAt = { $gte: startDate };

    if (userId) query.userId = mongoose.Types.ObjectId(userId);
    if (action) query.action = action;
    if (resourceType) query["resource.type"] = resourceType;
    if (success !== undefined) query["result.success"] = success === "true";
    if (riskLevel) query["security.riskLevel"] = riskLevel;
    if (ipAddress) query["client.ipAddress"] = ipAddress;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "name email"),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        filters: {
          days: parseInt(days),
          userId,
          action,
          resourceType,
          success,
          riskLevel,
          ipAddress,
        },
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching audit logs",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get user activity summary
 * @route GET /api/audit-logs/user/:userId/summary
 * @access Private (Admin or Self)
 */
const getUserActivitySummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    // Check if user can access this data
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only view your own activity or admin access required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const summary = await AuditLog.getUserActivitySummary(
      userId,
      parseInt(days)
    );

    res.json({
      success: true,
      data: {
        userId,
        period: parseInt(days),
        summary,
      },
    });
  } catch (error) {
    console.error("Get user activity summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user activity summary",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get system activity overview
 * @route GET /api/audit-logs/system/activity
 * @access Private (Admin)
 */
const getSystemActivity = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const activity = await AuditLog.getSystemActivity(parseInt(days));

    res.json({
      success: true,
      data: {
        period: parseInt(days),
        dailyActivity: activity,
      },
    });
  } catch (error) {
    console.error("Get system activity error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching system activity",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get suspicious activities
 * @route GET /api/audit-logs/suspicious
 * @access Private (Admin)
 */
const getSuspiciousActivities = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const suspiciousActivities = await AuditLog.findSuspiciousActivities(
      parseInt(days)
    );

    res.json({
      success: true,
      data: {
        activities: suspiciousActivities,
        count: suspiciousActivities.length,
        period: parseInt(days),
      },
    });
  } catch (error) {
    console.error("Get suspicious activities error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching suspicious activities",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get failed login attempts
 * @route GET /api/audit-logs/failed-logins
 * @access Private (Admin)
 */
const getFailedLogins = async (req, res) => {
  try {
    const { days = 7, limit = 100 } = req.query;

    const failedLogins = await AuditLog.findFailedLogins(
      parseInt(days),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        failedLogins,
        count: failedLogins.length,
        period: parseInt(days),
      },
    });
  } catch (error) {
    console.error("Get failed logins error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching failed login attempts",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get logs by IP address
 * @route GET /api/audit-logs/ip/:ipAddress
 * @access Private (Admin)
 */
const getLogsByIpAddress = async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const { days = 7 } = req.query;

    const logs = await AuditLog.findByIpAddress(ipAddress, parseInt(days));

    res.json({
      success: true,
      data: {
        ipAddress,
        logs,
        count: logs.length,
        period: parseInt(days),
      },
    });
  } catch (error) {
    console.error("Get logs by IP error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching logs by IP address",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Detect unusual activity for user
 * @route GET /api/audit-logs/user/:userId/unusual
 * @access Private (Admin or Self)
 */
const detectUnusualActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;

    // Check permissions
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const analysis = await AuditLog.detectUnusualActivity(
      userId,
      parseInt(hours)
    );

    res.json({
      success: true,
      data: {
        userId,
        period: parseInt(hours),
        analysis,
        riskAssessment:
          analysis.suspiciousPatterns.length > 0
            ? "high"
            : analysis.failureRate > 10
            ? "medium"
            : "low",
      },
    });
  } catch (error) {
    console.error("Detect unusual activity error:", error);
    res.status(500).json({
      success: false,
      message: "Error detecting unusual activity",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Export compliance logs
 * @route POST /api/audit-logs/export-compliance
 * @access Private (Admin)
 */
const exportComplianceLogs = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId, startDate, endDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const logs = await AuditLog.exportLogsForCompliance(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    // In a real implementation, you'd generate a proper export file
    const exportData = {
      exportDate: new Date(),
      userId,
      dateRange: { startDate, endDate },
      totalLogs: logs.length,
      logs,
    };

    res.json({
      success: true,
      message: "Compliance export completed",
      data: exportData,
    });
  } catch (error) {
    console.error("Export compliance logs error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting compliance logs",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Cleanup old audit logs
 * @route DELETE /api/audit-logs/cleanup
 * @access Private (Admin)
 */
const cleanupOldLogs = async (req, res) => {
  try {
    const result = await AuditLog.cleanupOldLogs();

    res.json({
      success: true,
      message: "Old logs cleanup completed",
      data: result,
    });
  } catch (error) {
    console.error("Cleanup old logs error:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up old logs",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  getAuditLogs,
  getUserActivitySummary,
  getSystemActivity,
  getSuspiciousActivities,
  getFailedLogins,
  getLogsByIpAddress,
  detectUnusualActivity,
  exportComplianceLogs,
  cleanupOldLogs,
};
