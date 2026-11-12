import mongoose, { Schema } from "mongoose";

// Every field added for the editorial storefront is optional, so products
// created through the admin form (name, price, description, stock, image,
// category) keep validating exactly as before.

const imageSchema = new Schema({
    url: { type: String, required: true },
    alt: { type: String, required: true },
    // cutout: transparent studio cut-out (hero flip). model: on-figure shot.
    // detail: fabric or construction close-up. flat: laid-flat product shot.
    role: { type: String, enum: ['cutout', 'front', 'back', 'model', 'detail', 'flat', 'look'], default: 'model' },
    width: Number,
    height: Number,
    credit: { name: String, url: String },
}, { _id: false });

const variantSchema = new Schema({
    size: { type: String, required: true },
    sku: String,
    stock: { type: Number, default: 0, min: 0 },
}, { _id: false });

const measurementSchema = new Schema({
    size: { type: String, required: true },
    chest: Number,   // cm, garment laid flat × 2
    length: Number,  // cm, high point shoulder to hem
    sleeve: Number,  // cm
    waist: Number,
    inseam: Number,
}, { _id: false });

const hotspotSchema = new Schema({
    x: { type: Number, min: 0, max: 100 }, // % of image width
    y: { type: Number, min: 0, max: 100 }, // % of image height
    label: String,
    detail: String,
}, { _id: false });

const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    price: {
        type: Number,
        required: true,
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'Category',
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    image: {
        type: String // cloudinary url, primary image
    },
    ratings: {
        type: Number,
        default: 5,
    },
    numReviews: {
        type: Number,
        default: 0,
    },

    // Editorial storefront fields
    slug: { type: String, unique: true, sparse: true, index: true },
    subtitle: String,
    story: String,
    compareAtPrice: Number, // only set for a real markdown
    images: [imageSchema],
    variants: [variantSchema],
    colorway: { name: String, swatch: String },
    fabric: {
        composition: [{ fiber: String, percent: Number, _id: false }],
        weightGsm: Number,
        weave: String,
        origin: String,
        care: [String],
    },
    fit: {
        cut: { type: String, enum: ['slim', 'regular', 'relaxed', 'oversized'] },
        modelHeightCm: Number,
        modelWears: String,
        notes: String,
    },
    measurements: [measurementSchema],
    hotspots: [hotspotSchema],
    turntable: [String], // ordered frame URLs for a 360° spin, empty until shot
    tags: [String],
    // `collection` is reserved by Mongoose documents, so the field is `edition`.
    edition: { type: mongoose.Schema.ObjectId, ref: 'Collection' },
    featured: {
        hero: { type: Boolean, default: false },
        order: Number,
    },
    isArchived: { type: Boolean, default: false, index: true },
}, { timestamps: true })

export const Product = mongoose.model("Product", productSchema)
