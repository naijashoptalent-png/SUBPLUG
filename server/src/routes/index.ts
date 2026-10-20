import { Router } from 'express';
import authRoutes from './authRoutes';
import walletRoutes from './walletRoutes';
import serviceRoutes from './serviceRoutes';
import purchaseRoutes from './purchaseRoutes';
import supportRoutes from './supportRoutes';
import notificationRoutes from './notificationRoutes';
import referralRoutes from './referralRoutes';
import adminRoutes from './adminRoutes';
import webhookRoutes from './webhookRoutes';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    data: {
      name: 'QuickTopUp API',
      version: '1.0.0',
      documentation: 'See docs/API.md in the project repository.',
    },
  });
});

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/services', serviceRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/support', supportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/referrals', referralRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
