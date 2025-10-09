const PendingOrder = require("../models/PendingOrder");
const Position = require("../models/Position");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get pending orders with integrated analytics
 * @route GET /api/pending-orders
 * @access Private
 */
const getPendingOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      portfolioId,
      status = "pending",
      symbol,
      type,
      side,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeStats = false,
    } = req.query;

    // Build query
    const query = { userId };
    if (portfolioId) query.portfolioId = portfolioId;
    if (status !== "all") query.status = status;
    if (symbol) query.symbol = new RegExp(symbol, "i");
    if (type) query.type = type;
    if (side) query.side = side;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute main query
    const [orders, total] = await Promise.all([
      PendingOrder.find(query)
        .populate("portfolioId", "name broker currency")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      PendingOrder.countDocuments(query),
    ]);

    let responseData = {
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    };

    // Include statistics if requested
    if (includeStats === "true" || includeStats === true) {
      const allUserOrders = await PendingOrder.find({ userId });

      const statistics = {
        totalOrders: allUserOrders.length,
        pendingOrders: allUserOrders.filter((o) => o.status === "pending")
          .length,
        executedOrders: allUserOrders.filter((o) => o.status === "executed")
          .length,
        cancelledOrders: allUserOrders.filter((o) => o.status === "cancelled")
          .length,
        totalValue: allUserOrders.reduce(
          (sum, o) => sum + (o.purchaseValue || 0),
          0
        ),
        avgOrderSize:
          allUserOrders.length > 0
            ? allUserOrders.reduce(
                (sum, o) => sum + (o.purchaseValue || 0),
                0
              ) / allUserOrders.length
            : 0,
      };

      responseData.statistics = statistics;
    }

    res.json({
      success: true,
      message: "Pending orders retrieved successfully",
      data: responseData,
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
 * @desc Create new pending order
 * @route POST /api/pending-orders
 * @access Private
 */
const createPendingOrder = async (req, res) => {
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
      portfolioId,
      symbol,
      name,
      type = "limit",
      side,
      volume,
      price,
      stopPrice,
      expiryTime,
      currency = "PLN",
      exchange,
      notes,
      tags,
    } = req.body;

    // Validate portfolio if provided
    if (portfolioId) {
      const portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }
    }

    const orderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const order = new PendingOrder({
      userId,
      portfolioId: portfolioId || null,
      orderId,
      symbol: symbol.toUpperCase(),
      name,
      type,
      side: side.toUpperCase(),
      volume,
      price,
      stopPrice,
      purchaseValue: price * volume,
      createdAt: new Date(),
      expiryTime: expiryTime ? new Date(expiryTime) : undefined,
      currency: currency.toUpperCase(),
      exchange,
      notes: notes ? notes.trim() : undefined,
      tags: tags ? tags.map((tag) => tag.trim()) : [],
      status: "pending",
    });

    await order.save();

    // Populate portfolio info
    await order.populate("portfolioId", "name broker currency");

    res.status(201).json({
      success: true,
      message: "Pending order created successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Create pending order error:", error);

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
 * @desc Execute pending order (creates position if successful)
 * @route PUT /api/pending-orders/:id/execute
 * @access Private
 */
const executePendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      executedPrice,
      executedVolume,
      commission = 0,
      fees = 0,
      createPosition = true,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await PendingOrder.findOne({ _id: id, userId }).populate(
      "portfolioId",
      "name broker currency"
    );

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

    const volumeToExecute = executedVolume || order.volume;
    const isFullExecution = volumeToExecute >= order.volume;

    // Update order execution data
    order.execution = {
      executedPrice,
      executedVolume: volumeToExecute,
      commission,
      fees,
      executedTime: new Date(),
    };

    order.status = isFullExecution ? "executed" : "partial";
    if (!isFullExecution) {
      order.volume -= volumeToExecute; // Reduce remaining volume
    }

    await order.save();

    let newPosition = null;

    // Create position if requested and fully executed
    if (createPosition && isFullExecution) {
      try {
        const positionData = {
          userId,
          portfolioId: order.portfolioId?._id || null,
          positionId: `POS_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          brokerPositionId: `BROKER_${Date.now()}_${Math.floor(
            Math.random() * 1000
          )}`,
          symbol: order.symbol,
          name: order.name,
          type: order.side, // BUY or SELL
          volume: volumeToExecute,
          openTime: order.execution.executedTime,
          openPrice: executedPrice,
          currentPrice: executedPrice,
          purchaseValue: executedPrice * volumeToExecute,
          commission: commission,
          currency: order.currency,
          exchange: order.exchange,
          notes: `Created from order ${order.orderId}${
            notes ? `. ${notes}` : ""
          }`,
          tags: order.tags,
          status: "open",
        };

        newPosition = new Position(positionData);
        await newPosition.save();

        console.log(
          `✅ Created position from executed order: ${newPosition.symbol}`
        );
      } catch (positionError) {
        console.error(
          "Error creating position from order:",
          positionError.message
        );
        // Don't fail order execution if position creation fails
      }
    }

    res.json({
      success: true,
      message: isFullExecution
        ? "Order executed successfully"
        : "Order partially executed",
      data: {
        order,
        position: newPosition,
        remaining: isFullExecution ? 0 : order.volume,
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
 * @desc Cancel/Delete pending order
 * @route DELETE /api/pending-orders/:id
 * @access Private
 */
const cancelPendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permanent = false, reason } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    let order;

    if (permanent === "true") {
      // Hard delete
      order = await PendingOrder.findOneAndDelete({ _id: id, userId });
    } else {
      // Soft cancel
      order = await PendingOrder.findOneAndUpdate(
        { _id: id, userId },
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason || "Cancelled by user",
          notes: (existing) =>
            existing ? `${existing} [CANCELLED]` : "[CANCELLED]",
        },
        { new: true }
      );
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    res.json({
      success: true,
      message:
        permanent === "true"
          ? "Order deleted permanently"
          : "Order cancelled successfully",
      data: {
        order: {
          id: order._id,
          orderId: order.orderId,
          symbol: order.symbol,
          status: order.status,
        },
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

module.exports = {
  getPendingOrders, // ✅ SIMPLIFIED: Includes stats option
  createPendingOrder, // ✅ KEEP: Core functionality
  executePendingOrder, // ✅ SIMPLIFIED: Auto position creation
  cancelPendingOrder, // ✅ SIMPLIFIED: Cancel + Delete combined
};

// ❌ REMOVED METHODS (7 methods removed):
// - getPendingOrder (access via getPendingOrders with filtering)
// - updatePendingOrder (rarely used - orders should be cancelled/recreated)
// - deletePendingOrder (merged into cancelOrder)
// - getActiveOrders (replaced by status filtering)
// - getOrdersBySymbol (replaced by symbol filtering)
// - cleanupExpiredOrders (move to background job)
// - getPendingOrdersByPortfolio (replaced by portfolioId filtering)
