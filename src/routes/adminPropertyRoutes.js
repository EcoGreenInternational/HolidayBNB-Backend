import { Router } from 'express';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  togglePropertyStatus,
  listOwners,
  listHosts,
} from '../controllers/adminPropertyController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff', 'Owner', 'Property Owner'));

router.get('/owners', listOwners);
router.get('/hosts',  listHosts);
router.get('/',       listProperties);
router.post('/',      createProperty);
router.get('/:id',    getProperty);
router.put('/:id',    updateProperty);
router.delete('/:id', deleteProperty);
router.patch('/:id/status', togglePropertyStatus);

export default router;
