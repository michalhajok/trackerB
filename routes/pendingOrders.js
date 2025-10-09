const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getPendingOrders,
  createPendingOrder,
  executePendingOrder,
  cancelPendingOrder,
} = require("../controllers/pendingOrdersController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/pending-orders
 * @desc    Get all pending orders for user
 * @access  Private
 */
router.get(
  "/",
  [
    query("status")
      .optional()
      .isIn([
        "pending",
        "partial",
        "executed",
        "cancelled",
        "expired",
        "rejected",
      ])
      .withMessage("Invalid order status"),
    query("symbol")
      .optional()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    query("type")
      .optional()
      .isIn(["market", "limit", "stop", "stop_limit", "trailing_stop"])
      .withMessage("Invalid order type"),
    query("side")
      .optional()
      .isIn(["buy", "sell"])
      .withMessage("Side must be either buy or sell"),
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
      .isIn(["openTime", "symbol", "type", "side", "volume", "price"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getPendingOrders
);

/**
 * @route   POST /api/pending-orders
 * @desc    Create new pending order
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
      .isIn(["market", "limit", "stop", "stop_limit", "trailing_stop"])
      .withMessage("Invalid order type"),
    body("side")
      .isIn(["buy", "sell"])
      .withMessage("Side must be either buy or sell"),
    body("volume")
      .isFloat({ min: 0.0001 })
      .withMessage("Volume must be a positive number greater than 0"),
    body("price")
      .if(body("type").not().equals("market"))
      .isFloat({ min: 0.01 })
      .withMessage(
        "Price is required for non-market orders and must be positive"
      ),
    body("stopPrice")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Stop price must be a positive number"),
    body("trailingAmount")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Trailing amount must be a positive number"),
    body("trailingPercent")
      .optional()
      .isFloat({ min: 0.01, max: 100 })
      .withMessage("Trailing percent must be between 0.01 and 100"),
    body("expiryTime")
      .optional()
      .isISO8601()
      .withMessage("Expiry time must be a valid ISO date"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("exchange")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Exchange name cannot exceed 50 characters"),
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
    body("conditions.timeInForce")
      .optional()
      .isIn(["GTC", "IOC", "FOK", "DAY", "GTD"])
      .withMessage("Invalid time in force value"),
    body("conditions.reduceOnly")
      .optional()
      .isBoolean()
      .withMessage("Reduce only must be boolean"),
    body("conditions.postOnly")
      .optional()
      .isBoolean()
      .withMessage("Post only must be boolean"),
    body("conditions.iceberg.visibleSize")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Iceberg visible size must be non-negative"),
    body("riskManagement.stopLoss.price")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Stop loss price must be positive"),
    body("riskManagement.stopLoss.enabled")
      .optional()
      .isBoolean()
      .withMessage("Stop loss enabled must be boolean"),
    body("riskManagement.takeProfit.price")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Take profit price must be positive"),
    body("riskManagement.takeProfit.enabled")
      .optional()
      .isBoolean()
      .withMessage("Take profit enabled must be boolean"),
    body("marketData.bidPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Bid price must be non-negative"),
    body("marketData.askPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Ask price must be non-negative"),
    body("marketData.lastPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Last price must be non-negative"),
  ],
  createPendingOrder
);

/**
 * @route   PUT /api/pending-orders/:id/execute
 * @desc    Execute pending order (full or partial)
 * @access  Private
 */
router.put(
  "/:id/execute",
  [
    param("id").isMongoId().withMessage("Invalid order ID"),
    body("executedPrice")
      .isFloat({ min: 0.01 })
      .withMessage("Executed price must be a positive number"),
    body("executedVolume")
      .optional()
      .isFloat({ min: 0.0001 })
      .withMessage("Executed volume must be a positive number"),
    body("commission")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Commission must be non-negative"),
    body("fees")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Fees must be non-negative"),
    body("createPosition")
      .optional()
      .isBoolean()
      .withMessage("Create position must be boolean"),
  ],
  executePendingOrder
);

/**
 * @route   PUT /api/pending-orders/:id/cancel
 * @desc    Cancel pending order
 * @access  Private
 */
router.put(
  "/:id/cancel",
  [
    param("id").isMongoId().withMessage("Invalid order ID"),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Reason cannot exceed 200 characters"),
  ],
  cancelPendingOrder
);

/**
 * @route   GET /api/pending-orders/health
 * @desc    Health check for pending orders service
 * @access  Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Pending orders service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
