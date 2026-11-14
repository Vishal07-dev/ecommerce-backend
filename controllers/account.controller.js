import bcrypt from 'bcryptjs';
import { User } from '../models/user.model.js';
import { Order } from '../models/Order.js';

/**
 * The signed-in shopper's own account. Every handler works on req.user.id
 * (set by `protect`), never on an id from the URL, so nobody can read or
 * change another person's account.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^[1-9][0-9]{5}$/;          // Indian PIN code
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const fail = (res, status, message, field) => res.status(status).json({ message, field });
const clean = v => (typeof v === 'string' ? v.trim() : v);

async function loadMe(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) { fail(res, 404, 'We couldn’t find your account. Sign in again.'); return null; }
  return user;
}

function view(user) {
  const u = user.toObject();
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '',
    role: u.role,
    createdAt: u.createdAt,
    addresses: (u.addresses ?? []).map(a => ({ ...a, _id: String(a._id) })),
  };
}

export const getMe = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (user) res.json(view(user));
  } catch (err) { fail(res, 500, 'Something went wrong loading your account.'); }
};

/** Name and phone change freely; email needs the current password. */
export const updateMe = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (!user) return;
    const name = clean(req.body.name);
    const phone = clean(req.body.phone);
    const email = clean(req.body.email)?.toLowerCase();

    if (name !== undefined) {
      if (!name || name.length > 80) return fail(res, 400, 'Enter your name (up to 80 characters).', 'name');
      user.name = name;
    }
    if (phone !== undefined) {
      if (phone && !PHONE_RE.test(phone)) return fail(res, 400, 'Enter a phone number using digits, spaces or +.', 'phone');
      user.phone = phone;
    }
    if (email !== undefined && email !== user.email) {
      if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter an email address like name@example.com.', 'email');
      const ok = await bcrypt.compare(String(req.body.currentPassword ?? ''), user.password);
      if (!ok) return fail(res, 400, 'Your current password is needed to change your email, and that one doesn’t match.', 'currentPassword');
      if (await User.exists({ email, _id: { $ne: user._id } })) return fail(res, 409, 'Another account already uses that email.', 'email');
      user.email = email;
    }
    await user.save();
    res.json(view(user));
  } catch (err) { fail(res, 500, 'We couldn’t save your details. Try again.'); }
};

export const changePassword = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (!user) return;
    const { currentPassword, newPassword } = req.body;
    if (!(await bcrypt.compare(String(currentPassword ?? ''), user.password))) {
      return fail(res, 400, 'That isn’t your current password.', 'currentPassword');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return fail(res, 400, 'Use at least 8 characters for your new password.', 'newPassword');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return fail(res, 400, 'Choose a password you haven’t used for this account.', 'newPassword');
    }
    user.password = newPassword; // hashed by the model's pre-save hook
    await user.save();
    res.json({ message: 'Password changed.' });
  } catch (err) { fail(res, 500, 'We couldn’t change your password. Try again.'); }
};

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
function readAddress(body) {
  const a = {
    fullName: clean(body.fullName),
    phone: clean(body.phone),
    line1: clean(body.line1),
    line2: clean(body.line2) || '',
    city: clean(body.city),
    state: clean(body.state),
    pincode: clean(body.pincode),
  };
  if (!a.fullName) return { error: ['Enter the name for delivery.', 'fullName'] };
  if (!a.phone || !PHONE_RE.test(a.phone)) return { error: ['Enter a phone number the courier can call.', 'phone'] };
  if (!a.line1) return { error: ['Enter the house and street.', 'line1'] };
  if (!a.city) return { error: ['Enter the city.', 'city'] };
  if (!a.state) return { error: ['Choose the state.', 'state'] };
  if (!PIN_RE.test(a.pincode ?? '')) return { error: ['Enter a 6-digit PIN code.', 'pincode'] };
  return { address: a };
}

function setDefault(user, id) {
  user.addresses.forEach(a => { a.isDefault = String(a._id) === String(id); });
}

export const addAddress = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (!user) return;
    if (user.addresses.length >= 10) return fail(res, 400, 'You can save up to 10 addresses. Remove one first.');
    const { address, error } = readAddress(req.body);
    if (error) return fail(res, 400, ...error);
    user.addresses.push(address);
    const added = user.addresses[user.addresses.length - 1];
    if (req.body.isDefault || user.addresses.length === 1) setDefault(user, added._id);
    await user.save();
    res.status(201).json(view(user));
  } catch (err) { fail(res, 500, 'We couldn’t save that address. Try again.'); }
};

export const updateAddress = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (!user) return;
    const existing = user.addresses.id(req.params.addressId);
    if (!existing) return fail(res, 404, 'That address no longer exists.');
    const { address, error } = readAddress(req.body);
    if (error) return fail(res, 400, ...error);
    existing.set(address);
    if (req.body.isDefault) setDefault(user, existing._id);
    await user.save();
    res.json(view(user));
  } catch (err) { fail(res, 500, 'We couldn’t update that address. Try again.'); }
};

export const removeAddress = async (req, res) => {
  try {
    const user = await loadMe(req, res);
    if (!user) return;
    const existing = user.addresses.id(req.params.addressId);
    if (!existing) return fail(res, 404, 'That address no longer exists.');
    const wasDefault = existing.isDefault;
    existing.deleteOne();
    if (wasDefault && user.addresses.length) setDefault(user, user.addresses[0]._id);
    await user.save();
    res.json(view(user));
  } catch (err) { fail(res, 500, 'We couldn’t remove that address. Try again.'); }
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
/** Orders placed while signed in, plus older ones made with the same email. */
export const myOrders = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email');
    if (!user) return fail(res, 404, 'We couldn’t find your account. Sign in again.');
    const orders = await Order.find({ $or: [{ userId: user._id }, { email: user.email }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(orders.map(o => ({
      _id: o._id,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      status: o.status ?? 'paid',
      items: (o.items ?? []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, size: i.size, image: i.image, productId: i.productId })),
    })));
  } catch (err) { fail(res, 500, 'We couldn’t load your orders. Try again.'); }
};

/** True when this signed-in user may see the order (theirs, or an admin). */
export async function ownsOrder(reqUser, order) {
  if (!reqUser) return false;
  if (reqUser.role === 'admin') return true;
  if (order.userId && String(order.userId) === String(reqUser.id)) return true;
  const user = await User.findById(reqUser.id).select('email');
  return !!user && user.email === order.email;
}

