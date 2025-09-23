const XLSX = require("xlsx");
const fs = require("fs").promises;
const path = require("path");

/**
 * Supported file formats
 */
const SUPPORTED_FORMATS = {
  EXCEL: [".xlsx", ".xls"],
  CSV: [".csv"],
  TEXT: [".txt"],
};

/**
 * Column mapping configurations for different data types
 */
const COLUMN_MAPPINGS = {
  positions: {
    // Standard XTB format
    position_id: ["position_id", "positionid", "id", "Position ID"],
    symbol: ["symbol", "Symbol", "instrument", "Instrument"],
    type: ["type", "Type", "cmd", "Command", "side", "Side"],
    volume: ["volume", "Volume", "size", "Size", "quantity", "Quantity"],
    open_time: ["open_time", "opentime", "Open Time", "timestamp", "Timestamp"],
    open_price: ["open_price", "openprice", "Open Price", "price", "Price"],
    close_time: ["close_time", "closetime", "Close Time", "close_timestamp"],
    close_price: ["close_price", "closeprice", "Close Price", "exit_price"],
    market_price: [
      "market_price",
      "marketprice",
      "Market Price",
      "current_price",
    ],
    commission: ["commission", "Commission", "fee", "Fee"],
    swap: ["swap", "Swap", "overnight", "Overnight"],
    taxes: ["taxes", "Taxes", "tax", "Tax"],
    profit: ["profit", "Profit", "pl", "P&L", "pnl", "PnL"],
    comment: ["comment", "Comment", "notes", "Notes", "description"],
  },
  cash_operations: {
    operation_id: ["operation_id", "operationid", "id", "ID"],
    type: ["type", "Type", "operation", "Operation"],
    time: ["time", "Time", "date", "Date", "timestamp", "Timestamp"],
    amount: ["amount", "Amount", "value", "Value", "sum", "Sum"],
    currency: ["currency", "Currency", "ccy", "CCY"],
    comment: ["comment", "Comment", "description", "Description", "notes"],
    symbol: ["symbol", "Symbol", "instrument", "Instrument"],
  },
  orders: {
    order_id: ["order_id", "orderid", "id", "ID"],
    symbol: ["symbol", "Symbol", "instrument", "Instrument"],
    type: ["type", "Type", "order_type", "ordertype"],
    side: ["side", "Side", "cmd", "Command"],
    volume: ["volume", "Volume", "size", "Size", "quantity"],
    price: ["price", "Price", "limit_price", "limitprice"],
    stop_price: ["stop_price", "stopprice", "Stop Price"],
    status: ["status", "Status", "state", "State"],
    open_time: ["open_time", "opentime", "created", "Created"],
  },
};

/**
 * Data type validators
 */
const DATA_VALIDATORS = {
  number: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) ? num : null;
  },
  positiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num > 0 ? num : null;
  },
  nonZeroNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num !== 0 ? num : null;
  },
  string: (value) => {
    return value && typeof value === "string" ? value.trim() : "";
  },
  symbol: (value) => {
    const str = String(value).trim().toUpperCase();
    return /^[A-Z0-9.]{1,10}$/.test(str) ? str : null;
  },
  date: (value) => {
    if (!value) return null;

    // Try different date formats
    const formats = [
      // ISO formats
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2}/,
      // European formats
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{2}-\d{2}-\d{4}/,
      /^\d{2}\.\d{2}\.\d{4}/,
      // US formats
      /^\d{2}\/\d{2}\/\d{4}/,
    ];

    const dateStr = String(value).trim();
    const date = new Date(dateStr);

    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  },
  type: (value) => {
    const str = String(value).trim().toUpperCase();
    const buyTypes = ["BUY", "LONG", "0", "B"];
    const sellTypes = ["SELL", "SHORT", "1", "S"];

    if (buyTypes.includes(str)) return "BUY";
    if (sellTypes.includes(str)) return "SELL";

    return str;
  },
  operationType: (value) => {
    const str = String(value).trim().toLowerCase();
    const typeMap = {
      deposit: "deposit",
      withdrawal: "withdrawal",
      dividend: "dividend",
      interest: "interest",
      fee: "fee",
      commission: "fee",
      bonus: "bonus",
      transfer: "transfer",
    };

    return typeMap[str] || str;
  },
  currency: (value) => {
    const str = String(value).trim().toUpperCase();
    const validCurrencies = ["USD", "EUR", "PLN", "GBP", "CHF", "JPY"];
    return validCurrencies.includes(str) ? str : "USD";
  },
};

