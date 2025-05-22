import {User} from '../models/user.model.js'
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
//create user
export const register = async (req,res) =>{
    try {
        const {name,email,password,address} = req.body

        const UserExist = await User.findOne({email})
        if(UserExist){
        return res.status(400).json({success:false, message:"User Already exist"})
        } 

    const user = new User({name,email,password,address});
    const savedUser = await user.save();  
    const { password: _, ...response } = savedUser.toObject();

    res.status(201).json({success:true, message:"User Created",data:response})  
    } catch (error) {
        res.status(500).json({message:error.message})
    }
}



const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN } // Short-lived access token
  );
};

const generateRefreshToken = (user) => {
    console.log(process.env.REFRESH_TOKEN_SECRET);
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_EXPIRES_IN }
  );
  
};




export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Invalid credentials" });
console.log(user,'ejkds');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
  const { password:_, ...userProfile } = user.toObject();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
    res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({userProfile, accessToken });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const updateUser = async(req, res)=>{
  try {
    const {name,email,address} = req.body
  const user = await User.findById(req.params.id); // fetch existing product
  if (!user) {
      return res.status(404).json({ message: 'Product not found' });
    }
 user.name = name ?? user.name;
    user.email = email ?? product.email;
    user.address = address ?? product.address;
       const updatedProduct = await user.save(); // saves the changes to the same _id
    res.json(updatedProduct);
  } 
  
catch (error) {
    res.status(500).json({ message: error.message });
  }

}

export const getuser = async (req, res) => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user by ID
    const user = await User.findById(decoded.id).select('-password'); // exclude password if needed

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 4. Send user data
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
