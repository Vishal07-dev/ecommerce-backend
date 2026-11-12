import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";

// All cart routes run behind `protect`, so the user always comes from the
// verified token (req.user.id) and never from the request body. Prices and
// stock always come from the database, never from the client.

const ONE_SIZE = 'One size';

const stockFor = (product, size) => {
  if (product.variants?.length) {
    return product.variants.find(v => v.size === size)?.stock ?? 0;
  }
  return product.stock ?? 0;
};

const sizeIsValid = (product, size) =>
  product.variants?.length ? product.variants.some(v => v.size === size) : size === ONE_SIZE;

const primaryImage = (product) =>
  product.images?.find(i => i.role === 'model')?.url || product.images?.[0]?.url || product.image;

// Shape the cart the storefront renders: one flat line per product + size.
const serialize = (cart) => {
  const items = (cart?.items ?? [])
    .filter(item => item.productId) // product was deleted
    .map(item => {
      const p = item.productId;
      return {
        _id: item._id,
        productId: p._id,
        slug: p.slug,
        name: p.name,
        colorway: p.colorway?.name,
        image: primaryImage(p),
        size: item.size || ONE_SIZE,
        quantity: item.quantity,
        price: item.priceAtTime,
        maxQuantity: Math.max(0, stockFor(p, item.size || ONE_SIZE)),
      };
    });
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + i.quantity * i.price, 0),
  };
};

const loadCart = (userId) =>
  Cart.findOne({ userId, isActive: true }).populate("items.productId");

const addLine = (cart, product, size, quantity) => {
  const line = cart.items.find(i => i.productId.toString() === product._id.toString() && (i.size || ONE_SIZE) === size);
  const available = stockFor(product, size);
  const wanted = Math.min((line?.quantity ?? 0) + quantity, available);
  if (wanted < 1) return false;
  if (line) {
    line.quantity = wanted;
  } else {
    cart.items.push({ productId: product._id, size, quantity: wanted, priceAtTime: product.price });
  }
  return true;
};

export const getUserCart = async (req, res) => {
  try {
    const cart = await loadCart(req.user.id);
    res.status(200).json(serialize(cart));
  } catch (error) {
    res.status(500).json({ message: "We couldn't load your bag. Refresh the page to try again." });
  }
};

export const addItemToCart = async (req, res) => {
  try {
    const { productId, size = ONE_SIZE } = req.body;
    const quantity = Math.max(1, Number(req.body.quantity) || 1);

    const product = await Product.findById(productId);
    if (!product || product.isArchived) {
      return res.status(404).json({ message: "This piece is no longer available." });
    }
    if (!sizeIsValid(product, size)) {
      return res.status(400).json({ message: "Choose a size before adding this piece to your bag." });
    }

    let cart = await Cart.findOne({ userId: req.user.id, isActive: true });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    if (!addLine(cart, product, size, quantity)) {
      return res.status(409).json({ message: `Size ${size} is sold out. Choose another size.` });
    }
    await cart.recalculate().save();
    res.status(200).json(serialize(await loadCart(req.user.id)));
  } catch (error) {
    res.status(500).json({ message: "We couldn't add this to your bag. Try again in a moment." });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1." });
    }
    const cart = await loadCart(req.user.id);
    const line = cart?.items.id(req.params.itemId);
    if (!line) return res.status(404).json({ message: "That item is no longer in your bag." });

    const available = stockFor(line.productId, line.size || ONE_SIZE);
    line.quantity = Math.min(quantity, Math.max(available, 1));
    await cart.recalculate().save();
    res.status(200).json(serialize(await loadCart(req.user.id)));
  } catch (error) {
    res.status(500).json({ message: "We couldn't update the quantity. Try again in a moment." });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id, isActive: true });
    if (!cart) return res.status(200).json(serialize(null));
    cart.items.pull({ _id: req.params.itemId });
    await cart.recalculate().save();
    res.status(200).json(serialize(await loadCart(req.user.id)));
  } catch (error) {
    res.status(500).json({ message: "We couldn't remove that item. Try again in a moment." });
  }
};

// Empties the bag, e.g. after a completed checkout.
export const clearCart = async (req, res) => {
  try {
    await Cart.updateOne({ userId: req.user.id, isActive: true }, { $set: { items: [], totalPrice: 0 } });
    res.status(200).json(serialize(null));
  } catch (error) {
    res.status(500).json({ message: "We couldn't empty your bag. Refresh the page to try again." });
  }
};

// Folds a guest bag (kept in the browser before sign-in) into the account bag.
export const mergeProduct = async (req, res) => {
  try {
    const lines = Array.isArray(req.body.products) ? req.body.products : [];
    let cart = await Cart.findOne({ userId: req.user.id, isActive: true });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    for (const line of lines) {
      const product = await Product.findById(line.productId).catch(() => null);
      const size = line.size || ONE_SIZE;
      if (!product || product.isArchived || !sizeIsValid(product, size)) continue;
      addLine(cart, product, size, Math.max(1, Number(line.quantity) || 1));
    }
    await cart.recalculate().save();
    res.status(200).json(serialize(await loadCart(req.user.id)));
  } catch (error) {
    console.error("Cart merge error:", error);
    res.status(500).json({ message: "We couldn't combine your bags. Your items are still saved on this device." });
  }
};
