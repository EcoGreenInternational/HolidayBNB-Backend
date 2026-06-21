import cloudinary from '../config/cloudinary.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const sanitize = (str) =>
  str.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'property';

export const uploadImages = async (req, res) => {
  try {
    if (!req.files?.length) {
      return sendError(res, 'No files provided', 400);
    }

    const uploadType = req.body.type || 'property';
    const name = sanitize(req.body.name || uploadType);
    const dateStr = new Date().toISOString().slice(0, 10);
    const folder = uploadType === 'avatar' ? 'holidaybnb/avatars' : 'holidaybnb/properties';

    const uploads = await Promise.all(
      req.files.map((file, idx) => {
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const publicId = `${folder}/${name}_${dateStr}_${unique}`;

        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              resource_type: 'image',
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });
      })
    );

    return sendSuccess(res, { urls: uploads }, 'Images uploaded successfully');
  } catch (err) {
    logger.error(`uploadImages: ${err.message}`);
    return sendError(res, 'Image upload failed');
  }
};
