import mongoose, { Schema } from "mongoose";

const wishListSchema = new Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    products: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true,
    }]
},{timestamps:true})

export const Wish = mongoose.model("wish",wishListSchema)