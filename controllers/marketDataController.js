const MarketData = require("../models/MarketData");
const Portfolio = require("../models/Portfolio");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

/**
 * @desc Get market data for symbol
 * @route GET /api/market-data/:symbol
 * @access Public
 */
const getMarketData = async (req, res) => {
  try {
    const { symbol } = req.params;

    const marketData = await MarketData.findBySymbol(symbol);

    if (!marketData) {
      return res.status(404).json({
        success: false,
        message: "Market data not found for this symbol",
      });
    }

    res.json({
      success: true,
      data: {
        marketData,
      },
    });
  } catch (error) {
    console.error("Get market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching market data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get multiple symbols market data
 * @route POST /api/market-data/batch
 * @access Public
 */
const getBatchMarketData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { symbols } = req.body;

    const marketData = await MarketData.find({
      symbol: { $in: symbols.map((s) => s.toUpperCase()) },
      "dataSource.isActive": true,
    }).sort({ symbol: 1 });

    res.json({
      success: true,
      data: {
        marketData,
        count: marketData.length,
      },
    });
  } catch (error) {
    console.error("Get batch market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching batch market data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Update market data for symbol
 * @route PUT /api/market-data/:symbol
 * @access Private (Admin/System)
 */
const updateMarketData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { symbol } = req.params;
    const priceData = req.body;

    let marketData = await MarketData.findBySymbol(symbol);

    if (!marketData) {
      // Create new market data entry
      marketData = new MarketData({
        symbol: symbol.toUpperCase(),
        currentPrice: priceData.price,
        dataSource: {
          provider: priceData.provider || "manual",
          lastUpdate: new Date(),
        },
      });
    }

    await marketData.updatePrice(priceData);

    res.json({
      success: true,
      message: "Market data updated successfully",
      data: {
        marketData,
      },
    });
  } catch (error) {
    console.error("Update market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating market data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Bulk update market data
 * @route PUT /api/market-data/bulk-update
 * @access Private (Admin/System)
 */
const bulkUpdateMarketData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { priceUpdates } = req.body;

    const result = await MarketData.bulkUpdatePrices(priceUpdates);

    res.json({
      success: true,
      message: "Bulk market data update completed",
      data: {
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        matchedCount: result.matchedCount,
      },
    });
  } catch (error) {
    console.error("Bulk update market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing bulk market data update",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get active symbols
 * @route GET /api/market-data/symbols
 * @access Public
 */
const getActiveSymbols = async (req, res) => {
  try {
    const { exchange } = req.query;

    const symbols = await MarketData.findActiveSymbols(exchange);

    res.json({
      success: true,
      data: {
        symbols,
        count: symbols.length,
      },
    });
  } catch (error) {
    console.error("Get active symbols error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching active symbols",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get market summary
 * @route GET /api/market-data/summary
 * @access Public
 */
const getMarketSummary = async (req, res) => {
  try {
    const { exchange } = req.query;

    const summary = await MarketData.getMarketSummary(exchange);

    res.json({
      success: true,
      data: {
        summary,
      },
    });
  } catch (error) {
    console.error("Get market summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching market summary",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get top movers
 * @route GET /api/market-data/movers
 * @access Public
 */
const getTopMovers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const movers = await MarketData.getTopMovers(parseInt(limit));

    const [gainers, losers, mostActive] = await Promise.all([
      movers.gainers,
      movers.losers,
      movers.mostActive,
    ]);

    res.json({
      success: true,
      data: {
        gainers,
        losers,
        mostActive,
      },
    });
  } catch (error) {
    console.error("Get top movers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top movers",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Search symbols
 * @route GET /api/market-data/search
 * @access Public
 */
const searchSymbols = async (req, res) => {
  try {
    const { q: searchTerm, limit = 20 } = req.query;

    if (!searchTerm || searchTerm.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Search term is required and must be at least 1 character",
      });
    }

    const results = await MarketData.searchSymbols(searchTerm, parseInt(limit));

    res.json({
      success: true,
      data: {
        results,
        searchTerm,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("Search symbols error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching symbols",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get historical data for symbol
 * @route GET /api/market-data/:symbol/history
 * @access Public
 */
const getHistoricalData = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { periods = 50 } = req.query;

    const marketData = await MarketData.findBySymbol(symbol);

    if (!marketData) {
      return res.status(404).json({
        success: false,
        message: "Market data not found for this symbol",
      });
    }

    const history = marketData.getPriceHistory(parseInt(periods));

    res.json({
      success: true,
      data: {
        symbol: marketData.symbol,
        history,
        periods: parseInt(periods),
      },
    });
  } catch (error) {
    console.error("Get historical data error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching historical data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get symbols by sector
 * @route GET /api/market-data/sectors/:sector
 * @access Public
 */
const getSymbolsBySector = async (req, res) => {
  try {
    const { sector } = req.params;
    const { limit = 50 } = req.query;

    const symbols = await MarketData.findBySector(sector, parseInt(limit));

    res.json({
      success: true,
      data: {
        sector,
        symbols,
        count: symbols.length,
      },
    });
  } catch (error) {
    console.error("Get symbols by sector error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching symbols by sector",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Record data source error
 * @route POST /api/market-data/:symbol/error
 * @access Private (System)
 */
const recordError = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { errorMessage } = req.body;

    if (!errorMessage) {
      return res.status(400).json({
        success: false,
        message: "Error message is required",
      });
    }

    const marketData = await MarketData.findBySymbol(symbol);

    if (!marketData) {
      return res.status(404).json({
        success: false,
        message: "Market data not found for this symbol",
      });
    }

    await marketData.recordError(errorMessage);

    res.json({
      success: true,
      message: "Error recorded successfully",
      data: {
        symbol: marketData.symbol,
        errorCount: marketData.dataSource.errorCount,
        isActive: marketData.dataSource.isActive,
      },
    });
  } catch (error) {
    console.error("Record error:", error);
    res.status(500).json({
      success: false,
      message: "Error recording data source error",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get symbols needing update
 * @route GET /api/market-data/update-needed
 * @access Private (System)
 */
const getSymbolsNeedingUpdate = async (req, res) => {
  try {
    const symbols = await MarketData.findSymbolsNeedingUpdate();

    res.json({
      success: true,
      data: {
        symbols,
        count: symbols.length,
      },
    });
  } catch (error) {
    console.error("Get symbols needing update error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching symbols needing update",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create new market data entry
 * @route POST /api/market-data
 * @access Private (Admin)
 */
const createMarketData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      symbol,
      name,
      currentPrice,
      marketInfo = {},
      metadata = {},
      dataSource = {},
    } = req.body;

    // Check if symbol already exists
    const existing = await MarketData.findBySymbol(symbol);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Market data for this symbol already exists",
      });
    }

    const marketData = new MarketData({
      symbol: symbol.toUpperCase(),
      name: name ? name.trim() : undefined,
      currentPrice,
      marketInfo: {
        exchange: marketInfo.exchange,
        currency: marketInfo.currency || "USD",
        sector: marketInfo.sector,
        industry: marketInfo.industry,
        country: marketInfo.country,
        marketCap: marketInfo.marketCap,
      },
      metadata: {
        assetType: metadata.assetType || "stock",
        isin: metadata.isin,
        cusip: metadata.cusip,
        ticker: metadata.ticker,
      },
      dataSource: {
        provider: dataSource.provider || "manual",
        updateFrequency: dataSource.updateFrequency || 5,
        isActive: dataSource.isActive !== false,
      },
    });

    await marketData.save();

    res.status(201).json({
      success: true,
      message: "Market data created successfully",
      data: {
        marketData,
      },
    });
  } catch (error) {
    console.error("Create market data error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating market data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Cleanup old historical data
 * @route DELETE /api/market-data/cleanup
 * @access Private (Admin)
 */
const cleanupOldData = async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.query;

    const result = await MarketData.cleanupOldData(parseInt(daysToKeep));

    res.json({
      success: true,
      message: "Old data cleanup completed",
      data: {
        modifiedCount: result.modifiedCount,
        daysKept: parseInt(daysToKeep),
      },
    });
  } catch (error) {
    console.error("Cleanup old data error:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up old data",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = {
  getMarketData,
  getBatchMarketData,
  updateMarketData,
  bulkUpdateMarketData,
  getActiveSymbols,
  getMarketSummary,
  getTopMovers,
  searchSymbols,
  getHistoricalData,
  getSymbolsBySector,
  recordError,
  getSymbolsNeedingUpdate,
  createMarketData,
  cleanupOldData,
};
