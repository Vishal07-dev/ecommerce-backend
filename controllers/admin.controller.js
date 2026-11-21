import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { User } from '../models/user.model.js';
import { Product } from '../models/product.model.js';
import { Category } from '../models/category.model.js';
import { Collection } from '../models/collection.model.js';
import { summarizeOrder } from '../utils/order-summary.js';

/**
 * KŌRA Studio, the admin API. Roles are checked per route in admin.route.js.
 * Money is in INR. Days are bucketed in India time (Asia/Kolkata).
 */

const TZ = 'Asia/Kolkata';
const STATUSES = ['paid', 'packed', 'shipped', 'delivered', 'cancelled'];
const LOW_STOCK = 2;
const fail = (res, status, message, field) => res.status(status).json({ message, field });
const statusExpr = { $ifNull: ['$status', 'paid'] }; // orders saved before statuses existed
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Placement is derived from the fields the storefront already reads. */
export function placementOf(p) {
  if (p.isArchived) return 'archived';
  if (p.featured?.hero) return 'hero';
  if (p.featured?.order != null) return 'featured';
  return 'shop';
}

function stockOf(p) {
  if (p.variants?.length) return p.variants.reduce((n, v) => n + (Number(v.stock) || 0), 0);
  return Number(p.stock) || 0;
}

function lowVariants(p) {
  return (p.variants ?? []).filter(v => v.stock <= LOW_STOCK).map(v => ({ size: v.size, stock: v.stock }));
}

function primaryImage(p) {
  const img = p.images?.find(i => i.role !== 'look') ?? p.images?.[0]; // first photo is the main one
  return img?.url ?? p.image ?? null;
}

// ---------------------------------------------------------------------------
// Overview: KPIs, daily series, top products, statuses, low stock, recent orders
// ---------------------------------------------------------------------------
export const overview = async (req, res) => {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    const prevFrom = new Date(from.getTime() - days * 86_400_000);

    const [current, previous, series, top, statuses, recent, newCustomers, prevCustomers, products] = await Promise.all([
      Order.aggregate([{ $match: { createdAt: { $gte: from }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { createdAt: { $gte: prevFrom, $lt: from }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { createdAt: { $gte: from }, status: { $ne: 'cancelled' } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } }]),
      Order.aggregate([{ $match: { createdAt: { $gte: from }, status: { $ne: 'cancelled' } } }, { $unwind: '$items' },
        { $group: { _id: { $ifNull: ['$items.productId', '$items.name'] }, name: { $first: '$items.name' }, units: { $sum: '$items.quantity' }, revenue: { $sum: '$items.price' } } },
        { $sort: { revenue: -1 } }, { $limit: 5 }]),
      Order.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: statusExpr, count: { $sum: 1 } } }]),
      Order.find().sort({ createdAt: -1 }).limit(6).lean(),
      User.countDocuments({ role: { $nin: ['owner', 'admin', 'staff'] }, createdAt: { $gte: from } }),
      User.countDocuments({ role: { $nin: ['owner', 'admin', 'staff'] }, createdAt: { $gte: prevFrom, $lt: from } }),
      Product.find().select('name slug price images image variants stock featured isArchived').lean(),
    ]);

    // Fill every day of the range so the chart has no gaps.
    const byDay = Object.fromEntries(series.map(d => [d._id, d]));
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const daily = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = fmt.format(new Date(now.getTime() - i * 86_400_000));
      daily.push({ date: key, revenue: byDay[key]?.revenue ?? 0, orders: byDay[key]?.orders ?? 0 });
    }

    const cur = current[0] ?? { revenue: 0, orders: 0 };
    const prev = previous[0] ?? { revenue: 0, orders: 0 };
    const live = products.filter(p => !p.isArchived);
    const hero = products.find(p => !p.isArchived && p.featured?.hero);

    res.json({
      days,
      updatedAt: now,
      kpis: {
        revenue: { value: cur.revenue, previous: prev.revenue },
        orders: { value: cur.orders, previous: prev.orders },
        aov: { value: cur.orders ? cur.revenue / cur.orders : 0, previous: prev.orders ? prev.revenue / prev.orders : 0 },
        customers: { value: newCustomers, previous: prevCustomers },
      },
      daily,
      topProducts: top.map(t => ({ id: String(t._id), name: t.name, units: t.units, revenue: t.revenue })),
      statuses: STATUSES.map(s => ({ status: s, count: statuses.find(x => x._id === s)?.count ?? 0 })),
      recentOrders: recent.map(o => ({ _id: o._id, ref: summarizeOrder(o).ref, email: o.email, totalAmount: o.totalAmount, status: o.status ?? 'paid', createdAt: o.createdAt, items: (o.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0) })),
      catalogue: {
        live: live.length,
        archived: products.length - live.length,
        featured: live.filter(p => p.featured?.order != null).length,
        hero: hero ? { _id: hero._id, name: hero.name, image: primaryImage(hero) } : null,
      },
      lowStock: live
        .map(p => ({ _id: p._id, name: p.name, image: primaryImage(p), stock: stockOf(p), sizes: lowVariants(p) }))
        .filter(p => p.sizes.length || (!p.sizes.length && p.stock <= LOW_STOCK))
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    });
  } catch (err) {
    console.error('Admin overview:', err.message);
    fail(res, 500, 'Couldn’t load the overview.');
  }
};

