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
import editorialRoutes from "./routes/editorial.route.js"

import cors from "cors"
import cookieParser from "cookie-parser";

const app = express()

// The storefront that may call this API with cookies: the live site, plus
// the local dev server. CLIENT_URL (set in .env / on Render) is added too.
const allowedOrigins = [
    'https://ecommerce-frontend-three-ruby.vercel.app',
    'http://localhost:4200',
    process.env.CLIENT_URL,
].filter(Boolean)

app.use(cors({
    origin: allowedOrigins,
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
app.use('/api/editorial', editorialRoutes)

export {app}