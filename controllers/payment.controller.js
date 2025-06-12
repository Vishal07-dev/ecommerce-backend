import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // from .env

export const createCheckoutSession = async (req, res) => {
  const { items } = req.body; // [{ name, price, quantity }]

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',

      line_items: items.map((item) => ({
       price_data: {
      currency: 'inr',
      unit_amount: item.price * 100,
      product_data: {
        name: item.name,
        description: 'Optional description',
        images: [item.image], // ✅ must be a public URL
        metadata: {
          category: item.category.name,
          productId: item.productId,
          originalPrice: item.originalPrice
        }
      }
    },
    quantity: item.quantity
  
      })),

      
      success_url: 'http://localhost:4200/success', // Your Angular success page
      cancel_url: 'http://localhost:4200/cancel',   // Cancel page
    });

    res.json({ url: session.url }); // Send session URL to frontend
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
