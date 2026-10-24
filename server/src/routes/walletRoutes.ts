import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { maintenanceGuard } from '../middleware/maintenance';
import { financialLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { fundWalletSchema, ledgerQuerySchema, manualFundingSchema, paginationQuerySchema, referenceParamSchema, sandboxOutcomeSchema, virtualAccountSchema } from '../validators/schemas';
import * as controller from '../controllers/walletController';

const router = Router();
router.use(authenticate);

router.get('/', controller.getWallet);
router.get('/manual-funding', controller.getManualFundingSettingsController);
router.get('/virtual-account', controller.getVirtualAccount);
router.post('/virtual-account', maintenanceGuard, financialLimiter, validate({ body: virtualAccountSchema }), controller.createVirtualAccount);
router.post('/manual-funding', maintenanceGuard, financialLimiter, validate({ body: manualFundingSchema }), controller.createManualFunding);
router.get('/ledger', validate({ query: ledgerQuerySchema }), controller.getLedger);
router.get('/fundings', validate({ query: paginationQuerySchema }), controller.listFundings);
router.get('/funding/:reference', validate({ params: referenceParamSchema }), controller.getFunding);
router.post('/funding/:reference/verify', validate({ params: referenceParamSchema }), controller.verifyFunding);
router.post(
  '/funding/:reference/simulate',
  validate({ params: referenceParamSchema, body: sandboxOutcomeSchema }),
  controller.simulateSandboxFunding
);
router.post(
  '/fund',
  maintenanceGuard,
  financialLimiter,
  validate({ body: fundWalletSchema }),
  controller.fundWallet
);

export default router;
