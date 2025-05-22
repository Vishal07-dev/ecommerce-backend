import express from 'express';
import { protect,isAdmin,session } from "../middlewares/authmiddleware.js"
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';

const router = express.Router();

router.post('/create',isAdmin, createProduct);
router.get('/list', getProducts);
router.get('/single/:id',isAdmin, getProductById);
router.put('/update/:id',isAdmin, updateProduct);
router.delete('/delete/:id',isAdmin, deleteProduct);

export default router;
  