/**
 * Parse Excel/CSV file
 * @param {string} filePath - Path to the file
 * @param {Object} options - Parsing options
 * @returns {Promise<Object>} Parsed data
 */
const parseFile = async (filePath, options = {}) => {
  try {
    const {
      hasHeaders = true,
      sheetName = null,
      maxRows = 10000,
      encoding = "utf8",
    } = options;

    console.log(`📖 Parsing file: ${path.basename(filePath)}`);

    // Check if file exists
    await fs.access(filePath);

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();

    if (!isSupportedFormat(ext)) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    let workbook;
    let data;

    if (SUPPORTED_FORMATS.EXCEL.includes(ext)) {
      // Parse Excel file
      workbook = XLSX.readFile(filePath);
      data = parseExcelWorkbook(workbook, { hasHeaders, sheetName, maxRows });
    } else if (SUPPORTED_FORMATS.CSV.includes(ext)) {
      // Parse CSV file
      const csvContent = await fs.readFile(filePath, encoding);
      data = parseCSVContent(csvContent, { hasHeaders, maxRows });
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    console.log(`✅ File parsed successfully: ${data.length} rows`);

    return {
      data,
      metadata: {
        fileName: path.basename(filePath),
        fileSize: (await fs.stat(filePath)).size,
        totalRows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        hasHeaders,
        parsedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ File parsing error:", error.message);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
};

/**
 * Parse Excel workbook
 * @param {Object} workbook - XLSX workbook object
 * @param {Object} options - Parsing options
 * @returns {Array} Parsed data
 */
const parseExcelWorkbook = (workbook, options = {}) => {
  const { hasHeaders = true, sheetName = null, maxRows = 10000 } = options;

  // Get sheet name
  const targetSheet = sheetName || workbook.SheetNames[0];

  if (!workbook.Sheets[targetSheet]) {
    throw new Error(`Sheet "${targetSheet}" not found`);
  }

  const worksheet = workbook.Sheets[targetSheet];

  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: hasHeaders ? undefined : 1,
    raw: false,
    defval: "",
  });

  // Limit rows
  return jsonData.slice(0, maxRows);
};

/**
 * Parse CSV content
 * @param {string} csvContent - CSV file content
 * @param {Object} options - Parsing options
 * @returns {Array} Parsed data
 */
const parseCSVContent = (csvContent, options = {}) => {
  const { hasHeaders = true, maxRows = 10000, delimiter = "," } = options;

  const lines = csvContent.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return [];
  }

  let headers;
  let dataStartIndex = 0;

  if (hasHeaders) {
    headers = parseCSVLine(lines[0], delimiter);
    dataStartIndex = 1;
  } else {
    // Generate generic headers
    const firstLine = parseCSVLine(lines[0], delimiter);
    headers = firstLine.map((_, index) => `Column${index + 1}`);
  }

  const data = [];
  const maxProcessRows = Math.min(lines.length, maxRows + dataStartIndex);

  for (let i = dataStartIndex; i < maxProcessRows; i++) {
    const values = parseCSVLine(lines[i], delimiter);

    if (values.length > 0) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }
  }

  return data;
};

/**
 * Parse CSV line with proper quote handling
 * @param {string} line - CSV line
 * @param {string} delimiter - Field delimiter
 * @returns {Array} Parsed values
 */
const parseCSVLine = (line, delimiter = ",") => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

/**
 * Detect data type from sample data
 * @param {Array} data - Array of data objects
 * @returns {string} Detected type (positions, cash_operations, orders)
 */
