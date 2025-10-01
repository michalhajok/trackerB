const Watchlist = require("../models/Watchlist");
const Portfolio = require("../models/Portfolio");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all watchlists for user
 * @route GET /api/watchlists
 * @access Private
 */
const getWatchlists = async (req, res) => {
  try {
    const userId = req.user.id;

    const watchlists = await Watchlist.findUserWatchlists(userId);

    res.json({
      success: true,
      data: {
        watchlists,
        count: watchlists.length,
      },
    });
  } catch (error) {
    console.error("Get watchlists error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching watchlists",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get single watchlist by ID
 * @route GET /api/watchlists/:id
 * @access Private
 */
const getWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({
      $or: [
        { _id: id, userId },
        { _id: id, isPublic: true },
        { _id: id, "shares.userId": userId },
      ],
    }).populate("shares.userId", "name");

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    // Update view stats if user owns the watchlist
    if (watchlist.userId.toString() === userId) {
      watchlist.stats.viewCount += 1;
      watchlist.stats.lastViewed = new Date();
      await watchlist.save();
    }

    res.json({
      success: true,
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Get watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create new watchlist
 * @route POST /api/watchlists
 * @access Private
 */
const createWatchlist = async (req, res) => {
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
      name,
      description,
      isDefault = false,
      isPublic = false,
      color = "blue",
      icon = "star",
      settings = {},
    } = req.body;

    // Check if trying to create another default watchlist
    if (isDefault) {
      const existingDefault = await Watchlist.findDefaultWatchlist(userId);
      if (existingDefault) {
        return res.status(400).json({
          success: false,
          message: "Default watchlist already exists",
        });
      }
    }

    const watchlist = new Watchlist({
      userId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      isDefault,
      isPublic,
      color,
      icon,
      settings: {
        notifications: {
          priceAlerts: settings.notifications?.priceAlerts ?? true,
          email: settings.notifications?.email ?? false,
          push: settings.notifications?.push ?? true,
        },
        display: {
          sortBy: settings.display?.sortBy || "custom",
          sortOrder: settings.display?.sortOrder || "asc",
          showColumns: settings.display?.showColumns || {
            price: true,
            change: true,
            volume: false,
            marketCap: false,
            sector: false,
          },
        },
        refreshInterval: settings.refreshInterval || 5,
      },
    });

    await watchlist.save();

    res.status(201).json({
      success: true,
      message: "Watchlist created successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Create watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Update watchlist
 * @route PUT /api/watchlists/:id
 * @access Private
 */
const updateWatchlist = async (req, res) => {
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
        message: "Invalid watchlist ID format",
      });
    }

    const updateData = { ...req.body };
    delete updateData.userId;
    delete updateData.items; // Items should be updated via separate endpoints

    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    if (updateData.description) {
      updateData.description = updateData.description.trim();
    }

    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    res.json({
      success: true,
      message: "Watchlist updated successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Update watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Delete watchlist
 * @route DELETE /api/watchlists/:id
 * @access Private
 */
const deleteWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    if (watchlist.isDefault) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete default watchlist",
      });
    }

    await watchlist.deleteOne();

    res.json({
      success: true,
      message: "Watchlist deleted successfully",
      data: {
        deletedWatchlist: {
          id: watchlist._id,
          name: watchlist.name,
        },
      },
    });
  } catch (error) {
    console.error("Delete watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Add symbol to watchlist
 * @route POST /api/watchlists/:id/symbols
 * @access Private
 */
const addSymbol = async (req, res) => {
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
    const symbolData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    await watchlist.addSymbol(symbolData);

    res.status(201).json({
      success: true,
      message: "Symbol added to watchlist successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Add symbol error:", error);
    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error adding symbol to watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Remove symbol from watchlist
 * @route DELETE /api/watchlists/:id/symbols/:symbol
 * @access Private
 */
const removeSymbol = async (req, res) => {
  try {
    const { id, symbol } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    await watchlist.removeSymbol(symbol);

    res.json({
      success: true,
      message: "Symbol removed from watchlist successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Remove symbol error:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error removing symbol from watchlist",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Add price alert to symbol
 * @route POST /api/watchlists/:id/symbols/:symbol/alerts
 * @access Private
 */
const addPriceAlert = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id, symbol } = req.params;
    const userId = req.user.id;
    const alertData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    await watchlist.addPriceAlert(symbol, alertData);

    res.status(201).json({
      success: true,
      message: "Price alert added successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Add price alert error:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error adding price alert",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Remove price alert
 * @route DELETE /api/watchlists/:id/symbols/:symbol/alerts/:alertId
 * @access Private
 */
const removePriceAlert = async (req, res) => {
  try {
    const { id, symbol, alertId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    await watchlist.removePriceAlert(symbol, alertId);

    res.json({
      success: true,
      message: "Price alert removed successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Remove price alert error:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error removing price alert",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Update market data for watchlist
 * @route PUT /api/watchlists/:id/market-data
 * @access Private
 */
const updateMarketData = async (req, res) => {
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
    const { marketData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID format",
      });
    }

    const watchlist = await Watchlist.findOne({ _id: id, userId });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    await watchlist.updateMarketData(marketData);

    res.json({
      success: true,
      message: "Market data updated successfully",
      data: {
        watchlist,
      },
    });
  } catch (error) {
    console.error("Update market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating market data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get public watchlists
 * @route GET /api/watchlists/public
 * @access Public
 */
const getPublicWatchlists = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const watchlists = await Watchlist.findPublicWatchlists(
      parseInt(limit),
      skip
    );

    res.json({
      success: true,
      data: {
        watchlists,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get public watchlists error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching public watchlists",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get watchlist statistics
 * @route GET /api/watchlists/statistics
 * @access Private
 */
const getWatchlistStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Watchlist.getWatchlistStats(userId);

    res.json({
      success: true,
      data: {
        statistics: stats,
      },
    });
  } catch (error) {
    console.error("Get watchlist statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching watchlist statistics",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

const getWatchlistsByPortfolio = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const lists = await Watchlist.find({ portfolioId })
      .populate("items")
      .sort({ name: 1 });
    res.json({ success: true, data: { watchlists: lists } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getWatchlists,
  getWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  addSymbol,
  removeSymbol,
  addPriceAlert,
  removePriceAlert,
  updateMarketData,
  getPublicWatchlists,
  getWatchlistStatistics,
  getWatchlistsByPortfolio,
};
