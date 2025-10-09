const Portfolio = require("../models/Portfolio");
const Position = require("../models/Position");
const CashOperation = require("../models/CashOperation");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all portfolios with statistics
 * @route GET /api/portfolios
 * @access Private
 */
const getPortfolios = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      includeInactive = false,
      broker,
      sortBy = "name",
      sortOrder = "asc",
      includeStats = true,
    } = req.query;

    const query = { userId };
    if (!includeInactive) query.isActive = true;
    if (broker) query.broker = broker;

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const portfolios = await Portfolio.find(query).sort(sort);

    // Add statistics if requested
    if (includeStats === "true" || includeStats === true) {
      const portfoliosWithStats = await Promise.all(
        portfolios.map(async (portfolio) => {
          const [positions, cashOps] = await Promise.all([
            Position.find({
              portfolioId: portfolio._id,
              status: { $ne: "deleted" },
            }),
            CashOperation.find({
              portfolioId: portfolio._id,
              status: "completed",
            }),
          ]);

          const stats = {
            totalValue: positions.reduce(
              (sum, p) => sum + (p.purchaseValue || 0),
              0
            ),
            totalPL: positions.reduce((sum, p) => sum + (p.grossPL || 0), 0),
            openPositions: positions.filter((p) => p.status === "open").length,
            closedPositions: positions.filter((p) => p.status === "closed")
              .length,
            cashBalance: cashOps.reduce((sum, c) => {
              const incomeTypes = ["deposit", "dividend", "interest", "bonus"];
              return (
                sum + (incomeTypes.includes(c.type) ? c.amount : -c.amount)
              );
            }, 0),
          };

          return {
            ...portfolio.toJSON(),
            stats,
          };
        })
      );

      return res.json({
        success: true,
        message: "Portfolios retrieved successfully",
        data: {
          portfolios: portfoliosWithStats,
          totalCount: portfoliosWithStats.length,
        },
      });
    }

    res.json({
      success: true,
      message: "Portfolios retrieved successfully",
      data: {
        portfolios: portfolios.map((p) => p.toJSON()),
        totalCount: portfolios.length,
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
 * @desc Create new portfolio
 * @route POST /api/portfolios
 * @access Private
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

    const userId = req.user.id;
    const {
      name,
      description,
      broker,
      currency = "PLN",
      brokerConfig = {},
      settings = {},
    } = req.body;

    // Check for duplicate name
    const existing = await Portfolio.findOne({
      userId,
      name: name.trim(),
      isActive: true,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Portfolio with this name already exists",
      });
    }

    const portfolio = new Portfolio({
      userId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      broker,
      currency: currency.toUpperCase(),
      brokerConfig: {
        ...brokerConfig,
        lastSyncStatus: "never",
        lastSync: null,
      },
      settings: {
        autoSync: false,
        notificationsEnabled: true,
        ...settings,
      },
      isActive: true,
    });

    await portfolio.save();

    res.status(201).json({
      success: true,
      message: "Portfolio created successfully",
      data: { portfolio: portfolio.toJSON() },
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
 * @desc Update portfolio
 * @route PUT /api/portfolios/:id
 * @access Private
 */
const updatePortfolio = async (req, res) => {
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
    const { name, description, brokerConfig, settings, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid portfolio ID format",
      });
    }

    const portfolio = await Portfolio.findOne({ _id: id, userId });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check for duplicate name if changing name
    if (name && name.trim() !== portfolio.name) {
      const duplicate = await Portfolio.findOne({
        userId,
        name: name.trim(),
        isActive: true,
        _id: { $ne: portfolio._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Portfolio with this name already exists",
        });
      }
      portfolio.name = name.trim();
    }

    // Update fields
    if (description !== undefined) portfolio.description = description.trim();
    if (brokerConfig) {
      portfolio.brokerConfig = {
        ...portfolio.brokerConfig.toObject(),
        ...brokerConfig,
      };
    }
    if (settings) {
      portfolio.settings = {
        ...portfolio.settings.toObject(),
        ...settings,
      };
    }
    if (isActive !== undefined) portfolio.isActive = isActive;

    await portfolio.save();

    res.json({
      success: true,
      message: "Portfolio updated successfully",
      data: { portfolio: portfolio.toJSON() },
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

/**
 * @desc Delete portfolio (soft delete)
 * @route DELETE /api/portfolios/:id
 * @access Private
 */
const deletePortfolio = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permanent = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid portfolio ID format",
      });
    }

    const portfolio = await Portfolio.findOne({ _id: id, userId });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found",
      });
    }

    // Check for open positions
    const openPositions = await Position.countDocuments({
      portfolioId: id,
      status: "open",
    });

    if (openPositions > 0 && permanent !== "true") {
      return res.status(400).json({
        success: false,
        message: `Cannot delete portfolio with ${openPositions} open positions`,
      });
    }

    let result;
    if (permanent === "true") {
      // Hard delete portfolio and related data
      await Promise.all([
        Position.deleteMany({ portfolioId: id }),
        CashOperation.deleteMany({ portfolioId: id }),
        PendingOrder.deleteMany({ portfolioId: id }),
        Portfolio.findByIdAndDelete(id),
      ]);

      result = "Portfolio and all related data deleted permanently";
    } else {
      // Soft delete
      portfolio.isActive = false;
      portfolio.deletedAt = new Date();
      await portfolio.save();

      result = "Portfolio deactivated successfully";
    }

    res.json({
      success: true,
      message: result,
      data: {
        deletedPortfolio: {
          id: portfolio._id,
          name: portfolio.name,
        },
      },
    });
  } catch (error) {
    console.error("Delete portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete portfolio",
      error: error.message,
    });
  }
};

module.exports = {
  getPortfolios, // ✅ SIMPLIFIED: Includes stats option
  createPortfolio, // ✅ KEEP: Core functionality
  updatePortfolio, // ✅ KEEP: Core functionality
  deletePortfolio, // ✅ SIMPLIFIED: Soft delete option
};

// ❌ REMOVED METHODS (5 methods removed):
// - getPortfolio (access via getPortfolios with filtering)
// - getPortfolioStats (merged into getPortfolios)
// - syncPortfolio (too complex for MVP)
// - importPortfolio (moved to fileImport controller)
// - All processing functions (moved to fileImport)
