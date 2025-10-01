// controllers/portfoliosController.js

const FileImport = require("../models/FileImport");
const Portfolio = require("../models/Portfolio");
const Position = require("../models/Position");
const CashOperation = require("../models/CashOperation");
const PendingOrder = require("../models/PendingOrder");
const XLSX = require("xlsx");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;
const jwt = require("jsonwebtoken");
const BrokerService = require("../services/BrokerService");

/**
 * @desc    Get all portfolios for user
 * @route   GET /api/portfolios
 * @access  Private
 */
const getPortfolios = async (req, res) => {
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
      includeInactive = false,
      broker,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;
    const query = { userId: req.user.id };
    if (!includeInactive) query.isActive = true;
    if (broker) query.broker = broker;

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const portfolios = await Portfolio.find(query)
      .sort(sort)
      .populate("positions", "symbol volume marketValue grossPL status");

    const portfoliosWithStats = await Promise.all(
      portfolios.map(async (p) => {
        await p.updateStats();
        return p.toJSON();
      })
    );

    res.json({
      success: true,
      message: "Portfolios retrieved successfully",
      data: {
        portfolios: portfoliosWithStats,
        totalCount: portfoliosWithStats.length,
      },
    });
  } catch (error) {
    console.error("Get portfolios error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolios",
      error: error.message,
    });
  }
};

/**
 * @desc    Get aggregated portfolio statistics
 * @route   GET /api/portfolios/stats
 * @access  Private
 */
const getPortfolioStats = async (req, res) => {
  try {
    const stats = await Portfolio.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalPortfolios: { $sum: 1 },
          totalValue: { $sum: "$stats.totalValue" },
          totalPL: { $sum: "$stats.totalPL" },
          totalOpenPositions: { $sum: "$stats.openPositionsCount" },
          totalClosedPositions: { $sum: "$stats.closedPositionsCount" },
          brokerBreakdown: {
            $push: {
              broker: "$broker",
              value: "$stats.totalValue",
              pl: "$stats.totalPL",
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalPortfolios: 0,
      totalValue: 0,
      totalPL: 0,
      totalOpenPositions: 0,
      totalClosedPositions: 0,
      brokerBreakdown: [],
    };

    const brokerStats = result.brokerBreakdown.reduce((acc, item) => {
      acc[item.broker] = acc[item.broker] || { value: 0, pl: 0, count: 0 };
      acc[item.broker].value += item.value;
      acc[item.broker].pl += item.pl;
      acc[item.broker].count += 1;
      return acc;
    }, {});

    res.json({
      success: true,
      message: "Portfolio statistics retrieved successfully",
      data: {
        ...result,
        brokerStats,
        totalPLPercent:
          result.totalValue > 0
            ? (result.totalPL / result.totalValue) * 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Get portfolio stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio statistics",
      error: error.message,
    });
  }
};

/**
 * @desc    Create new portfolio
 * @route   POST /api/portfolios
 * @access  Private
 */
const createPortfolio = async (req, res) => {
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
      name,
      description,
      broker,
      currency,
      brokerConfig = {},
      settings = {},
    } = req.body;
    const existing = await Portfolio.findOne({
      userId: req.user.id,
      name,
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Portfolio with this name already exists",
      });
    }

    const portfolio = new Portfolio({
      userId: req.user.id,
      name,
      description,
      broker,
      currency,
      brokerConfig: { ...brokerConfig, lastSyncStatus: "never" },
      settings: { autoSync: true, notificationsEnabled: true, ...settings },
    });
    await portfolio.save();

    res.status(201).json({
      success: true,
      message: "Portfolio created successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Create portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create portfolio",
      error: error.message,
    });
  }
};

/**
 * @desc    Sync portfolio with broker
 * @route   POST /api/portfolios/:id/sync
 * @access  Private
 */
const syncPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!portfolio)
      return res
        .status(404)
        .json({ success: false, message: "Portfolio not found" });
    if (!portfolio.canSync()) {
      return res.status(400).json({
        success: false,
        message: "Portfolio sync is disabled or broker not supported",
      });
    }

    portfolio.brokerConfig.lastSyncStatus = "in_progress";
    await portfolio.save();

    BrokerService.syncPortfolio(portfolio._id)
      .then(async () => {
        portfolio.brokerConfig.lastSync = new Date();
        portfolio.brokerConfig.lastSyncStatus = "success";
        portfolio.brokerConfig.lastSyncError = null;
        await portfolio.save();
        await portfolio.updateStats();
      })
      .catch(async (err) => {
        portfolio.brokerConfig.lastSyncStatus = "error";
        portfolio.brokerConfig.lastSyncError = err.message;
        await portfolio.save();
      });

    res.json({
      success: true,
      message: "Portfolio sync started",
      data: { portfolioId: portfolio._id, syncStatus: "in_progress" },
    });
  } catch (error) {
    console.error("Sync portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync portfolio",
      error: error.message,
    });
  }
};

/**
 * @desc    Get single portfolio
 * @route   GET /api/portfolios/:id
 * @access  Private
 */
const getPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("positions");
    if (!portfolio) {
      return res
        .status(404)
        .json({ success: false, message: "Portfolio not found" });
    }
    res.json({
      success: true,
      message: "Portfolio retrieved successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Get portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio",
      error: error.message,
    });
  }
};

/**
 * @desc    Update portfolio
 * @route   PUT /api/portfolios/:id
 * @access  Private
 */
const updatePortfolio = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, description, brokerConfig, settings } = req.body;
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!portfolio)
      return res
        .status(404)
        .json({ success: false, message: "Portfolio not found" });

    if (name && name !== portfolio.name) {
      const dupe = await Portfolio.findOne({
        userId: req.user.id,
        name,
        isActive: true,
        _id: { $ne: portfolio._id },
      });
      if (dupe) {
        return res.status(400).json({
          success: false,
          message: "Portfolio with this name already exists",
        });
      }
      portfolio.name = name;
    }

    if (description !== undefined) portfolio.description = description;
    if (brokerConfig)
      portfolio.brokerConfig = {
        ...portfolio.brokerConfig.toObject(),
        ...brokerConfig,
      };
    if (settings)
      portfolio.settings = { ...portfolio.settings.toObject(), ...settings };

    await portfolio.save();
    res.json({
      success: true,
      message: "Portfolio updated successfully",
      data: portfolio.toJSON(),
    });
  } catch (error) {
    console.error("Update portfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update portfolio",
      error: error.message,
    });
  }
};

/**
 * @desc    Import portfolio data (file upload)
 * @route   POST /api/portfolios/:id/import
 * @access  Private
 */
const importPortfolio = async (req, res) => {
  try {
    const { id: portfolioId } = req.params;
    const portfolio = await Portfolio.findOne({
      _id: portfolioId,
      userId: req.user.id,
    });
    if (!portfolio) {
      return res
        .status(404)
        .json({ success: false, message: "Portfolio not found" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // Verify JWT and extract userId
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No authentication token provided" });
    }
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id || decoded.user?.id;
      if (!userId) throw new Error("Invalid token payload");
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "Invalid authentication token" });
    }

    // Create FileImport record
    const fileImport = new FileImport({
      userId,
      portfolioId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      importType: req.body.importType || "mixed",
      importDate: new Date(),
      startTime: new Date(),
      status: "pending",
      storage: { path: req.file.path },
      processing: {
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        errorRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
      },
      recordsCount: {
        positions: 0,
        cashOperations: 0,
        pendingOrders: 0,
        total: 0,
      },
      metadata: {
        userAgent: req.headers["user-agent"] || "unknown",
        ipAddress: req.ip || "unknown",
        source: "web_upload",
      },
      cleanup: { deleteFileAfterImport: false, retentionDays: 30 },
      rollback: { canRollback: true, isRolledBack: false },
    });
    await fileImport.save();

    // Fire and forget background processing
    processFileAsync(fileImport._id, userId, portfolioId);

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        id: fileImport._id,
        filename: fileImport.originalName,
        status: fileImport.status,
        importType: fileImport.importType,
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import file",
      error: error.message,
    });
  }
};

