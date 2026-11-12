import mongoose, { Schema } from "mongoose";

// Site-level editorial imagery that belongs to no product (brand note,
// empty-bag illustration, texture plates). Looked up by `key`.
const assetSchema = new Schema({
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    width: Number,
    height: Number,
    credit: { name: String, url: String },
}, { timestamps: true });

export const Asset = mongoose.model("Asset", assetSchema);
