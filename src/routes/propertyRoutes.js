import express from 'express';
import { getProperties, getPropertyById, seedProperties } from '../controllers/propertyController.js';

const router = express.Router();

router.route('/').get(getProperties);
router.route('/seed').post(seedProperties);
router.route('/:id').get(getPropertyById);

export default router;
