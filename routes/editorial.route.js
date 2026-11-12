import express from 'express';
import { getAssets, getCollections, getCredits, getHero, getLooks } from '../controllers/editorial.controller.js';

const router = express.Router();

router.get('/collections', getCollections);
router.get('/looks', getLooks);
router.get('/hero', getHero);
router.get('/assets', getAssets);
router.get('/credits', getCredits);

export default router;
