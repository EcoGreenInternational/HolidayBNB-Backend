import { Router } from 'express';
import multer from 'multer';
import { submitApplication } from '../controllers/hostController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG and WebP images allowed'), false);
  },
});

router.post('/apply', upload.array('images', 10), submitApplication);

export default router;