// ---------------------------------------------------------------------------
// Notifications: derived from real events, newest first
// ---------------------------------------------------------------------------
export const notifications = async (req, res) => {
  try {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const [orders, users, products] = await Promise.all([
      Order.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20).lean(),
      User.find({ role: { $nin: ['owner', 'admin', 'staff'] }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).select('name email createdAt').lean(),
      Product.find({ isArchived: { $ne: true } }).select('name variants stock updatedAt').lean(),
    ]);
    const items = [
      ...orders.map(o => ({ id: `order-${o._id}`, kind: 'order', title: `New order · ₹${Math.round(o.totalAmount).toLocaleString('en-IN')}`, detail: o.email, at: o.createdAt, link: `/admin/orders?open=${o._id}` })),
      ...users.map(u => ({ id: `user-${u._id}`, kind: 'customer', title: 'New customer', detail: `${u.name} · ${u.email}`, at: u.createdAt, link: '/admin/customers' })),
      ...products.flatMap(p => {
        const out = (p.variants ?? []).filter(v => v.stock === 0).map(v => v.size);
        const low = (p.variants ?? []).filter(v => v.stock > 0 && v.stock <= LOW_STOCK).map(v => v.size);
        const list = [];
        if (out.length) list.push({ id: `soldout-${p._id}-${out.join('')}`, kind: 'stock', title: `Sold out: ${p.name}`, detail: `Size ${out.join(', ')}`, at: p.updatedAt, link: `/admin/products/${p._id}` });
        if (low.length) list.push({ id: `low-${p._id}-${low.join('')}`, kind: 'stock', title: `Low stock: ${p.name}`, detail: `Size ${low.join(', ')} · ${LOW_STOCK} or fewer left`, at: p.updatedAt, link: `/admin/products/${p._id}` });
        return list;
      }),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
    res.json({ items, serverTime: new Date() });
  } catch (err) {
    fail(res, 500, 'Couldn’t load notifications.');
  }
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const listOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const match = {};
    if (STATUSES.includes(req.query.status)) {
      match.$expr = { $eq: [statusExpr, req.query.status] };
    }
    if (req.query.q) {
      const re = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      const or = [{ email: re }, { 'items.name': re }];
      const q = req.query.q.trim().replace(/^#/, '');
      if (mongoose.isValidObjectId(q)) or.push({ _id: q });
      // The short reference shown everywhere (#72EECD1E) is the end of the order id.
      if (/^[0-9a-f]{4,24}$/i.test(q)) or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: q + '$', options: 'i' } } });
      match.$or = or;
    }
    const [orders, total, counts] = await Promise.all([
      Order.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(match),
      Order.aggregate([{ $group: { _id: statusExpr, count: { $sum: 1 } } }]),
    ]);
    res.json({
      orders: orders.map(o => {
        const s = summarizeOrder(o);
        return {
          _id: o._id, ref: s.ref, email: o.email, sessionId: o.sessionId, createdAt: o.createdAt, status: s.status,
          subtotal: s.subtotal, deliveryFee: s.deliveryFee, totalAmount: s.total,
          items: s.lines.map(l => ({ name: l.name, size: l.size, quantity: l.quantity, unitPrice: l.unitPrice, price: l.amount, image: l.image, productId: l.productId })),
        };
      }),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
      counts: Object.fromEntries(STATUSES.map(s => [s, counts.find(c => c._id === s)?.count ?? 0])),
    });
  } catch (err) {
    fail(res, 500, 'Couldn’t load orders.');
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return fail(res, 400, 'Choose a valid status.', 'status');
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Order not found.');
    const order = await Order.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).lean();
    if (!order) return fail(res, 404, 'Order not found.');
    res.json(order);
  } catch (err) {
    fail(res, 500, 'Couldn’t update that order.');
  }
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const listCustomers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 25;
    const match = { role: { $nin: ['owner', 'admin', 'staff'] } };
    if (req.query.q) {
      const re = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      match.$or = [{ name: re }, { email: re }];
    }
    const [users, total] = await Promise.all([
      User.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('name email phone createdAt addresses').lean(),
      User.countDocuments(match),
    ]);
    const emails = users.map(u => u.email);
    const ids = users.map(u => u._id);
    const stats = await Order.aggregate([
      { $match: { $or: [{ email: { $in: emails } }, { userId: { $in: ids } }], status: { $ne: 'cancelled' } } },
      { $group: { _id: '$email', orders: { $sum: 1 }, spent: { $sum: '$totalAmount' }, last: { $max: '$createdAt' } } },
    ]);
    const byEmail = Object.fromEntries(stats.map(s => [s._id, s]));
    res.json({
      customers: users.map(u => ({
        _id: u._id, name: u.name, email: u.email, phone: u.phone ?? '', createdAt: u.createdAt,
        city: u.addresses?.find(a => a.isDefault)?.city ?? u.addresses?.[0]?.city ?? null,
        orders: byEmail[u.email]?.orders ?? 0, spent: byEmail[u.email]?.spent ?? 0, lastOrder: byEmail[u.email]?.last ?? null,
      })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    fail(res, 500, 'Couldn’t load customers.');
  }
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const listProducts = async (req, res) => {
  try {
    const all = await Product.find()
      .populate('category', 'name').populate('edition', 'name slug')
      .select('name slug subtitle price compareAtPrice images image variants stock featured isArchived category edition colorway updatedAt createdAt')
      .sort({ 'featured.hero': -1, 'featured.order': 1, createdAt: -1 })
      .lean();
    let list = all.map(p => ({
      _id: p._id, name: p.name, slug: p.slug, subtitle: p.subtitle, price: p.price, compareAtPrice: p.compareAtPrice,
      image: primaryImage(p), stock: stockOf(p), lowSizes: lowVariants(p), sizes: (p.variants ?? []).length,
      placement: placementOf(p), featuredOrder: p.featured?.order ?? null,
      category: p.category?.name ?? null, edition: p.edition?.name ?? null, colorway: p.colorway?.name ?? null,
      updatedAt: p.updatedAt,
    }));
    const counts = { all: list.length, hero: 0, featured: 0, shop: 0, archived: 0 };
    list.forEach(p => { counts[p.placement]++; });
    if (['hero', 'featured', 'shop', 'archived'].includes(req.query.placement)) list = list.filter(p => p.placement === req.query.placement);
    if (req.query.q) { const q = req.query.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || (p.slug ?? '').includes(q)); }
    res.json({ products: list, counts });
  } catch (err) {
    fail(res, 500, 'Couldn’t load products.');
  }
};

export const getProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Product not found.');
  const p = await Product.findById(req.params.id).lean();
  if (!p) return fail(res, 404, 'Product not found.');
  res.json({ ...p, placement: placementOf(p) });
};

