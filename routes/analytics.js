const express = require("express");
const { query } = require("express-validator");
const {
  getDashboard,
  getPerformance,
  getAllocation,
  getStatistics,
} = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get("/dashboard", getDashboard);

/**
 * @route   GET /api/analytics/performance
 * @desc    Get performance data
 * @access  Private
 */
router.get(
  "/performance",
  [
    query("period")
      .optional()
      .isIn(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"])
      .withMessage("Period must be one of: 1D, 1W, 1M, 3M, 6M, 1Y, ALL"),
    query("interval")
      .optional()
      .isIn(["hour", "day", "week", "month"])
      .withMessage("Interval must be one of: hour, day, week, month"),
  ],
  getPerformance
);

/**
 * @route   GET /api/analytics/allocation
 * @desc    Get portfolio allocation
 * @access  Private
 */
router.get(
  "/allocation",
  [
    query("groupBy")
      .optional()
      .isIn(["symbol", "sector", "exchange", "currency", "type"])
      .withMessage(
        "Group by must be one of: symbol, sector, exchange, currency, type"
      ),
  ],
  getAllocation
);

/**
 * @route   GET /api/analytics/statistics
 * @desc    Get detailed statistics
 * @access  Private
 */
router.get(
  "/statistics",
  [
    query("period")
      .optional()
      .isIn(["1M", "3M", "6M", "1Y", "ALL"])
      .withMessage("Period must be one of: 1M, 3M, 6M, 1Y, ALL"),
  ],
  getStatistics
);

/**
 * @route   GET /api/analytics/health
 * @desc    Health check for analytics service
 * @access  Private
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Analytics service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
