import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  email: { type: String, required: true, index: true },
  // Set when the shopper was signed in at checkout (Stripe client_reference_id).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: { type: String, enum: ['paid', 'packed', 'shipped', 'delivered', 'cancelled'], default: 'paid' },
  items: [
    {
      name: String,
      quantity: Number,
      price: Number,
      productId: String,
      size: String,
      category: String,
      originalPrice: Number,
      image: String
    }
  ],
  totalAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);
