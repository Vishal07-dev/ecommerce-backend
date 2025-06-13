import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  email: { type: String, required: true },
  items: [
    {
      name: String,
      quantity: Number,
      price: Number,
      productId: String,
      category: String,
      originalPrice: Number,
      image: String
    }
  ],
  totalAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);
