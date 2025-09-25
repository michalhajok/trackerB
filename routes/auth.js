const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  "/register",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters"),
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
  ],
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", authMiddleware, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authMiddleware, getMe);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  [
    authMiddleware,
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters"),
    body("preferences.currency")
      .optional()
      .isIn(["USD", "EUR", "PLN", "GBP"])
      .withMessage("Currency must be one of: USD, EUR, PLN, GBP"),
    body("preferences.theme")
      .optional()
      .isIn(["light", "dark", "auto"])
      .withMessage("Theme must be one of: light, dark, auto"),
    body("preferences.notifications.email")
      .optional()
      .isBoolean()
      .withMessage("Email notifications must be boolean"),
    body("preferences.notifications.push")
      .optional()
      .isBoolean()
      .withMessage("Push notifications must be boolean"),
  ],
  updateProfile
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  "/change-password",
  [
    authMiddleware,
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "New password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Password confirmation does not match password");
      }
      return value;
    }),
  ],
  changePassword
);

/**
 * @route   GET /api/auth/health
 * @desc    Health check for auth service
 * @access  Public
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth service is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
