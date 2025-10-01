const multer = require("multer");
const path = require("path");

// Folder tymczasowy dla uploadów
const upload = multer({
  dest: path.join(__dirname, "../uploads"),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

module.exports = upload;
