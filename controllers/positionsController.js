const Position = require("../models/Position");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc    Get all positions for user
 * @route   GET /api/positions
 * @access  Private
 */
const getPositions = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      symbol,
      type,
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

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute query with pagination
    const [positions, total] = await Promise.all([
      Position.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Position.countDocuments(query),
    ]);

    // Calculate totals
    const totals = await Position.calculateTotalPL(userId, status);

    res.json({
      success: true,
      data: {
        positions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        totals,
      },
    });
  } catch (error) {
    console.error("Get positions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching positions",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get single position by ID
 * @route   GET /api/positions/:id
 * @access  Private
 */
const getPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
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

    res.json({
      success: true,
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Get position error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching position",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Create new position
 * @route   POST /api/positions
 * @access  Private
 */
const createPosition = async (req, res) => {
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

    // Generate unique position ID
    const positionId = Date.now() + Math.floor(Math.random() * 1000);

    const position = new Position({
      userId,
      positionId,
      symbol: symbol.toUpperCase(),
      name,
      type,
      volume,
      openTime: new Date(),
      openPrice,
      marketPrice: marketPrice || openPrice,
      commission,
      swap,
      taxes,
      currency,
      exchange,
      sector,
      notes,
      tags: tags ? tags.map((tag) => tag.trim()) : [],
    });

    await position.save();

    res.status(201).json({
      success: true,
      message: "Position created successfully",
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Create position error:", error);

    // Handle duplicate position ID
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
 * @desc    Update position
 * @route   PUT /api/positions/:id
 * @access  Private
 */
const updatePosition = async (req, res) => {
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
        message: "Invalid position ID format",
      });
    }

    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.positionId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Uppercase symbol if provided
    if (updateData.symbol) {
      updateData.symbol = updateData.symbol.toUpperCase();
    }

    // Trim tags if provided
    if (updateData.tags) {
      updateData.tags = updateData.tags.map((tag) => tag.trim());
    }

    const position = await Position.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.json({
      success: true,
      message: "Position updated successfully",
      data: {
        position,
      },
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
 * @desc    Update market price for position
 * @route   PUT /api/positions/:id/market-price
 * @access  Private
 */
const updateMarketPrice = async (req, res) => {
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
    const { marketPrice } = req.body;

    // Validate ObjectId
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
        message: "Cannot update market price for closed position",
      });
    }

    await position.updateMarketPrice(marketPrice);

    res.json({
      success: true,
      message: "Market price updated successfully",
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Update market price error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating market price",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Close position
 * @route   PUT /api/positions/:id/close
 * @access  Private
 */
const closePosition = async (req, res) => {
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
      closePrice,
      closeTime,
      commission = 0,
      taxes = 0,
      notes,
    } = req.body;

    // Validate ObjectId
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

    // Add additional commission and taxes if provided
    if (commission > 0) {
      position.commission = (position.commission || 0) + commission;
    }
    if (taxes > 0) {
      position.taxes = (position.taxes || 0) + taxes;
    }

    // Add notes if provided
    if (notes) {
      position.notes = position.notes ? `${position.notes}. ${notes}` : notes;
    }

    await position.closePosition(
      closePrice,
      closeTime ? new Date(closeTime) : new Date()
    );

    res.json({
      success: true,
      message: "Position closed successfully",
      data: {
        position,
      },
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
 * @desc    Delete position
 * @route   DELETE /api/positions/:id
 * @access  Private
 */
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const position = await Position.findOneAndDelete({ _id: id, userId });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.json({
      success: true,
      message: "Position deleted successfully",
      data: {
        deletedPosition: {
          id: position._id,
          symbol: position.symbol,
          positionId: position.positionId,
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

/**
 * @desc    Get positions by symbol
 * @route   GET /api/positions/symbol/:symbol
 * @access  Private
 */
const getPositionsBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    const userId = req.user.id;
    const { status } = req.query;

    const positions = await Position.findBySymbol(userId, symbol.toUpperCase());

    // Filter by status if provided
    let filteredPositions = positions;
    if (status) {
      filteredPositions = positions.filter((pos) => pos.status === status);
    }

    // Calculate symbol totals
    const totalVolume = filteredPositions.reduce(
      (sum, pos) => sum + pos.volume,
      0
    );
    const totalPL = filteredPositions.reduce(
      (sum, pos) => sum + (pos.grossPL || 0),
      0
    );
    const avgOpenPrice =
      filteredPositions.length > 0
        ? filteredPositions.reduce((sum, pos) => sum + pos.openPrice, 0) /
          filteredPositions.length
        : 0;

    res.json({
      success: true,
      data: {
        positions: filteredPositions,
        summary: {
          symbol: symbol.toUpperCase(),
          totalPositions: filteredPositions.length,
          totalVolume,
          totalPL,
          avgOpenPrice,
        },
      },
    });
  } catch (error) {
    console.error("Get positions by symbol error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching positions by symbol",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get portfolio summary
 * @route   GET /api/positions/portfolio/summary
 * @access  Private
 */
const getPortfolioSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const [portfolioValue, openPositions, closedPositions, totalPL] =
      await Promise.all([
        Position.calculatePortfolioValue(userId),
        Position.find({ userId, status: "open" }).countDocuments(),
        Position.find({ userId, status: "closed" }).countDocuments(),
        Position.calculateTotalPL(userId),
      ]);

    // Get positions with largest gains/losses
    const topGainers = await Position.find({ userId, grossPL: { $gt: 0 } })
      .sort({ grossPL: -1 })
      .limit(5)
      .select("symbol grossPL plPercentage");

    const topLosers = await Position.find({ userId, grossPL: { $lt: 0 } })
      .sort({ grossPL: 1 })
      .limit(5)
      .select("symbol grossPL plPercentage");

    res.json({
      success: true,
      data: {
        portfolioValue,
        totalPositions: openPositions + closedPositions,
        openPositions,
        closedPositions,
        totalPL: totalPL.totalGrossPL,
        netPL: totalPL.totalNetPL,
        topGainers,
        topLosers,
      },
    });
  } catch (error) {
    console.error("Get portfolio summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching portfolio summary",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  getPositions,
  getPosition,
  createPosition,
  updatePosition,
  updateMarketPrice,
  closePosition,
  deletePosition,
  getPositionsBySymbol,
  getPortfolioSummary,
};
