import { Router } from 'express';
import * as controller from '../controllers/authController';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  twoFactorLoginSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validators/schemas';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/csrf', controller.getCsrf);

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/2fa/login', authLimiter, validate({ body: twoFactorLoginSchema }), controller.twoFactorLogin);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticate, controller.logout);

router.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), controller.verifyEmail);
router.post('/resend-verification', passwordResetLimiter, validate({ body: resendVerificationSchema }), controller.resendVerification);
router.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);

router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), controller.updateProfile);
router.post('/change-password', authenticate, authLimiter, validate({ body: changePasswordSchema }), controller.changePassword);
router.post('/2fa/setup', authenticate, authLimiter, controller.setupTwoFactor);
router.post('/2fa/enable', authenticate, authLimiter, validate({ body: twoFactorCodeSchema }), controller.enableTwoFactor);
router.post('/2fa/disable', authenticate, authLimiter, validate({ body: twoFactorDisableSchema }), controller.disableTwoFactor);

export default router;
