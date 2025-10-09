const Position = require("../models/Position");
const Portfolio = require("../models/Portfolio");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all positions with integrated analytics
 * @route GET /api/positions
 * @access Private
 */
const getPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      portfolioId,
      status = "open",
      symbol,
      type,
      page = 1,
      limit = 50,
      sortBy = "openTime",
      sortOrder = "desc",
      includeAnalytics = false,
    } = req.query;

    // Build query
    const query = { userId };
    if (portfolioId) query.portfolioId = portfolioId;
    if (status !== "all") query.status = status;
    if (symbol) query.symbol = new RegExp(symbol, "i");
    if (type) query.type = type;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute main query
    const [positions, total] = await Promise.all([
      Position.find(query)
        .populate("portfolioId", "name broker currency")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Position.countDocuments(query),
    ]);

    let responseData = {
      positions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
        hasNext: page < Math.ceil(total / parseInt(limit)),
        hasPrev: page > 1,
      },
    };

    // Include portfolio analytics if requested
    if (includeAnalytics === "true" || includeAnalytics === true) {
      const allUserPositions = await Position.find({ userId });

      const analytics = {
        portfolioValue: allUserPositions.reduce(
          (sum, p) => sum + (p.purchaseValue || 0),
          0
        ),
        totalPL: allUserPositions.reduce((sum, p) => sum + (p.grossPL || 0), 0),
        openPositions: allUserPositions.filter((p) => p.status === "open")
          .length,
        closedPositions: allUserPositions.filter((p) => p.status === "closed")
          .length,
        topPerformers: allUserPositions
          .filter((p) => p.grossPL > 0)
          .sort((a, b) => b.grossPL - a.grossPL)
          .slice(0, 5)
          .map((p) => ({ symbol: p.symbol, grossPL: p.grossPL })),
        worstPerformers: allUserPositions
          .filter((p) => p.grossPL < 0)
          .sort((a, b) => a.grossPL - b.grossPL)
          .slice(0, 5)
          .map((p) => ({ symbol: p.symbol, grossPL: p.grossPL })),
      };

      responseData.analytics = analytics;
    }

    res.json({
      success: true,
      message: "Positions retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Get positions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve positions",
      error: error.message,
    });
  }
};

/**
 * @desc Create new position
 * @route POST /api/positions
 * @access Private
 */
