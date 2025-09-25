const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    notificationId: {
      type: String,
      required: [true, "Notification ID is required"],
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [1000, "Message cannot exceed 1000 characters"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: {
        values: [
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
        ],
        message: "Invalid notification type",
      },
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      enum: [
        "account",
        "trading",
        "portfolio",
        "security",
        "system",
        "marketing",
        "support",
      ],
      default: "system",
      index: true,
    },
    // Additional data for context-specific notifications
    metadata: {
      // For trade-related notifications
      positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Position",
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PendingOrder",
      },
      symbol: {
        type: String,
        uppercase: true,
      },
      // For price alert notifications
      alertPrice: {
        type: Number,
      },
      currentPrice: {
        type: Number,
      },
      // For system notifications
      systemComponent: {
        type: String,
      },
      // Generic additional data
      extra: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    // Action buttons for interactive notifications
    actions: [
      {
        label: {
          type: String,
          maxlength: 50,
        },
        type: {
          type: String,
          enum: ["link", "action", "dismiss"],
          default: "link",
        },
        url: {
          type: String,
        },
        actionId: {
          type: String,
        },
        style: {
          type: String,
          enum: ["primary", "secondary", "danger", "success"],
          default: "primary",
        },
      },
    ],
    // Delivery channels
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
    },
    // Delivery status
    deliveryStatus: {
      inApp: {
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
      },
      email: {
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
        error: {
          type: String,
        },
      },
      push: {
        delivered: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
        },
        error: {
          type: String,
        },
      },
    },
    // Expiry and scheduling
    expiresAt: {
      type: Date,
      index: { expires: 0 },
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    // Tracking
    clickCount: {
      type: Number,
      default: 0,
    },
    lastClickedAt: {
      type: Date,
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
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1 });
notificationSchema.index({ scheduledFor: 1 }, { sparse: true });

// Virtual for age in minutes
notificationSchema.virtual("ageInMinutes").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60));
});

// Virtual for formatted time
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
});

// Pre-save middleware
notificationSchema.pre("save", function (next) {
  if (!this.notificationId) {
    this.notificationId = `notif_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  next();
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Instance method to mark as unread
notificationSchema.methods.markAsUnread = function () {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

// Instance method to record click
notificationSchema.methods.recordClick = function () {
  this.clickCount += 1;
  this.lastClickedAt = new Date();
  return this.save();
};

// Static method to find unread notifications
notificationSchema.statics.findUnread = function (userId, limit = 20) {
  return this.find({ userId, isRead: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find by type
notificationSchema.statics.findByType = function (userId, type, limit = 50) {
  return this.find({ userId, type }).sort({ createdAt: -1 }).limit(limit);
};

// Static method to get notification counts
notificationSchema.statics.getNotificationCounts = async function (userId) {
  const pipeline = [
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
        byType: {
          $push: {
            type: "$type",
            isRead: "$isRead",
          },
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  if (result.length === 0) {
    return { total: 0, unread: 0, byType: {} };
  }

  const stats = result[0];
  const typeStats = {};

  stats.byType.forEach((item) => {
    if (!typeStats[item.type]) {
      typeStats[item.type] = { total: 0, unread: 0 };
    }
    typeStats[item.type].total += 1;
    if (!item.isRead) {
      typeStats[item.type].unread += 1;
    }
  });

  return {
    total: stats.total,
    unread: stats.unread,
    byType: typeStats,
  };
};

// Static method to mark multiple as read
notificationSchema.statics.markMultipleAsRead = function (
  userId,
  notificationIds
) {
  return this.updateMany(
    {
      userId,
      _id: { $in: notificationIds },
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
};

// Static method to clean up old notifications
notificationSchema.statics.cleanupOld = function (daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

// Static method to create system notification
notificationSchema.statics.createSystemNotification = async function (
  title,
  message,
  userIds = null,
  priority = "medium"
) {
  const notifications = [];

  // If no specific users, send to all active users
  if (!userIds) {
    const User = require("./User");
    const activeUsers = await User.find({ isActive: true }).select("_id");
    userIds = activeUsers.map((user) => user._id);
  }

  for (const userId of userIds) {
    notifications.push({
      userId,
      title,
      message,
      type: "system",
      priority,
      category: "system",
    });
  }

  return this.insertMany(notifications);
};

module.exports = mongoose.model("Notification", notificationSchema);
