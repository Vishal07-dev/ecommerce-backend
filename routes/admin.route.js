import express from 'express';
import multer from 'multer';
import { isStudio, isAdmin, isOwner } from '../middlewares/authmiddleware.js';
import { storage } from '../utils/cloudinary.js';
import {
  overview, notifications, listOrders, updateOrderStatus, listCustomers,
  listProducts, getProduct, createProduct, updateProduct, setPlacement, deleteProduct,
  upload, meta,
} from '../controllers/admin.controller.js';
import {
  listTeam, searchAccounts, addMember, changeRole, removeMember, createInvite, revokeInvite,
} from '../controllers/team.controller.js';

/**
 * KŌRA Studio API. Roles are checked against the database on every request:
 *   Staff  → overview, notifications, orders
 *   Admin  → + products, categories data, customers, uploads
 *   Owner  → + team
 */
const router = express.Router();

const images = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

// Everyone on the team
router.get('/overview', isStudio, overview);
router.get('/notifications', isStudio, notifications);
router.get('/orders', isStudio, listOrders);
router.patch('/orders/:id/status', isStudio, updateOrderStatus);

// Owner and Admin
router.get('/meta', isAdmin, meta);
router.get('/customers', isAdmin, listCustomers);
router.get('/products', isAdmin, listProducts);
router.post('/products', isAdmin, createProduct);
router.get('/products/:id', isAdmin, getProduct);
router.put('/products/:id', isAdmin, updateProduct);
router.patch('/products/:id/placement', isAdmin, setPlacement);
router.delete('/products/:id', isAdmin, deleteProduct);
router.post('/upload', isAdmin, (req, res, next) => images.single('image')(req, res, err => {
  if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'That image is over 8 MB. Use a smaller one.' : 'That file couldn’t be uploaded.' });
  next();
}), upload);

// Owner only
router.get('/team', isOwner, listTeam);
router.get('/team/search', isOwner, searchAccounts);
router.post('/team/members', isOwner, addMember);
router.patch('/team/members/:id', isOwner, changeRole);
router.post('/team/members/:id/remove', isOwner, removeMember);
router.post('/team/invites', isOwner, createInvite);
router.delete('/team/invites/:id', isOwner, revokeInvite);

export default router;
