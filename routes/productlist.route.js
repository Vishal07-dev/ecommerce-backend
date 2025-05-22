import express from 'express';
import { protect,isAdmin } from "../middlewares/authmiddleware.js"
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';

const router = express.Router();

router.get('/list', getProducts);
router.get('/single/:id', getProductById);

export default router;
