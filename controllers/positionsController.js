/**
 * FIXED Positions Controller - Adds token extraction like in FileImport
 * Bypasses broken auth middleware by extracting userId from token directly
 */

const Position = require("../models/Position");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken"); // Add JWT for token verification

// 🔧 HELPER: Extract userId from token (reusable function)
const extractUserIdFromToken = (req) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new Error("No authentication token provided");
  }

  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key"
  );
  const userId = decoded.userId || decoded.id || decoded.user?.id;

  if (!userId) {
    throw new Error("Invalid token - no user ID found");
  }

  return userId;
};

/**
 * @desc    Get all positions for user
 * @route   GET /api/positions
 * @access  Private
 */
// controllers/positionsController.js - AKTUALIZACJA
// DODAJ na początek getPositions function:

const getPositions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      status,
      symbol,
      type,
      page = 1,
      limit = 50,
      sortBy = "openTime",
      sortOrder = "desc",
      portfolioId, // NOWY PARAMETR
    } = req.query;

    // Build query
    const query = { userId: req.user.id };

    // NOWE: Filter by portfolio if provided
    if (portfolioId) {
      query.portfolioId = portfolioId;
    }

    if (status) query.status = status;
    if (symbol) query.symbol = new RegExp(symbol, "i");
    if (type) query.type = type;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with population
    const [positions, totalCount] = await Promise.all([
      Position.find(query)
        .populate("portfolioId", "name broker currency") // NOWE: Populate portfolio info
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Position.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      message: "Positions retrieved successfully",
      data: {
        positions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage,
        },
      },
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

// DODAJ nową funkcję:
const getPositionsByPortfolio = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { status = "open" } = req.query;

    // Verify portfolio ownership
    const Portfolio = require("../models/Portfolio");
    const portfolio = await Portfolio.findOne({
      _id: portfolioId,
      userId: req.user.id,
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    const positions = await Position.find({
      portfolioId: portfolioId,
      status: status,
    }).sort({ openTime: -1 });

    res.json({
      success: true,
      message: "Portfolio positions retrieved successfully",
      data: {
        portfolio: {
          id: portfolio._id,
          name: portfolio.name,
          broker: portfolio.broker,
          currency: portfolio.currency,
        },
        positions,
        totalCount: positions.length,
      },
    });
  } catch (error) {
    console.error("Get positions by portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio positions",
      error: error.message,
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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const position = await Position.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

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

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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

    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

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

    // Generate unique position ID and brokerPositionId
    const positionId = `POS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const brokerPositionId = `BROKER_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}`;

    const position = new Position({
      userId,
      positionId,
      brokerPositionId, // ✅ FIXED: Provide unique brokerPositionId
      symbol: symbol.toUpperCase(),
      name,
      type,
      volume,
      openTime: new Date(),
      openPrice,
      currentPrice: marketPrice || openPrice,
      purchaseValue: openPrice * volume, // ✅ FIXED: Calculate purchaseValue
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

    // Handle auth errors
    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

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
    delete updateData.brokerPositionId;
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
      { _id: id, userId: new mongoose.Types.ObjectId(userId) },
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

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);
    const { marketPrice } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const position = await Position.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

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

    // Update market price (with fallback if updateMarketPrice method doesn't exist)
    try {
      await position.updateMarketPrice(marketPrice);
    } catch (methodError) {
      console.warn(
        "⚠️ updateMarketPrice method not available, using direct update"
      );
      position.currentPrice = marketPrice;
      await position.save();
    }

    res.json({
      success: true,
      message: "Market price updated successfully",
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Update market price error:", error);

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

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

    const position = await Position.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

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

    // Close position (with fallback if closePosition method doesn't exist)
    try {
      await position.closePosition(
        closePrice,
        closeTime ? new Date(closeTime) : new Date()
      );
    } catch (methodError) {
      console.warn(
        "⚠️ closePosition method not available, using direct update"
      );
      position.closePrice = closePrice;
      position.closeTime = closeTime ? new Date(closeTime) : new Date();
      position.status = "closed";
      await position.save();
    }

    res.json({
      success: true,
      message: "Position closed successfully",
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Close position error:", error);

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid position ID format",
      });
    }

    const position = await Position.findOneAndDelete({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

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

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);
    const { status } = req.query;

    // Use direct query instead of static method (with fallback)
    let positions;
    try {
      positions = await Position.findBySymbol(userId, symbol.toUpperCase());
    } catch (methodError) {
      console.warn("⚠️ findBySymbol method not available, using direct query");
      const query = {
        userId: new mongoose.Types.ObjectId(userId),
        symbol: new RegExp(symbol.toUpperCase(), "i"),
      };
      positions = await Position.find(query);
    }

    // Filter by status if provided
    let filteredPositions = positions;
    if (status) {
      filteredPositions = positions.filter((pos) => pos.status === status);
    }

    // Calculate symbol totals
    const totalVolume = filteredPositions.reduce(
      (sum, pos) => sum + (pos.volume || 0),
      0
    );
    const totalPL = filteredPositions.reduce(
      (sum, pos) => sum + (pos.grossPL || 0),
      0
    );
    const avgOpenPrice =
      filteredPositions.length > 0
        ? filteredPositions.reduce(
            (sum, pos) => sum + (pos.openPrice || 0),
            0
          ) / filteredPositions.length
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

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
    // 🔧 FIXED: Extract userId from token
    const userId = extractUserIdFromToken(req);

    const userQuery = { userId: new mongoose.Types.ObjectId(userId) };

    // Get counts and totals with fallback calculations
    let portfolioValue, totalPL;

    try {
      portfolioValue = await Position.calculatePortfolioValue(userId);
    } catch (methodError) {
      console.warn(
        "⚠️ calculatePortfolioValue method not available, using fallback"
      );
      const allPositions = await Position.find(userQuery);
      portfolioValue = allPositions.reduce(
        (sum, pos) => sum + (pos.purchaseValue || 0),
        0
      );
    }

    try {
      totalPL = await Position.calculateTotalPL(userId);
    } catch (methodError) {
      console.warn("⚠️ calculateTotalPL method not available, using fallback");
      const allPositions = await Position.find(userQuery);
      totalPL = {
        totalGrossPL: allPositions.reduce(
          (sum, pos) => sum + (pos.grossPL || 0),
          0
        ),
        totalNetPL: allPositions.reduce(
          (sum, pos) => sum + (pos.netPL || pos.grossPL || 0),
          0
        ),
      };
    }

    const [openPositions, closedPositions] = await Promise.all([
      Position.countDocuments({ ...userQuery, status: "open" }),
      Position.countDocuments({ ...userQuery, status: "closed" }),
    ]);

    // Get positions with largest gains/losses
    const topGainers = await Position.find({
      ...userQuery,
      grossPL: { $gt: 0 },
    })
      .sort({ grossPL: -1 })
      .limit(5)
      .select("symbol grossPL");

    const topLosers = await Position.find({ ...userQuery, grossPL: { $lt: 0 } })
      .sort({ grossPL: 1 })
      .limit(5)
      .select("symbol grossPL");

    res.json({
      success: true,
      data: {
        portfolioValue,
        totalPositions: openPositions + closedPositions,
        openPositions,
        closedPositions,
        totalPL: totalPL.totalGrossPL || totalPL,
        netPL: totalPL.totalNetPL || totalPL,
        topGainers,
        topLosers,
      },
    });
  } catch (error) {
    console.error("Get portfolio summary error:", error);

    if (
      error.message.includes("token") ||
      error.message.includes("authentication")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

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