const detectDataType = (data) => {
  if (!data || data.length === 0) {
    return "unknown";
  }

  const sample = data[0];
  const columns = Object.keys(sample).map((key) => key.toLowerCase());

  // Check for position indicators
  const positionIndicators = [
    "position_id",
    "open_price",
    "close_price",
    "volume",
    "symbol",
  ];
  const positionScore = positionIndicators.reduce((score, indicator) => {
    return score + (columns.some((col) => col.includes(indicator)) ? 1 : 0);
  }, 0);

  // Check for cash operation indicators
  const cashIndicators = [
    "operation_id",
    "amount",
    "comment",
    "deposit",
    "withdrawal",
  ];
  const cashScore = cashIndicators.reduce((score, indicator) => {
    return score + (columns.some((col) => col.includes(indicator)) ? 1 : 0);
  }, 0);

  // Check for order indicators
  const orderIndicators = ["order_id", "side", "limit", "stop", "pending"];
  const orderScore = orderIndicators.reduce((score, indicator) => {
    return score + (columns.some((col) => col.includes(indicator)) ? 1 : 0);
  }, 0);

  // Return type with highest score
  if (positionScore >= cashScore && positionScore >= orderScore) {
    return "positions";
  } else if (cashScore >= orderScore) {
    return "cash_operations";
  } else if (orderScore > 0) {
    return "orders";
  }

  return "unknown";
};

/**
 * Map columns to standard format
 * @param {Array} data - Raw data
 * @param {string} dataType - Data type (positions, cash_operations, orders)
 * @returns {Array} Mapped data
 */
const mapColumns = (data, dataType) => {
  if (!data || data.length === 0) {
    return [];
  }

  const mapping = COLUMN_MAPPINGS[dataType];
  if (!mapping) {
    throw new Error(`No column mapping found for data type: ${dataType}`);
  }

  return data.map((row) => {
    const mappedRow = {};

    // Map each standard field
    Object.keys(mapping).forEach((standardField) => {
      const possibleColumns = mapping[standardField];
      let value = null;

      // Find matching column
      for (const column of possibleColumns) {
        if (row[column] !== undefined && row[column] !== "") {
          value = row[column];
          break;
        }

        // Case-insensitive search
        const matchingKey = Object.keys(row).find(
          (key) => key.toLowerCase() === column.toLowerCase()
        );

        if (
          matchingKey &&
          row[matchingKey] !== undefined &&
          row[matchingKey] !== ""
        ) {
          value = row[matchingKey];
          break;
        }
      }

      if (value !== null) {
        mappedRow[standardField] = value;
      }
    });

    return mappedRow;
  });
};

/**
 * Validate and clean data
 * @param {Array} data - Mapped data
 * @param {string} dataType - Data type
 * @returns {Object} Validation results
 */
const validateData = (data, dataType) => {
  const validRows = [];
  const errors = [];

  const validators = getValidatorsForType(dataType);

  data.forEach((row, index) => {
    const validatedRow = {};
    const rowErrors = [];

    // Validate each field
    Object.keys(validators).forEach((field) => {
      const validator = validators[field];
      const rawValue = row[field];

      if (validator.required && (!rawValue || rawValue === "")) {
        rowErrors.push({
          field,
          error: `${field} is required`,
          value: rawValue,
        });
        return;
      }

      if (rawValue !== undefined && rawValue !== "") {
        const validatedValue = validator.validate(rawValue);

        if (validatedValue === null && validator.required) {
          rowErrors.push({
            field,
            error: `Invalid ${field}: ${rawValue}`,
            value: rawValue,
          });
        } else {
          validatedRow[field] = validatedValue;
        }
      }
    });

    if (rowErrors.length === 0) {
      validRows.push(validatedRow);
    } else {
      errors.push({
        row: index + 1,
        errors: rowErrors,
        data: row,
      });
    }
  });

  return {
    validRows,
    errors,
    summary: {
      totalRows: data.length,
      validRows: validRows.length,
      errorRows: errors.length,
      successRate:
        data.length > 0
          ? ((validRows.length / data.length) * 100).toFixed(2)
          : 0,
    },
  };
};

/**
 * Get validators for data type
 * @param {string} dataType - Data type
 * @returns {Object} Validators configuration
 */
