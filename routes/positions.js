const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getPositions,
  getPosition,
  createPosition,
  updatePosition,
  updateMarketPrice,
  closePosition,
  deletePosition,
  getPositionsBySymbol,
  getPortfolioSummary,
} = require("../controllers/positionsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/positions
 * @desc    Get all positions for user
 * @access  Private
 */
router.get(
  "/",
  [
    query("status")
      .optional()
      .isIn(["open", "closed"])
      .withMessage("Status must be either open or closed"),
    query("symbol")
      .optional()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    query("type")
      .optional()
      .isIn(["BUY", "SELL"])
      .withMessage("Type must be either BUY or SELL"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn([
        "openTime",
        "closeTime",
        "symbol",
        "grossPL",
        "volume",
        "openPrice",
      ])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getPositions
);

/**
 * @route   GET /api/positions/portfolio/summary
 * @desc    Get portfolio summary
 * @access  Private
 */
router.get("/portfolio/summary", getPortfolioSummary);

/**
 * @route   GET /api/positions/symbol/:symbol
 * @desc    Get positions by symbol
 * @access  Private
 */
router.get(
  "/symbol/:symbol",
  [
    param("symbol")
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9\.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    query("status")
      .optional()
      .isIn(["open", "closed"])
      .withMessage("Status must be either open or closed"),
  ],
  getPositionsBySymbol
);

/**
 * @route   GET /api/positions/:id
 * @desc    Get single position by ID
 * @access  Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid position ID")],
  getPosition
);

/**
 * @route   POST /api/positions
 * @desc    Create new position
 * @access  Private
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
      .matches(/^[A-Za-z0-9\.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("type")
      .optional()
      .isIn(["BUY", "SELL"])
      .withMessage("Type must be either BUY or SELL"),
    body("volume")
      .isFloat({ min: 0.0001 })
      .withMessage("Volume must be a positive number greater than 0"),
    body("openPrice")
      .isFloat({ min: 0.01 })
      .withMessage("Open price must be a positive number"),
    body("marketPrice")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Market price must be a positive number"),
    body("commission")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Commission must be non-negative"),
    body("swap").optional().isFloat().withMessage("Swap must be a number"),
    body("taxes")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Taxes must be non-negative"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
    body("sector")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Sector cannot exceed 50 characters"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes cannot exceed 500 characters"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .trim()
      .isLength({ min: 1, max: 20 })
      .withMessage("Each tag must be between 1 and 20 characters"),
  ],
  createPosition
);

/**
 * @route   PUT /api/positions/:id
 * @desc    Update position
 * @access  Private
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid position ID"),
    body("symbol")
      .optional()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9\.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("type")
      .optional()
      .isIn(["BUY", "SELL"])
      .withMessage("Type must be either BUY or SELL"),
    body("volume")
      .optional()
      .isFloat({ min: 0.0001 })
      .withMessage("Volume must be a positive number greater than 0"),
    body("openPrice")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Open price must be a positive number"),
    body("marketPrice")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Market price must be a positive number"),
    body("commission")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Commission must be non-negative"),
    body("swap").optional().isFloat().withMessage("Swap must be a number"),
    body("taxes")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Taxes must be non-negative"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
    body("sector")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Sector cannot exceed 50 characters"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes cannot exceed 500 characters"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .trim()
      .isLength({ min: 1, max: 20 })
      .withMessage("Each tag must be between 1 and 20 characters"),
  ],
  updatePosition
);

/**
 * @route   PUT /api/positions/:id/market-price
 * @desc    Update market price for position
 * @access  Private
 */
router.put(
  "/:id/market-price",
  [
    param("id").isMongoId().withMessage("Invalid position ID"),
    body("marketPrice")
      .isFloat({ min: 0.01 })
      .withMessage("Market price must be a positive number"),
  ],
  updateMarketPrice
);

/**
 * @route   PUT /api/positions/:id/close
 * @desc    Close position
 * @access  Private
 */
router.put(
  "/:id/close",
  [
    param("id").isMongoId().withMessage("Invalid position ID"),
    body("closePrice")
      .isFloat({ min: 0.01 })
      .withMessage("Close price must be a positive number"),
    body("closeTime")
      .optional()
      .isISO8601()
      .withMessage("Close time must be a valid ISO date"),
    body("commission")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Commission must be non-negative"),
    body("taxes")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Taxes must be non-negative"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes cannot exceed 500 characters"),
  ],
  closePosition
);

/**
 * @route   DELETE /api/positions/:id
 * @desc    Delete position
 * @access  Private
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid position ID")],
  deletePosition
);

/**
 * @route   GET /api/positions/health
 * @desc    Health check for positions service
 * @access  Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Positions service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
