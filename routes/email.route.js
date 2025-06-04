import { Router } from 'express';
const router = Router();
import { sendEmail } from '../controllers/email.Controller.js';

router.post('/send-email', sendEmail);

export default router;
