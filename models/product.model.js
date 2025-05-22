import mongoose, { Schema } from "mongoose";

const productSchema = new Schema({
    name:{
        type:String,
        required:true,
        unique:true,
        
    },
    price:{
        type:Number,
        required:true,
    },
    category:{
        type:String,
        required:true,
        enum:['Shirt','jeans'],
    },
    description:{
        type:String,
        required:true
    },
    stock:{
        type:Number,
        default:0
    },
    image:{
        type:String // cloudinary url,   
    },
    ratings: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
},{timestamps:true})

export const Product = mongoose.model("Product",productSchema)