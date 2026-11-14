import mongoose from "mongoose";
import { Wish } from "../models/wishList.model.js";

/**
 * The signed-in shopper's saved pieces. Routes sit behind `protect`, so an
 * expired token gets a 401 (which the storefront refreshes and retries)
 * instead of a 500. Every response has the same shape:
 *   { items: Product[], ids: string[] }   newest saves first
 */

// What the storefront's product card needs, and nothing more.
const CARD_FIELDS = 'name slug subtitle price compareAtPrice images image variants stock colorway edition isArchived';

const isId = id => mongoose.isValidObjectId(id);

async function respond(res, userId, status = 200) {
  const wish = await Wish.findOne({ user: userId }).populate({ path: 'products', select: CARD_FIELDS, populate: { path: 'edition', select: 'name slug season' } });
  const items = (wish?.products ?? [])
    .filter(p => p && !p.isArchived)   // deleted or archived pieces drop out quietly
    .reverse();                        // newest saves first
  res.status(status).json({ items, ids: items.map(p => String(p._id)) });
}

export const getUserWishList = async (req, res) => {
  try { await respond(res, req.user.id); }
  catch (error) { res.status(500).json({ message: 'We couldn’t load your saved pieces.' }); }
};

export const addItemToWishList = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!isId(productId)) return res.status(400).json({ message: 'That piece couldn’t be found.' });
    // $addToSet keeps each piece once; upsert creates the list on first save.
    await Wish.updateOne({ user: req.user.id }, { $addToSet: { products: productId } }, { upsert: true });
    await respond(res, req.user.id);
  } catch (error) { res.status(500).json({ message: 'We couldn’t save that piece.' }); }
};

export const removeItemFromWishList = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'That piece couldn’t be found.' });
    await Wish.updateOne({ user: req.user.id }, { $pull: { products: req.params.id } });
    await respond(res, req.user.id);
  } catch (error) { res.status(500).json({ message: 'We couldn’t remove that piece.' }); }
};

export const clearWishList = async (req, res) => {
  try {
    await Wish.updateOne({ user: req.user.id }, { $set: { products: [] } });
    await respond(res, req.user.id);
  } catch (error) { res.status(500).json({ message: 'We couldn’t clear your saved pieces.' }); }
};

/** Pieces saved while signed out are folded in at sign-in. Accepts `items` or `products`. */
export const mergeWishListItems = async (req, res) => {
  try {
    const incoming = (req.body.items ?? req.body.products ?? []).filter(isId).slice(0, 100);
    if (incoming.length) {
      await Wish.updateOne({ user: req.user.id }, { $addToSet: { products: { $each: incoming } } }, { upsert: true });
    }
    await respond(res, req.user.id);
  } catch (error) { res.status(500).json({ message: 'We couldn’t merge your saved pieces.' }); }
};
