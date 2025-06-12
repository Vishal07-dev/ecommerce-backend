import express from 'express';
import { protect,isAdmin,session } from "../middlewares/authmiddleware.js"
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import multer from 'multer';

// ✅ Use upload from your custom Cloudinary setup
import upload from '../middlewares/upload.js';

const router = express.Router();

router.post('/create',isAdmin, upload.single('image'), createProduct);
router.get('/list', getProducts);
router.get('/single/:id'  , getProductById);
router.put('/update/:id' ,isAdmin,upload.single('image'), updateProduct);
router.delete('/delete/:id',isAdmin, deleteProduct);

export default router;
  