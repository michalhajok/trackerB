const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getCashOperations,
  getCashOperation,
  createCashOperation,
  updateCashOperation,
  deleteCashOperation,
  getBalance,
  getCashFlowSummary,
  getMonthlySummary,
  getOperationsByType,
} = require("../controllers/cashOperationsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/cash-operations
 * @desc    Get all cash operations for user
 * @access  Private
 */
router.get(
  "/",
  [
    query("type")
      .optional()
      .isIn([
        "deposit",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "bonus",
        "transfer",
        "adjustment",
      ])
      .withMessage("Invalid operation type"),
    query("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    query("symbol")
      .optional()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters"),
    query("status")
      .optional()
      .isIn(["pending", "completed", "failed", "cancelled"])
      .withMessage(
        "Status must be one of: pending, completed, failed, cancelled"
      ),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Date from must be a valid ISO date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Date to must be a valid ISO date"),
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
      .isIn(["time", "amount", "type", "currency"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getCashOperations
);

/**
 * @route   GET /api/cash-operations/balance
 * @desc    Get cash balance by currency
 * @access  Private
 */
router.get(
  "/balance",
  [
    query("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    query("upToDate")
      .optional()
      .isISO8601()
      .withMessage("Up to date must be a valid ISO date"),
  ],
  getBalance
);

/**
 * @route   GET /api/cash-operations/cash-flow
 * @desc    Get cash flow summary
 * @access  Private
 */
router.get(
  "/cash-flow",
  [
    query("period")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Period must be between 1 and 365 days"),
  ],
  getCashFlowSummary
);

/**
 * @route   GET /api/cash-operations/monthly/:year/:month
 * @desc    Get monthly summary
 * @access  Private
 */
router.get(
  "/monthly/:year/:month",
  [
    param("year")
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Year must be between 2000 and 2100"),
    param("month")
      .isInt({ min: 1, max: 12 })
      .withMessage("Month must be between 1 and 12"),
  ],
  getMonthlySummary
);

/**
 * @route   GET /api/cash-operations/type/:type
 * @desc    Get operations by type
 * @access  Private
 */
router.get(
  "/type/:type",
  [
    param("type")
      .isIn([
        "deposit",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "bonus",
        "transfer",
        "adjustment",
      ])
      .withMessage("Invalid operation type"),
    query("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Date from must be a valid ISO date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Date to must be a valid ISO date"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ],
  getOperationsByType
);

/**
 * @route   GET /api/cash-operations/:id
 * @desc    Get single cash operation by ID
 * @access  Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid operation ID")],
  getCashOperation
);

/**
 * @route   POST /api/cash-operations
 * @desc    Create new cash operation
 * @access  Private
 */
router.post(
  "/",
  [
    body("type")
      .isIn([
        "deposit",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "bonus",
        "transfer",
        "adjustment",
      ])
      .withMessage("Invalid operation type"),
    body("amount")
      .isFloat({ ne: 0 })
      .withMessage("Amount must be a non-zero number"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("comment")
      .trim()
      .notEmpty()
      .withMessage("Comment is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Comment must be between 1 and 200 characters"),
    body("symbol")
      .optional()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9\.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    body("time")
      .optional()
      .isISO8601()
      .withMessage("Time must be a valid ISO date"),
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
    body("details.dividendPerShare")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Dividend per share must be non-negative"),
    body("details.sharesCount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Shares count must be non-negative"),
    body("details.exDividendDate")
      .optional()
      .isISO8601()
      .withMessage("Ex-dividend date must be a valid ISO date"),
    body("details.paymentDate")
      .optional()
      .isISO8601()
      .withMessage("Payment date must be a valid ISO date"),
    body("details.bankAccount")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Bank account info cannot exceed 50 characters"),
    body("details.paymentMethod")
      .optional()
      .isIn(["bank_transfer", "card", "blik", "paypal", "crypto", "other"])
      .withMessage("Invalid payment method"),
    body("details.transactionId")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Transaction ID cannot exceed 100 characters"),
    body("details.feeType")
      .optional()
      .isIn([
        "commission",
        "spread",
        "overnight",
        "inactivity",
        "currency_conversion",
        "other",
      ])
      .withMessage("Invalid fee type"),
    body("details.relatedPositionId")
      .optional()
      .isInt()
      .withMessage("Related position ID must be an integer"),
    body("details.interestRate")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Interest rate must be non-negative"),
    body("taxInfo.taxable")
      .optional()
      .isBoolean()
      .withMessage("Taxable must be boolean"),
    body("taxInfo.taxRate")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Tax rate must be between 0 and 100"),
    body("taxInfo.taxAmount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Tax amount must be non-negative"),
  ],
  createCashOperation
);

/**
 * @route   PUT /api/cash-operations/:id
 * @desc    Update cash operation
 * @access  Private
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid operation ID"),
    body("type")
      .optional()
      .isIn([
        "deposit",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "bonus",
        "transfer",
        "adjustment",
      ])
      .withMessage("Invalid operation type"),
    body("amount")
      .optional()
      .isFloat({ ne: 0 })
      .withMessage("Amount must be a non-zero number"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("comment")
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Comment must be between 1 and 200 characters"),
    body("symbol")
      .optional()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage("Symbol must be between 1 and 10 characters")
      .matches(/^[A-Za-z0-9\.]+$/)
      .withMessage("Symbol can only contain letters, numbers, and dots"),
    body("time")
      .optional()
      .isISO8601()
      .withMessage("Time must be a valid ISO date"),
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
    body("taxInfo.taxable")
      .optional()
      .isBoolean()
      .withMessage("Taxable must be boolean"),
    body("taxInfo.taxRate")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Tax rate must be between 0 and 100"),
    body("taxInfo.taxAmount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Tax amount must be non-negative"),
  ],
  updateCashOperation
);

/**
 * @route   DELETE /api/cash-operations/:id
 * @desc    Delete cash operation
 * @access  Private
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid operation ID")],
  deleteCashOperation
);

/**
 * @route   GET /api/cash-operations/health
 * @desc    Health check for cash operations service
 * @access  Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Cash operations service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
