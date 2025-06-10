import express from 'express';
import {
  addItemToWishList,
  getUserWishList,
  removeItemFromWishList,
  clearWishList,
  mergeWishListItems
} from '../controllers/wishList.controller.js';
const router = express.Router();
router.post('/add', addItemToWishList);

router.get('/list', getUserWishList);

router.delete('/remove/:id', removeItemFromWishList);

router.delete('/clear', clearWishList);

router.post('/merge', mergeWishListItems);
export default router;
