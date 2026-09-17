import { Router } from 'express';
import {
  createBroadcast,
  getBroadcasts,
  getBroadcastById,
  uploadBroadcastAttachment,
} from '../controllers/broadcastController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getBroadcasts);
router.post('/', createBroadcast);
router.post('/upload', uploadBroadcastAttachment);
router.get('/:broadcastId', getBroadcastById);

export default router;
