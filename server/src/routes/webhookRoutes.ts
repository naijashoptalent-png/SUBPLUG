import { Router } from 'express';
import * as controller from '../controllers/webhooksController';
import { webhookLimiter } from '../middleware/rateLimit';

const router = Router();
router.post('/paystack', webhookLimiter, controller.paystackWebhook);
router.post('/flutterwave', webhookLimiter, controller.flutterwaveWebhook);

export default router;
