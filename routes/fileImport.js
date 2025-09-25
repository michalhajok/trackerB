// const express = require("express");
// const { body, query, param } = require("express-validator");
// const multer = require("multer");
// const path = require("path");
// const {
//   uploadFile,
//   getImportHistory,
//   getImportStatus,
//   cancelImport,
//   rollbackImport,
//   downloadFile,
// } = require("../controllers/fileImportController");
// const authMiddleware = require("../middleware/auth");

// const router = express.Router();

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const uploadDir = process.env.UPLOAD_DIR || "./uploads";
//     cb(null, uploadDir);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(
//       null,
//       file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
//     );
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedMimeTypes = [
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
//     "application/vnd.ms-excel", // .xls
//     "text/csv", // .csv
//     "text/plain", // .txt
//   ];

//   if (allowedMimeTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(
//       new Error(
//         "Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed."
//       ),
//       false
//     );
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 50 * 1024 * 1024, // 50MB limit
//     files: 1, // Only one file at a time
//   },
// });

// // Apply auth middleware to all routes
// router.use(authMiddleware);

// /**
//  * @route   POST /api/import/upload
//  * @desc    Upload and process Excel/CSV file
//  * @access  Private
//  */
// router.post(
//   "/upload",
//   [
//     upload.single("file"),
//     body("importType")
//       .optional()
//       .isIn([
//         "positions",
//         "cash_operations",
//         "orders",
//         "mixed",
//         "portfolio_export",
//       ])
//       .withMessage("Invalid import type"),
//     body("hasHeaders")
//       .optional()
//       .isBoolean()
//       .withMessage("Has headers must be boolean"),
//   ],
//   uploadFile
// );

// /**
//  * @route   GET /api/import/history
//  * @desc    Get import history
//  * @access  Private
//  */
// router.get(
//   "/history",
//   [
//     query("status")
//       .optional()
//       .isIn([
//         "pending",
//         "processing",
//         "completed",
//         "failed",
//         "cancelled",
//         "partial",
//       ])
//       .withMessage("Invalid import status"),
//     query("importType")
//       .optional()
//       .isIn([
//         "positions",
//         "cash_operations",
//         "orders",
//         "mixed",
//         "portfolio_export",
//       ])
//       .withMessage("Invalid import type"),
//     query("page")
//       .optional()
//       .isInt({ min: 1 })
//       .withMessage("Page must be a positive integer"),
//     query("limit")
//       .optional()
//       .isInt({ min: 1, max: 100 })
//       .withMessage("Limit must be between 1 and 100"),
//     query("dateFrom")
//       .optional()
//       .isISO8601()
//       .withMessage("Date from must be a valid ISO date"),
//     query("dateTo")
//       .optional()
//       .isISO8601()
//       .withMessage("Date to must be a valid ISO date"),
//   ],
//   getImportHistory
// );

// /**
//  * @route   GET /api/import/:id/status
//  * @desc    Get import status
//  * @access  Private
//  */
// router.get(
//   "/:id/status",
//   [param("id").isMongoId().withMessage("Invalid import ID")],
//   getImportStatus
// );

// /**
//  * @route   GET /api/import/:id/download
//  * @desc    Download import file
//  * @access  Private
//  */
// router.get(
//   "/:id/download",
//   [param("id").isMongoId().withMessage("Invalid import ID")],
//   downloadFile
// );

// /**
//  * @route   DELETE /api/import/:id/cancel
//  * @desc    Cancel import
//  * @access  Private
//  */
// router.delete(
//   "/:id/cancel",
//   [param("id").isMongoId().withMessage("Invalid import ID")],
//   cancelImport
// );

// /**
//  * @route   POST /api/import/:id/rollback
//  * @desc    Rollback import
//  * @access  Private
//  */
// router.post(
//   "/:id/rollback",
//   [
//     param("id").isMongoId().withMessage("Invalid import ID"),
//     body("reason")
//       .optional()
//       .trim()
//       .isLength({ max: 200 })
//       .withMessage("Reason cannot exceed 200 characters"),
//   ],
//   rollbackImport
// );

// /**
//  * @route   GET /api/import/health
//  * @desc    Health check for file import service
//  * @access  Private
//  */
// router.get("/health", (req, res) => {
//   res.json({
//     success: true,
//     message: "File import service is running",
//     timestamp: new Date().toISOString(),
//     userId: req.user.id,
//     uploadLimits: {
//       maxFileSize: "50MB",
//       allowedTypes: ["xlsx", "xls", "csv", "txt"],
//     },
//   });
// });

// /**
//  * Error handling middleware for multer
//  */
// router.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     if (error.code === "LIMIT_FILE_SIZE") {
//       return res.status(400).json({
//         success: false,
//         message: "File too large. Maximum size is 50MB.",
//       });
//     }
//     if (error.code === "LIMIT_UNEXPECTED_FILE") {
//       return res.status(400).json({
//         success: false,
//         message: "Too many files. Only one file is allowed per upload.",
//       });
//     }
//   }

//   if (error.message.includes("Invalid file type")) {
//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }

//   next(error);
// });

// module.exports = router;

/**
 * Backend Route with Multer middleware for file uploads
 * Add this to your Express routes to handle FormData uploads
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadFile,
  getImportHistory,
  getImportStatus,
  cancelImport,
  rollbackImport,
  downloadFile,
} = require("../controllers/fileImportController");
// const { authenticate } = require("../middleware/auth"); // Your auth middleware
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🔧 MULTER CONFIGURATION - This was missing!
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Save to uploads directory
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "import-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file types
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed."
        )
      );
    }
  },
});

// 🔧 ROUTES WITH PROPER MIDDLEWARE
router.post("/upload", authMiddleware, upload.single("file"), uploadFile); // Added multer middleware!
router.get("/history", authMiddleware, getImportHistory);
router.get("/:id/status", authMiddleware, getImportStatus);
router.delete("/:id/cancel", authMiddleware, cancelImport);
router.post("/:id/rollback", authMiddleware, rollbackImport);
router.get("/:id/download", authMiddleware, downloadFile);

// 🔧 TEMPLATE ROUTE - Add this if missing
router.get("/template", authMiddleware, (req, res) => {
  try {
    const { type = "positions" } = req.query;

    const templates = {
      positions:
        "symbol,name,type,volume,openPrice,openTime,commission,taxes,currency,exchange,sector,notes\nAAPL,Apple Inc.,BUY,100,150.00,2025-01-01,5.00,0.00,USD,NASDAQ,Technology,Sample position",
      "cash-operations":
        "type,amount,currency,description,date\nDEPOSIT,1000.00,USD,Initial deposit,2025-01-01",
      "pending-orders":
        "symbol,type,volume,targetPrice,orderType,validUntil\nTSLA,BUY,50,200.00,LIMIT,2025-12-31",
    };

    const csvContent = templates[type] || templates.positions;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type}_template.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating template",
    });
  }
});

module.exports = router;
