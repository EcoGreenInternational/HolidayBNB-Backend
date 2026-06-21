import { body, param } from 'express-validator';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-z0-9_]+$/).withMessage('Username: lowercase letters, numbers and underscores only'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
];

export const loginRules = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Email or username is required'),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// ─── User profile ─────────────────────────────────────────────────────────────

export const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),

  body('phone')
    .optional({ nullable: true })
    .trim()
    .matches(/^\+?[\d\s\-().]{7,20}$/).withMessage('Please enter a valid phone number'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),

  body('favoriteDestination')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Favorite destination cannot exceed 100 characters'),

  body('interests')
    .optional()
    .isArray().withMessage('Interests must be an array')
    .custom(arr =>
      arr.every(v =>
        ['beach','mountain','city','history','foodie','adventure','wellness','backpack'].includes(v)
      )
    ).withMessage('One or more interest values are invalid'),

  body('preferences')
    .optional()
    .isArray().withMessage('Preferences must be an array')
    .custom(arr =>
      arr.every(v => ['entire','hotel','cabin','shared','camp'].includes(v))
    ).withMessage('One or more preference values are invalid'),
];

// ─── Admin user management ─────────────────────────────────────────────────────

const VALID_ROLES = ['Admin', 'Host', 'Staff', 'Owner', 'Guest'];
const VALID_SPECIALIZATIONS = [
  'All Property Types', 'Luxury Villas', 'Urban Apartments',
  'Beachfront & Coastal', 'Boutique & Heritage', 'Eco & Nature Retreats',
];

export const adminCreateUserRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-z0-9_]+$/).withMessage('Username: lowercase letters, numbers and underscores only'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('role')
    .optional()
    .trim()
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),

  body('specialization')
    .optional()
    .trim()
    .isIn(VALID_SPECIALIZATIONS).withMessage(`Invalid specialization`),

  body('phone')
    .optional({ nullable: true })
    .trim(),

  body('verificationId')
    .optional()
    .trim(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),
];

export const adminUpdateUserRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),

  body('password')
    .optional({ nullable: true })
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  body('role')
    .optional()
    .trim()
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),

  body('specialization')
    .optional()
    .trim()
    .isIn(VALID_SPECIALIZATIONS).withMessage(`Invalid specialization`),

  body('phone')
    .optional({ nullable: true })
    .trim(),

  body('verificationId')
    .optional()
    .trim(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),

  body('photo')
    .optional({ nullable: true })
    .trim(),
];

// ─── OTP verification ───────────────────────────────────────────────────────

export const verifyOtpRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),

  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
];

// ─── Password reset ──────────────────────────────────────────────────────────

export const forgotPasswordRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
];

export const resetPasswordRules = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

// ─── Shared param rules ───────────────────────────────────────────────────────

export const mongoIdParam = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
];
