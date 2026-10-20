import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as controller from '../controllers/notificationController';

const router = Router();
router.use(authenticate);

router.get('/', controller.listNotifications);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', controller.markRead);

export default router;
