import mongoose from "mongoose";

// A cart line is one product in one size. The line's own _id is what the
// storefront uses to change quantity or remove it.
const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: String,
    default: 'One size'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtTime: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  totalPrice: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, { timestamps: true });

cartSchema.methods.recalculate = function () {
  this.totalPrice = this.items.reduce((total, item) => total + item.quantity * item.priceAtTime, 0);
  return this;
};

export const Cart = mongoose.model("Cart", cartSchema)
