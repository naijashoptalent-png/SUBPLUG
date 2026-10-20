import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  adminAuditQuerySchema,
  adminFundingQuerySchema,
  adminPlanUpdateSchema,
  adminPlansQuerySchema,
  adminRejectReviewSchema,
  adminSettingsSchema,
  adminSupportReplySchema,
  adminTransactionQuerySchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  adminWalletAdjustSchema,
  idParamSchema,
  overviewQuerySchema,
  referenceParamSchema,
  supportQuerySchema,
  ticketParamSchema,
} from '../validators/schemas';
import * as controller from '../controllers/adminController';

const router = Router();
router.use(authenticate, requireRole('SUPPORT', 'ADMIN'));

// Read-only operational views: SUPPORT + ADMIN
router.get('/overview', validate({ query: overviewQuerySchema }), controller.overview);
router.get('/users', validate({ query: adminUsersQuerySchema }), controller.listUsers);
router.get('/users/:id', validate({ params: idParamSchema }), controller.getUser);
router.get('/transactions', validate({ query: adminTransactionQuerySchema }), controller.listTransactions);
router.get('/transactions/:reference', validate({ params: referenceParamSchema }), controller.getTransaction);
router.get('/fundings', validate({ query: adminFundingQuerySchema }), controller.listFundings);
router.get('/plans', validate({ query: adminPlansQuerySchema }), controller.listPlans);
router.get('/providers', controller.listProviders);
router.get('/support/tickets', validate({ query: supportQuerySchema }), controller.listSupportTickets);

// Mutating / sensitive actions: ADMIN only
router.patch('/users/:id/status', requireRole('ADMIN'), validate({ params: idParamSchema, body: adminUserStatusSchema }), controller.setUserStatus);
router.post('/wallet/adjust', requireRole('ADMIN'), validate({ body: adminWalletAdjustSchema }), controller.adjustWallet);
router.post('/transactions/:reference/approve', requireRole('ADMIN'), validate({ params: referenceParamSchema }), controller.approveReview);
router.post('/transactions/:reference/reject', requireRole('ADMIN'), validate({ params: referenceParamSchema, body: adminRejectReviewSchema }), controller.rejectReview);
router.post('/transactions/:reference/check-status', requireRole('ADMIN'), validate({ params: referenceParamSchema }), controller.checkTransactionStatus);
router.post('/fundings/:reference/recheck', requireRole('ADMIN'), validate({ params: referenceParamSchema }), controller.recheckFunding);
router.post('/plans/sync', requireRole('ADMIN'), controller.syncCatalogue);
router.patch('/plans/:id', requireRole('ADMIN'), validate({ params: idParamSchema, body: adminPlanUpdateSchema }), controller.updatePlan);
router.get('/settings', requireRole('ADMIN'), controller.getSettings);
router.patch('/settings', requireRole('ADMIN'), validate({ body: adminSettingsSchema }), controller.saveSetting);
router.get('/audit-logs', requireRole('ADMIN'), validate({ query: adminAuditQuerySchema }), controller.listAuditLogs);
router.post('/providers/check', requireRole('ADMIN'), controller.checkProviders);
router.get('/reconciliation', requireRole('ADMIN'), controller.reconciliation);

router.get('/support/tickets/:id', requireRole('ADMIN', 'SUPPORT'), validate({ params: ticketParamSchema }), controller.getSupportTicket);
router.post(
  '/support/tickets/:id/reply',
  requireRole('ADMIN', 'SUPPORT'),
  validate({ params: ticketParamSchema, body: adminSupportReplySchema }),
  controller.replySupportTicket
);

export default router;
