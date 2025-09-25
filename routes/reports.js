const express = require("express");
const { body, query, param } = require("express-validator");
const {
  getReports,
  getReport,
  createReport,
  downloadReport,
  createTaxReport,
  getScheduledReports,
} = require("../controllers/reportsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/reports
 * @desc Get all reports for user
 * @access Private
 */
router.get(
  "/",
  [
    query("type")
      .optional()
      .isIn([
        "tax_report",
        "performance_report",
        "portfolio_summary",
        "trading_activity",
        "profit_loss",
        "risk_analysis",
        "sector_analysis",
        "monthly_summary",
        "yearly_summary",
        "custom",
      ])
      .withMessage("Invalid report type"),
    query("status")
      .optional()
      .isIn(["pending", "generating", "completed", "failed", "cancelled"])
      .withMessage("Invalid report status"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getReports
);

/**
 * @route GET /api/reports/scheduled
 * @desc Get scheduled reports (Admin only)
 * @access Private (Admin)
 */
router.get("/scheduled", getScheduledReports);

/**
 * @route GET /api/reports/:id
 * @desc Get single report by ID
 * @access Private
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid report ID")],
  getReport
);

/**
 * @route GET /api/reports/:id/download
 * @desc Download report file
 * @access Private
 */
router.get(
  "/:id/download",
  [param("id").isMongoId().withMessage("Invalid report ID")],
  downloadReport
);

/**
 * @route POST /api/reports
 * @desc Create new report
 * @access Private
 */
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Report name is required")
      .isLength({ max: 200 })
      .withMessage("Name cannot exceed 200 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Description cannot exceed 1000 characters"),
    body("type")
      .isIn([
        "tax_report",
        "performance_report",
        "portfolio_summary",
        "trading_activity",
        "profit_loss",
        "risk_analysis",
        "sector_analysis",
        "monthly_summary",
        "yearly_summary",
        "custom",
      ])
      .withMessage("Invalid report type"),
    body("format")
      .optional()
      .isIn(["pdf", "csv", "excel", "json"])
      .withMessage("Format must be one of: pdf, csv, excel, json"),
    body("dateRange.startDate")
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    body("dateRange.endDate")
      .isISO8601()
      .withMessage("End date must be a valid ISO date")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.dateRange.startDate)) {
          throw new Error("End date must be after start date");
        }
        return true;
      }),
    body("configuration.formatting.currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("configuration.formatting.dateFormat")
      .optional()
      .isIn(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])
      .withMessage("Invalid date format"),
    body("schedule.isRecurring")
      .optional()
      .isBoolean()
      .withMessage("isRecurring must be boolean"),
    body("schedule.frequency")
      .optional()
      .isIn(["daily", "weekly", "monthly", "quarterly", "yearly"])
      .withMessage("Invalid schedule frequency"),
    body("schedule.dayOfMonth")
      .optional()
      .isInt({ min: 1, max: 31 })
      .withMessage("Day of month must be between 1 and 31"),
    body("schedule.dayOfWeek")
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage("Day of week must be between 0 and 6"),
    body("schedule.time")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Time must be in HH:MM format"),
  ],
  createReport
);

/**
 * @route POST /api/reports/tax
 * @desc Create tax report
 * @access Private
 */
router.post(
  "/tax",
  [
    body("taxYear")
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Tax year must be between 2000 and 2100"),
    body("format")
      .optional()
      .isIn(["pdf", "csv", "excel"])
      .withMessage("Format must be one of: pdf, csv, excel"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
  ],
  createTaxReport
);

/**
 * @route GET /api/reports/health
 * @desc Health check for reports service
 * @access Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Reports service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
    capabilities: {
      formats: ["pdf", "csv", "excel", "json"],
      types: [
        "tax_report",
        "performance_report",
        "portfolio_summary",
        "trading_activity",
      ],
      scheduling: true,
      emailDelivery: true,
    },
  });
});

module.exports = router;
