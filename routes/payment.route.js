import express from 'express';
import { createCheckoutSession ,storeOrderAfterPayment} from '../controllers/payment.controller.js';
import { session } from '../middlewares/authmiddleware.js';
const router = express.Router();
router.post('/create-checkout-session', session, createCheckoutSession);
router.post('/store-order', storeOrderAfterPayment);

export default router;