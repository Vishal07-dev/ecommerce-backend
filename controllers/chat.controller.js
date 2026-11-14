import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from '../models/product.model.js';
import { FREE_DELIVERY_FROM, DELIVERY_FEE } from './payment.controller.js';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// "-latest" aliases follow Google's current models, so the assistant doesn't
// break when a dated model is retired (gemini-2.0-flash was). The first model
// that answers wins; a busy or missing model falls through to the next.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',').map(s => s.trim()).filter(Boolean);

const MAX_MESSAGE = 500;
const MAX_HISTORY = 8;

// --- A small per-visitor rate limit, so nobody can run up the AI bill. ------
const WINDOW_MS = 60_000, LIMIT = 15;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return recent.length > LIMIT;
}

// --- Catalogue context ------------------------------------------------------
function describe(p) {
  const sizes = (p.variants ?? []).filter(v => v.stock > 0).map(v => v.size);
  const fabric = p.fabric?.composition?.map(c => `${c.percent}% ${c.fiber}`).join(', ');
  return [
    `- ${p.name}${p.colorway?.name ? `, ${p.colorway.name}` : ''} — ₹${p.price}`,
    p.subtitle && `  ${p.subtitle}.`,
    p.description && `  ${p.description.trim()}`,
    fabric && `  Fabric: ${fabric}${p.fabric?.weightGsm ? `, ${p.fabric.weightGsm} gsm` : ''}${p.fabric?.origin ? `. ${p.fabric.origin}` : ''}.`,
    p.fit?.notes && `  Fit: ${p.fit.notes}`,
    `  Sizes in stock: ${sizes.length ? sizes.join(', ') : (p.variants?.length ? 'sold out' : 'one size')}.`,
  ].filter(Boolean).join('\n');
}

function systemPrompt(catalogue) {
  return `You are the shopping assistant for KŌRA, an Indian clothing brand ("Everyday Garments", est. Ahmedabad) that makes a small range of everyday clothes in heavy cotton and honest wool.

Tone: calm, warm, brief. Plain sentences. No markdown, no bullet symbols, no emoji. Two to four short sentences unless the shopper asks for detail.
Write prices with the rupee sign and digits, like ₹12,900. Describe fabrics exactly as the catalogue lists them; don't generalise (a cotton coat is not a wool coat).

Facts you can rely on:
- Prices are in Indian rupees and include GST.
- Delivery is free on orders from ₹${FREE_DELIVERY_FROM}; below that it is a flat ₹${DELIVERY_FEE}. Delivery takes 3–6 working days across India.
- Checkout is by card through Stripe. Shoppers need an account to check out.
- Every product page has a size guide with garment measurements and what the model wears.
- For anything about a specific order, ask the shopper to use the Contact page.

The full current catalogue:
${catalogue}

Only recommend pieces from this catalogue, using their exact names. If something isn't in the catalogue, say so plainly and suggest the closest piece. Never invent prices, stock, discounts, policies or delivery dates.`;
}

/** Products the reply actually names ("The Heavy Tee, Sage" also matches "the Heavy Tee in Sage"). */
function namedIn(reply, all) {
  const said = reply.toLowerCase();
  return all.filter(p => {
    const full = p.name.toLowerCase();
    if (said.includes(full)) return true;
    const base = p.name.split(',')[0].toLowerCase();
    if (!said.includes(base)) return false;
    const siblings = all.filter(o => o.name.split(',')[0].toLowerCase() === base);
    if (siblings.length === 1) return true;
    const colour = p.colorway?.name?.toLowerCase();
    return !!colour && said.includes(colour);
  }).slice(0, 3);
}

// --- Handler --------------------------------------------------------------
export const sendChat = async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Type a question first.' });
  if (message.length > MAX_MESSAGE) return res.status(400).json({ error: `Keep it under ${MAX_MESSAGE} characters, please.` });
  const visitor = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.ip;
  if (rateLimited(visitor)) return res.status(429).json({ error: 'That’s a lot of questions at once. Give it a minute and try again.' });

  // Earlier turns from this conversation, newest last, trimmed.
  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter(t => (t?.from === 'user' || t?.from === 'bot') && typeof t.text === 'string')
    .slice(-MAX_HISTORY)
    .map(t => ({ role: t.from === 'user' ? 'user' : 'model', parts: [{ text: t.text.slice(0, 1000) }] }));
  while (history.length && history[0].role !== 'user') history.shift(); // Gemini wants a user turn first

  try {
    const all = await Product.find({ isArchived: { $ne: true } })
      .select('name slug subtitle description price colorway fabric fit variants images')
      .lean();
    const instruction = systemPrompt(all.map(describe).join('\n'));

    let reply = null, lastErr = null;
    for (const name of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: name, systemInstruction: instruction });
        const chat = model.startChat({ history, generationConfig: { maxOutputTokens: 400, temperature: 0.4 } });
        const result = await chat.sendMessage(message);
        reply = result.response.text().replace(/\*\*?|__|^#+\s*/gm, '').trim();
        if (reply) break;
      } catch (err) {
        lastErr = err;
        console.error(`Chat model ${name} failed:`, String(err?.message ?? err).slice(0, 200));
      }
    }
    if (!reply) throw lastErr ?? new Error('No reply');

    const products = namedIn(reply, all).map(p => ({
      _id: p._id, name: p.name, slug: p.slug, price: p.price, colorway: p.colorway?.name,
      image: (p.images?.find(i => i.role === 'model') ?? p.images?.[0])?.url,
    }));

    res.status(200).json({ reply, products });
  } catch (err) {
    console.error('Chat error:', String(err?.message ?? err).slice(0, 300));
    res.status(503).json({ error: 'The assistant isn’t available right now. Try again in a moment, or use the Contact page.' });
  }
};
