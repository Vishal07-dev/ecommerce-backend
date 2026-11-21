import express from "express"
import {register,loginUser, updateUser, getuser,logoutUser} from "../controllers/user.controller.js"
import { protect,isAdmin } from "../middlewares/authmiddleware.js"
import { getMe, updateMe, changePassword, addAddress, updateAddress, removeAddress, myOrders } from "../controllers/account.controller.js"
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

const router = express.Router()

router.post('/create',register)
router.post('/login',loginUser)
router.put('/update/:id', protect, updateUser)

// The signed-in shopper's own account (always req.user.id, never a URL id)
router.get('/me', protect, getMe)
router.patch('/me', protect, updateMe)
router.patch('/me/password', protect, changePassword)
router.get('/me/orders', protect, myOrders)
router.post('/me/addresses', protect, addAddress)
router.patch('/me/addresses/:addressId', protect, updateAddress)
router.delete('/me/addresses/:addressId', protect, removeAddress)

// router.get("/profile", protect, (req, res) => {
//   res.json({ message: "Welcome to user profile", user: req.user });
// });
router.get("/profile",getuser)
// Admin-only route
router.get("/admin-data", protect, isAdmin, (req, res) => {
  res.json({ message: "Welcome Admin" });
});

router.post("/refresh-token", async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    // Create a new short-lived access token
    // The role comes from the database, so a changed or removed role
    // takes effect at the next renewal instead of lingering in old tokens.
    const user = await User.findById(decoded.id).select('role').lean();
    if (!user) return res.status(401).json({ message: "Account not found" });
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: user.role ?? 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || process.env.ACCESS_EXPIRES_IN || '1d' }
    );

    // Return only access token; refresh token stays in cookie
    res.json({ accessToken: newAccessToken });

  } catch (err) {
    console.error('Refresh error:', err.message);
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout",logoutUser)


export default router