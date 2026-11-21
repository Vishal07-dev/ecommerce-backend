import express from 'express';
import { peekInvite, acceptInvite } from '../controllers/team.controller.js';

// Public invite links: /api/team/invite/:token
const router = express.Router();
router.get('/invite/:token', peekInvite);
router.post('/invite/:token/accept', acceptInvite);
export default router;
