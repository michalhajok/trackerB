const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadFile,
  getImportHistory,
  getImportStatus,
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

module.exports = router;
