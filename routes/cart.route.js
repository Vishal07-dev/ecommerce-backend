import express from 'express';
import { protect } from '../middlewares/authmiddleware.js';
import {
  addItemToCart,
  clearCart,
  getUserCart,
  mergeProduct,
  removeCartItem,
  updateCartItem,
} from '../controllers/cart.controller.js';

const router = express.Router();

// Every cart route identifies the user from the verified token.
router.use(protect);

router.get('/show', getUserCart);
router.post('/add', addItemToCart);
router.patch('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);
router.post('/merge', mergeProduct);

export default router;
