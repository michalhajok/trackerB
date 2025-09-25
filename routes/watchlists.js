const express = require("express");
const { body, query, param } = require("express-validator");
const {
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
} = require("../controllers/watchlistController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * @route GET /api/watchlists/public
 * @desc Get public watchlists
 * @access Public
 */
router.get(
  "/public",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  getPublicWatchlists
);

// Apply auth middleware to protected routes
router.use(authMiddleware);

/**
 * @route GET /api/watchlists
 * @desc Get all watchlists for user
 * @access Private
 */
router.get("/", getWatchlists);

/**
 * @route GET /api/watchlists/statistics
 * @desc Get watchlist statistics
 * @access Private
 */
router.get("/statistics", getWatchlistStatistics);

/**
 * @route GET /api/watchlists/:id
 * @desc Get single watchlist by ID
 * @access Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid watchlist ID")],
  getWatchlist
);

/**
 * @route POST /api/watchlists
 * @desc Create new watchlist
 * @access Private
 */
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Watchlist name is required")
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
    body("isDefault")
      .optional()
      .isBoolean()
      .withMessage("isDefault must be boolean"),
    body("isPublic")
      .optional()
      .isBoolean()
      .withMessage("isPublic must be boolean"),
    body("color")
      .optional()
      .isIn([
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
        "pink",
        "indigo",
        "gray",
        "orange",
        "teal",
      ])
      .withMessage("Invalid color"),
    body("icon")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Icon cannot exceed 50 characters"),
  ],
  createWatchlist
);

/**
 * @route PUT /api/watchlists/:id
 * @desc Update watchlist
 * @access Private
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description cannot exceed 500 characters"),
    body("isPublic")
      .optional()
      .isBoolean()
      .withMessage("isPublic must be boolean"),
    body("color")
      .optional()
      .isIn([
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
        "pink",
        "indigo",
        "gray",
        "orange",
        "teal",
      ])
      .withMessage("Invalid color"),
  ],
  updateWatchlist
);

/**
 * @route DELETE /api/watchlists/:id
 * @desc Delete watchlist
 * @access Private
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid watchlist ID")],
  deleteWatchlist
);

/**
 * @route POST /api/watchlists/:id/symbols
 * @desc Add symbol to watchlist
 * @access Private
 */
router.post(
  "/:id/symbols",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
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
    body("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange cannot exceed 50 characters"),
    body("sector")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Sector cannot exceed 50 characters"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes cannot exceed 1000 characters"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage("Each tag must be between 1 and 30 characters"),
  ],
  addSymbol
);

/**
 * @route DELETE /api/watchlists/:id/symbols/:symbol
 * @desc Remove symbol from watchlist
 * @access Private
 */
router.delete(
  "/:id/symbols/:symbol",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
    param("symbol")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
  ],
  removeSymbol
);

/**
 * @route POST /api/watchlists/:id/symbols/:symbol/alerts
 * @desc Add price alert to symbol
 * @access Private
 */
router.post(
  "/:id/symbols/:symbol/alerts",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
    param("symbol")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    body("type")
      .isIn(["above", "below", "change_percent"])
      .withMessage("Alert type must be one of: above, below, change_percent"),
    body("value")
      .isFloat({ min: 0 })
      .withMessage("Alert value must be a positive number"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
  ],
  addPriceAlert
);

/**
 * @route DELETE /api/watchlists/:id/symbols/:symbol/alerts/:alertId
 * @desc Remove price alert
 * @access Private
 */
router.delete(
  "/:id/symbols/:symbol/alerts/:alertId",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
    param("symbol")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
  ],
  removePriceAlert
);

/**
 * @route PUT /api/watchlists/:id/market-data
 * @desc Update market data for watchlist
 * @access Private
 */
router.put(
  "/:id/market-data",
  [
    param("id").isMongoId().withMessage("Invalid watchlist ID"),
    body("marketData")
      .isArray({ min: 1 })
      .withMessage("Market data array is required"),
    body("marketData.*.symbol")
      .notEmpty()
      .withMessage("Symbol is required for each market data entry"),
    body("marketData.*.price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("marketData.*.change24h")
      .optional()
      .isFloat()
      .withMessage("Change24h must be a number"),
    body("marketData.*.changePercent24h")
      .optional()
      .isFloat()
      .withMessage("ChangePercent24h must be a number"),
    body("marketData.*.volume24h")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Volume24h must be a non-negative number"),
  ],
  updateMarketData
);

/**
 * @route GET /api/watchlists/health
 * @desc Health check for watchlists service
 * @access Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Watchlists service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
