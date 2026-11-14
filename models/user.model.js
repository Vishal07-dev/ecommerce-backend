import mongoose, {Schema } from "mongoose";
import bcrypt from 'bcryptjs'

const addressSchema = new Schema({
    fullName:{ type:String, required:true, trim:true },
    phone:{ type:String, required:true, trim:true },
    line1:{ type:String, required:true, trim:true },
    line2:{ type:String, trim:true },
    city:{ type:String, required:true, trim:true },
    state:{ type:String, required:true, trim:true },
    pincode:{ type:String, required:true, trim:true },
    isDefault:{ type:Boolean, default:false },
});

const userSchema = new Schema({
    name:{
        type:String,
        required: true,
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
        type:String, // legacy free-text address; the account page uses addresses[]
    },
    phone:{
        type:String,
        trim:true,
    },
    addresses:[addressSchema],
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
