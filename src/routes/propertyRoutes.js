import express from 'express';
import { getProperties, getPropertyById, seedProperties } from '../controllers/propertyController.js';
import { protect, restrictTo } from '../middleware/protect.js';
import { mongoIdParam } from '../middleware/validators.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.route('/').get(getProperties);
router.route('/seed').post(protect, restrictTo('Admin'), seedProperties);
router.route('/:id').get(mongoIdParam('id'), validate, getPropertyById);

export default router;
