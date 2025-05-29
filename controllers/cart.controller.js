import { Cart } from "../models/cart.model.js";
import jwt from "jsonwebtoken";

//create Cart

export const addItemToCart = async (req, res) => {
  try {
    const { userId, productId, quantity, price } = req.body;

    let cart = await Cart.findOne({ userId, isActive: true });

    if (!cart) {
      cart = new Cart({ userId, items: [], totalPrice: 0 });
    }

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, priceAtTime: price });
    }

    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.quantity * item.priceAtTime,
      0
    );

    await cart.save();

    // ✅ Populate full product data before sending response
    const populatedCart = await Cart.findById(cart._id).populate("items.productId");

    res.status(200).json(populatedCart);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//get all cartData
export const getUserCart = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const token = authHeader.split(" ")[1]; // ✅ Extract token after "Bearer"

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id; // ✅ Extract user ID from token

    const cart = await Cart.findOne({ userId, isActive: true }).populate("items.productId");

    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    res.status(200).json(cart);
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


export const removeCartItem = async (req, res) => {
  try {
    const { userId } = req.body; // or get from token
    const itemId = req.params.id;

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId: itemId } } },
      { new: true } // returns updated document
    );

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    console.log(cart);
    
    res.json({ message: 'Cart item removed', cart });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const mergeProduct = async (req, res) => {
  const { products } = req.body;

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    let cart = await Cart.findOne({ userId, isActive: true });

    if (!cart) {
      cart = new Cart({ userId, items: [], totalPrice: 0 });
    }

    for (const item of products) {
      const existingItem = cart.items.find(
        (i) => i.productId.toString() === item.productId
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        cart.items.push({
          productId: item.productId,
          quantity: item.quantity,
          priceAtTime: item.price,
        });
      }
    }

    // Recalculate total price
    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.quantity * item.priceAtTime,
      0
    );

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate("items.productId");

    res.status(200).json({ message: "Cart merged successfully", cart: populatedCart });

  } catch (error) {
    console.error("Cart merge error:", error);
    res.status(500).json({ message: "Server error while merging cart" });
  }
};
