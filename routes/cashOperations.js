const express = require("express");
// const { body, query, param } = require("express-validator");
const {
  getCashOperations,
  createCashOperation,
  updateCashOperation,
  deleteCashOperation,
} = require("../controllers/cashOperationsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// router.get("/", getCashOperations); // GET /api/cash-operations?includeStats=true&portfolioId=123
// router.post("/", createCashOperation); // POST /api/cash-operations
// router.put("/:id", updateCashOperation); // PUT /api/cash-operations/:id
// router.delete("/:id", deleteCashOperation); // DELETE /api/cash-operations/:id?permanent=true
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Cash operations service is running",
    timestamp: new Date().toISOString(),
    userId: req.user.id,
  });
});

module.exports = router;
