// routes/portfolios.js - NOWY PLIK
const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} = require("../controllers/portfoliosController");
const authMiddleware = require("../middleware/auth");

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

module.exports = router;
