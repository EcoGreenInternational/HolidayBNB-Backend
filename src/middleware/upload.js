import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const MAX_MB    = parseInt(process.env.MAX_FILE_SIZE_MB) || 5;
const UPLOAD_BASE = process.env.UPLOAD_PATH || 'src/uploads';

// Use memory storage — we intercept the buffer and process it with Sharp
// before writing to disk. This lets us resize, compress and convert to WebP.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// ─── Internal helper: process buffer → WebP file on disk ─────────────────────
const processAndSave = async (buffer, destDir, { width, height, quality = 82, fit = 'cover' }) => {
  await fs.mkdir(destDir, { recursive: true });
  const filename   = `${uuidv4()}.webp`;
  const outputPath = path.join(destDir, filename);

  await sharp(buffer)
    .resize(width, height, { fit, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outputPath);

  return filename;
};

// ─── Avatar upload middleware ─────────────────────────────────────────────────
// Accepts a single file in the 'avatar' field.
// After this runs: req.uploadedFilename = 'uuid.webp'

export const uploadAvatar = [
  upload.single('avatar'),
  async (req, res, next) => {
    if (!req.file) return next(); // optional — controller checks this
    try {
      req.uploadedFilename = await processAndSave(
        req.file.buffer,
        path.join(UPLOAD_BASE, 'avatars'),
        { width: 400, height: 400, quality: 85 }
      );
      next();
    } catch (err) {
      logger.error(`Avatar processing failed: ${err.message}`);
      return sendError(res, 'Image processing failed', 422);
    }
  },
];

// ─── Hotel images upload middleware ──────────────────────────────────────────
// Accepts up to 10 files in the 'images' field.
// After this runs: req.uploadedFilenames = ['uuid.webp', ...]

export const uploadHotelImages = [
  upload.array('images', 10),
  async (req, res, next) => {
    if (!req.files?.length) {
      req.uploadedFilenames = [];
      return next();
    }
    try {
      req.uploadedFilenames = await Promise.all(
        req.files.map(file =>
          processAndSave(
            file.buffer,
            path.join(UPLOAD_BASE, 'hotels'),
            { width: 1200, height: 800, quality: 82 }
          )
        )
      );
      next();
    } catch (err) {
      logger.error(`Hotel image processing failed: ${err.message}`);
      return sendError(res, 'Image processing failed', 422);
    }
  },
];
