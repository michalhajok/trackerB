/**
 * Financial Calculations Utility
 * Comprehensive set of financial calculation functions for portfolio management
 */

/**
 * Position P&L Calculations
 */
const positionCalculations = {
  /**
   * Calculate gross P&L for a position
   * @param {Object} position - Position object
   * @returns {number} Gross P&L
   */
  calculateGrossPL: (position) => {
    const { type, volume, openPrice, closePrice, marketPrice } = position;

    if (!volume || !openPrice) return 0;

    const currentPrice = closePrice || marketPrice || openPrice;

    if (type === "BUY") {
      return (currentPrice - openPrice) * volume;
    } else if (type === "SELL") {
      return (openPrice - currentPrice) * volume;
    }

    return 0;
  },

  /**
   * Calculate net P&L for a position
   * @param {Object} position - Position object
   * @returns {number} Net P&L
   */
  calculateNetPL: (position) => {
    const grossPL = positionCalculations.calculateGrossPL(position);
    const commission = position.commission || 0;
    const swap = position.swap || 0;
    const taxes = position.taxes || 0;

    return grossPL - commission - swap - taxes;
  },

  /**
   * Calculate P&L percentage
   * @param {Object} position - Position object
   * @returns {number} P&L percentage
   */
  calculatePLPercentage: (position) => {
    const { volume, openPrice } = position;

    if (!volume || !openPrice) return 0;

    const investedAmount = volume * openPrice;
    if (investedAmount === 0) return 0;

    const grossPL = positionCalculations.calculateGrossPL(position);
    return (grossPL / investedAmount) * 100;
  },

  /**
   * Calculate position value
   * @param {Object} position - Position object
   * @returns {number} Current position value
   */
  calculatePositionValue: (position) => {
    const { volume, closePrice, marketPrice, openPrice } = position;

    if (!volume) return 0;

    const currentPrice = closePrice || marketPrice || openPrice;
    return volume * currentPrice;
  },

  /**
   * Calculate position duration in days
   * @param {Object} position - Position object
   * @returns {number} Duration in days
   */
  calculatePositionDuration: (position) => {
    const { openTime, closeTime } = position;

    if (!openTime) return 0;

    const endTime = closeTime || new Date();
    const startTime = new Date(openTime);

    return Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24));
  },
};

/**
 * Portfolio Calculations
 */
