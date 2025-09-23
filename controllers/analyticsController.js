const Position = require("../models/Position");
const CashOperation = require("../models/CashOperation");
const PendingOrder = require("../models/PendingOrder");
const mongoose = require("mongoose");

/**
 * @desc    Get dashboard data
 * @route   GET /api/analytics/dashboard
 * @access  Private
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all necessary data in parallel
    const [
      openPositions,
      closedPositions,
      activeOrders,
      cashBalance,
      portfolioValue,
      totalPL,
      recentActivity,
    ] = await Promise.all([
      Position.find({ userId, status: "open" }),
      Position.countDocuments({ userId, status: "closed" }),
      PendingOrder.countDocuments({
        userId,
        status: { $in: ["pending", "partial"] },
      }),
      CashOperation.calculateBalance(userId),
      Position.calculatePortfolioValue(userId),
      Position.calculateTotalPL(userId),
      getRecentActivity(userId, 10),
    ]);

    // Calculate portfolio metrics
    const openPositionsCount = openPositions.length;
    const totalOpenPL = openPositions.reduce(
      (sum, pos) => sum + (pos.grossPL || 0),
      0
    );
    const totalInvested = openPositions.reduce(
      (sum, pos) => sum + pos.purchaseValue,
      0
    );

    // Calculate day change (mock data - in real app you'd track daily changes)
    const dayChange = totalOpenPL * 0.1; // Mock 10% of current P&L as day change
    const dayChangePercent =
      totalInvested > 0 ? (dayChange / totalInvested) * 100 : 0;

    // Get top performing positions
    const topGainers = openPositions
      .filter((pos) => pos.grossPL > 0)
      .sort((a, b) => b.grossPL - a.grossPL)
      .slice(0, 5)
      .map((pos) => ({
        symbol: pos.symbol,
        grossPL: pos.grossPL,
        plPercentage: pos.plPercentage,
        currentValue: pos.currentValue,
      }));

    const topLosers = openPositions
      .filter((pos) => pos.grossPL < 0)
      .sort((a, b) => a.grossPL - b.grossPL)
      .slice(0, 5)
      .map((pos) => ({
        symbol: pos.symbol,
        grossPL: pos.grossPL,
        plPercentage: pos.plPercentage,
        currentValue: pos.currentValue,
      }));

    res.json({
      success: true,
      data: {
        portfolio: {
          totalValue: portfolioValue,
          totalCash:
            typeof cashBalance === "object"
              ? Object.values(cashBalance).reduce((sum, val) => sum + val, 0)
              : cashBalance,
          totalPL: totalPL.totalGrossPL,
          netPL: totalPL.totalNetPL,
          dayChange,
          dayChangePercent,
        },
        positions: {
          open: openPositionsCount,
          closed: closedPositions,
          totalOpenPL,
          totalInvested,
        },
        orders: {
          active: activeOrders,
        },
        performance: {
          topGainers,
          topLosers,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get performance data
 * @route   GET /api/analytics/performance
 * @access  Private
 */