const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const num = v => (v === '' || v == null ? undefined : Number(v));

/** Validate and shape a product body from the editor. */
async function readProduct(body, existingId) {
  const name = String(body.name ?? '').trim();
  if (!name) return { error: ['Give the product a name.', 'name'] };
  if (await Product.exists({ name, _id: { $ne: existingId } })) return { error: ['Another product already has that name. Add the colour, like “The Heavy Tee, Sage”.', 'name'] };
  const price = num(body.price);
  if (!(price > 0)) return { error: ['Enter a price above ₹0.', 'price'] };
  const compareAtPrice = num(body.compareAtPrice);
  if (compareAtPrice != null && !(compareAtPrice > price)) return { error: ['The “was” price must be higher than the price.', 'compareAtPrice'] };
  const description = String(body.description ?? '').trim();
  if (!description) return { error: ['Add a short description.', 'description'] };
  if (!mongoose.isValidObjectId(body.category) || !(await Category.exists({ _id: body.category }))) return { error: ['Choose a category.', 'category'] };
  if (body.edition && !(mongoose.isValidObjectId(body.edition) && await Collection.exists({ _id: body.edition }))) return { error: ['Choose an edition, or none.', 'edition'] };

  const images = (Array.isArray(body.images) ? body.images : [])
    .filter(i => typeof i?.url === 'string' && /^https:\/\//.test(i.url))
    .map(i => ({ url: i.url, alt: String(i.alt ?? '').trim() || name, role: ['model', 'front', 'back', 'detail', 'flat', 'look', 'cutout'].includes(i.role) ? i.role : 'model', width: num(i.width), height: num(i.height), ...(i.credit?.name ? { credit: i.credit } : {}) }));
  if (!images.length) return { error: ['Add at least one photo.', 'images'] };

  const variants = (Array.isArray(body.variants) ? body.variants : [])
    .filter(v => String(v?.size ?? '').trim())
    .map(v => ({ size: String(v.size).trim(), sku: String(v.sku ?? '').trim() || undefined, stock: Math.max(0, Math.floor(Number(v.stock) || 0)) }));
  const sizes = variants.map(v => v.size.toLowerCase());
  if (new Set(sizes).size !== sizes.length) return { error: ['Each size can only appear once.', 'variants'] };

  let slug = slugify(body.slug || `${name}${body.colorway?.name ? '-' + body.colorway.name : ''}`);
  if (!slug) return { error: ['Enter a web address (slug).', 'slug'] };
  if (await Product.exists({ slug, _id: { $ne: existingId } })) return { error: ['Another product already uses that web address.', 'slug'] };

  return {
    data: {
      name, slug, price, compareAtPrice: compareAtPrice ?? undefined, description,
      subtitle: String(body.subtitle ?? '').trim() || undefined,
      story: String(body.story ?? '').trim() || undefined,
      category: body.category, edition: body.edition || undefined,
      images, variants,
      image: images[0].url, // older parts of the shop still read a single image
      stock: variants.length ? variants.reduce((n, v) => n + v.stock, 0) : Math.max(0, Math.floor(Number(body.stock) || 0)),
      colorway: body.colorway?.name ? { name: String(body.colorway.name).trim(), swatch: String(body.colorway.swatch ?? '').trim() || undefined } : undefined,
      fabric: body.fabric ? {
        composition: (body.fabric.composition ?? []).filter(c => c?.fiber && Number(c.percent) > 0).map(c => ({ fiber: String(c.fiber).trim(), percent: Number(c.percent) })),
        weightGsm: num(body.fabric.weightGsm), weave: String(body.fabric.weave ?? '').trim() || undefined,
        origin: String(body.fabric.origin ?? '').trim() || undefined,
        care: (body.fabric.care ?? []).map(String).map(s => s.trim()).filter(Boolean),
      } : undefined,
      fit: body.fit ? { cut: ['slim', 'regular', 'relaxed', 'oversized'].includes(body.fit.cut) ? body.fit.cut : undefined, modelHeightCm: num(body.fit.modelHeightCm), modelWears: String(body.fit.modelWears ?? '').trim() || undefined, notes: String(body.fit.notes ?? '').trim() || undefined } : undefined,
      tags: (Array.isArray(body.tags) ? body.tags : []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 8),
    },
  };
}

async function applyPlacement(product, placement) {
  if (placement === 'hero') {
    await Product.updateMany({ _id: { $ne: product._id }, 'featured.hero': true }, { $set: { 'featured.hero': false } });
    product.isArchived = false;
    const order = product.featured?.order ?? 0;
    product.featured = { hero: true, order };
  } else if (placement === 'featured') {
    product.isArchived = false;
    if (product.featured?.order == null) {
      const last = await Product.findOne({ 'featured.order': { $exists: true } }).sort({ 'featured.order': -1 }).select('featured').lean();
      product.featured = { hero: false, order: (last?.featured?.order ?? 0) + 1 };
    } else {
      product.featured = { hero: false, order: product.featured.order };
    }
  } else if (placement === 'shop') {
    product.isArchived = false;
    product.featured = undefined;
  } else if (placement === 'archived') {
    product.isArchived = true;
    product.featured = undefined;
  }
}

export const createProduct = async (req, res) => {
  try {
    const { data, error } = await readProduct(req.body);
    if (error) return fail(res, 400, ...error);
    const product = new Product(data);
    await applyPlacement(product, req.body.placement ?? 'shop');
    await product.save();
    res.status(201).json({ ...product.toObject(), placement: placementOf(product) });
  } catch (err) {
    console.error('Create product:', err.message);
    fail(res, 500, 'Couldn’t save the product.');
  }
};

export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Product not found.');
    const product = await Product.findById(req.params.id);
    if (!product) return fail(res, 404, 'Product not found.');
    const { data, error } = await readProduct(req.body, product._id);
    if (error) return fail(res, 400, ...error);
    product.set(data);
    if (req.body.placement) await applyPlacement(product, req.body.placement);
    await product.save();
    res.json({ ...product.toObject(), placement: placementOf(product) });
  } catch (err) {
    console.error('Update product:', err.message);
    fail(res, 500, 'Couldn’t save the product.');
  }
};

