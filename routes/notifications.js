const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getNotifications,
  getNotification,
  createNotification,
  markAsRead,
  markMultipleAsRead,
  deleteNotification,
  getUnreadNotifications,
  getNotificationsByType,
  recordClick,
  createSystemNotification,
  cleanupOldNotifications,
} = require("../controllers/notificationsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/notifications
 * @desc Get all notifications for user
 * @access Private
 */
router.get(
  "/",
  [
    query("type")
      .optional()
      .isIn([
        "info",
        "warning",
        "error",
        "success",
        "trade_execution",
        "price_alert",
        "portfolio_update",
        "system",
        "security",
        "maintenance",
      ])
      .withMessage("Invalid notification type"),
    query("category")
      .optional()
      .isIn([
        "account",
        "trading",
        "portfolio",
        "security",
        "system",
        "marketing",
        "support",
      ])
      .withMessage("Invalid notification category"),
    query("isRead")
      .optional()
      .isBoolean()
      .withMessage("isRead must be boolean"),
    query("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority level"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn(["createdAt", "priority", "type"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getNotifications
);

/**
 * @route GET /api/notifications/unread
 * @desc Get unread notifications
 * @access Private
 */
router.get(
  "/unread",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  getUnreadNotifications
);

/**
 * @route GET /api/notifications/type/:type
 * @desc Get notifications by type
 * @access Private
 */
router.get(
  "/type/:type",
  [
    param("type")
      .isIn([
        "info",
        "warning",
        "error",
        "success",
        "trade_execution",
        "price_alert",
        "portfolio_update",
        "system",
        "security",
        "maintenance",
      ])
      .withMessage("Invalid notification type"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getNotificationsByType
);

/**
 * @route GET /api/notifications/:id
 * @desc Get single notification by ID
 * @access Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  getNotification
);

/**
 * @route POST /api/notifications
 * @desc Create new notification
 * @access Private
 */
router.post(
  "/",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ max: 1000 })
      .withMessage("Message cannot exceed 1000 characters"),
    body("type")
      .optional()
      .isIn([
        "info",
        "warning",
        "error",
        "success",
        "trade_execution",
        "price_alert",
        "portfolio_update",
        "system",
        "security",
        "maintenance",
      ])
      .withMessage("Invalid notification type"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority level"),
    body("category")
      .optional()
      .isIn([
        "account",
        "trading",
        "portfolio",
        "security",
        "system",
        "marketing",
        "support",
      ])
      .withMessage("Invalid notification category"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Expires at must be a valid ISO date"),
    body("scheduledFor")
      .optional()
      .isISO8601()
      .withMessage("Scheduled for must be a valid ISO date"),
  ],
  createNotification
);

/**
 * @route POST /api/notifications/system
 * @desc Create system notification (Admin only)
 * @access Private (Admin)
 */
router.post(
  "/system",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ max: 1000 })
      .withMessage("Message cannot exceed 1000 characters"),
    body("userIds")
      .optional()
      .isArray()
      .withMessage("User IDs must be an array"),
    body("userIds.*")
      .optional()
      .isMongoId()
      .withMessage("Each user ID must be a valid MongoDB ID"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority level"),
  ],
  createSystemNotification
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put(
  "/:id/read",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  markAsRead
);

/**
 * @route PUT /api/notifications/mark-read
 * @desc Mark multiple notifications as read
 * @access Private
 */
router.put(
  "/mark-read",
  [
    body("notificationIds")
      .isArray({ min: 1 })
      .withMessage("Notification IDs array is required"),
    body("notificationIds.*")
      .isMongoId()
      .withMessage("Each notification ID must be a valid MongoDB ID"),
  ],
  markMultipleAsRead
);

/**
 * @route POST /api/notifications/:id/click
 * @desc Record notification click
 * @access Private
 */
router.post(
  "/:id/click",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  recordClick
);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  deleteNotification
);

/**
 * @route DELETE /api/notifications/cleanup
 * @desc Cleanup old notifications (Admin only)
 * @access Private (Admin)
 */
router.delete(
  "/cleanup",
  [
    query("daysOld")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Days old must be between 1 and 365"),
  ],
  cleanupOldNotifications
);

/**
 * @route GET /api/notifications/health
 * @desc Health check for notifications service
 * @access Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Notifications service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
