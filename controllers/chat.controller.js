import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from '../models/product.model.js';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -- Helper to fetch relevant products loosely based on query --
const getRelevantProducts = async (query) => {
  const lower = query.toLowerCase();
  const keywordRegex = new RegExp(lower.split(/\s+/).join('|'), 'i');

  // Only apply regex to known string fields
  const filter = {
    $or: [
      { name: { $regex: keywordRegex } },
      { description: { $regex: keywordRegex } }
    ]
  };

  // Optional price filtering
  const priceMatch = lower.match(/(?:under|below|less than)\s*\$?(\d+)/);
  if (priceMatch) {
    const limit = parseFloat(priceMatch[1]);
    filter.price = { $lt: limit };
  }

  try {
    const products = await Product.find(filter).limit(10).populate('category');
    return products;
  } catch (err) {
    console.error("Product fetch error:", err);
    return [];
  }
};

// -- Main chat controller --
export const sendChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "Please enter a valid message." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const products = await getRelevantProducts(message);
    let systemPrompt = `You are a friendly assistant for an online clothing store. Use the product data below to answer user questions clearly and conversationally.`;

    if (products.length > 0) {
      const list = products.map(p => {
        const category = p.category?.name || p.category || 'Miscellaneous';
        return `- ${p.name} (${category}) — ₹${p.price}: ${p.description.trim()} In stock: ${p.stock}.`;
      }).join('\n');

      systemPrompt += `\nHere are the available products:\n${list}\n\nAnswer the user's question using this information.`;
    } else {
      systemPrompt += `\nCurrently, no exact matches were found for the question. Try to help the user in a helpful way and suggest they ask about other categories or popular items.`;
    }

    const fullPrompt = `${systemPrompt}\n\nUser: ${message}\nAssistant:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ reply: text });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ error: "Something went wrong while answering your question. Please try again later." });
  }
};
