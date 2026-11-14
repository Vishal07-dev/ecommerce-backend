import express from 'express';
import {downloadReceipt} from '../controllers/receipt.controller.js'
import { protect } from '../middlewares/authmiddleware.js';
const router = express.Router();
router.get('/download-receipt/:id', protect, downloadReceipt);

export default router;
