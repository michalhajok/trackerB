const Portfolio = require("../models/Portfolio");
const CashOperation = require("../models/CashOperation");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all cash operations for user
 * @route GET /api/cash-operations
 * @access Private
 */
const getCashOperations = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      currency,
      symbol,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = "time",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { userId };
    if (type) query.type = type;
    if (currency) query.currency = currency;
    if (symbol) query.symbol = symbol.toUpperCase();
    if (status) query.status = status;

    if (dateFrom || dateTo) {
      query.time = {};
      if (dateFrom) query.time.$gte = new Date(dateFrom);
      if (dateTo) query.time.$lte = new Date(dateTo);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute queries
    const [operations, total] = await Promise.all([
      CashOperation.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      CashOperation.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        operations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get cash operations error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cash operations",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get single cash operation by ID
 * @route GET /api/cash-operations/:id
 * @access Private
 */
const getCashOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID format",
      });
    }

    const operation = await CashOperation.findOne({ _id: id, userId });

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Cash operation not found",
      });
    }

    res.json({
      success: true,
      data: {
        operation,
      },
    });
  } catch (error) {
    console.error("Get cash operation error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create new cash operation
 * @route POST /api/cash-operations
 * @access Private
 */
const createCashOperation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const {
      type,
      amount,
      currency = "PLN",
      comment,
      symbol,
      time,
      notes,
      tags = [],
      taxInfo = {},
    } = req.body;

    const operation = new CashOperation({
      userId,
      type,
      amount: parseFloat(amount),
      currency,
      comment: comment.trim(),
      symbol: symbol ? symbol.toUpperCase() : undefined,
      time: time ? new Date(time) : new Date(),
      notes: notes ? notes.trim() : undefined,
      tags,
      taxInfo: {
        taxable: taxInfo.taxable || false,
        taxRate: taxInfo.taxRate || 0,
        taxAmount: taxInfo.taxAmount || 0,
      },
    });

    await operation.save();

    res.status(201).json({
      success: true,
      message: "Cash operation created successfully",
      data: {
        operation,
      },
    });
  } catch (error) {
    console.error("Create cash operation error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Update cash operation
 * @route PUT /api/cash-operations/:id
 * @access Private
 */
const updateCashOperation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID format",
      });
    }

    const updateData = { ...req.body };
    delete updateData.userId; // Prevent userId modification

    if (updateData.comment) {
      updateData.comment = updateData.comment.trim();
    }

    if (updateData.notes) {
      updateData.notes = updateData.notes.trim();
    }

    if (updateData.symbol) {
      updateData.symbol = updateData.symbol.toUpperCase();
    }

    if (updateData.time) {
      updateData.time = new Date(updateData.time);
    }

    const operation = await CashOperation.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Cash operation not found",
      });
    }

    res.json({
      success: true,
      message: "Cash operation updated successfully",
      data: {
        operation,
      },
    });
  } catch (error) {
    console.error("Update cash operation error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Delete cash operation
 * @route DELETE /api/cash-operations/:id
 * @access Private
 */
const deleteCashOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID format",
      });
    }

    const operation = await CashOperation.findOneAndDelete({ _id: id, userId });

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Cash operation not found",
      });
    }

    res.json({
      success: true,
      message: "Cash operation deleted successfully",
      data: {
        deletedOperation: {
          id: operation._id,
          type: operation.type,
          amount: operation.amount,
          currency: operation.currency,
        },
      },
    });
  } catch (error) {
    console.error("Delete cash operation error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get cash balance by currency
 * @route GET /api/cash-operations/balance
 * @access Private
 */
const getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, upToDate } = req.query;

    const query = { userId, status: "completed" };
    if (currency) query.currency = currency;
    if (upToDate) query.time = { $lte: new Date(upToDate) };

    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: "$currency",
          balance: {
            $sum: {
              $cond: [
                {
                  $in: ["$type", ["deposit", "dividend", "interest", "bonus"]],
                },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
          totalDeposits: {
            $sum: {
              $cond: [
                {
                  $in: ["$type", ["deposit", "dividend", "interest", "bonus"]],
                },
                "$amount",
                0,
              ],
            },
          },
          totalWithdrawals: {
            $sum: {
              $cond: [{ $in: ["$type", ["withdrawal", "fee"]] }, "$amount", 0],
            },
          },
          operationCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const balances = await CashOperation.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        balances,
        summary: balances.reduce(
          (acc, curr) => ({
            totalBalance: acc.totalBalance + curr.balance,
            totalDeposits: acc.totalDeposits + curr.totalDeposits,
            totalWithdrawals: acc.totalWithdrawals + curr.totalWithdrawals,
          }),
          { totalBalance: 0, totalDeposits: 0, totalWithdrawals: 0 }
        ),
      },
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching balance",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get cash flow summary
 * @route GET /api/cash-operations/cash-flow
 * @access Private
 */
const getCashFlowSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const pipeline = [
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          status: "completed",
          time: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$time" } },
            type: "$type",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1, "_id.type": 1 } },
    ];

    const cashFlow = await CashOperation.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        period: parseInt(period),
        cashFlow,
      },
    });
  } catch (error) {
    console.error("Get cash flow summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cash flow summary",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get monthly summary
 * @route GET /api/cash-operations/monthly/:year/:month
 * @access Private
 */
const getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.params;

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const operations = await CashOperation.find({
      userId,
      time: { $gte: startDate, $lte: endDate },
      status: "completed",
    }).sort({ time: -1 });

    const summary = operations.reduce((acc, op) => {
      if (!acc[op.type]) {
        acc[op.type] = { total: 0, count: 0, operations: [] };
      }
      acc[op.type].total += op.amount;
      acc[op.type].count += 1;
      acc[op.type].operations.push(op);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        summary,
        totalOperations: operations.length,
      },
    });
  } catch (error) {
    console.error("Get monthly summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching monthly summary",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get operations by type
 * @route GET /api/cash-operations/type/:type
 * @access Private
 */
const getOperationsByType = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.params;
    const {
      currency,
      dateFrom,
      dateTo,
      limit = 50,
      sortOrder = "desc",
    } = req.query;

    const query = { userId, type };
    if (currency) query.currency = currency;

    if (dateFrom || dateTo) {
      query.time = {};
      if (dateFrom) query.time.$gte = new Date(dateFrom);
      if (dateTo) query.time.$lte = new Date(dateTo);
    }

    const operations = await CashOperation.find(query)
      .sort({ time: sortOrder === "desc" ? -1 : 1 })
      .limit(parseInt(limit));

    const statistics = {
      totalAmount: operations.reduce((sum, op) => sum + op.amount, 0),
      count: operations.length,
      averageAmount:
        operations.length > 0
          ? operations.reduce((sum, op) => sum + op.amount, 0) /
            operations.length
          : 0,
    };

    res.json({
      success: true,
      data: {
        type,
        operations,
        statistics,
      },
    });
  } catch (error) {
    console.error("Get operations by type error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching operations by type",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

const getCashOperationsByPortfolio = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const ops = await CashOperation.find({
      portfolioId,
      status: "completed",
    }).sort({ time: -1 });
    res.json({ success: true, data: { operations: ops } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCashOperations,
  getCashOperation,
  createCashOperation,
  updateCashOperation,
  deleteCashOperation,
  getBalance,
  getCashFlowSummary,
  getMonthlySummary,
  getOperationsByType,
  getCashOperationsByPortfolio,
};
