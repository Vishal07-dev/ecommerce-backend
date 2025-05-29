import express from 'express';
import { addItemToCart, getUserCart, mergeProduct, removeCartItem } from '../controllers/cart.controller.js';
const router = express.Router();

router.post('/add', addItemToCart);
router.get('/show',getUserCart)
router.delete('/delete/:id',removeCartItem)
router.post('/merge',mergeProduct)
export default router;