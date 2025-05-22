import mongoose, {Schema } from "mongoose";
import bcrypt from 'bcryptjs'
const userSchema = new Schema({
    name:{
        type:String,
        required: true,
        lowercase: true,
        trim: true, 
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
    },
    password:{
        type:String,
        required:true
    },
    address:{
        type:String,
    },
    role:{
        type:String,
        enum:['admin','user'],
        default:'user'
    },
    refreshtoken:{
        type:String
    }
},
{timestamps:true}
)

userSchema.pre('save',async function encryptpassword(next){

    if(!this.isModified("password")) return next()
    this.password = await bcrypt.hash(this.password,10)

})
 

export const User = mongoose.model("User",userSchema)