export const setPlacement = async (req, res) => {
  try {
    const { placement } = req.body;
    if (!['hero', 'featured', 'shop', 'archived'].includes(placement)) return fail(res, 400, 'Choose where the product appears.');
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Product not found.');
    const product = await Product.findById(req.params.id);
    if (!product) return fail(res, 404, 'Product not found.');
    await applyPlacement(product, placement);
    await product.save();
    res.json({ _id: product._id, placement: placementOf(product) });
  } catch (err) {
    fail(res, 500, 'Couldn’t move that product.');
  }
};

export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Product not found.');
    const product = await Product.findById(req.params.id).select('featured name').lean();
    if (!product) return fail(res, 404, 'Product not found.');
    if (product.featured?.hero) return fail(res, 409, 'This is the home page hero. Choose another hero before deleting it.');
    await Product.deleteOne({ _id: product._id });
    res.json({ message: `${product.name} deleted.` });
  } catch (err) {
    fail(res, 500, 'Couldn’t delete that product.');
  }
};

export const upload = async (req, res) => {
  if (!req.file) return fail(res, 400, 'Choose a JPG, PNG or WebP image.');
  res.status(201).json({ url: req.file.path, width: req.file.width, height: req.file.height });
};

export const meta = async (_req, res) => {
  try {
    const [categories, editions] = await Promise.all([
      Category.find().select('name status').sort({ name: 1 }).lean(),
      Collection.find().select('name slug season').sort({ order: 1, name: 1 }).lean(),
    ]);
    res.json({ categories, editions });
  } catch (err) {
    fail(res, 500, 'Couldn’t load categories and editions.');
  }
};
