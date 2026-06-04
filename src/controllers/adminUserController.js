import User from '../models/User.js';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest, sendConflict, sendForbidden } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const STAFF_MANAGEABLE = ['Owner', 'Host'];

const canManageRole = (requesterRole, targetRole) => {
  if (requesterRole === 'Admin') return true;
  if (requesterRole === 'Staff') return STAFF_MANAGEABLE.includes(targetRole);
  return false;
};

// ─── GET /api/admin/users/stats ─────────────────────────────────────────────────
export const getUserStats = async (req, res) => {
  try {
    const [total, admins, staffAndHosts, active] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'Admin' }),
      User.countDocuments({ role: { $in: ['Host', 'Staff', 'Owner'] } }),
      User.countDocuments({ isActive: true }),
    ]);

    return sendSuccess(res, {
      stats: {
        total,
        administrators: admins,
        hostsAndEditors,
        activeUsers: active,
      },
    });
  } catch (err) {
    logger.error(`getUserStats: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── GET /api/admin/users ──────────────────────────────────────────────────────
export const listUsers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.role && req.query.role !== 'All') {
      filter.role = req.query.role;
    }
    if (req.query.status) {
      filter.isActive = req.query.status === 'Active';
    }
    if (req.query.search) {
      const re = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { email: re },
        { username: re },
        { phone: re },
        { specialization: re },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-refreshTokens -passwordResetToken -passwordResetExpires -loginAttempts -lockUntil -otpCode -otpExpires -passwordChangedAt -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const enriched = users.map(u => ({
      ...u,
      id: u._id,
      dateCreated: u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '',
    }));

    return sendSuccess(res, {
      users: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`listUsers: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── POST /api/admin/users ─────────────────────────────────────────────────────
export const createUser = async (req, res) => {
  try {
    const { name, email, username, password, phone, role, specialization, verificationId, notes, photo } = req.body;

    const targetRole = role || 'Host';
    if (targetRole === 'Admin') {
      return sendBadRequest(res, 'Cannot create additional Admin users');
    }
    if (!canManageRole(req.user.role, targetRole)) {
      return sendForbidden(res, `Staff can only create: ${STAFF_MANAGEABLE.join(', ')}`);
    }

    const existing = await User.findOne({
      $or: [{ email: email?.toLowerCase().trim() }, { username: username?.toLowerCase().trim() }],
    });
    if (existing) {
      const field = existing.email === email?.toLowerCase().trim() ? 'email' : 'username';
      return sendConflict(res, `A user with this ${field} already exists`);
    }

    const user = await User.create({
      name,
      email,
      username,
      password,
      phone: phone || null,
      role: targetRole,
      isActive: true,
      isEmailVerified: true,
      specialization: specialization || 'All Property Types',
      verificationId: verificationId || '',
      notes: notes || '',
      photo: photo || null,
    });

    return sendCreated(res, { user: user.toSafeObject() }, 'User created successfully');
  } catch (err) {
    logger.error(`createUser: ${err.message}`);
    if (err.code === 11000) {
      return sendConflict(res, 'A user with this email or username already exists');
    }
    return sendError(res, err.message);
  }
};

// ─── GET /api/admin/users/:id ──────────────────────────────────────────────────
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');
    return sendSuccess(res, { user: user.toSafeObject() });
  } catch (err) {
    logger.error(`getUser: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────
export const updateUser = async (req, res) => {
  try {
    const ALLOWED = ['name', 'email', 'phone', 'role', 'specialization', 'verificationId', 'notes', 'photo', 'password'];
    const updates = {};
    ALLOWED.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (!Object.keys(updates).length) {
      return sendBadRequest(res, 'No valid fields provided');
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');

    if (user.role === 'Admin' && req.user._id.toString() !== req.params.id) {
      return sendBadRequest(res, 'Cannot modify the super admin account');
    }

    const newRole = updates.role || user.role;
    if (newRole === 'Admin') {
      return sendBadRequest(res, 'Cannot promote users to Admin role');
    }
    if (!canManageRole(req.user.role, user.role) || !canManageRole(req.user.role, newRole)) {
      return sendForbidden(res, `Staff can only manage: ${STAFF_MANAGEABLE.join(', ')}`);
    }

    if (updates.email) {
      const existing = await User.findOne({ email: updates.email.toLowerCase().trim(), _id: { $ne: req.params.id } });
      if (existing) return sendConflict(res, 'Email is already in use by another user');
      updates.email = updates.email.toLowerCase().trim();
    }

    Object.keys(updates).forEach(field => {
      if (field === 'password' && !updates.password) return;
      user[field] = updates[field];
    });

    await user.save();

    return sendSuccess(res, { user: user.toSafeObject() }, 'User updated successfully');
  } catch (err) {
    logger.error(`updateUser: ${err.message}`);
    if (err.code === 11000) {
      return sendConflict(res, 'A user with this email or username already exists');
    }
    return sendError(res, err.message);
  }
};

// ─── DELETE /api/admin/users/:id ───────────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return sendBadRequest(res, 'Cannot delete your own account');
    }
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');
    if (user.role === 'Admin') {
      return sendBadRequest(res, 'Cannot delete the super admin account');
    }
    if (!canManageRole(req.user.role, user.role)) {
      return sendForbidden(res, `Staff can only manage: ${STAFF_MANAGEABLE.join(', ')}`);
    }
    await User.findByIdAndDelete(req.params.id);
    return sendSuccess(res, {}, 'User deleted successfully');
  } catch (err) {
    logger.error(`deleteUser: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PATCH /api/admin/users/:id/status ─────────────────────────────────────────
export const toggleUserStatus = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return sendBadRequest(res, 'Cannot change your own status');
    }
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');
    if (user.role === 'Admin') {
      return sendBadRequest(res, 'Cannot deactivate the super admin account');
    }
    if (!canManageRole(req.user.role, user.role)) {
      return sendForbidden(res, `Staff can only manage: ${STAFF_MANAGEABLE.join(', ')}`);
    }
    user.isActive = !user.isActive;
    await user.save();
    const action = user.isActive ? 'activated' : 'deactivated';
    return sendSuccess(res, { user: user.toSafeObject() }, `User ${action} successfully`);
  } catch (err) {
    logger.error(`toggleUserStatus: ${err.message}`);
    return sendError(res, err.message);
  }
};