/**
 * Background processing of uploaded file
 */
/**
 * Background processing of uploaded file
 */
async function processFileAsync(fileImportId, userId, portfolioId) {
  const fileImport = await FileImport.findById(fileImportId);
  if (!fileImport) {
    console.error("FileImport not found:", fileImportId);
    return;
  }

  // 🔧 DEBUG - sprawdź co mamy
  console.log("🔍 FileImport data:", {
    _id: fileImport._id,
    portfolioId: portfolioId,
    userId: fileImport.userId,
    filename: fileImport.originalName,
  });

  // const { portfolioId } = fileImport; // ✅ Wydobądź portfolioId

  if (!portfolioId) {
    console.error("❌ Portfolio ID is missing from FileImport");
    return;
  }

  try {
    const workbook = XLSX.readFile(fileImport.storage.path);
    const sheets = workbook.SheetNames;
    console.log("📊 Found sheets:", sheets);

    let stats = {
      processed: 0,
      successful: 0,
      errors: 0,
      positions: 0,
      cash: 0,
      orders: 0,
    };

    for (const sheetName of sheets) {
      console.log(`📄 Processing sheet: ${sheetName}`);

      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });

      if (/position/i.test(sheetName)) {
        console.log(
          `✅ Calling processPositionsSheet with portfolioId: ${portfolioId}`
        );
        const { processed, successful, errors } = await processPositionsSheet(
          data,
          userId,
          portfolioId, // ✅ Przekazuj jako string
          fileImportId
        );
        stats.processed += processed;
        stats.successful += successful;
        stats.errors += errors;
        stats.positions += successful;
      } else if (/cash/i.test(sheetName)) {
        console.log(
          `✅ Calling processCashOperationsSheet with portfolioId: ${portfolioId}`
        );
        const { processed, successful, errors } =
          await processCashOperationsSheet(
            data,
            userId,
            portfolioId, // ✅ Przekazuj jako string
            fileImportId
          );
        stats.processed += processed;
        stats.successful += successful;
        stats.errors += errors;
        stats.cash += successful;
      } else if (/pending/i.test(sheetName)) {
        console.log(
          `✅ Calling processPendingOrdersSheet with portfolioId: ${portfolioId}`
        );
        const { processed, successful, errors } =
          await processPendingOrdersSheet(
            data,
            userId,
            portfolioId, // ✅ Przekazuj jako string
            fileImportId
          );
        stats.processed += processed;
        stats.successful += successful;
        stats.errors += errors;
        stats.orders += successful;
      }
    }

    // Update FileImport with results
    fileImport.processing = {
      totalRows: stats.processed,
      processedRows: stats.processed,
      successfulRows: stats.successful,
      errorRows: stats.errors,
      skippedRows: 0,
      duplicateRows: 0,
    };

    fileImport.recordsCount = {
      positions: stats.positions,
      cashOperations: stats.cash,
      pendingOrders: stats.orders,
      total: stats.successful,
    };

    fileImport.status = "completed";
    fileImport.endTime = new Date();
    await fileImport.save();

    console.log(
      `✅ Import completed: ${stats.successful} successful, ${stats.errors} errors`
    );
  } catch (err) {
    console.error("❌ Background processing error:", err);
    fileImport.status = "failed";
    fileImport.error = err.message;
    await fileImport.save();
  }
}

/**
 * Process positions sheet - parse and save Position documents.
 * @param {Array[]} data - 2D array of sheet rows (header + data).
 * @param {string} userId
 * @param {string} fileImportId
 * @returns {Promise<{processed:number,successful:number,errors:number}>}
 */

