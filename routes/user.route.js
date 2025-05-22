import express from "express"
import {register,loginUser, updateUser, getuser} from "../controllers/user.controller.js"
import { protect,isAdmin } from "../middlewares/authmiddleware.js"
import jwt from "jsonwebtoken";

const router = express.Router()

router.post('/create',register)
router.post('/login',loginUser)
router.put('/update/:id',updateUser)

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
    console.log(token,'wefcewa');
    console.log(process.env.REFRESH_TOKEN_SECRET);
    
    
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES_IN }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});


export default router