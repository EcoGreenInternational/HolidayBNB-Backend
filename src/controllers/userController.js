import User from '../models/User.js';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendBadRequest } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_BASE = process.env.UPLOAD_PATH || 'src/uploads';

// ─── GET /api/users/profile ───────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendNotFound(res, 'User not found');
    return sendSuccess(res, { user: user.toSafeObject() });
  } catch (err) {
    logger.error(`getProfile: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PATCH /api/users/profile ─────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const ALLOWED = ['name', 'phone', 'bio', 'favoriteDestination', 'interests', 'preferences'];
    const updates = {};
    ALLOWED.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (!Object.keys(updates).length) {
      return sendBadRequest(res, 'No valid fields provided');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, { user: user.toSafeObject() }, 'Profile updated');
  } catch (err) {
    logger.error(`updateProfile: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PATCH /api/users/avatar ──────────────────────────────────────────────────
export const updateAvatar = async (req, res) => {
  try {
    if (!req.uploadedFilename) {
      return sendBadRequest(res, 'No image file provided');
    }

    // Delete the old avatar file from disk
    const existing = await User.findById(req.user._id).select('photo');
    if (existing?.photo) {
      const oldPath = path.join(UPLOAD_BASE, 'avatars', existing.photo);
      await fs.unlink(oldPath).catch(() => {}); // ignore if already missing
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { photo: req.uploadedFilename } },
      { new: true }
    );

    return sendSuccess(res, { photo: user.photo, user: user.toSafeObject() }, 'Avatar updated');
  } catch (err) {
    logger.error(`updateAvatar: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── POST /api/users/experiences ──────────────────────────────────────────────
export const addExperience = async (req, res) => {
  try {
    const { place, story } = req.body;
    if (!place?.trim() || !story?.trim()) {
      return sendBadRequest(res, 'Place and story are both required');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { experiences: { $each: [{ place, story }], $position: 0 } } },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, { experiences: user.experiences }, 'Experience added');
  } catch (err) {
    logger.error(`addExperience: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── DELETE /api/users/experiences/:expId ─────────────────────────────────────
export const removeExperience = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { experiences: { _id: req.params.expId } } },
      { new: true }
    );
    return sendSuccess(res, { experiences: user.experiences }, 'Experience removed');
  } catch (err) {
    logger.error(`removeExperience: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── GET /api/users  (Admin only) ────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.role)   filter.role = req.query.role;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { email: re }, { username: re }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`getAllUsers: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
export const getUserById = async (req, res) => {
  try {
    // Non-admins can only view themselves
    if (req.user.role !== 'Admin' && req.user._id.toString() !== req.params.id) {
      return sendForbidden(res);
    }
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');
    return sendSuccess(res, { user: user.toSafeObject() });
  } catch (err) {
    logger.error(`getUserById: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PATCH /api/users/:id/role  (Admin only) ─────────────────────────────────
export const updateUserRole = async (req, res) => {
  try {
    const VALID = ['Guest', 'Host', 'Staff', 'Admin'];
    const { role } = req.body;
    if (!VALID.includes(role)) {
      return sendBadRequest(res, `Role must be one of: ${VALID.join(', ')}`);
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    );
    if (!user) return sendNotFound(res, 'User not found');
    return sendSuccess(res, { user: user.toSafeObject() }, `Role updated to ${role}`);
  } catch (err) {
    logger.error(`updateUserRole: ${err.message}`);
    return sendError(res, err.message);
  }
};

// ─── PATCH /api/users/:id/status  (Admin only) ───────────────────────────────
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found');
    user.isActive = !user.isActive;
    await user.save();
    const action = user.isActive ? 'activated' : 'deactivated';
    return sendSuccess(res, { user: user.toSafeObject() }, `User ${action}`);
  } catch (err) {
    logger.error(`toggleUserStatus: ${err.message}`);
    return sendError(res, err.message);
  }
};
