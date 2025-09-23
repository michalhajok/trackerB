const FileImport = require("../models/FileImport");
const Position = require("../models/Position");
const CashOperation = require("../models/CashOperation");
const PendingOrder = require("../models/PendingOrder");
const XLSX = require("xlsx");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;

/**
 * @desc    Upload and process Excel file
 * @route   POST /api/import/upload
 * @access  Private
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user.id;
    const file = req.file;
    const { importType = "mixed", hasHeaders = true } = req.body;

    // Validate file type
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only Excel and CSV files are allowed.",
      });
    }

    // Create file import record
    const fileImport = new FileImport({
      userId,
      filename: file.filename,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      importType,
      storage: {
        path: file.path,
      },
      configuration: {
        hasHeaders: hasHeaders === "true" || hasHeaders === true,
      },
      progress: {
        percentage: 0,
        currentStep: "uploading",
        message: "File uploaded successfully",
      },
    });

    await fileImport.save();

    // Start processing in background
    processFileAsync(fileImport._id, userId);

    res.status(201).json({
      success: true,
      message: "File uploaded successfully. Processing started.",
      data: {
        fileImport: {
          id: fileImport._id,
          filename: fileImport.originalName,
          status: fileImport.status,
          importType: fileImport.importType,
          fileSize: fileImport.fileSize,
        },
      },
    });
  } catch (error) {
    console.error("Upload file error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get import history
 * @route   GET /api/import/history
 * @access  Private
 */
const getImportHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      importType,
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
    } = req.query;

    const options = {
      status,
      importType,
      dateFrom,
      dateTo,
      limit: parseInt(limit),
      sort: { importDate: -1 },
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { userId };
    if (status) query.status = status;
    if (importType) query.importType = importType;

    // Date range filter
    if (dateFrom || dateTo) {
      query.importDate = {};
      if (dateFrom) query.importDate.$gte = new Date(dateFrom);
      if (dateTo) query.importDate.$lte = new Date(dateTo);
    }

    // Execute queries
    const [imports, total] = await Promise.all([
      FileImport.find(query)
        .sort(options.sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select("-preview -rollback.rollbackData -storage.path"),
      FileImport.countDocuments(query),
    ]);

    // Get statistics
    const stats = await FileImport.getImportStatistics(userId, 30);

    res.json({
      success: true,
      data: {
        imports,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        statistics: stats,
      },
    });
  } catch (error) {
    console.error("Get import history error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching import history",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Get import status
 * @route   GET /api/import/:id/status
 * @access  Private
 */
const getImportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import ID format",
      });
    }

    const fileImport = await FileImport.findOne({
      _id: id,
      userId,
    }).select("-rollback.rollbackData -storage.path");

    if (!fileImport) {
      return res.status(404).json({
        success: false,
        message: "Import not found",
      });
    }

    res.json({
      success: true,
      data: {
        fileImport,
      },
    });
  } catch (error) {
    console.error("Get import status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching import status",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Cancel import
 * @route   DELETE /api/import/:id/cancel
 * @access  Private
 */
const cancelImport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import ID format",
      });
    }

    const fileImport = await FileImport.findOne({ _id: id, userId });

    if (!fileImport) {
      return res.status(404).json({
        success: false,
        message: "Import not found",
      });
    }

    if (!["pending", "processing"].includes(fileImport.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel import that is not pending or processing",
      });
    }

    fileImport.status = "cancelled";
    fileImport.progress.currentStep = "cancelled";
    fileImport.progress.message = "Import cancelled by user";
    fileImport.endTime = new Date();

    await fileImport.save();

    // Clean up uploaded file
    try {
      if (fileImport.storage.path) {
        await fs.unlink(fileImport.storage.path);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up file:", cleanupError);
    }

    res.json({
      success: true,
      message: "Import cancelled successfully",
      data: {
        fileImport: {
          id: fileImport._id,
          status: fileImport.status,
        },
      },
    });
  } catch (error) {
    console.error("Cancel import error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling import",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Rollback import
 * @route   POST /api/import/:id/rollback
 * @access  Private
 */
const rollbackImport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import ID format",
      });
    }

    const fileImport = await FileImport.findOne({ _id: id, userId });

    if (!fileImport) {
      return res.status(404).json({
        success: false,
        message: "Import not found",
      });
    }

    if (fileImport.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed imports can be rolled back",
      });
    }

    if (fileImport.rollback.isRolledBack) {
      return res.status(400).json({
        success: false,
        message: "Import has already been rolled back",
      });
    }

    // Perform rollback
    await performRollback(fileImport, userId);
    await fileImport.performRollback(reason);

    res.json({
      success: true,
      message: "Import rolled back successfully",
      data: {
        fileImport: {
          id: fileImport._id,
          status: fileImport.status,
          rollbackTime: fileImport.rollback.rollbackTime,
        },
      },
    });
  } catch (error) {
    console.error("Rollback import error:", error);
    res.status(500).json({
      success: false,
      message: "Error rolling back import",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc    Download import file
 * @route   GET /api/import/:id/download
 * @access  Private
 */
const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import ID format",
      });
    }

    const fileImport = await FileImport.findOne({ _id: id, userId });

    if (!fileImport) {
      return res.status(404).json({
        success: false,
        message: "Import not found",
      });
    }

    if (!fileImport.storage.path) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    // Check if file exists
    try {
      await fs.access(fileImport.storage.path);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: "File no longer available on server",
      });
    }

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileImport.originalName}"`
    );
    res.setHeader("Content-Type", fileImport.mimeType);

    // Send file
    res.download(fileImport.storage.path, fileImport.originalName);
  } catch (error) {
    console.error("Download file error:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading file",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// Background processing functions

/**
 * Process file asynchronously
 */
const processFileAsync = async (fileImportId, userId) => {
  let fileImport;

  try {
    fileImport = await FileImport.findById(fileImportId);
    if (!fileImport) {
      console.error("FileImport not found:", fileImportId);
      return;
    }

    // Update status to processing
    await fileImport.updateProgress(10, "parsing", "Parsing file...");

    // Parse the Excel file
    const workbook = XLSX.readFile(fileImport.storage.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: fileImport.configuration.hasHeaders ? undefined : 1,
      raw: false,
    });

    if (jsonData.length === 0) {
      throw new Error("File is empty or contains no valid data");
    }

    // Update progress
    await fileImport.updateProgress(30, "validating", "Validating data...");

    // Generate preview
    fileImport.preview = {
      headers: Object.keys(jsonData[0] || {}),
      rows: jsonData.slice(0, 5).map((row) => Object.values(row)),
      maxRows: 5,
    };

    fileImport.processing.totalRows = jsonData.length;
    await fileImport.save();

    // Update progress
    await fileImport.updateProgress(50, "importing", "Importing data...");

    // Process data based on import type
    const importResults = await processData(jsonData, fileImport, userId);

    // Update final statistics
    fileImport.recordsCount = importResults.recordsCount;
    fileImport.processing = {
      ...fileImport.processing,
      ...importResults.processing,
    };

    await fileImport.markCompleted(importResults.processing);

    console.log(`File import ${fileImportId} completed successfully`);
  } catch (error) {
    console.error("File processing error:", error);

    if (fileImport) {
      await fileImport.markFailed(error.message);
    }
  }
};

/**
 * Process parsed data and create records
 */
const processData = async (data, fileImport, userId) => {
  const results = {
    recordsCount: {
      positions: 0,
      cashOperations: 0,
      pendingOrders: 0,
      total: 0,
    },
    processing: {
      totalRows: data.length,
      processedRows: 0,
      successfulRows: 0,
      errorRows: 0,
      skippedRows: 0,
    },
  };

  let processed = 0;
  const batchSize = 100;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    for (const row of batch) {
      try {
        const recordType = detectRecordType(row, fileImport.importType);

        switch (recordType) {
          case "position":
            await createPositionFromRow(row, userId, fileImport._id);
            results.recordsCount.positions++;
            break;
          case "cash_operation":
            await createCashOperationFromRow(row, userId, fileImport._id);
            results.recordsCount.cashOperations++;
            break;
          case "pending_order":
            await createPendingOrderFromRow(row, userId, fileImport._id);
            results.recordsCount.pendingOrders++;
            break;
          default:
            results.processing.skippedRows++;
            continue;
        }

        results.processing.successfulRows++;
      } catch (error) {
        console.error(`Error processing row ${i + processed + 1}:`, error);
        await fileImport.addError(i + processed + 1, error.message, {
          value: row,
        });
        results.processing.errorRows++;
      }

      processed++;
      results.processing.processedRows = processed;

      // Update progress every 50 records
      if (processed % 50 === 0) {
        const progressPercent = Math.min(
          95,
          50 + (processed / data.length) * 45
        );
        await fileImport.updateProgress(
          progressPercent,
          "importing",
          `Processed ${processed}/${data.length} records...`
        );
      }
    }
  }

  results.recordsCount.total =
    results.recordsCount.positions +
    results.recordsCount.cashOperations +
    results.recordsCount.pendingOrders;

  return results;
};

/**
 * Detect record type from row data
 */
const detectRecordType = (row, importType) => {
  if (importType !== "mixed") {
    switch (importType) {
      case "positions":
        return "position";
      case "cash_operations":
        return "cash_operation";
      case "orders":
        return "pending_order";
    }
  }

  // Auto-detect based on column names (case-insensitive)
  const keys = Object.keys(row).map((key) => key.toLowerCase());

  // Check for position indicators
  if (
    keys.some((key) =>
      ["open_price", "close_price", "volume", "position_id"].includes(key)
    )
  ) {
    return "position";
  }

  // Check for cash operation indicators
  if (
    keys.some((key) => ["amount", "comment", "operation_id"].includes(key)) &&
    keys.some((key) =>
      ["deposit", "withdrawal", "dividend"].some((type) => key.includes(type))
    )
  ) {
    return "cash_operation";
  }

  // Check for order indicators
  if (keys.some((key) => ["order_id", "side", "price"].includes(key))) {
    return "pending_order";
  }

  // Default fallback
  return "position";
};

