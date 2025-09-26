// controllers/portfoliosController.js - NOWY PLIK

const Portfolio = require("../models/Portfolio");
const Position = require("../models/Position");
const { validationResult } = require("express-validator");
const BrokerService = require("../services/BrokerService");

/**
 * @desc    Get all portfolios for user
 * @route   GET /api/portfolios
 * @access  Private
 */
const getPortfolios = async (req, res) => {
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
      includeInactive = false,
      broker,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { userId: req.user.id };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (broker) {
      query.broker = broker;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const portfolios = await Portfolio.find(query)
      .sort(sort)
      .populate("positions", "symbol volume marketValue grossPL status");

    // Update stats for each portfolio
    const portfoliosWithStats = await Promise.all(
      portfolios.map(async (portfolio) => {
        await portfolio.updateStats();
        return portfolio.toJSON();
      })
    );

    res.json({
      success: true,
      message: "Portfolios retrieved successfully",
      data: {
        portfolios: portfoliosWithStats,
        totalCount: portfoliosWithStats.length,
      },
    });
  } catch (error) {
    console.error("Get portfolios error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolios",
      error: error.message,
    });
  }
};

/**
 * @desc    Get aggregated portfolio statistics
 * @route   GET /api/portfolios/stats
 * @access  Private
 */
const getPortfolioStats = async (req, res) => {
  try {
    const portfolios = await Portfolio.find({
      userId: req.user.id,
      isActive: true,
    });

    const stats = await Portfolio.aggregate([
      { $match: { userId: req.user.id, isActive: true } },
      {
        $group: {
          _id: null,
          totalPortfolios: { $sum: 1 },
          totalValue: { $sum: "$stats.totalValue" },
          totalPL: { $sum: "$stats.totalPL" },
          totalOpenPositions: { $sum: "$stats.openPositionsCount" },
          totalClosedPositions: { $sum: "$stats.closedPositionsCount" },
          brokerBreakdown: {
            $push: {
              broker: "$broker",
              value: "$stats.totalValue",
              pl: "$stats.totalPL",
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalPortfolios: 0,
      totalValue: 0,
      totalPL: 0,
      totalOpenPositions: 0,
      totalClosedPositions: 0,
      brokerBreakdown: [],
    };

    // Group by broker
    const brokerStats = result.brokerBreakdown.reduce((acc, item) => {
      if (!acc[item.broker]) {
        acc[item.broker] = { value: 0, pl: 0, count: 0 };
      }
      acc[item.broker].value += item.value;
      acc[item.broker].pl += item.pl;
      acc[item.broker].count += 1;
      return acc;
    }, {});

    res.json({
      success: true,
      message: "Portfolio statistics retrieved successfully",
      data: {
        ...result,
        brokerStats,
        totalPLPercent:
          result.totalValue > 0
            ? (result.totalPL / result.totalValue) * 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Get portfolio stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio statistics",
      error: error.message,
    });
  }
};

/**
 * @desc    Create new portfolio
 * @route   POST /api/portfolios
 * @access  Private
 */
const createPortfolio = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, description, broker, currency, brokerConfig, settings } =
      req.body;

    // Check for duplicate name
    const existingPortfolio = await Portfolio.findOne({
      userId: req.user.id,
      name: name,
      isActive: true,
    });

    if (existingPortfolio) {
      return res.status(400).json({
        success: false,
        message: "Portfolio with this name already exists",
      });
    }

    const portfolio = new Portfolio({
      userId: req.user.id,
      name,
      description,
      broker,
      currency,
      brokerConfig: {
        ...brokerConfig,
        lastSyncStatus: "never",
      },
      settings: {
        autoSync: true,
        notificationsEnabled: true,
        ...settings,
      },
    });

    await portfolio.save();

    res.status(201).json({
      success: true,
      message: "Portfolio created successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Create portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create portfolio",
      error: error.message,
    });
  }
};

/**
 * @desc    Sync portfolio with broker
 * @route   POST /api/portfolios/:id/sync
 * @access  Private
 */
const syncPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    if (!portfolio.canSync()) {
      return res.status(400).json({
        success: false,
        message: "Portfolio sync is disabled or broker not supported",
      });
    }

    // Update sync status
    portfolio.brokerConfig.lastSyncStatus = "in_progress";
    await portfolio.save();

    // Start sync process (background job)
    BrokerService.syncPortfolio(portfolio._id)
      .then(async (result) => {
        portfolio.brokerConfig.lastSync = new Date();
        portfolio.brokerConfig.lastSyncStatus = "success";
        portfolio.brokerConfig.lastSyncError = null;
        await portfolio.save();
        await portfolio.updateStats();
      })
      .catch(async (error) => {
        portfolio.brokerConfig.lastSyncStatus = "error";
        portfolio.brokerConfig.lastSyncError = error.message;
        await portfolio.save();
      });

    res.json({
      success: true,
      message: "Portfolio sync started",
      data: {
        portfolioId: portfolio._id,
        syncStatus: "in_progress",
      },
    });
  } catch (error) {
    console.error("Sync portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync portfolio",
      error: error.message,
    });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("positions");

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    res.json({
      success: true,
      message: "Portfolio retrieved successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Get portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio",
      error: error.message,
    });
  }
};

const updatePortfolio = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array,
      });
    }

    const { name, description, brokerConfig, settings } = req.body;

    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check for duplicate name
    if (name && name !== portfolio.name) {
      const existingPortfolio = await Portfolio.findOne({
        userId: req.user.id,
        name: name,
        isActive: true,
        _id: { $ne: portfolio._id },
      });
      if (existingPortfolio) {
        return res.status(400).json({
          success: false,
          message: "Portfolio with this name already exists",
        });
      }
      portfolio.name = name;
    }

    if (description !== undefined) portfolio.description = description;
    if (brokerConfig) {
      portfolio.brokerConfig = {
        ...portfolio.brokerConfig,
        ...brokerConfig,
      };
    }
    if (settings) {
      portfolio.settings = {
        ...portfolio.settings,
        ...settings,
      };
    }

    await portfolio.save();

    res.json({
      success: true,
      message: "Portfolio updated successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Update portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update portfolio",
      error: error.message,
    });
  }
};

module.exports = {
  getPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  // deletePortfolio,
  syncPortfolio,
  getPortfolioStats,
  // getPortfolioPositions,
  // clonePortfolio,
  // getPortfolioPerformance,
};
