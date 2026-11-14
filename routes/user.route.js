import express from "express"
import {register,loginUser, updateUser, getuser,logoutUser} from "../controllers/user.controller.js"
import { protect,isAdmin } from "../middlewares/authmiddleware.js"
import { getMe, updateMe, changePassword, addAddress, updateAddress, removeAddress, myOrders } from "../controllers/account.controller.js"
import jwt from "jsonwebtoken";

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

router.post("/refresh-token", (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    // Create a new short-lived access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role }, // include role if needed
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_EXPIRES_IN || '30s' }
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