import express from 'express';
import {
  addItemToWishList,
  getUserWishList,
  removeItemFromWishList,
  clearWishList,
  mergeWishListItems
} from '../controllers/wishList.controller.js';
import { protect } from '../middlewares/authmiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/list', getUserWishList);
router.post('/add', addItemToWishList);
router.delete('/remove/:id', removeItemFromWishList);
router.delete('/clear', clearWishList);
router.post('/merge', mergeWishListItems);

export default router;
