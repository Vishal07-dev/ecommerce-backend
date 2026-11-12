import { Collection } from '../models/collection.model.js';
import { Look } from '../models/look.model.js';
import { Product } from '../models/product.model.js';
import { Asset } from '../models/asset.model.js';

// GET /api/editorial/assets: { [key]: { url, alt, width, height, credit } }
export const getAssets = async (req, res) => {
  try {
    const assets = await Asset.find().lean();
    res.json(Object.fromEntries(assets.map(({ key, url, alt, width, height, credit }) => [key, { url, alt, width, height, credit }])));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const LOOK_PRODUCT_FIELDS = 'name slug price images image colorway variants stock isArchived';

// GET /api/editorial/credits: every photographer whose work appears on the site
export const getCredits = async (req, res) => {
  try {
    const [products, looks, editions, assets] = await Promise.all([
      Product.find({ isArchived: { $ne: true } }, 'images.credit').lean(),
      Look.find({}, 'image.credit').lean(),
      Collection.find({}, 'cover.credit').lean(),
      Asset.find({}, 'credit').lean(),
    ]);
    const all = [
      ...products.flatMap(p => (p.images ?? []).map(i => i.credit)),
      ...looks.map(l => l.image?.credit),
      ...editions.map(e => e.cover?.credit),
      ...assets.map(a => a.credit),
    ].filter(c => c?.name);
    const byName = new Map();
    for (const c of all) if (!byName.has(c.name)) byName.set(c.name, c);
    res.json([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/editorial/collections
export const getCollections = async (req, res) => {
  try {
    const collections = await Collection.find().sort({ order: 1 }).lean();
    const counts = await Product.aggregate([
      { $match: { isArchived: { $ne: true }, edition: { $ne: null } } },
      { $group: { _id: '$edition', count: { $sum: 1 } } },
    ]);
    const byId = Object.fromEntries(counts.map(c => [String(c._id), c.count]));
    res.json(collections.map(c => ({ ...c, productCount: byId[String(c._id)] ?? 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/editorial/looks
export const getLooks = async (req, res) => {
  try {
    const looks = await Look.find().sort({ order: 1 }).populate('items.product', LOOK_PRODUCT_FIELDS).lean();
    // Drop markers that point at archived or deleted products.
    res.json(looks.map(l => ({ ...l, items: l.items.filter(i => i.product && !i.product.isArchived) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/editorial/hero: the piece the homepage showcase is built around
export const getHero = async (req, res) => {
  try {
    const product = await Product.findOne({ 'featured.hero': true, isArchived: { $ne: true } })
      .populate('category')
      .populate('edition', 'name slug season');
    if (!product) return res.status(404).json({ message: 'No hero product is set.' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
