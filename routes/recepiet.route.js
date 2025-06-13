import express from 'express';
import {downloadReceipt} from '../controllers/receipt.controller.js'
const router = express.Router();
router.get('/download-receipt/:id', downloadReceipt);

export default router;