const getPerformance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = "1Y", interval = "day" } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "1D":
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "1W":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "1M":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Get positions and cash operations within date range
    const [positions, cashOps] = await Promise.all([
      Position.find({
        userId,
        $or: [
          { openTime: { $gte: startDate, $lte: endDate } },
          { closeTime: { $gte: startDate, $lte: endDate } },
        ],
      }).sort({ openTime: 1 }),
      CashOperation.find({
        userId,
        time: { $gte: startDate, $lte: endDate },
        status: "completed",
      }).sort({ time: 1 }),
    ]);

    // Generate performance timeline
    const timeline = generatePerformanceTimeline(
      positions,
      cashOps,
      startDate,
      endDate,
      interval
    );

    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(positions, cashOps);

    res.json({
      success: true,
      data: {
        period,
        interval,
        timeline,
        metrics,
      },
    });
  } catch (error) {
    console.error("Get performance error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching performance data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get portfolio allocation
 * @route   GET /api/analytics/allocation
 * @access  Private
 */
const getAllocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupBy = "symbol" } = req.query;

    const openPositions = await Position.find({ userId, status: "open" });

    if (openPositions.length === 0) {
      return res.json({
        success: true,
        data: {
          groupBy,
          allocation: [],
          totalValue: 0,
        },
      });
    }

    let allocation = [];
    const totalValue = openPositions.reduce(
      (sum, pos) => sum + pos.currentValue,
      0
    );

    switch (groupBy) {
      case "symbol":
        allocation = calculateAllocationBySymbol(openPositions, totalValue);
        break;
      case "sector":
        allocation = calculateAllocationBySector(openPositions, totalValue);
        break;
      case "exchange":
        allocation = calculateAllocationByExchange(openPositions, totalValue);
        break;
      case "currency":
        allocation = calculateAllocationByCurrency(openPositions, totalValue);
        break;
      case "type":
        allocation = calculateAllocationByType(openPositions, totalValue);
        break;
      default:
        allocation = calculateAllocationBySymbol(openPositions, totalValue);
    }

    res.json({
      success: true,
      data: {
        groupBy,
        allocation,
        totalValue,
        positionsCount: openPositions.length,
      },
    });
  } catch (error) {
    console.error("Get allocation error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching allocation data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get detailed statistics
 * @route   GET /api/analytics/statistics
 * @access  Private
 */
const getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = "1Y" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "1M":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case "ALL":
        startDate.setFullYear(2000); // Get all data
        break;
      default:
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Get data within period
    const [positions, cashOps, orders] = await Promise.all([
      Position.find({
        userId,
        $or: [
          { openTime: { $gte: startDate, $lte: endDate } },
          { closeTime: { $gte: startDate, $lte: endDate } },
        ],
      }),
      CashOperation.find({
        userId,
        time: { $gte: startDate, $lte: endDate },
        status: "completed",
      }),
      PendingOrder.find({
        userId,
        openTime: { $gte: startDate, $lte: endDate },
      }),
    ]);

    // Calculate comprehensive statistics
    const stats = {
      period,
      trading: calculateTradingStatistics(positions),
      financial: calculateFinancialStatistics(positions, cashOps),
      risk: calculateRiskStatistics(positions),
      activity: calculateActivityStatistics(positions, cashOps, orders),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// Helper functions

/**
 * Get recent activity for dashboard
 */
const getRecentActivity = async (userId, limit = 10) => {
  try {
    const [recentPositions, recentCashOps, recentOrders] = await Promise.all([
      Position.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("symbol type status grossPL updatedAt"),
      CashOperation.find({ userId, status: "completed" })
        .sort({ time: -1 })
        .limit(5)
        .select("type amount currency time comment"),
      PendingOrder.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select("symbol side status updatedAt"),
    ]);

    const activities = [];

    // Add position activities
    recentPositions.forEach((pos) => {
      activities.push({
        type: "position",
        action: pos.status === "closed" ? "closed" : "updated",
        symbol: pos.symbol,
        data: pos,
        timestamp: pos.updatedAt,
      });
    });

    // Add cash operation activities
    recentCashOps.forEach((op) => {
      activities.push({
        type: "cash_operation",
        action: op.type,
        data: op,
        timestamp: op.time,
      });
    });

    // Add order activities
    recentOrders.forEach((order) => {
      activities.push({
        type: "order",
        action: order.status,
        symbol: order.symbol,
        data: order,
        timestamp: order.updatedAt,
      });
    });

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  } catch (error) {
    console.error("Get recent activity error:", error);
    return [];
  }
};

/**
 * Generate performance timeline
 */
const generatePerformanceTimeline = (
  positions,
  cashOps,
  startDate,
  endDate,
  interval
) => {
  const timeline = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    // Calculate portfolio value at this point in time
    let portfolioValue = 0;
    let cashBalance = 0;
    let totalPL = 0;

    // Add cash operations up to this date
    const cashOpsUpToDate = cashOps.filter((op) => new Date(op.time) <= dayEnd);
    cashBalance = cashOpsUpToDate.reduce((sum, op) => sum + op.amount, 0);

    // Add position values up to this date
    const activePositions = positions.filter((pos) => {
      const openTime = new Date(pos.openTime);
      const closeTime = pos.closeTime ? new Date(pos.closeTime) : null;
      return openTime <= dayEnd && (!closeTime || closeTime > dayEnd);
    });

    portfolioValue = activePositions.reduce((sum, pos) => {
      const value = pos.marketPrice
        ? pos.marketPrice * pos.volume
        : pos.purchaseValue;
      return sum + value;
    }, 0);

    totalPL = activePositions.reduce((sum, pos) => sum + (pos.grossPL || 0), 0);

    timeline.push({
      date: new Date(current).toISOString(),
      portfolioValue,
      cashBalance,
      totalValue: portfolioValue + cashBalance,
      totalPL,
    });

    // Move to next interval
    switch (interval) {
      case "hour":
        current.setHours(current.getHours() + 1);
        break;
      case "day":
        current.setDate(current.getDate() + 1);
        break;
      case "week":
        current.setDate(current.getDate() + 7);
        break;
      case "month":
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        current.setDate(current.getDate() + 1);
    }
  }

  return timeline;
};

/**
 * Calculate performance metrics
 */
const calculatePerformanceMetrics = (positions, cashOps) => {
  const closedPositions = positions.filter((pos) => pos.status === "closed");
  const totalInvested = Math.abs(
    cashOps
      .filter((op) => op.type === "deposit")
      .reduce((sum, op) => sum + op.amount, 0)
  );

  const totalPL = positions.reduce((sum, pos) => sum + (pos.grossPL || 0), 0);
  const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const winningTrades = closedPositions.filter((pos) => pos.grossPL > 0);
  const losingTrades = closedPositions.filter((pos) => pos.grossPL < 0);
  const winRate =
    closedPositions.length > 0
      ? (winningTrades.length / closedPositions.length) * 100
      : 0;

  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, pos) => sum + pos.grossPL, 0) /
        winningTrades.length
      : 0;
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce((sum, pos) => sum + pos.grossPL, 0) /
            losingTrades.length
        )
      : 0;

  return {
    totalReturn,
    totalPL,
    totalInvested,
    winRate,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    avgWin,
    avgLoss,
    profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
  };
};