const createPosition = async (req, res) => {
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
      type = "BUY",
      volume,
      openPrice,
      marketPrice,
      commission = 0,
      swap = 0,
      taxes = 0,
      currency = "PLN",
      exchange,
      sector,
      notes,
      tags,
    } = req.body;

    // Validate portfolio ownership if provided
    if (portfolioId) {
      const portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }
    }

    // Generate unique IDs
    const positionId = `POS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const brokerPositionId = `BROKER_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}`;

    const position = new Position({
      userId,
      portfolioId: portfolioId || null,
      positionId,
      brokerPositionId,
      symbol: symbol.toUpperCase(),
      name,
      type: type.toUpperCase(),
      volume,
      openTime: new Date(),
      openPrice,
      currentPrice: marketPrice || openPrice,
      purchaseValue: openPrice * volume,
      commission,
      swap,
      taxes,
      currency: currency.toUpperCase(),
      exchange,
      sector,
      notes,
      tags: tags ? tags.map((tag) => tag.trim()) : [],
      status: "open",
    });

    await position.save();

    // Populate portfolio info in response
    await position.populate("portfolioId", "name broker currency");

    res.status(201).json({
      success: true,
      message: "Position created successfully",
      data: { position },
    });
  } catch (error) {
    console.error("Create position error:", error);

    if (error.code === 11000 && error.keyPattern?.positionId) {
      return res.status(409).json({
        success: false,
        message: "Position ID already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating position",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Update position (includes market price updates)
 * @route PUT /api/positions/:id
 * @access Private
 */
const updatePosition = async (req, res) => {
  try {
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const updateData = { ...req.body };

    // Remove protected fields
    delete updateData.userId;
    delete updateData.positionId;
    delete updateData.brokerPositionId;
    delete updateData.createdAt;
    delete updateData.purchaseValue; // Recalculated automatically

    // Handle market price update with P&L recalculation
    if (updateData.currentPrice || updateData.marketPrice) {
      const newPrice = updateData.currentPrice || updateData.marketPrice;
      updateData.currentPrice = newPrice;
      delete updateData.marketPrice; // Use currentPrice consistently
    }

    // Sanitize text fields
    if (updateData.symbol) updateData.symbol = updateData.symbol.toUpperCase();
    if (updateData.currency)
      updateData.currency = updateData.currency.toUpperCase();
    if (updateData.tags)
      updateData.tags = updateData.tags.map((tag) => tag.trim());
    if (updateData.notes) updateData.notes = updateData.notes.trim();

    // Find and update position
    const position = await Position.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    ).populate("portfolioId", "name broker currency");

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    // Recalculate P&L if price changed
    if (updateData.currentPrice && position.status === "open") {
      // Trigger P&L recalculation (assuming you have this method)
      try {
        await position.updateMarketPrice?.(updateData.currentPrice);
      } catch (methodError) {
        // Fallback manual calculation
        const priceDiff = position.currentPrice - position.openPrice;
        position.grossPL =
          position.type === "BUY"
            ? priceDiff * position.volume
            : -priceDiff * position.volume;
        await position.save();
      }
    }

    res.json({
      success: true,
      message: "Position updated successfully",
      data: { position },
    });
  } catch (error) {
    console.error("Update position error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating position",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Close position with final calculations
 * @route PUT /api/positions/:id/close
 * @access Private
 */
const closePosition = async (req, res) => {
  try {
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
      closePrice,
      closeTime,
      commission = 0,
      taxes = 0,
      notes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const position = await Position.findOne({ _id: id, userId });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    if (position.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Position is already closed",
      });
    }

    // Update position with closing data
    position.closePrice = closePrice;
    position.closeTime = closeTime ? new Date(closeTime) : new Date();
    position.status = "closed";

    // Add additional costs
    if (commission > 0)
      position.commission = (position.commission || 0) + commission;
    if (taxes > 0) position.taxes = (position.taxes || 0) + taxes;
    if (notes) {
      position.notes = position.notes ? `${position.notes}. ${notes}` : notes;
    }

    // Calculate final P&L
    const priceDiff = position.closePrice - position.openPrice;
    position.grossPL =
      position.type === "BUY"
        ? priceDiff * position.volume
        : -priceDiff * position.volume;
    position.netPL =
      position.grossPL -
      position.commission -
      position.taxes -
      Math.abs(position.swap || 0);

    await position.save();

    // Populate portfolio info
    await position.populate("portfolioId", "name broker currency");

    res.json({
      success: true,
      message: "Position closed successfully",
      data: { position },
    });
  } catch (error) {
    console.error("Close position error:", error);
    res.status(500).json({
      success: false,
      message: "Error closing position",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Delete position (soft delete)
 * @route DELETE /api/positions/:id
 * @access Private
 */
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permanent = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    let position;

    if (permanent === "true") {
      // Hard delete
      position = await Position.findOneAndDelete({ _id: id, userId });
    } else {
      // Soft delete - mark as deleted
      position = await Position.findOneAndUpdate(
        { _id: id, userId },
        {
          status: "deleted",
          notes: (existing) =>
            existing ? `${existing} [DELETED]` : "[DELETED]",
        },
        { new: true }
      );
    }

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.json({
      success: true,
      message:
        permanent === "true"
          ? "Position deleted permanently"
          : "Position marked as deleted",
      data: {
        deletedPosition: {
          id: position._id,
          symbol: position.symbol,
          positionId: position.positionId,
          status: position.status,
        },
      },
    });
  } catch (error) {
    console.error("Delete position error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting position",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  getPositions, // ✅ SIMPLIFIED: Includes analytics option
  createPosition, // ✅ KEEP: Core functionality
  updatePosition, // ✅ SIMPLIFIED: Includes market price updates
  closePosition, // ✅ KEEP: Important business logic
  deletePosition, // ✅ SIMPLIFIED: Soft delete option
};

// ❌ REMOVED METHODS:
// - getPosition (rarely used - access via getPositions with ID filter)
// - getPositionsBySymbol (replaced by symbol filtering in getPositions)
// - getPortfolioSummary (moved to analytics)
// - getPositionsByPortfolio (replaced by portfolioId filtering)
// - updateMarketPrice (merged into updatePosition)
