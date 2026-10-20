import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as controller from '../controllers/referralController';

const router = Router();
router.use(authenticate);
router.get('/', controller.getSummary);

export default router;