const getValidatorsForType = (dataType) => {
  switch (dataType) {
    case "positions":
      return {
        symbol: { validate: DATA_VALIDATORS.symbol, required: true },
        type: { validate: DATA_VALIDATORS.type, required: true },
        volume: { validate: DATA_VALIDATORS.positiveNumber, required: true },
        open_price: {
          validate: DATA_VALIDATORS.positiveNumber,
          required: true,
        },
        close_price: {
          validate: DATA_VALIDATORS.positiveNumber,
          required: false,
        },
        open_time: { validate: DATA_VALIDATORS.date, required: true },
        close_time: { validate: DATA_VALIDATORS.date, required: false },
        commission: { validate: DATA_VALIDATORS.number, required: false },
        swap: { validate: DATA_VALIDATORS.number, required: false },
        taxes: { validate: DATA_VALIDATORS.number, required: false },
      };

    case "cash_operations":
      return {
        type: { validate: DATA_VALIDATORS.operationType, required: true },
        amount: { validate: DATA_VALIDATORS.nonZeroNumber, required: true },
        currency: { validate: DATA_VALIDATORS.currency, required: false },
        time: { validate: DATA_VALIDATORS.date, required: true },
        comment: { validate: DATA_VALIDATORS.string, required: true },
        symbol: { validate: DATA_VALIDATORS.symbol, required: false },
      };

    case "orders":
      return {
        symbol: { validate: DATA_VALIDATORS.symbol, required: true },
        type: { validate: DATA_VALIDATORS.string, required: true },
        side: { validate: DATA_VALIDATORS.string, required: true },
        volume: { validate: DATA_VALIDATORS.positiveNumber, required: true },
        price: { validate: DATA_VALIDATORS.positiveNumber, required: false },
        open_time: { validate: DATA_VALIDATORS.date, required: true },
      };

    default:
      return {};
  }
};

/**
 * Check if file format is supported
 * @param {string} extension - File extension
 * @returns {boolean} Is supported
 */
const isSupportedFormat = (extension) => {
  const allFormats = [
    ...SUPPORTED_FORMATS.EXCEL,
    ...SUPPORTED_FORMATS.CSV,
    ...SUPPORTED_FORMATS.TEXT,
  ];

  return allFormats.includes(extension.toLowerCase());
};

/**
 * Get file preview (first few rows)
 * @param {string} filePath - Path to file
 * @param {number} maxRows - Maximum rows to preview
 * @returns {Promise<Object>} Preview data
 */
const getFilePreview = async (filePath, maxRows = 5) => {
  try {
    const result = await parseFile(filePath, { maxRows });

    return {
      headers: result.metadata.columns,
      rows: result.data.slice(0, maxRows),
      totalColumns: result.metadata.columns.length,
      estimatedRows: result.data.length,
      detectedType: detectDataType(result.data),
    };
  } catch (error) {
    throw new Error(`Failed to generate preview: ${error.message}`);
  }
};

/**
 * Process file completely (parse, detect, map, validate)
 * @param {string} filePath - Path to file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
const processFile = async (filePath, options = {}) => {
  try {
    const startTime = Date.now();

    // Parse file
    const parseResult = await parseFile(filePath, options);

    // Detect data type
    const detectedType = options.dataType || detectDataType(parseResult.data);

    if (detectedType === "unknown") {
      throw new Error("Could not detect data type from file content");
    }

    // Map columns
    const mappedData = mapColumns(parseResult.data, detectedType);

    // Validate data
    const validationResult = validateData(mappedData, detectedType);

    const processingTime = Date.now() - startTime;

    return {
      metadata: parseResult.metadata,
      detectedType,
      validRows: validationResult.validRows,
      errors: validationResult.errors,
      summary: {
        ...validationResult.summary,
        processingTimeMs: processingTime,
      },
    };
  } catch (error) {
    throw new Error(`File processing failed: ${error.message}`);
  }
};

module.exports = {
  parseFile,
  detectDataType,
  mapColumns,
  validateData,
  getFilePreview,
  processFile,
  isSupportedFormat,
  SUPPORTED_FORMATS,
  COLUMN_MAPPINGS,
  DATA_VALIDATORS,
};
