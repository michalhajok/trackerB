// routes/portfolios.js - NOWY PLIK
const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  // deletePortfolio,
  syncPortfolio,
  getPortfolioStats,
  importPortfolio,
  // getPortfolioPositions,
  // clonePortfolio,
  // getPortfolioPerformance,
} = require("../controllers/portfoliosController");
const authMiddleware = require("../middleware/auth");

const analyticsController = require("../controllers/analyticsController");
const cashOperationsController = require("../controllers/cashOperationsController");
const pendingOrdersController = require("../controllers/pendingOrdersController");
const positionsController = require("../controllers/positionsController");
const watchlistController = require("../controllers/watchlistController");
// const marketDataController = require("../controllers/marketDataController");

const upload = require("../middleware/upload");

const router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

/**
 * @route   GET /api/portfolios
 * @desc    Get all portfolios for user
 * @access  Private
 */
router.get(
  "/",
  [
    query("includeInactive")
      .optional()
      .isBoolean()
      .withMessage("includeInactive must be boolean"),
    query("broker")
      .optional()
      .isIn(["XTB", "PKO", "BINANCE", "BYBIT", "ING", "MANUAL"])
      .withMessage("Invalid broker"),
    query("sortBy")
      .optional()
      .isIn(["name", "broker", "totalValue", "createdAt", "lastSync"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getPortfolios
);

/**
 * @route   GET /api/portfolios/stats
 * @desc    Get aggregated portfolio statistics
 * @access  Private
 */
router.get("/stats", getPortfolioStats);

/**
 * @route   GET /api/portfolios/:id
 * @desc    Get single portfolio
 * @access  Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid portfolio ID")],
  getPortfolio
);

/**
 * @route   GET /api/portfolios/:id/positions
 * @desc    Get positions for specific portfolio
 * @access  Private
 */
// router.get(
//   "/:id/positions",
//   [
//     param("id").isMongoId().withMessage("Invalid portfolio ID"),
//     query("status")
//       .optional()
//       .isIn(["open", "closed"])
//       .withMessage("Status must be open or closed"),
//   ],
//   getPortfolioPositions
// );

/**
 * @route   GET /api/portfolios/:id/performance
 * @desc    Get portfolio performance metrics
 * @access  Private
 */
// router.get(
//   "/:id/performance",
//   [
//     param("id").isMongoId().withMessage("Invalid portfolio ID"),
//     query("period")
//       .optional()
//       .isIn(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"])
//       .withMessage("Invalid period"),
//   ],
//   getPortfolioPerformance
// );

/**
 * @route   POST /api/portfolios
 * @desc    Create new portfolio
 * @access  Private
 */
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Portfolio name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),
    body("broker")
      .isIn(["XTB", "PKO", "BINANCE", "BYBIT", "ING", "MANUAL"])
      .withMessage("Invalid broker"),
    body("currency")
      .isIn(["USD", "EUR", "PLN", "GBP", "USDT", "BTC"])
      .withMessage("Invalid currency"),
    body("brokerConfig.accountId")
      .notEmpty()
      .withMessage("Broker account ID is required"),
    body("brokerConfig.accountType")
      .optional()
      .isIn(["trading", "investment", "spot", "futures", "savings", "manual"])
      .withMessage("Invalid account type"),
  ],
  createPortfolio
);

/**
 * @route   PUT /api/portfolios/:id
 * @desc    Update portfolio
 * @access  Private
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid portfolio ID"),
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
  ],
  updatePortfolio
);

/**
 * @route   POST /api/portfolios/:id/sync
 * @desc    Manually sync portfolio with broker
 * @access  Private
 */
router.post(
  "/:id/sync",
  [param("id").isMongoId().withMessage("Invalid portfolio ID")],
  syncPortfolio
);

router.post("/:id/import", upload.single("file"), importPortfolio);

/**
 * @route   POST /api/portfolios/:id/clone
 * @desc    Clone portfolio (for templating)
 * @access  Private
 */
// router.post(
//   "/:id/clone",
//   [
//     param("id").isMongoId().withMessage("Invalid portfolio ID"),
//     body("name")
//       .trim()
//       .notEmpty()
//       .withMessage("New portfolio name is required"),
//   ],
//   clonePortfolio
// );

/**
 * @route   DELETE /api/portfolios/:id
 * @desc    Delete portfolio
 * @access  Private
 */
// router.delete(
//   "/:id",
//   [param("id").isMongoId().withMessage("Invalid portfolio ID")],
//   deletePortfolio
// );

router.get(
  "/:portfolioId/analytics",
  analyticsController.getAnalyticsByPortfolio
);
router.get(
  "/:portfolioId/cash-operations",
  cashOperationsController.getCashOperationsByPortfolio
);
router.get(
  "/:portfolioId/pending-orders",
  pendingOrdersController.getPendingOrdersByPortfolio
);
router.get(
  "/:portfolioId/positions",
  positionsController.getPositionsByPortfolio
);
router.get(
  "/:portfolioId/watchlists",
  watchlistController.getWatchlistsByPortfolio
);
// router.get(
//   "/api/portfolios/:portfolioId/market-data",
//   marketDataController.getMarketData
// );

module.exports = router;
