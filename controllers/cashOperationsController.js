const Portfolio = require("../models/Portfolio");
const CashOperation = require("../models/CashOperation");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get all cash operations for user with analytics
 * @route GET /api/cash-operations
 * @access Private
 */
const getCashOperations = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      portfolioId,
      type,
      currency,
      status = "completed",
      dateFrom,
      dateTo,
      period = 30,
      page = 1,
      limit = 20,
      sortBy = "time",
      sortOrder = "desc",
      includeStats = true,
    } = req.query;

    // Build query
    const query = { userId };
    if (portfolioId) query.portfolioId = portfolioId;
    if (type) query.type = type;
    if (currency) query.currency = currency;
    if (status) query.status = status;

    if (dateFrom || dateTo) {
      query.time = {};
      if (dateFrom) query.time.$gte = new Date(dateFrom);
      if (dateTo) query.time.$lte = new Date(dateTo);
    } else if (period) {
      // Default period filter
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      query.time = { $gte: startDate };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute main query
    const [operations, total] = await Promise.all([
      CashOperation.find(query)
        .populate("portfolioId", "name broker currency")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      CashOperation.countDocuments(query),
    ]);

    let responseData = {
      operations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
        hasNext: page < Math.ceil(total / parseInt(limit)),
        hasPrev: page > 1,
      },
    };

    // Include analytics if requested
    if (includeStats === "true" || includeStats === true) {
      const statsQuery = { ...query };
      delete statsQuery.time; // Get all-time stats

      const allOperations = await CashOperation.find(statsQuery);

      // Calculate balance by currency
      const balanceByType = {
        income: ["deposit", "dividend", "interest", "bonus"],
        expense: ["withdrawal", "fee", "tax"],
      };

      const analytics = allOperations.reduce((acc, op) => {
        const currency = op.currency || "PLN";
        if (!acc[currency]) {
          acc[currency] = {
            balance: 0,
            totalIncome: 0,
            totalExpense: 0,
            operationsCount: 0,
          };
        }

        const isIncome = balanceByType.income.includes(op.type);
        const amount = Math.abs(op.amount);

        if (isIncome) {
          acc[currency].balance += amount;
          acc[currency].totalIncome += amount;
        } else {
          acc[currency].balance -= amount;
          acc[currency].totalExpense += amount;
        }

        acc[currency].operationsCount++;
        return acc;
      }, {});

      // Calculate period summary for filtered operations
      const periodSummary = operations.reduce(
        (acc, op) => {
          const isIncome = balanceByType.income.includes(op.type);
          const amount = Math.abs(op.amount);

          if (isIncome) {
            acc.periodIncome += amount;
          } else {
            acc.periodExpense += amount;
          }
          return acc;
        },
        { periodIncome: 0, periodExpense: 0 }
      );

      responseData.analytics = {
        balanceByCurrenty: analytics,
        periodSummary: {
          ...periodSummary,
          netCashFlow: periodSummary.periodIncome - periodSummary.periodExpense,
          period: parseInt(period),
        },
        totalBalance: Object.values(analytics).reduce(
          (sum, curr) => sum + curr.balance,
          0
        ),
      };
    }

    return res.json({
      success: true,
      message: "Cash operations retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Get cash operations error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching cash operations",
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
      portfolioId,
      type,
      amount,
      currency = "PLN",
      comment,
      symbol,
      time,
      notes,
      tags = [],
      status = "completed",
      taxInfo = {},
    } = req.body;

    // Validate portfolioId if provided
    if (portfolioId) {
      const portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
      if (!portfolio) {
        return res.status(404).json({
          success: false,
          message: "Portfolio not found",
        });
      }
    }

    // Ensure amount is positive for income types, negative for expense types
    const incomeTypes = ["deposit", "dividend", "interest", "bonus"];
    const expenseTypes = ["withdrawal", "fee", "tax"];

    let finalAmount = Math.abs(parseFloat(amount));
    if (expenseTypes.includes(type)) {
      finalAmount = -finalAmount; // Make expenses negative
    }

    const operation = new CashOperation({
      userId,
      portfolioId: portfolioId || null,
      type,
      amount: finalAmount,
      currency: currency.toUpperCase(),
      comment: comment.trim(),
      symbol: symbol ? symbol.toUpperCase() : undefined,
      time: time ? new Date(time) : new Date(),
      notes: notes ? notes.trim() : undefined,
      tags: tags.map((tag) => tag.trim()),
      status,
      taxInfo: {
        taxable: taxInfo.taxable || false,
        taxRate: taxInfo.taxRate || 0,
        taxAmount: taxInfo.taxAmount || 0,
      },
    });

    await operation.save();

    // Populate portfolio info in response
    await operation.populate("portfolioId", "name broker currency");

    return res.status(201).json({
      success: true,
      message: "Cash operation created successfully",
      data: { operation },
    });
  } catch (error) {
    console.error("Create cash operation error:", error);
    return res.status(500).json({
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

    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.createdAt;

    // Sanitize text fields
    if (updateData.comment) updateData.comment = updateData.comment.trim();
    if (updateData.notes) updateData.notes = updateData.notes.trim();
    if (updateData.symbol) updateData.symbol = updateData.symbol.toUpperCase();
    if (updateData.currency)
      updateData.currency = updateData.currency.toUpperCase();
    if (updateData.time) updateData.time = new Date(updateData.time);
    if (updateData.tags)
      updateData.tags = updateData.tags.map((tag) => tag.trim());

    // Handle amount sign correction based on type
    if (updateData.amount && updateData.type) {
      const expenseTypes = ["withdrawal", "fee", "tax"];
      let finalAmount = Math.abs(parseFloat(updateData.amount));
      if (expenseTypes.includes(updateData.type)) {
        finalAmount = -finalAmount;
      }
      updateData.amount = finalAmount;
    }

    const operation = await CashOperation.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    ).populate("portfolioId", "name broker currency");

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Cash operation not found",
      });
    }

    return res.json({
      success: true,
      message: "Cash operation updated successfully",
      data: { operation },
    });
  } catch (error) {
    console.error("Update cash operation error:", error);
    return res.status(500).json({
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
    const { permanent = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID format",
      });
    }

    let operation;

    if (permanent === "true") {
      // Hard delete
      operation = await CashOperation.findOneAndDelete({ _id: id, userId });
    } else {
      // Soft delete - mark as cancelled
      operation = await CashOperation.findOneAndUpdate(
        { _id: id, userId },
        {
          status: "cancelled",
          notes: (existing) =>
            existing ? `${existing} [CANCELLED]` : "[CANCELLED]",
        },
        { new: true }
      );
    }

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Cash operation not found",
      });
    }

    return res.json({
      success: true,
      message:
        permanent === "true"
          ? "Cash operation deleted permanently"
          : "Cash operation cancelled successfully",
      data: {
        deletedOperation: {
          id: operation._id,
          type: operation.type,
          amount: operation.amount,
          currency: operation.currency,
          status: operation.status,
        },
      },
    });
  } catch (error) {
    console.error("Delete cash operation error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting cash operation",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  getCashOperations,
  createCashOperation,
  updateCashOperation,
  deleteCashOperation,
};