/**
 * Create position from row data
 */
const createPositionFromRow = async (row, userId, importBatchId) => {
  const positionData = {
    userId,
    positionId:
      row.position_id || Date.now() + Math.floor(Math.random() * 10000),
    symbol: (row.symbol || row.Symbol || "").toString().toUpperCase(),
    type: (row.type || row.Type || "BUY").toString().toUpperCase(),
    volume: parseFloat(row.volume || row.Volume || 0),
    openTime: parseDate(row.open_time || row.openTime || row.Open_Time),
    openPrice: parseFloat(
      row.open_price || row.openPrice || row.Open_Price || 0
    ),
    closeTime: parseDate(row.close_time || row.closeTime || row.Close_Time),
    closePrice:
      parseFloat(row.close_price || row.closePrice || row.Close_Price || 0) ||
      null,
    marketPrice:
      parseFloat(
        row.market_price || row.marketPrice || row.Market_Price || 0
      ) || null,
    commission: parseFloat(row.commission || row.Commission || 0),
    swap: parseFloat(row.swap || row.Swap || 0),
    taxes: parseFloat(row.taxes || row.Taxes || 0),
    currency: (row.currency || row.Currency || "PLN").toString().toUpperCase(),
    notes: row.comment || row.Comment || row.notes || row.Notes || "",
    importedFrom: "excel",
    importBatchId,
  };

  // Determine status
  positionData.status = positionData.closeTime ? "closed" : "open";

  // Validate required fields
  if (
    !positionData.symbol ||
    positionData.volume <= 0 ||
    positionData.openPrice <= 0
  ) {
    throw new Error(
      "Invalid position data: symbol, volume, and open_price are required"
    );
  }

  const position = new Position(positionData);
  await position.save();

  return position;
};

/**
 * Create cash operation from row data
 */
const createCashOperationFromRow = async (row, userId, importBatchId) => {
  const operationData = {
    userId,
    operationId:
      row.operation_id || Date.now() + Math.floor(Math.random() * 10000),
    type: (row.type || row.Type || "deposit").toString().toLowerCase(),
    time: parseDate(row.time || row.Time || row.date || row.Date),
    amount: parseFloat(row.amount || row.Amount || 0),
    currency: (row.currency || row.Currency || "PLN").toString().toUpperCase(),
    comment:
      row.comment || row.Comment || row.description || row.Description || "",
    symbol: row.symbol ? row.symbol.toString().toUpperCase() : undefined,
    importBatchId,
  };

  // Validate required fields
  if (operationData.amount === 0) {
    throw new Error("Invalid cash operation: amount cannot be zero");
  }

  if (!operationData.comment) {
    throw new Error("Invalid cash operation: comment is required");
  }

  const operation = new CashOperation(operationData);
  await operation.save();

  return operation;
};

/**
 * Create pending order from row data
 */
const createPendingOrderFromRow = async (row, userId, importBatchId) => {
  const orderData = {
    userId,
    orderId: row.order_id || Date.now() + Math.floor(Math.random() * 10000),
    symbol: (row.symbol || row.Symbol || "").toString().toUpperCase(),
    type: (row.type || row.Type || "limit").toString().toLowerCase(),
    side: (row.side || row.Side || "buy").toString().toLowerCase(),
    volume: parseFloat(row.volume || row.Volume || 0),
    price: parseFloat(row.price || row.Price || 0),
    openTime: parseDate(row.open_time || row.openTime || row.Open_Time),
    currency: (row.currency || row.Currency || "PLN").toString().toUpperCase(),
    importBatchId,
  };

  // Validate required fields
  if (!orderData.symbol || orderData.volume <= 0) {
    throw new Error("Invalid order data: symbol and volume are required");
  }

  if (orderData.type !== "market" && orderData.price <= 0) {
    throw new Error(
      "Invalid order data: price is required for non-market orders"
    );
  }

  const order = new PendingOrder(orderData);
  await order.save();

  return order;
};

/**
 * Parse date from various formats
 */
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();

  // If already a date object
  if (dateStr instanceof Date) return dateStr;

  // Try parsing different formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
  ];

  const dateString = dateStr.toString().trim();
  const parsedDate = new Date(dateString);

  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  // If parsing fails, return current date
  return new Date();
};

/**
 * Perform rollback of imported data
 */
const performRollback = async (fileImport, userId) => {
  const importBatchId = fileImport._id;

  // Delete all records imported in this batch
  await Promise.all([
    Position.deleteMany({ importBatchId, userId }),
    CashOperation.deleteMany({ importBatchId, userId }),
    PendingOrder.deleteMany({ importBatchId, userId }),
  ]);
};

module.exports = {
  uploadFile,
  getImportHistory,
  getImportStatus,
  cancelImport,
  rollbackImport,
  downloadFile,
};
