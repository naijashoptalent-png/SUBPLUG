import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { maintenanceGuard } from '../middleware/maintenance';
import { financialLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { fundWalletSchema, ledgerQuerySchema, paginationQuerySchema, referenceParamSchema, sandboxOutcomeSchema } from '../validators/schemas';
import * as controller from '../controllers/walletController';

const router = Router();
router.use(authenticate);

router.get('/', controller.getWallet);
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
