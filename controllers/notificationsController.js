const Notification = require("../models/Notification");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all notifications for user
 * @route GET /api/notifications
 * @access Private
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      category,
      isRead,
      priority,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { userId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (priority) query.priority = priority;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute queries
    const [notifications, total, counts] = await Promise.all([
      Notification.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.getNotificationCounts(userId),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        counts,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get single notification by ID
 * @route GET /api/notifications/:id
 * @access Private
 */
const getNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      data: {
        notification,
      },
    });
  } catch (error) {
    console.error("Get notification error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notification",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create new notification
 * @route POST /api/notifications
 * @access Private
 */
const createNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const {
      title,
      message,
      type = "info",
      priority = "medium",
      category = "system",
      metadata = {},
      actions = [],
      channels = { inApp: true },
      expiresAt,
      scheduledFor,
    } = req.body;

    const notification = new Notification({
      userId,
      title: title.trim(),
      message: message.trim(),
      type,
      priority,
      category,
      metadata,
      actions,
      channels,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: {
        notification,
      },
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Mark notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: "Notification marked as read",
      data: {
        notification,
      },
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Mark multiple notifications as read
 * @route PUT /api/notifications/mark-read
 * @access Private
 */
const markMultipleAsRead = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { notificationIds } = req.body;

    const result = await Notification.markMultipleAsRead(
      userId,
      notificationIds
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Mark multiple as read error:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
      data: {
        deletedNotification: {
          id: notification._id,
          title: notification.title,
          type: notification.type,
        },
      },
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get unread notifications
 * @route GET /api/notifications/unread
 * @access Private
 */
const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const notifications = await Notification.findUnread(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
      },
    });
  } catch (error) {
    console.error("Get unread notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unread notifications",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get notifications by type
 * @route GET /api/notifications/type/:type
 * @access Private
 */
const getNotificationsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const validTypes = [
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
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification type. Valid types: ${validTypes.join(
          ", "
        )}`,
      });
    }

    const notifications = await Notification.findByType(
      userId,
      type,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        type,
        notifications,
        count: notifications.length,
      },
    });
  } catch (error) {
    console.error("Get notifications by type error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications by type",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Record notification click
 * @route POST /api/notifications/:id/click
 * @access Private
 */
const recordClick = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format",
      });
    }

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.recordClick();

    res.json({
      success: true,
      message: "Click recorded successfully",
      data: {
        clickCount: notification.clickCount,
      },
    });
  } catch (error) {
    console.error("Record click error:", error);
    res.status(500).json({
      success: false,
      message: "Error recording click",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create system notification (Admin only)
 * @route POST /api/notifications/system
 * @access Private (Admin)
 */
const createSystemNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { title, message, userIds, priority = "medium" } = req.body;

    const notifications = await Notification.createSystemNotification(
      title.trim(),
      message.trim(),
      userIds,
      priority
    );

    res.status(201).json({
      success: true,
      message: `System notification sent to ${notifications.length} users`,
      data: {
        notificationCount: notifications.length,
        sampleNotification: notifications[0],
      },
    });
  } catch (error) {
    console.error("Create system notification error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating system notification",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Cleanup old notifications
 * @route DELETE /api/notifications/cleanup
 * @access Private (Admin)
 */
const cleanupOldNotifications = async (req, res) => {
  try {
    const { daysOld = 90 } = req.query;

    const result = await Notification.cleanupOld(parseInt(daysOld));

    res.json({
      success: true,
      message: "Old notifications cleanup completed",
      data: {
        deletedCount: result.deletedCount,
        daysOld: parseInt(daysOld),
      },
    });
  } catch (error) {
    console.error("Cleanup notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up notifications",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
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
};
