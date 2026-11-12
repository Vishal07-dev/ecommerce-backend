import mongoose, { Schema } from "mongoose";

// A lookbook frame: one editorial photograph with shoppable markers.
const lookSchema = new Schema({
    slug: { type: String, required: true, unique: true },
    number: { type: Number, required: true },
    title: String,
    caption: String,
    image: {
        url: { type: String, required: true },
        alt: { type: String, required: true },
        width: Number,
        height: Number,
        credit: { name: String, url: String },
    },
    items: [{
        product: { type: mongoose.Schema.ObjectId, ref: 'Product', required: true },
        x: { type: Number, min: 0, max: 100 },
        y: { type: Number, min: 0, max: 100 },
        _id: false,
    }],
    order: { type: Number, default: 0 },
}, { timestamps: true });

export const Look = mongoose.model("Look", lookSchema);