async function processPositionsSheet(data, userId, portfolioId, fileImportId) {
  let processed = 0,
    successful = 0,
    errors = 0;

  try {
    // Znajdź wiersz z nagłówkami - używaj rzeczywistych nagłówków z XTB
    const headerRow = data.find(
      (r) =>
        r.includes("Position") ||
        (r.includes("Symbol") && r.includes("Type") && r.includes("Volume"))
    );

    if (!headerRow) return { processed, successful, errors };

    const headers = headerRow.map((h) => h.toString().trim().toLowerCase());
    const idx = (name) => headers.indexOf(name);

    // Pobierz portfolio RAZ na początku
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      console.error(`Portfolio ${portfolioId} not found`);
      return { processed, successful, errors };
    }

    const { broker, brokerConfig } = portfolio;
    const start = data.indexOf(headerRow) + 1;

    for (let i = start; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[1]) continue; // skip empty rows

      processed++;

      try {
        // Mapuj kolumny z XTB - bazując na rzeczywistych danych
        const positionId = row[idx("position")] || `POS_${Date.now()}_${i}`;
        const symbol = row[idx("symbol")]?.toString().trim();
        const type = row[idx("type")]?.toString().trim().toUpperCase() || "BUY";
        const volume = parseFloat(row[idx("volume")]) || 0;
        const openPrice = parseFloat(row[idx("open price")]) || 0;
        const openTime = row[idx("open time")]
          ? new Date(row[idx("open time")])
          : new Date();
        const closeTime = row[idx("close time")]
          ? new Date(row[idx("close time")])
          : null;
        const closePrice = parseFloat(row[idx("close price")]) || null;
        const purchaseValue =
          parseFloat(row[idx("purchase value")]) || volume * openPrice;
        const grossPL = parseFloat(row[idx("gross p/l")]) || 0;

        if (!symbol || volume <= 0) {
          errors++;
          continue;
        }

        const position = new Position({
          userId,
          fileImportId,
          portfolioId: portfolioId, // ✅ POPRAW: użyj przekazanego parametru
          positionId: positionId,
          symbol: symbol.substring(0, 10), // ograniczenie długości
          type,
          volume,
          openPrice,
          openTime,
          closeTime,
          closePrice,
          purchaseValue,
          grossPL,
          status: closeTime ? "closed" : "open",
          brokerData: {
            broker: broker || "XTB",
            brokerAccountId: brokerConfig?.accountId || "unknown",
            brokerSymbol: symbol,
          },
        });

        await position.save();
        successful++;
      } catch (e) {
        console.error(`Positions row ${i + 1} error:`, e.message);
        errors++;
      }
    }
  } catch (e) {
    console.error("processPositionsSheet error:", e);
    errors++;
  }

  return { processed, successful, errors };
}

/**
 * Parse and save CashOperation documents from sheet data.
 * @param {Array[]} data - 2D array of rows (header + data).
 * @param {string} userId
 * @param {string} portfolioId
 * @param {string} fileImportId
 * @returns {Promise<{processed:number,successful:number,errors:number}>}
 */
