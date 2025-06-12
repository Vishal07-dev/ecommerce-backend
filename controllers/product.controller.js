import { Product } from '../models/product.model.js';
import  {cloudinary}  from '../utils/cloudinary.js';

// Create a new product
export const createProduct = async (req, res) => {
  try {
     const image = req.file.path;
    const { name, price, description, stock,category } = req.body;

    const productExists = await Product.findOne({ name });
    if (productExists) {
      return res.status(400).json({ message: 'Product already exists' });
    }

    const product = new Product({ name, price, description, stock, image ,category});
    const savedProduct = await product.save();

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all products
// controllers/productController.js
export const getProducts = async (req, res) => {
  try {
    // 1) pull queries out of req.query (with sensible defaults)
    const {
      category,      // e.g. ?category=608d1f...
      name,       // e.g. ?keyword=phone
      minPrice,      // e.g. ?minPrice=100
      maxPrice,      // e.g. ?maxPrice=1000
      sortBy,        // e.g. ?sortBy=-price (desc by price)
      page = 1,      // default to page 1
      limit = 20,    // default page size = 20
    } = req.query;

    // 2) build up your Mongo filter
    const filter = {};
    if (category) {
      // if you're using ObjectId:
      filter.category = category;
      // OR if you're storing a slug:
      // filter['category.slug'] = category;
    }
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // 3) calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // 4) build the Mongoose query
    let query = Product.find(filter).populate('category');
    if (sortBy) {
      query = query.sort(sortBy);
    }

    // 5) apply pagination
    query = query.skip(skip).limit(Number(limit));

    // 6) execute
    const products = await query;

    // 7) optionally send back total count for frontend pagers
    const total = await Product.countDocuments(filter);

    // 8) respond
    res.json({
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product by ID

export const updateProduct = async (req, res) => {
  try {
    const { name, price, description, stock, category } = req.body;

    // Find the existing product
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // If new image uploaded, replace the old one
    if (req.file) {
      // Optional: delete old image from cloudinary
      const oldImageUrl = product.image;
      const publicIdMatch = oldImageUrl.match(/\/([^/]+)\.[a-z]+$/); // extract publicId
      if (publicIdMatch) {
        const publicId = `ecommerce-products/${publicIdMatch[1]}`;
        await cloudinary.uploader.destroy(publicId);
      }

      // Set new image
      product.image = req.file.path;
    }

    // Update other fields
    product.name = name || product.name;
    product.price = price || product.price;
    product.description = description || product.description;
    product.stock = stock || product.stock;
    product.category = category || product.category;

    const updated = await product.save();
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Delete product by ID
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
