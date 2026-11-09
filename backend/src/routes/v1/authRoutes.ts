import { Router } from 'express';
import * as authController from '../../controllers/authController';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { loginSchema, registerSchema } from '../../validation/authValidation';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);
// Logout is typically handled on the client side by discarding the token, 
// but we could implement a token blocklist here in the future.

export default router;
