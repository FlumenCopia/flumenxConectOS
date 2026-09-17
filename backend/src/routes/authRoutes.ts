import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate } from '../middleware/validate';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/authValidators';
import { requireAuth } from '../middleware/authMiddleware';
import { authRateLimiter } from '../middleware/rateLimit';

import { acceptInvitationSchema } from '../validators/clientValidators';
import { ClientUserController } from '../controllers/clientUserController';

const router = Router();

// Public authentication, recovery, and invitation routes (rate-limited)
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);
router.post('/invitations/accept', validate(acceptInvitationSchema), ClientUserController.acceptInvitation);

// Protected session & password change routes
router.get('/me', requireAuth, AuthController.getMe);
router.post('/logout', requireAuth, AuthController.logout);
router.post('/change-password', requireAuth, validate(changePasswordSchema), AuthController.changePassword);
router.put('/change-password', requireAuth, validate(changePasswordSchema), AuthController.changePassword);

export default router;
