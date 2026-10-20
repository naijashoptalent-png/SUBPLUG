import { Router } from 'express';
import * as controller from '../controllers/servicesController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { meterValidationSchema, smartcardValidationSchema } from '../validators/schemas';
import { contactLimiter } from '../middleware/rateLimit';
import { frontendContactSchema } from '../validators/schemas';

const router = Router();

router.get('/', controller.listServices);
router.get('/networks', controller.getNetworks);
router.get('/data-plans', controller.getDataPlans);
router.get('/electricity-providers', controller.getElectricityProviders);
router.get('/cable-providers', controller.getCableProviders);
router.get('/cable-packages', controller.getCablePackages);
router.get('/airtime-quote', controller.quoteAirtime);

router.post('/validate-meter', authenticate, validate({ body: meterValidationSchema }), controller.validateMeter);
router.post('/validate-smartcard', authenticate, validate({ body: smartcardValidationSchema }), controller.validateSmartcard);

router.get('/public-settings', controller.publicSettings);
router.post('/contact', contactLimiter, validate({ body: frontendContactSchema }), controller.contact);

export default router;