const portfolioCalculations = {
  /**
   * Calculate total portfolio value
   * @param {Array} positions - Array of positions
   * @returns {number} Total portfolio value
   */
  calculatePortfolioValue: (positions) => {
    if (!Array.isArray(positions)) return 0;

    return positions
      .filter((pos) => pos.status === "open")
      .reduce((total, position) => {
        return total + positionCalculations.calculatePositionValue(position);
      }, 0);
  },

  /**
   * Calculate total P&L
   * @param {Array} positions - Array of positions
   * @param {string} type - 'gross' or 'net'
   * @returns {Object} P&L summary
   */
  calculateTotalPL: (positions, type = "gross") => {
    if (!Array.isArray(positions)) {
      return { total: 0, open: 0, closed: 0 };
    }

    const calculator =
      type === "net"
        ? positionCalculations.calculateNetPL
        : positionCalculations.calculateGrossPL;

    const openPositions = positions.filter((pos) => pos.status === "open");
    const closedPositions = positions.filter((pos) => pos.status === "closed");

    const openPL = openPositions.reduce((sum, pos) => sum + calculator(pos), 0);
    const closedPL = closedPositions.reduce(
      (sum, pos) => sum + calculator(pos),
      0
    );

    return {
      total: openPL + closedPL,
      open: openPL,
      closed: closedPL,
      positions: {
        total: positions.length,
        open: openPositions.length,
        closed: closedPositions.length,
      },
    };
  },

  /**
   * Calculate portfolio allocation
   * @param {Array} positions - Array of positions
   * @param {string} groupBy - Group by field (symbol, sector, currency, etc.)
   * @returns {Array} Allocation breakdown
   */
  calculateAllocation: (positions, groupBy = "symbol") => {
    if (!Array.isArray(positions)) return [];

    const openPositions = positions.filter((pos) => pos.status === "open");
    const totalValue =
      portfolioCalculations.calculatePortfolioValue(openPositions);

    if (totalValue === 0) return [];

    // Group positions
    const groups = {};

    openPositions.forEach((position) => {
      const key = position[groupBy] || "Unknown";
      if (!groups[key]) {
        groups[key] = {
          label: key,
          positions: [],
          totalValue: 0,
          totalPL: 0,
        };
      }

      const positionValue =
        positionCalculations.calculatePositionValue(position);
      const positionPL = positionCalculations.calculateGrossPL(position);

      groups[key].positions.push(position);
      groups[key].totalValue += positionValue;
      groups[key].totalPL += positionPL;
    });

    // Convert to array with percentages
    return Object.values(groups)
      .map((group) => ({
        ...group,
        percentage: (group.totalValue / totalValue) * 100,
        count: group.positions.length,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  },

  /**
   * Calculate portfolio diversification metrics
   * @param {Array} positions - Array of positions
   * @returns {Object} Diversification metrics
   */
  calculateDiversification: (positions) => {
    if (!Array.isArray(positions) || positions.length === 0) {
      return { concentrationRisk: 0, diversificationRatio: 0 };
    }

    const openPositions = positions.filter((pos) => pos.status === "open");
    const totalValue =
      portfolioCalculations.calculatePortfolioValue(openPositions);

    if (totalValue === 0 || openPositions.length === 0) {
      return { concentrationRisk: 0, diversificationRatio: 0 };
    }

    // Calculate concentration (largest position percentage)
    const positionValues = openPositions.map((pos) =>
      positionCalculations.calculatePositionValue(pos)
    );

    const maxPosition = Math.max(...positionValues);
    const concentrationRisk = (maxPosition / totalValue) * 100;

    // Calculate diversification ratio (1 / sum of squares of weights)
    const weights = positionValues.map((value) => value / totalValue);
    const sumOfSquares = weights.reduce(
      (sum, weight) => sum + weight * weight,
      0
    );
    const diversificationRatio = sumOfSquares > 0 ? 1 / sumOfSquares : 0;

    return {
      concentrationRisk: Math.round(concentrationRisk * 100) / 100,
      diversificationRatio: Math.round(diversificationRatio * 100) / 100,
      effectivePositions: Math.round((1 / sumOfSquares) * 100) / 100,
    };
  },
};

/**
 * Performance Calculations
 */
const performanceCalculations = {
  /**
   * Calculate total return
   * @param {number} initialValue - Initial investment
   * @param {number} currentValue - Current portfolio value
   * @param {Array} cashflows - Array of cash operations
   * @returns {Object} Return metrics
   */
  calculateTotalReturn: (initialValue, currentValue, cashflows = []) => {
    if (initialValue <= 0) return { absolute: 0, percentage: 0 };

    const netCashflows = cashflows.reduce((sum, cf) => {
      if (cf.type === "deposit") return sum + cf.amount;
      if (cf.type === "withdrawal") return sum - Math.abs(cf.amount);
      return sum;
    }, 0);

    const totalInvested = initialValue + netCashflows;
    const absoluteReturn = currentValue - totalInvested;
    const percentageReturn =
      totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

    return {
      absolute: Math.round(absoluteReturn * 100) / 100,
      percentage: Math.round(percentageReturn * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
    };
  },

  /**
   * Calculate annualized return
   * @param {number} totalReturn - Total return percentage
   * @param {number} years - Investment period in years
   * @returns {number} Annualized return percentage
   */
  calculateAnnualizedReturn: (totalReturn, years) => {
    if (years <= 0) return 0;

    const totalReturnDecimal = totalReturn / 100;
    const annualizedReturn = Math.pow(1 + totalReturnDecimal, 1 / years) - 1;

    return Math.round(annualizedReturn * 10000) / 100; // Percentage with 2 decimals
  },

  /**
   * Calculate Sharpe ratio
   * @param {Array} returns - Array of periodic returns
   * @param {number} riskFreeRate - Risk-free rate (annual)
   * @returns {number} Sharpe ratio
   */
  calculateSharpeRatio: (returns, riskFreeRate = 0) => {
    if (!Array.isArray(returns) || returns.length < 2) return 0;

    const avgReturn = statisticalCalculations.mean(returns);
    const stdDev = statisticalCalculations.standardDeviation(returns);

    if (stdDev === 0) return 0;

    return Math.round(((avgReturn - riskFreeRate) / stdDev) * 100) / 100;
  },

  /**
   * Calculate maximum drawdown
   * @param {Array} values - Array of portfolio values over time
   * @returns {Object} Drawdown metrics
   */
  calculateMaxDrawdown: (values) => {
    if (!Array.isArray(values) || values.length < 2) {
      return { maxDrawdown: 0, maxDrawdownPercentage: 0, duration: 0 };
    }

    let maxDrawdown = 0;
    let maxDrawdownPercentage = 0;
    let peak = values[0];
    let peakIndex = 0;
    let maxDuration = 0;
    let currentDrawdownStart = -1;

    for (let i = 1; i < values.length; i++) {
      const currentValue = values[i];

      if (currentValue > peak) {
        // New peak
        peak = currentValue;
        peakIndex = i;

        // End current drawdown
        if (currentDrawdownStart >= 0) {
          const duration = i - currentDrawdownStart;
          maxDuration = Math.max(maxDuration, duration);
          currentDrawdownStart = -1;
        }
      } else {
        // In drawdown
        if (currentDrawdownStart === -1) {
          currentDrawdownStart = peakIndex;
        }

        const drawdown = peak - currentValue;
        const drawdownPercentage = (drawdown / peak) * 100;

        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercentage = drawdownPercentage;
        }
      }
    }

    // Check if still in drawdown
    if (currentDrawdownStart >= 0) {
      const duration = values.length - 1 - currentDrawdownStart;
      maxDuration = Math.max(maxDuration, duration);
    }

    return {
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercentage: Math.round(maxDrawdownPercentage * 100) / 100,
      duration: maxDuration,
    };
  },

  /**
   * Calculate win rate for closed positions
   * @param {Array} closedPositions - Array of closed positions
   * @returns {Object} Win rate metrics
   */
  calculateWinRate: (closedPositions) => {
    if (!Array.isArray(closedPositions) || closedPositions.length === 0) {
      return { winRate: 0, totalTrades: 0, winners: 0, losers: 0 };
    }

    const winners = closedPositions.filter(
      (pos) => positionCalculations.calculateGrossPL(pos) > 0
    );

    const losers = closedPositions.filter(
      (pos) => positionCalculations.calculateGrossPL(pos) < 0
    );

    const winRate = (winners.length / closedPositions.length) * 100;

    return {
      winRate: Math.round(winRate * 100) / 100,
      totalTrades: closedPositions.length,
      winners: winners.length,
      losers: losers.length,
    };
  },

  /**
   * Calculate profit factor
   * @param {Array} closedPositions - Array of closed positions
   * @returns {number} Profit factor
   */
  calculateProfitFactor: (closedPositions) => {
    if (!Array.isArray(closedPositions) || closedPositions.length === 0)
      return 0;

    const grossProfits = closedPositions
      .map((pos) => positionCalculations.calculateGrossPL(pos))
      .filter((pl) => pl > 0)
      .reduce((sum, pl) => sum + pl, 0);

    const grossLosses = Math.abs(
      closedPositions
        .map((pos) => positionCalculations.calculateGrossPL(pos))
        .filter((pl) => pl < 0)
        .reduce((sum, pl) => sum + pl, 0)
    );

    if (grossLosses === 0) return grossProfits > 0 ? Infinity : 0;

    return Math.round((grossProfits / grossLosses) * 100) / 100;
  },
};

/**
 * Risk Calculations
 */
const riskCalculations = {
  /**
   * Calculate portfolio volatility (standard deviation of returns)
   * @param {Array} returns - Array of periodic returns
   * @returns {number} Volatility (annualized)
   */
  calculateVolatility: (returns) => {
    if (!Array.isArray(returns) || returns.length < 2) return 0;

    const stdDev = statisticalCalculations.standardDeviation(returns);

    // Annualize volatility (assuming daily returns)
    const annualizedVolatility = stdDev * Math.sqrt(252);

    return Math.round(annualizedVolatility * 10000) / 100;
  },

  /**
   * Calculate Value at Risk (VaR)
   * @param {Array} returns - Array of returns
   * @param {number} confidence - Confidence level (e.g., 0.95 for 95%)
   * @returns {number} VaR
   */
  calculateVaR: (returns, confidence = 0.95) => {
    if (!Array.isArray(returns) || returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);

    return Math.round(sortedReturns[index] * 100) / 100;
  },

  /**
   * Calculate beta (correlation with market)
   * @param {Array} portfolioReturns - Portfolio returns
   * @param {Array} marketReturns - Market returns
   * @returns {number} Beta coefficient
   */
  calculateBeta: (portfolioReturns, marketReturns) => {
    if (!Array.isArray(portfolioReturns) || !Array.isArray(marketReturns))
      return 0;
    if (portfolioReturns.length !== marketReturns.length) return 0;
    if (portfolioReturns.length < 2) return 0;

    const covariance = statisticalCalculations.covariance(
      portfolioReturns,
      marketReturns
    );
    const marketVariance = statisticalCalculations.variance(marketReturns);

    if (marketVariance === 0) return 0;

    return Math.round((covariance / marketVariance) * 100) / 100;
  },
};

/**
 * Statistical Helper Functions
 */
const statisticalCalculations = {
  /**
   * Calculate mean (average)
   * @param {Array} values - Array of numbers
   * @returns {number} Mean value
   */
  mean: (values) => {
    if (!Array.isArray(values) || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  },

  /**
   * Calculate median
   * @param {Array} values - Array of numbers
   * @returns {number} Median value
   */
  median: (values) => {
    if (!Array.isArray(values) || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  },

  /**
   * Calculate variance
   * @param {Array} values - Array of numbers
   * @returns {number} Variance
   */
  variance: (values) => {
    if (!Array.isArray(values) || values.length < 2) return 0;

    const mean = statisticalCalculations.mean(values);
    const sumSquaredDiffs = values.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0);

    return sumSquaredDiffs / (values.length - 1);
  },

  /**
   * Calculate standard deviation
   * @param {Array} values - Array of numbers
   * @returns {number} Standard deviation
   */
  standardDeviation: (values) => {
    return Math.sqrt(statisticalCalculations.variance(values));
  },

  /**
   * Calculate covariance between two arrays
   * @param {Array} x - First array
   * @param {Array} y - Second array
   * @returns {number} Covariance
   */
  covariance: (x, y) => {
    if (!Array.isArray(x) || !Array.isArray(y)) return 0;
    if (x.length !== y.length || x.length < 2) return 0;

    const meanX = statisticalCalculations.mean(x);
    const meanY = statisticalCalculations.mean(y);

    const covariance = x.reduce((sum, xi, i) => {
      return sum + (xi - meanX) * (y[i] - meanY);
    }, 0);

    return covariance / (x.length - 1);
  },

  /**
   * Calculate correlation coefficient
   * @param {Array} x - First array
   * @param {Array} y - Second array
   * @returns {number} Correlation coefficient (-1 to 1)
   */
  correlation: (x, y) => {
    const covariance = statisticalCalculations.covariance(x, y);
    const stdX = statisticalCalculations.standardDeviation(x);
    const stdY = statisticalCalculations.standardDeviation(y);

    if (stdX === 0 || stdY === 0) return 0;

    return covariance / (stdX * stdY);
  },
};

/**
 * Cash Flow Calculations
 */
const cashFlowCalculations = {
  /**
   * Calculate net cash flow
   * @param {Array} cashOperations - Array of cash operations
   * @returns {Object} Cash flow summary
   */
  calculateNetCashFlow: (cashOperations) => {
    if (!Array.isArray(cashOperations)) {
      return { deposits: 0, withdrawals: 0, net: 0 };
    }

    const deposits = cashOperations
      .filter((op) => op.type === "deposit")
      .reduce((sum, op) => sum + Math.abs(op.amount), 0);

    const withdrawals = cashOperations
      .filter((op) => op.type === "withdrawal")
      .reduce((sum, op) => sum + Math.abs(op.amount), 0);

    const dividends = cashOperations
      .filter((op) => op.type === "dividend")
      .reduce((sum, op) => sum + Math.abs(op.amount), 0);

    const fees = cashOperations
      .filter((op) => op.type === "fee")
      .reduce((sum, op) => sum + Math.abs(op.amount), 0);

    return {
      deposits: Math.round(deposits * 100) / 100,
      withdrawals: Math.round(withdrawals * 100) / 100,
      dividends: Math.round(dividends * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      net: Math.round((deposits - withdrawals + dividends - fees) * 100) / 100,
    };
  },

  /**
   * Calculate current cash balance
   * @param {Array} cashOperations - Array of cash operations
   * @param {string} currency - Currency filter (optional)
   * @returns {number|Object} Balance (number if currency specified, object otherwise)
   */
  calculateCurrentBalance: (cashOperations, currency = null) => {
    if (!Array.isArray(cashOperations)) return currency ? 0 : {};

    if (currency) {
      // Calculate balance for specific currency
      return cashOperations
        .filter((op) => op.currency === currency && op.status === "completed")
        .reduce((sum, op) => sum + op.amount, 0);
    } else {
      // Calculate balance for all currencies
      const balances = {};

      cashOperations
        .filter((op) => op.status === "completed")
        .forEach((op) => {
          const curr = op.currency || "USD";
          balances[curr] = (balances[curr] || 0) + op.amount;
        });

      return balances;
    }
  },
};

/**
 * Utility Functions
 */
const utils = {
  /**
   * Format currency value
   * @param {number} value - Numeric value
   * @param {string} currency - Currency code
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted currency string
   */
  formatCurrency: (value, currency = "USD", decimals = 2) => {
    if (typeof value !== "number" || isNaN(value)) return "0.00";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  },

  /**
   * Format percentage
   * @param {number} value - Numeric value
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted percentage string
   */
  formatPercentage: (value, decimals = 2) => {
    if (typeof value !== "number" || isNaN(value)) return "0.00%";

    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Calculate compound annual growth rate (CAGR)
   * @param {number} beginningValue - Starting value
   * @param {number} endingValue - Ending value
   * @param {number} years - Number of years
   * @returns {number} CAGR percentage
   */
  calculateCAGR: (beginningValue, endingValue, years) => {
    if (beginningValue <= 0 || years <= 0) return 0;

    const cagr = Math.pow(endingValue / beginningValue, 1 / years) - 1;
    return Math.round(cagr * 10000) / 100; // Percentage with 2 decimals
  },

  /**
   * Round to specified decimal places
   * @param {number} value - Value to round
   * @param {number} decimals - Number of decimal places
   * @returns {number} Rounded value
   */
  roundTo: (value, decimals = 2) => {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },
};

module.exports = {
  positionCalculations,
  portfolioCalculations,
  performanceCalculations,
  riskCalculations,
  statisticalCalculations,
  cashFlowCalculations,
  utils,
};
