import { Router } from 'express';
import multer from 'multer';
import { uploadImages } from '../controllers/uploadController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff', 'Owner', 'Property Owner'));

router.post('/', upload.array('images', 10), uploadImages);

export default router;
