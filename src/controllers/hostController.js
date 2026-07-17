import cloudinary from '../config/cloudinary.js';
import HostApplication from '../models/HostApplication.js';
import { sendHostApplicationEmail } from '../utils/mailer.js';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const uploadToCloudinary = (buffer, idx) => {
  return new Promise((resolve, reject) => {
    const publicId = `holidaybnb/host_applications/${Date.now()}_${idx}`;
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

export const submitApplication = async (req, res) => {
  try {
    const { name, email, phone, propertyName, propertyType, city, country, bedrooms, bathrooms, description } = req.body;

    if (!name || !email || !propertyName) {
      return sendError(res, 'Name, email, and property name are required', 400);
    }

    let imageUrls = [];
    if (req.files?.length) {
      imageUrls = await Promise.all(
        req.files.map((file, idx) => uploadToCloudinary(file.buffer, idx))
      );
    }

    const application = await HostApplication.create({
      name, email, phone, propertyName, propertyType, city, country,
      bedrooms: parseInt(bedrooms) || 0, bathrooms: parseInt(bathrooms) || 0,
      description, imageUrls, status: 'pending',
    });

    try {
      await sendHostApplicationEmail({
        name, email, phone, propertyName, propertyType, city, country,
        bedrooms, bathrooms, description, imageUrls,
      });
    } catch (mailErr) {
      logger.error(`Host application email send failed: ${mailErr.message}`);
    }

    return sendCreated(res, { application }, 'Application submitted successfully');
  } catch (err) {
    logger.error(`submitApplication: ${err.message}`);
    return sendError(res, 'Failed to submit application');
  }
};
