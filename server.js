import { app } from "./app.js";

import dotenv from "dotenv"

import connectDB from "./db/index.js";

dotenv.config({
    path:'.env'
})
connectDB().then(()=>{
app.listen(2000,()=>{
    console.log(`server is running`);
    
})
}).catch((err)=>{
    console.log(`error in listening`,err);
    
})
