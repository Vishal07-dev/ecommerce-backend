import mongoose, {Schema } from "mongoose";
const categorySchema = new Schema({
    name:{
        type:String,
        required: true,
        lowercase: true,
        trim: true, 
    },
    description:{
        type:String,
        required:true,
        lowercase:true,
    },
    status:{
        type:String,
        enum:['Active','Inactive'],
    },
},
{timestamps:true}
)



export const Category = mongoose.model("Category",categorySchema)