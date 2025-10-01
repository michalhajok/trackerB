const PendingOrder = require("../models/PendingOrder");
const Position = require("../models/Position");
const Portfolio = require("../models/Portfolio");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc    Get all pending orders for user
 * @route   GET /api/pending-orders
 * @access  Private
 */
const getPendingOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      symbol,
      type,
      side,
      page = 1,
      limit = 50,
      sortBy = "openTime",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { userId };
    if (status) query.status = status;
    if (symbol) query.symbol = new RegExp(symbol, "i");
    if (type) query.type = type;
    if (side) query.side = side;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute query with pagination
    const [orders, total] = await Promise.all([
      PendingOrder.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      PendingOrder.countDocuments(query),
    ]);

    // Get statistics
    const stats = await PendingOrder.getOrderStatistics(userId, 30);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        statistics: stats,
      },
    });
  } catch (error) {
    console.error("Get pending orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending orders",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get single pending order by ID
 * @route   GET /api/pending-orders/:id
 * @access  Private
 */
const getPendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await PendingOrder.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    res.json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Get pending order error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Create new pending order
 * @route   POST /api/pending-orders
 * @access  Private
 */
const createPendingOrder = async (req, res) => {
  try {
    // Check for validation errors
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
      symbol,
      name,
      type = "limit",
      side,
      volume,
      price,
      stopPrice,
      trailingAmount,
      trailingPercent,
      expiryTime,
      conditions = {},
      riskManagement = {},
      marketData = {},
      currency = "PLN",
      exchange,
      notes,
      tags,
    } = req.body;

    // Generate unique order ID
    const orderId = Date.now() + Math.floor(Math.random() * 1000);

    const order = new PendingOrder({
      userId,
      orderId,
      symbol: symbol.toUpperCase(),
      name,
      type,
      side,
      volume,
      price,
      stopPrice,
      trailingAmount,
      trailingPercent,
      purchaseValue: price ? price * volume : 0,
      openTime: new Date(),
      expiryTime: expiryTime ? new Date(expiryTime) : undefined,
      conditions: {
        timeInForce: conditions.timeInForce || "GTC",
        reduceOnly: conditions.reduceOnly || false,
        postOnly: conditions.postOnly || false,
        iceberg: conditions.iceberg || {},
      },
      riskManagement,
      marketData,
      currency,
      exchange,
      notes: notes ? notes.trim() : undefined,
      tags: tags ? tags.map((tag) => tag.trim()) : [],
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Pending order created successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Create pending order error:", error);

    // Handle duplicate order ID
    if (error.code === 11000 && error.keyPattern?.orderId) {
      return res.status(409).json({
        success: false,
        message: "Order ID already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating pending order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Update pending order
 * @route   PUT /api/pending-orders/:id
 * @access  Private
 */
const updatePendingOrder = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find the order first to check if it can be updated
    const existingOrder = await PendingOrder.findOne({ _id: id, userId });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    // Check if order can be modified
    if (!["pending", "partial"].includes(existingOrder.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update order that is not pending or partial",
      });
    }

    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.orderId;
    delete updateData.execution;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Uppercase symbol if provided
    if (updateData.symbol) {
      updateData.symbol = updateData.symbol.toUpperCase();
    }

    // Trim notes if provided
    if (updateData.notes) {
      updateData.notes = updateData.notes.trim();
    }

    // Trim tags if provided
    if (updateData.tags) {
      updateData.tags = updateData.tags.map((tag) => tag.trim());
    }

    // Update purchase value if price or volume changed
    if (updateData.price || updateData.volume) {
      const newPrice = updateData.price || existingOrder.price;
      const newVolume = updateData.volume || existingOrder.volume;
      updateData.purchaseValue = newPrice * newVolume;
    }

    const order = await PendingOrder.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Pending order updated successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Update pending order error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating pending order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Execute pending order (full or partial)
 * @route   PUT /api/pending-orders/:id/execute
 * @access  Private
 */
const executePendingOrder = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const {
      executedPrice,
      executedVolume,
      commission = 0,
      fees = 0,
      createPosition = true,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await PendingOrder.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    if (!["pending", "partial"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be executed",
      });
    }

    // Execute the order
    await order.executeOrder(executedPrice, executedVolume, commission, fees);

    let newPosition = null;

    // Create position if order is fully executed and createPosition is true
    if (order.status === "executed" && createPosition) {
      try {
        const positionData = {
          userId,
          positionId: Date.now() + Math.floor(Math.random() * 1000),
          symbol: order.symbol,
          name: order.name,
          type: order.side.toUpperCase(),
          volume: order.execution.executedVolume,
          openTime: order.execution.executedTime,
          openPrice: order.execution.executedPrice,
          marketPrice: order.execution.executedPrice,
          commission: order.execution.commission,
          currency: order.currency,
          exchange: order.exchange,
          notes: `Created from order ${order.orderId}${
            order.notes ? ". " + order.notes : ""
          }`,
          tags: order.tags,
          importedFrom: "order",
        };

        newPosition = new Position(positionData);
        await newPosition.save();

        // Update order with resulting position ID
        order.execution.resultingPositionId = newPosition.positionId;
        await order.save();
      } catch (positionError) {
        console.error("Error creating position from order:", positionError);
        // Don't fail the order execution if position creation fails
      }
    }

    res.json({
      success: true,
      message:
        order.status === "executed"
          ? "Order executed successfully"
          : "Order partially executed",
      data: {
        order,
        position: newPosition,
      },
    });
  } catch (error) {
    console.error("Execute order error:", error);
    res.status(500).json({
      success: false,
      message: "Error executing order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Cancel pending order
 * @route   PUT /api/pending-orders/:id/cancel
 * @access  Private
 */
const cancelPendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await PendingOrder.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    if (!["pending", "partial"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled",
      });
    }

    await order.cancelOrder(reason);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Delete pending order
 * @route   DELETE /api/pending-orders/:id
 * @access  Private
 */
const deletePendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await PendingOrder.findOneAndDelete({ _id: id, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    res.json({
      success: true,
      message: "Pending order deleted successfully",
      data: {
        deletedOrder: {
          id: order._id,
          orderId: order.orderId,
          symbol: order.symbol,
          status: order.status,
        },
      },
    });
  } catch (error) {
    console.error("Delete pending order error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting pending order",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get active orders
 * @route   GET /api/pending-orders/active
 * @access  Private
 */
const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const activeOrders = await PendingOrder.findActiveOrders(userId);

    res.json({
      success: true,
      data: {
        orders: activeOrders,
        count: activeOrders.length,
      },
    });
  } catch (error) {
    console.error("Get active orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching active orders",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get orders by symbol
 * @route   GET /api/pending-orders/symbol/:symbol
 * @access  Private
 */
const getOrdersBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    const userId = req.user.id;
    const { status } = req.query;

    const query = { userId, symbol: symbol.toUpperCase() };
    if (status) query.status = status;

    const orders = await PendingOrder.find(query).sort({ openTime: -1 });

    // Calculate symbol totals
    const totalVolume = orders.reduce((sum, order) => sum + order.volume, 0);
    const totalValue = orders.reduce((sum, order) => sum + order.orderValue, 0);

    res.json({
      success: true,
      data: {
        orders,
        summary: {
          symbol: symbol.toUpperCase(),
          totalOrders: orders.length,
          totalVolume,
          totalValue,
        },
      },
    });
  } catch (error) {
    console.error("Get orders by symbol error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders by symbol",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Cleanup expired orders
 * @route   POST /api/pending-orders/cleanup-expired
 * @access  Private (Admin)
 */
const cleanupExpiredOrders = async (req, res) => {
  try {
    const results = await PendingOrder.cleanupExpiredOrders();

    res.json({
      success: true,
      message: "Expired orders cleanup completed",
      data: {
        results,
        processedCount: results.length,
      },
    });
  } catch (error) {
    console.error("Cleanup expired orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up expired orders",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

const getPendingOrdersByPortfolio = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const orders = await PendingOrder.find({
      portfolioId,
      status: "pending",
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: { orders } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPendingOrders,
  getPendingOrder,
  createPendingOrder,
  updatePendingOrder,
  executePendingOrder,
  cancelPendingOrder,
  deletePendingOrder,
  getActiveOrders,
  getOrdersBySymbol,
  cleanupExpiredOrders,
  getPendingOrdersByPortfolio,
};
