const CashOperation = require("../models/CashOperation");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc    Get all cash operations for user
 * @route   GET /api/cash-operations
 * @access  Private
 */
const getCashOperations = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type,
      currency,
      symbol,
      status = "completed",
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
      sortBy = "time",
      sortOrder = "desc",
    } = req.query;

    const options = {
      type,
      currency,
      symbol,
      status,
      dateFrom,
      dateTo,
      sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
      limit: parseInt(limit),
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { userId };
    if (type) query.type = type;
    if (currency) query.currency = currency;
    if (symbol) query.symbol = new RegExp(symbol, "i");
    if (status) query.status = status;

    // Date range filter
    if (dateFrom || dateTo) {
      query.time = {};
      if (dateFrom) query.time.$gte = new Date(dateFrom);
      if (dateTo) query.time.$lte = new Date(dateTo);
    }

    // Execute queries
    const [operations, total] = await Promise.all([
      CashOperation.find(query)
        .sort(options.sort)
        .skip(skip)
        .limit(parseInt(limit)),
      CashOperation.countDocuments(query),
    ]);

    // Calculate balance
    const balance = await CashOperation.calculateBalance(userId, currency);

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
        balance:
          typeof balance === "object"
            ? balance
            : { [currency || "total"]: balance },
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
 * @desc    Get single cash operation by ID
 * @route   GET /api/cash-operations/:id
 * @access  Private
 */
const getCashOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
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
 * @desc    Create new cash operation
 * @route   POST /api/cash-operations
 * @access  Private
 */
const createCashOperation = async (req, res) => {
  try {
    // Check for validation errors
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
      details = {},
      notes,
      tags,
      taxInfo = {},
    } = req.body;

    // Generate unique operation ID
    const operationId = Date.now() + Math.floor(Math.random() * 1000);

    const operation = new CashOperation({
      userId,
      operationId,
      type,
      time: time ? new Date(time) : new Date(),
      amount: parseFloat(amount),
      currency,
      comment: comment.trim(),
      symbol: symbol ? symbol.toUpperCase() : undefined,
      details,
      notes: notes ? notes.trim() : undefined,
      tags: tags ? tags.map((tag) => tag.trim()) : [],
      taxInfo: {
        taxable: taxInfo.taxable || false,
        taxRate: taxInfo.taxRate || 0,
        taxAmount: taxInfo.taxAmount || 0,
      },
    });

    await operation.save();

    // Calculate new balance
    const balance = await CashOperation.calculateBalance(userId, currency);

    res.status(201).json({
      success: true,
      message: "Cash operation created successfully",
      data: {
        operation,
        balance: { [currency]: balance },
      },
    });
  } catch (error) {
    console.error("Create cash operation error:", error);

    // Handle duplicate operation ID
    if (error.code === 11000 && error.keyPattern?.operationId) {
      return res.status(409).json({
        success: false,
        message: "Operation ID already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Update cash operation
 * @route   PUT /api/cash-operations/:id
 * @access  Private
 */
const updateCashOperation = async (req, res) => {
  try {
    // Check for validation errors
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID format",
      });
    }

    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.operationId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Uppercase symbol if provided
    if (updateData.symbol) {
      updateData.symbol = updateData.symbol.toUpperCase();
    }

    // Trim comment and notes
    if (updateData.comment) {
      updateData.comment = updateData.comment.trim();
    }
    if (updateData.notes) {
      updateData.notes = updateData.notes.trim();
    }

    // Trim tags if provided
    if (updateData.tags) {
      updateData.tags = updateData.tags.map((tag) => tag.trim());
    }

    // Parse amount if provided
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }

    // Parse time if provided
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
 * @desc    Delete cash operation
 * @route   DELETE /api/cash-operations/:id
 * @access  Private
 */
const deleteCashOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
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
          operationId: operation.operationId,
          type: operation.type,
          amount: operation.amount,
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
 * @desc    Get cash balance by currency
 * @route   GET /api/cash-operations/balance
 * @access  Private
 */
const getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, upToDate } = req.query;

    const balance = await CashOperation.calculateBalance(
      userId,
      currency,
      upToDate
    );

    res.json({
      success: true,
      data: {
        balance,
        currency: currency || "all",
        upToDate: upToDate || "now",
      },
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating balance",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get cash flow summary
 * @route   GET /api/cash-operations/cash-flow
 * @access  Private
 */
const getCashFlowSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 30 } = req.query;

    const summary = await CashOperation.getCashFlowSummary(
      userId,
      parseInt(period)
    );

    // Calculate totals
    const totals = summary.reduce(
      (acc, item) => {
        acc.totalAmount += item.totalAmount;
        acc.totalCount += item.count;

        if (item.totalAmount > 0) {
          acc.totalInflow += item.totalAmount;
        } else {
          acc.totalOutflow += Math.abs(item.totalAmount);
        }

        return acc;
      },
      {
        totalAmount: 0,
        totalCount: 0,
        totalInflow: 0,
        totalOutflow: 0,
      }
    );

    res.json({
      success: true,
      data: {
        period: parseInt(period),
        summary,
        totals,
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
 * @desc    Get monthly summary
 * @route   GET /api/cash-operations/monthly/:year/:month
 * @access  Private
 */
const getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.params;

    // Validate year and month
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);

    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      return res.status(400).json({
        success: false,
        message: "Invalid year",
      });
    }

    if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month (1-12)",
      });
    }

    const summary = await CashOperation.getMonthlySummary(
      userId,
      targetYear,
      targetMonth
    );

    res.json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        summary,
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
 * @desc    Get operations by type
 * @route   GET /api/cash-operations/type/:type
 * @access  Private
 */
const getOperationsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    const {
      currency,
      dateFrom,
      dateTo,
      limit = 20,
      sortOrder = "desc",
    } = req.query;

    const validTypes = [
      "deposit",
      "withdrawal",
      "dividend",
      "interest",
      "fee",
      "bonus",
      "transfer",
      "adjustment",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operation type. Valid types: ${validTypes.join(
          ", "
        )}`,
      });
    }

    const query = { userId, type };
    if (currency) query.currency = currency;

    // Date range filter
    if (dateFrom || dateTo) {
      query.time = {};
      if (dateFrom) query.time.$gte = new Date(dateFrom);
      if (dateTo) query.time.$lte = new Date(dateTo);
    }

    const operations = await CashOperation.find(query)
      .sort({ time: sortOrder === "desc" ? -1 : 1 })
      .limit(parseInt(limit));

    // Calculate summary for this type
    const summary = operations.reduce(
      (acc, op) => {
        acc.totalAmount += op.amount;
        acc.count += 1;
        return acc;
      },
      { totalAmount: 0, count: 0 }
    );

    res.json({
      success: true,
      data: {
        type,
        operations,
        summary,
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
};
