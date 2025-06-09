import express from 'express';
import { sendChat } from '../controllers/chat.controller.js';

const router = express.Router();
router.post('/chat', sendChat);

export default router;
