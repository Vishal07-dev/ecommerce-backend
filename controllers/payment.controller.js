import Stripe from 'stripe';
import { Order } from '../models/Order.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // from .env

// Where Stripe sends the shopper back. Set CLIENT_URL in .env for local work;
// it falls back to the deployed storefront.
const CLIENT_URL = process.env.CLIENT_URL || 'https://ecommerce-frontend-three-ruby.vercel.app';

export const FREE_DELIVERY_FROM = 5000; // INR
export const DELIVERY_FEE = 250;        // INR

export const createCheckoutSession = async (req, res) => {
  const { items } = req.body; // [{ productId, size, quantity }]

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your bag is empty.' });
    }

    // Price every line from the database, never from the browser.
    const products = await Product.find({ _id: { $in: items.map(i => i.productId) } });
    const byId = Object.fromEntries(products.map(p => [String(p._id), p]));
    const lines = items
      .map(item => ({ item, product: byId[String(item.productId)] }))
      .filter(({ product }) => product && !product.isArchived);
    if (lines.length === 0) {
      return res.status(400).json({ error: 'These pieces are no longer available.' });
    }

    // Delivery: free from ₹5,000, otherwise a flat ₹250. The storefront shows
    // the same rule (front-end/src/service/cartService/cart.service.ts).
    const subtotal = lines.reduce((n, { item, product }) => n + product.price * Math.max(1, Number(item.quantity) || 1), 0);
    const deliveryFee = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;

    // Signed-in shoppers: tie the payment to their account and prefill email.
    const buyer = req.user ? await User.findById(req.user.id).select('email') : null;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(buyer ? { client_reference_id: String(buyer._id), customer_email: buyer.email } : {}),
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: deliveryFee * 100, currency: 'inr' },
          display_name: deliveryFee ? 'Standard delivery' : 'Free delivery',
          delivery_estimate: { minimum: { unit: 'business_day', value: 3 }, maximum: { unit: 'business_day', value: 6 } },
        },
      }],

      line_items: lines.map(({ item, product }) => {
        const size = item.size || 'One size';
        const image = product.images?.find(i => i.role === 'model')?.url || product.images?.[0]?.url || product.image;
        return {
          price_data: {
            currency: 'inr',
            unit_amount: Math.round(product.price * 100),
            product_data: {
              name: `${product.name} (${size})`,
              description: [product.colorway?.name, size].filter(Boolean).join(' · '),
              ...(image ? { images: [image] } : {}),
              metadata: {
                productId: String(product._id),
                size,
              }
            }
          },
          quantity: Math.max(1, Number(item.quantity) || 1)
        };
      }),

      success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel`
    });

    res.json({ url: session.url }); // Send session URL to frontend
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export const storeOrderAfterPayment = async (req, res) => {
  const { sessionId } = req.body;

  try {
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Missing checkout session.' });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'This payment hasn’t gone through.' });
    }

    // Reloading the success page must not create a second order.
    const existing = await Order.findOne({ sessionId: session.id });
    if (existing) return res.status(200).json({ message: 'Order already saved', orderId: existing._id });

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { expand: ['data.price.product'] });

    const order = new Order({
      sessionId: session.id,
      email: session.customer_details?.email ?? session.customer_email,
      ...(session.client_reference_id ? { userId: session.client_reference_id } : {}),
      totalAmount: session.amount_total / 100,
      items: lineItems.data.map(item => {
        const product = typeof item.price?.product === 'object' ? item.price.product : null;
        return {
          name: item.description,
          quantity: item.quantity,
          price: item.amount_total / 100,
          productId: product?.metadata?.productId,
          size: product?.metadata?.size,
          image: product?.images?.[0],
        };
      })
    });

    await order.save();

    res.status(201).json({ message: 'Order saved successfully', orderId: order._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

