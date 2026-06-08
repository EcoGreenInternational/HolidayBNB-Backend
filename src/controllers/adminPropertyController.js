import Property from '../models/Property.js';
import User from '../models/User.js';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest, sendForbidden } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const listProperties = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.user.role === 'Owner' || req.user.role === 'Property Owner') {
      filter.owner = req.user._id;
    }

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate('owner', 'name email')
        .populate('host', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`listProperties: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('host', 'name email');
    if (!property) return sendNotFound(res, 'Property not found');

    if (req.user.role === 'Owner' && property.owner?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'You can only view your own properties');
    }

    return sendSuccess(res, { property });
  } catch (err) {
    logger.error(`getProperty: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const createProperty = async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.owner === '' || body.owner === 'null' || body.owner === 'undefined') {
      delete body.owner;
    }

    if (!body.owner) {
      if (req.user.role === 'Admin' || req.user.role === 'Staff') {
        return sendBadRequest(res, 'Owner is required when creating as Admin or Staff');
      }
      body.owner = req.user._id;
    }

    const property = await Property.create(body);

    return sendCreated(res, { property }, 'Property created successfully');
  } catch (err) {
    logger.error(`createProperty: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return sendNotFound(res, 'Property not found');

    if (req.user.role === 'Owner' && property.owner?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'You can only update your own properties');
    }

    const ALLOWED = [
      'name','propertyType','roomType','status','description',
      'maxAdults','maxChildren','maxInfants',
      'country','city','address','mapLink','landmarks',
      'bedrooms','beds','bathrooms','floorArea','minNights','maxNights',
      'amenities','accessibility','nearby','rules','experience','uniqueExperiences','safety',
      'price','cleaningFee','weeklyDiscount','monthlyDiscount','availability','instantBooking',
      'images','owner','host',
    ];

    const updates = {};
    ALLOWED.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    return sendSuccess(res, { property: updated }, 'Property updated successfully');
  } catch (err) {
    logger.error(`updateProperty: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return sendNotFound(res, 'Property not found');

    if (req.user.role === 'Owner' && property.owner?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'You can only delete your own properties');
    }

    await Property.findByIdAndDelete(req.params.id);
    return sendSuccess(res, {}, 'Property deleted successfully');
  } catch (err) {
    logger.error(`deleteProperty: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const togglePropertyStatus = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return sendNotFound(res, 'Property not found');

    if (req.user.role === 'Owner' && property.owner?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, 'You can only manage your own properties');
    }

    property.status = property.status === 'Active' ? 'Inactive' : 'Active';
    await property.save();

    return sendSuccess(res, { property }, `Property ${property.status === 'Active' ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    logger.error(`togglePropertyStatus: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const listOwners = async (req, res) => {
  try {
    const owners = await User.find({ role: { $in: ['Owner', 'Property Owner'] } })
      .select('name email _id')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, { owners });
  } catch (err) {
    logger.error(`listOwners: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const listHosts = async (req, res) => {
  try {
    const hosts = await User.find({ role: 'Host' })
      .select('name email _id')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, { hosts });
  } catch (err) {
    logger.error(`listHosts: ${err.message}`);
    return sendError(res, err.message);
  }
};
