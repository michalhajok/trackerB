const Report = require("../models/Report");
const Position = require("../models/Position");
const CashOperation = require("../models/CashOperation");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;

/**
 * @desc Get all reports for user
 * @route GET /api/reports
 * @access Private
 */
const getReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, page = 1, limit = 20 } = req.query;

    const options = {
      type,
      status,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    };

    const [reports, total, stats] = await Promise.all([
      Report.findUserReports(userId, options),
      Report.countDocuments({
        userId,
        ...(type && { type }),
        ...(status && { status }),
      }),
      Report.getReportStatistics(userId, 30),
    ]);

    res.json({
      success: true,
      data: {
        reports,
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
    console.error("Get reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reports",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get single report by ID
 * @route GET /api/reports/:id
 * @access Private
 */
const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID format",
      });
    }

    const report = await Report.findOne({
      $or: [
        { _id: id, userId },
        { _id: id, "access.sharedWith.userId": userId },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create new report
 * @route POST /api/reports
 * @access Private
 */
const createReport = async (req, res) => {
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
      name,
      description,
      type,
      format = "pdf",
      dateRange,
      configuration = {},
      schedule = {},
    } = req.body;

    const report = new Report({
      userId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      type,
      format,
      dateRange: {
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate),
      },
      configuration,
      schedule: schedule.isRecurring
        ? {
            isRecurring: true,
            frequency: schedule.frequency,
            dayOfMonth: schedule.dayOfMonth,
            dayOfWeek: schedule.dayOfWeek,
            time: schedule.time || "09:00",
            nextRun: Report.calculateNextRun(schedule),
            isActive: true,
          }
        : { isRecurring: false },
    });

    await report.save();

    // Start report generation in background
    generateReportAsync(report._id);

    res.status(201).json({
      success: true,
      message: "Report creation started",
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating report",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Download report file
 * @route GET /api/reports/:id/download
 * @access Private
 */
const downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID format",
      });
    }

    const report = await Report.findOne({
      $or: [
        { _id: id, userId },
        { _id: id, "access.sharedWith.userId": userId },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (report.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Report is not ready for download",
        status: report.status,
        progress: report.generation.progress,
      });
    }

    if (!report.file.path) {
      return res.status(404).json({
        success: false,
        message: "Report file not found",
      });
    }

    // Check if file exists
    try {
      await fs.access(report.file.path);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: "Report file no longer available",
      });
    }

    // Record download
    await report.recordDownload();

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.file.originalName}"`
    );
    res.setHeader("Content-Type", report.file.mimeType);

    // Send file
    res.download(report.file.path, report.file.originalName);
  } catch (error) {
    console.error("Download report error:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading report",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Create tax report
 * @route POST /api/reports/tax
 * @access Private
 */
const createTaxReport = async (req, res) => {
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
    const { taxYear, format = "pdf", currency = "PLN" } = req.body;

    const report = Report.createTaxReport(userId, taxYear, {
      format,
      currency,
    });
    await report.save();

    // Start generation
    generateReportAsync(report._id);

    res.status(201).json({
      success: true,
      message: "Tax report generation started",
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("Create tax report error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating tax report",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * @desc Get scheduled reports
 * @route GET /api/reports/scheduled
 * @access Private (Admin)
 */
const getScheduledReports = async (req, res) => {
  try {
    const scheduledReports = await Report.findScheduledReports();

    res.json({
      success: true,
      data: {
        scheduledReports,
        count: scheduledReports.length,
      },
    });
  } catch (error) {
    console.error("Get scheduled reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching scheduled reports",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// Background report generation function
const generateReportAsync = async (reportId) => {
  try {
    const report = await Report.findById(reportId).populate(
      "userId",
      "name email preferences"
    );

    if (!report) {
      console.error("Report not found:", reportId);
      return;
    }

    // Update progress
    await report.updateProgress(
      10,
      "initializing",
      "Starting report generation..."
    );

    // Fetch data
    await report.updateProgress(
      30,
      "fetching_data",
      "Fetching portfolio data..."
    );

    const [positions, cashOperations] = await Promise.all([
      Position.find({
        userId: report.userId._id,
        $or: [
          {
            openTime: {
              $gte: report.dateRange.startDate,
              $lte: report.dateRange.endDate,
            },
          },
          {
            closeTime: {
              $gte: report.dateRange.startDate,
              $lte: report.dateRange.endDate,
            },
          },
        ],
      }),
      CashOperation.find({
        userId: report.userId._id,
        time: {
          $gte: report.dateRange.startDate,
          $lte: report.dateRange.endDate,
        },
      }),
    ]);

    await report.updateProgress(
      60,
      "processing_positions",
      "Processing positions..."
    );

    // Generate report content based on type
    const reportContent = await generateReportContent(
      report,
      positions,
      cashOperations
    );

    await report.updateProgress(
      80,
      "formatting_report",
      "Formatting report..."
    );

    // Save report file
    const filename = `${report.type}_${report.userId.name}_${Date.now()}.${
      report.format
    }`;
    const filePath = path.join(
      process.env.REPORTS_DIR || "./reports",
      filename
    );

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write report content to file (simplified - would use proper PDF/Excel generation)
    await fs.writeFile(filePath, JSON.stringify(reportContent, null, 2));

    await report.markCompleted({
      filename,
      originalName: filename,
      path: filePath,
      size: (await fs.stat(filePath)).size,
      mimeType: getMimeType(report.format),
    });

    console.log(`Report ${reportId} generated successfully`);
  } catch (error) {
    console.error("Report generation error:", error);
    const report = await Report.findById(reportId);
    if (report) {
      await report.markFailed(error.message);
    }
  }
};

// Helper function to generate report content
const generateReportContent = async (report, positions, cashOperations) => {
  const content = {
    metadata: {
      reportId: report.reportId,
      generatedAt: new Date(),
      dateRange: report.dateRange,
      type: report.type,
      user: report.userId.name,
    },
    summary: {},
    data: {},
  };

  // Generate content based on report type
  switch (report.type) {
    case "tax_report":
      content.data.closedPositions = positions.filter(
        (p) => p.status === "closed"
      );
      content.data.dividends = cashOperations.filter(
        (op) => op.type === "dividend"
      );
      content.summary.totalTaxableGains = content.data.closedPositions.reduce(
        (sum, p) => sum + (p.grossPL || 0),
        0
      );
      break;

    case "performance_report":
      content.data.allPositions = positions;
      content.data.performanceMetrics = calculatePerformanceMetrics(
        positions,
        cashOperations
      );
      break;

    default:
      content.data.positions = positions;
      content.data.cashOperations = cashOperations;
  }

  return content;
};

// Helper function to get MIME type
const getMimeType = (format) => {
  const mimeTypes = {
    pdf: "application/pdf",
    csv: "text/csv",
    excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    json: "application/json",
  };
  return mimeTypes[format] || "application/octet-stream";
};

// Helper function for performance calculations
const calculatePerformanceMetrics = (positions, cashOperations) => {
  const totalGrossPL = positions.reduce((sum, p) => sum + (p.grossPL || 0), 0);
  const totalDeposits = cashOperations
    .filter((op) => op.type === "deposit")
    .reduce((sum, op) => sum + op.amount, 0);
  const totalWithdrawals = cashOperations
    .filter((op) => op.type === "withdrawal")
    .reduce((sum, op) => sum + op.amount, 0);

  return {
    totalGrossPL,
    totalDeposits,
    totalWithdrawals,
    netCashFlow: totalDeposits - totalWithdrawals,
    winRate:
      (positions.filter((p) => (p.grossPL || 0) > 0).length /
        Math.max(positions.length, 1)) *
      100,
  };
};

module.exports = {
  getReports,
  getReport,
  createReport,
  downloadReport,
  createTaxReport,
  getScheduledReports,
};