/**
 * Calculate allocation by symbol
 */
const calculateAllocationBySymbol = (positions, totalValue) => {
  const symbolMap = new Map();

  positions.forEach((pos) => {
    const existing = symbolMap.get(pos.symbol) || { value: 0, positions: 0 };
    existing.value += pos.currentValue;
    existing.positions += 1;
    symbolMap.set(pos.symbol, existing);
  });

  return Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({
      label: symbol,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      positions: data.positions,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Calculate allocation by sector
 */
const calculateAllocationBySector = (positions, totalValue) => {
  const sectorMap = new Map();

  positions.forEach((pos) => {
    const sector = pos.sector || "Unknown";
    const existing = sectorMap.get(sector) || { value: 0, positions: 0 };
    existing.value += pos.currentValue;
    existing.positions += 1;
    sectorMap.set(sector, existing);
  });

  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      label: sector,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      positions: data.positions,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Calculate allocation by exchange
 */
const calculateAllocationByExchange = (positions, totalValue) => {
  const exchangeMap = new Map();

  positions.forEach((pos) => {
    const exchange = pos.exchange || "Unknown";
    const existing = exchangeMap.get(exchange) || { value: 0, positions: 0 };
    existing.value += pos.currentValue;
    existing.positions += 1;
    exchangeMap.set(exchange, existing);
  });

  return Array.from(exchangeMap.entries())
    .map(([exchange, data]) => ({
      label: exchange,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      positions: data.positions,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Calculate allocation by currency
 */
const calculateAllocationByCurrency = (positions, totalValue) => {
  const currencyMap = new Map();

  positions.forEach((pos) => {
    const existing = currencyMap.get(pos.currency) || {
      value: 0,
      positions: 0,
    };
    existing.value += pos.currentValue;
    existing.positions += 1;
    currencyMap.set(pos.currency, existing);
  });

  return Array.from(currencyMap.entries())
    .map(([currency, data]) => ({
      label: currency,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      positions: data.positions,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Calculate allocation by type
 */
const calculateAllocationByType = (positions, totalValue) => {
  const typeMap = new Map();

  positions.forEach((pos) => {
    const existing = typeMap.get(pos.type) || { value: 0, positions: 0 };
    existing.value += pos.currentValue;
    existing.positions += 1;
    typeMap.set(pos.type, existing);
  });

  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      label: type,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      positions: data.positions,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Calculate trading statistics
 */
const calculateTradingStatistics = (positions) => {
  const closedPositions = positions.filter((pos) => pos.status === "closed");
  const openPositions = positions.filter((pos) => pos.status === "open");

  const winningTrades = closedPositions.filter((pos) => pos.grossPL > 0);
  const losingTrades = closedPositions.filter((pos) => pos.grossPL < 0);

  return {
    totalTrades: closedPositions.length,
    openPositions: openPositions.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      closedPositions.length > 0
        ? (winningTrades.length / closedPositions.length) * 100
        : 0,
    avgTradeDuration: calculateAvgTradeDuration(closedPositions),
    maxWin: Math.max(...winningTrades.map((pos) => pos.grossPL), 0),
    maxLoss: Math.min(...losingTrades.map((pos) => pos.grossPL), 0),
  };
};

/**
 * Calculate financial statistics
 */
const calculateFinancialStatistics = (positions, cashOps) => {
  const totalDeposits = cashOps
    .filter((op) => op.type === "deposit")
    .reduce((sum, op) => sum + op.amount, 0);

  const totalWithdrawals = Math.abs(
    cashOps
      .filter((op) => op.type === "withdrawal")
      .reduce((sum, op) => sum + op.amount, 0)
  );

  const totalDividends = cashOps
    .filter((op) => op.type === "dividend")
    .reduce((sum, op) => sum + op.amount, 0);

  const totalPL = positions.reduce((sum, pos) => sum + (pos.grossPL || 0), 0);
  const netPL = positions.reduce((sum, pos) => sum + (pos.netPL || 0), 0);
  const totalCommissions = positions.reduce(
    (sum, pos) => sum + (pos.commission || 0),
    0
  );
  const totalTaxes = positions.reduce((sum, pos) => sum + (pos.taxes || 0), 0);

  return {
    totalDeposits,
    totalWithdrawals,
    totalDividends,
    totalPL,
    netPL,
    totalCommissions,
    totalTaxes,
    netCashFlow: totalDeposits - totalWithdrawals + totalDividends,
    roi: totalDeposits > 0 ? (totalPL / totalDeposits) * 100 : 0,
  };
};

/**
 * Calculate risk statistics
 */
const calculateRiskStatistics = (positions) => {
  const closedPositions = positions.filter((pos) => pos.status === "closed");
  const returns = closedPositions.map((pos) => pos.plPercentage);

  if (returns.length < 2) {
    return {
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      var95: 0,
    };
  }

  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
    returns.length;
  const volatility = Math.sqrt(variance);

  const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let cumulativePL = 0;

  closedPositions.forEach((pos) => {
    cumulativePL += pos.grossPL;
    if (cumulativePL > peak) {
      peak = cumulativePL;
    }
    const drawdown = ((peak - cumulativePL) / Math.abs(peak)) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Value at Risk (95% confidence)
  const sortedReturns = returns.sort((a, b) => a - b);
  const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)] || 0;

  return {
    volatility,
    sharpeRatio,
    maxDrawdown,
    var95,
  };
};

/**
 * Calculate activity statistics
 */
const calculateActivityStatistics = (positions, cashOps, orders) => {
  return {
    totalPositions: positions.length,
    totalCashOperations: cashOps.length,
    totalOrders: orders.length,
    avgPositionsPerMonth: calculateAvgPerMonth(positions, "openTime"),
    avgCashOpsPerMonth: calculateAvgPerMonth(cashOps, "time"),
    mostTradedSymbol: getMostTradedSymbol(positions),
    tradingFrequency: calculateTradingFrequency(positions),
  };
};

/**
 * Calculate average trade duration
 */
const calculateAvgTradeDuration = (closedPositions) => {
  if (closedPositions.length === 0) return 0;

  const totalDuration = closedPositions.reduce((sum, pos) => {
    if (pos.closeTime && pos.openTime) {
      return sum + (new Date(pos.closeTime) - new Date(pos.openTime));
    }
    return sum;
  }, 0);

  return Math.floor(
    totalDuration / closedPositions.length / (1000 * 60 * 60 * 24)
  ); // days
};

/**
 * Calculate average per month
 */
const calculateAvgPerMonth = (items, dateField) => {
  if (items.length === 0) return 0;

  const dates = items.map((item) => new Date(item[dateField]));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const monthsDiff =
    (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
    (maxDate.getMonth() - minDate.getMonth()) +
    1;

  return monthsDiff > 0 ? items.length / monthsDiff : 0;
};

/**
 * Get most traded symbol
 */
const getMostTradedSymbol = (positions) => {
  const symbolCounts = positions.reduce((acc, pos) => {
    acc[pos.symbol] = (acc[pos.symbol] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(symbolCounts);
  if (entries.length === 0) return null;

  const [symbol, count] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
  return { symbol, count };
};

/**
 * Calculate trading frequency
 */
const calculateTradingFrequency = (positions) => {
  if (positions.length < 2) return 0;

  const dates = positions.map((pos) => new Date(pos.openTime)).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  return daysDiff > 0 ? (positions.length / daysDiff) * 30 : 0; // trades per month
};

module.exports = {
  getDashboard,
  getPerformance,
  getAllocation,
  getStatistics,
};
