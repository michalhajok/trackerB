const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getAuditLogs,
  getUserActivitySummary,
  getSystemActivity,
  getSuspiciousActivities,
  getFailedLogins,
  getLogsByIpAddress,
  detectUnusualActivity,
  exportComplianceLogs,
  cleanupOldLogs,
} = require("../controllers/auditLogController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/audit-logs
 * @desc Get audit logs (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/",
  [
    query("userId").optional().isMongoId().withMessage("Invalid user ID"),
    query("action")
      .optional()
      .isIn([
        "login",
        "logout",
        "register",
        "password_change",
        "password_reset",
        "create",
        "read",
        "update",
        "delete",
        "position_open",
        "position_close",
        "order_create",
        "order_execute",
        "cash_operation_create",
        "file_import",
        "report_generate",
        "user_ban",
        "system_maintenance",
        "unauthorized_access",
        "suspicious_activity",
        "rate_limit_exceeded",
      ])
      .withMessage("Invalid action type"),
    query("resourceType")
      .optional()
      .isIn([
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
      ])
      .withMessage("Invalid resource type"),
    query("success")
      .optional()
      .isBoolean()
      .withMessage("Success must be boolean"),
    query("riskLevel")
      .optional()
      .isIn(["low", "medium", "high", "critical"])
      .withMessage("Invalid risk level"),
    query("ipAddress")
      .optional()
      .isIP()
      .withMessage("Invalid IP address format"),
    query("days")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Days must be between 1 and 365"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be between 1 and 1000"),
  ],
  getAuditLogs
);

/**
 * @route GET /api/audit-logs/system/activity
 * @desc Get system activity overview (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/system/activity",
  [
    query("days")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Days must be between 1 and 30"),
  ],
  getSystemActivity
);

/**
 * @route GET /api/audit-logs/suspicious
 * @desc Get suspicious activities (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/suspicious",
  [
    query("days")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Days must be between 1 and 30"),
  ],
  getSuspiciousActivities
);

/**
 * @route GET /api/audit-logs/failed-logins
 * @desc Get failed login attempts (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/failed-logins",
  [
    query("days")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Days must be between 1 and 30"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage("Limit must be between 1 and 500"),
  ],
  getFailedLogins
);

/**
 * @route GET /api/audit-logs/user/:userId/summary
 * @desc Get user activity summary
 * @access Private (Admin or Self)
 */
router.get(
  "/user/:userId/summary",
  [
    param("userId").isMongoId().withMessage("Invalid user ID"),
    query("days")
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage("Days must be between 1 and 90"),
  ],
  getUserActivitySummary
);

/**
 * @route GET /api/audit-logs/user/:userId/unusual
 * @desc Detect unusual activity for user
 * @access Private (Admin or Self)
 */
router.get(
  "/user/:userId/unusual",
  [
    param("userId").isMongoId().withMessage("Invalid user ID"),
    query("hours")
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage("Hours must be between 1 and 168 (7 days)"),
  ],
  detectUnusualActivity
);

/**
 * @route GET /api/audit-logs/ip/:ipAddress
 * @desc Get logs by IP address (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/ip/:ipAddress",
  [
    param("ipAddress").isIP().withMessage("Invalid IP address format"),
    query("days")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Days must be between 1 and 30"),
  ],
  getLogsByIpAddress
);

/**
 * @route POST /api/audit-logs/export-compliance
 * @desc Export compliance logs (Admin only)
 * @access Private (Admin)
 */
router.post(
  "/export-compliance",
  [
    body("userId").isMongoId().withMessage("Invalid user ID"),
    body("startDate")
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    body("endDate")
      .isISO8601()
      .withMessage("End date must be a valid ISO date")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
          throw new Error("End date must be after start date");
        }
        return true;
      }),
  ],
  exportComplianceLogs
);

/**
 * @route DELETE /api/audit-logs/cleanup
 * @desc Cleanup old audit logs (Admin only)
 * @access Private (Admin)
 */
router.delete("/cleanup", cleanupOldLogs);

/**
 * @route GET /api/audit-logs/health
 * @desc Health check for audit logs service
 * @access Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Audit logs service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
    capabilities: {
      logging: true,
      compliance: true,
      realTimeMonitoring: true,
      securityAnalysis: true,
      dataRetention: true,
    },
  });
});

module.exports = router;