async function processCashOperationsSheet(
  data,
  userId,
  portfolioId,
  fileImportId
) {
  let processed = 0,
    successful = 0,
    errors = 0;

  // Find header row
  const headerRow = data.find(
    (row) => row.includes("Type") && row.includes("Amount")
  );
  if (!headerRow) return { processed, successful, errors };

  // Normalize headers
  const headers = headerRow.map((h) => h.toString().trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);

  // Fetch portfolio once
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    console.error(`Portfolio ${portfolioId} not found`);
    return { processed, successful, errors };
  }
  const { broker, brokerConfig } = portfolio;
  const defaultSymbol = portfolio.name.substring(0, 10).toUpperCase();

  // Type mapping aligned with schema enum
  const typeMap = {
    deposit: "deposit",
    withdrawal: "withdrawal",
    dividend: "dividend",
    divident: "dividend",
    interest: "interest",
    fee: "fee",
    commission: "fee",
    bonus: "bonus",
    transfer: "transfer",
    "subaccount transfer": "subaccount_transfer",
    "stock purchase": "stock_purchase",
    "stock sale": "stock_sale",
    "close trade": "close_trade",
    adjustment: "adjustment",
    "fractional shares": "fractional_shares",
    correction: "correction",
    tax: "tax",
    "withholding tax": "withholding_tax",
  };

  // Process each data row
  for (let i = data.indexOf(headerRow) + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < headers.length) continue;
    processed++;

    const rawType = row[idx("type")]?.toString().trim().toLowerCase() || "";
    const key = Object.keys(typeMap).find((k) => rawType.includes(k));
    if (!key) {
      console.warn(`Skipped unknown cash type "${rawType}" at row ${i + 1}`);
      errors++;
      continue;
    }
    const type = typeMap[key];

    let amount = parseFloat(row[idx("amount")]) || 0;
    if (amount === 0) {
      console.warn(`Skipped zero amount at row ${i + 1}`);
      errors++;
      continue;
    }
    // For interest ensure positive
    if (type === "interest") amount = Math.abs(amount);

    const timeCell = row[idx("time")] || row[idx("date")];
    const time = timeCell ? new Date(timeCell) : new Date();
    const comment = row[idx("comment")]?.toString().trim() || "Imported";
    const currency = row[idx("currency")] || portfolio.currency || "PLN";
    const operationId = Date.now() * 1000 + i;

    // Symbol only required for dividend; truncate to 10 chars
    let symbol = row[idx("symbol")]?.toString().trim().toUpperCase();
    if (type === "dividend")
      symbol = symbol ? symbol.substring(0, 10) : defaultSymbol;
    else symbol = symbol ? symbol.substring(0, 10) : "";

    try {
      const cashOp = new CashOperation({
        userId,
        fileImportId,
        portfolioId,
        operationId,
        type,
        amount,
        currency,
        time,
        comment,
        purchaseValue: amount,
        symbol,
        brokerData: {
          broker,
          brokerAccountId: brokerConfig.accountId,
          brokerSymbol: symbol || defaultSymbol,
        },
        source: "import",
        importBatchId: fileImportId,
      });
      await cashOp.save();
      successful++;
    } catch (e) {
      console.error(`Cash row ${i + 1} error:`, e.message);
      errors++;
    }
  }
  return { processed, successful, errors };
}

// ********** Process pending orders sheet **********
async function processPendingOrdersSheet(
  data,
  userId,
  portfolioId,
  fileImportId
) {
  let processed = 0,
    successful = 0,
    errors = 0;
  try {
    const headerRow = data.find(
      (r) => r.includes("Symbol") && r.includes("Price")
    );
    if (!headerRow) return { processed, successful, errors };
    const headers = headerRow.map((h) => h.toString().trim().toLowerCase());
    const idx = (name) => headers.indexOf(name);

    const portfolio = await Portfolio.findById(portfolioId);
    const { broker, brokerConfig } = portfolio;

    const start = data.indexOf(headerRow) + 1;
    for (let i = start; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < headers.length) continue;
      processed++;
      try {
        const symbol = row[idx("symbol")]?.toString().trim();
        const sideRaw =
          row[idx("side")]?.toString().trim().toUpperCase() || "BUY";
        const side = sideRaw.includes("SELL") ? "SELL" : "BUY";
        const volume = parseFloat(row[idx("volume")]) || 0;
        const price = parseFloat(row[idx("price")]) || 0;
        const createdAt = row[idx("date")]
          ? new Date(row[idx("date")])
          : new Date();
        const comment = row[idx("comment")]?.toString().trim() || "Imported";

        if (!symbol || volume <= 0 || price <= 0) {
          errors++;
          continue;
        }

        const order = new PendingOrder({
          userId,
          fileImportId,
          portfolioId,
          orderId: Date.now() * 1000 + i,
          symbol,
          side,
          volume,
          price,
          status: "pending",
          createdAt,
          comment,
          purchaseValue: volume * price,
          brokerData: {
            broker,
            brokerAccountId: brokerConfig.accountId,
            brokerSymbol: symbol,
          },
        });
        await order.save();
        successful++;
      } catch (e) {
        console.error(`Orders row ${i + 1} error:`, e.message);
        errors++;
      }
    }
  } catch (e) {
    console.error("processPendingOrdersSheet error:", e);
  }
  return { processed, successful, errors };
}

module.exports = {
  getPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  syncPortfolio,
  getPortfolioStats,
  importPortfolio,
};
