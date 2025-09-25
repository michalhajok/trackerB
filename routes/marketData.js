const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getMarketData,
  getBatchMarketData,
  updateMarketData,
  bulkUpdateMarketData,
  getActiveSymbols,
  getMarketSummary,
  getTopMovers,
  searchSymbols,
  getHistoricalData,
  getSymbolsBySector,
  recordError,
  getSymbolsNeedingUpdate,
  createMarketData,
  cleanupOldData,
} = require("../controllers/marketDataController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * @route GET /api/market-data/symbols
 * @desc Get active symbols
 * @access Public
 */
router.get(
  "/symbols",
  [
    query("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
  ],
  getActiveSymbols
);

/**
 * @route GET /api/market-data/summary
 * @desc Get market summary
 * @access Public
 */
router.get(
  "/summary",
  [
    query("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
  ],
  getMarketSummary
);

/**
 * @route GET /api/market-data/movers
 * @desc Get top movers
 * @access Public
 */
router.get(
  "/movers",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  getTopMovers
);

/**
 * @route GET /api/market-data/search
 * @desc Search symbols
 * @access Public
 */
router.get(
  "/search",
  [
    query("q")
      .notEmpty()
      .withMessage("Search term is required")
      .isLength({ min: 1, max: 50 })
      .withMessage("Search term must be between 1 and 50 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  searchSymbols
);

/**
 * @route GET /api/market-data/sectors/:sector
 * @desc Get symbols by sector
 * @access Public
 */
router.get(
  "/sectors/:sector",
  [
    param("sector")
      .trim()
      .notEmpty()
      .withMessage("Sector is required")
      .isLength({ max: 50 })
      .withMessage("Sector name cannot exceed 50 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getSymbolsBySector
);

/**
 * @route GET /api/market-data/:symbol
 * @desc Get market data for symbol
 * @access Public
 */
router.get(
  "/:symbol",
  [
    param("symbol")
      .trim()
      .notEmpty()
      .withMessage("Symbol is required")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
  ],
  getMarketData
);

/**
 * @route GET /api/market-data/:symbol/history
 * @desc Get historical data for symbol
 * @access Public
 */
router.get(
  "/:symbol/history",
  [
    param("symbol")
      .trim()
      .notEmpty()
      .withMessage("Symbol is required")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    query("periods")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Periods must be between 1 and 1000"),
  ],
  getHistoricalData
);

/**
 * @route POST /api/market-data/batch
 * @desc Get multiple symbols market data
 * @access Public
 */
router.post(
  "/batch",
  [
    body("symbols")
      .isArray({ min: 1, max: 100 })
      .withMessage("Symbols array is required and must contain 1-100 items"),
    body("symbols.*")
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage("Each symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9.]+$/)
      .withMessage("Each symbol can only contain letters, numbers, and dots"),
  ],
  getBatchMarketData
);

// Protected routes (require authentication)
router.use(authMiddleware);

/**
 * @route POST /api/market-data
 * @desc Create new market data entry
 * @access Private (Admin)
 */
router.post(
  "/",
  [
    body("symbol")
      .trim()
      .notEmpty()
      .withMessage("Symbol is required")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("currentPrice")
      .isFloat({ min: 0.01 })
      .withMessage("Current price must be a positive number"),
    body("marketInfo.exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
    body("marketInfo.currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP", "JPY", "CHF", "CAD", "AUD"])
      .withMessage("Invalid currency"),
    body("marketInfo.sector")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Sector cannot exceed 50 characters"),
    body("metadata.assetType")
      .optional()
      .isIn(["stock", "etf", "crypto", "forex", "commodity", "bond", "fund"])
      .withMessage("Invalid asset type"),
  ],
  createMarketData
);

/**
 * @route PUT /api/market-data/:symbol
 * @desc Update market data for symbol
 * @access Private (Admin/System)
 */
router.put(
  "/:symbol",
  [
    param("symbol")
      .trim()
      .notEmpty()
      .withMessage("Symbol is required")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    body("price")
      .isFloat({ min: 0.01 })
      .withMessage("Price must be a positive number"),
    body("bid")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Bid must be a non-negative number"),
    body("ask")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Ask must be a non-negative number"),
    body("volume")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Volume must be a non-negative number"),
    body("high")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("High must be a non-negative number"),
    body("low")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Low must be a non-negative number"),
    body("open")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Open must be a non-negative number"),
    body("provider")
      .optional()
      .isIn(["yahoo", "alpha_vantage", "iex", "polygon", "finnhub", "manual"])
      .withMessage("Invalid data provider"),
  ],
  updateMarketData
);

/**
 * @route PUT /api/market-data/bulk-update
 * @desc Bulk update market data
 * @access Private (Admin/System)
 */
router.put(
  "/bulk-update",
  [
    body("priceUpdates")
      .isArray({ min: 1, max: 1000 })
      .withMessage(
        "Price updates array is required and must contain 1-1000 items"
      ),
    body("priceUpdates.*.symbol")
      .notEmpty()
      .withMessage("Symbol is required for each update"),
    body("priceUpdates.*.price")
      .isFloat({ min: 0.01 })
      .withMessage("Price must be a positive number for each update"),
  ],
  bulkUpdateMarketData
);

/**
 * @route GET /api/market-data/update-needed
 * @desc Get symbols needing update
 * @access Private (System)
 */
router.get("/update-needed", getSymbolsNeedingUpdate);

/**
 * @route POST /api/market-data/:symbol/error
 * @desc Record data source error
 * @access Private (System)
 */
router.post(
  "/:symbol/error",
  [
    param("symbol").trim().notEmpty().withMessage("Symbol is required"),
    body("errorMessage")
      .notEmpty()
      .withMessage("Error message is required")
      .isLength({ max: 500 })
      .withMessage("Error message cannot exceed 500 characters"),
  ],
  recordError
);

/**
 * @route DELETE /api/market-data/cleanup
 * @desc Cleanup old historical data
 * @access Private (Admin)
 */
router.delete(
  "/cleanup",
  [
    query("daysToKeep")
      .optional()
      .isInt({ min: 30, max: 1095 })
      .withMessage("Days to keep must be between 30 and 1095 (3 years)"),
  ],
  cleanupOldData
);

/**
 * @route GET /api/market-data/health
 * @desc Health check for market data service
 * @access Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Market data service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
