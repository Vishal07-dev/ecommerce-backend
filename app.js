import express from "express"
import productRoutes from "./routes/product.route.js"
import categoryRoutes from "./routes/category.route.js"
import productlistRoutes from "./routes/productlist.route.js"
import cartRoutes from "./routes/cart.route.js"
import userRoutes from "./routes/user.route.js"
import emailRoutes from "./routes/email.route.js"
import chatRoutes from "./routes/chat.route.js"
import paymentRoutes from "./routes/payment.route.js"
import receiptRoutes from "./routes/recepiet.route.js"


import wishListRoutes from "./routes/wishList.route.js"

import cors from "cors"
import cookieParser from "cookie-parser";

const app = express()

app.use(cors({
    origin:'https://ecommerce-frontend-three-ruby.vercel.app',
    credentials: true
}))
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(express.json()); // for parsing application/json
// Route prefix
app.use('/api/product', productRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/user',userRoutes)
app.use('/api/productlist',productlistRoutes)
app.use('/api/cart',cartRoutes)
app.use('/api/contact', emailRoutes); // your endpoint is now: /api/send-email
app.use('/api',chatRoutes)
app.use('/api/wishlist',wishListRoutes)
app.use('/api/payment',paymentRoutes)
app.use('/api/receipet',receiptRoutes)

export {app}