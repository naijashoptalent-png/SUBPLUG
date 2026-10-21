import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { maintenanceGuard } from '../middleware/maintenance';
import { financialLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  airtimePurchaseSchema,
  cablePurchaseSchema,
  dataPurchaseSchema,
  electricityPurchaseSchema,
  referenceParamSchema,
  transactionQuerySchema,
} from '../validators/schemas';
import * as controller from '../controllers/purchasesController';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: transactionQuerySchema }), controller.listPurchases);
router.get('/summary', controller.dashboardSummary);
router.get('/:reference', validate({ params: referenceParamSchema }), controller.getPurchase);

router.use(maintenanceGuard, financialLimiter);
router.post('/airtime', validate({ body: airtimePurchaseSchema }), controller.buyAirtime);
router.post('/data', validate({ body: dataPurchaseSchema }), controller.buyData);
router.post('/electricity', validate({ body: electricityPurchaseSchema }), controller.payElectricity);
router.post('/cable', validate({ body: cablePurchaseSchema }), controller.payCable);

export default router;
