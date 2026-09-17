import { Router } from 'express';
import { getPublicForm, submitPublicForm } from '../controllers/publicFormController';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import { publicSubmissionSchema } from '../validators/formValidators';

const router = Router();

// =============================================================
// Public Form Endpoints
// Rate limited with sliding-window protection & schema validation
// =============================================================
router.get('/:publicKey', authLimiter, getPublicForm);
router.post('/:publicKey/submit', authLimiter, validate(publicSubmissionSchema), submitPublicForm);

// Also support paths with /forms prefix if mounted at router root
router.get('/forms/:publicKey', authLimiter, getPublicForm);
router.post('/forms/:publicKey/submit', authLimiter, validate(publicSubmissionSchema), submitPublicForm);

export default router;
