import mongoose, { Schema } from "mongoose";

const collectionSchema = new Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    season: String,
    intro: String,
    cover: {
        url: String,
        alt: String,
        credit: { name: String, url: String },
    },
    order: { type: Number, default: 0 },
}, { timestamps: true });

export const Collection = mongoose.model("Collection", collectionSchema);
