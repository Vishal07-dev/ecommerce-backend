import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Invite } from '../models/invite.model.js';
import { TeamLog } from '../models/teamlog.model.js';

/**
 * Team: who can use KŌRA Studio. Owner-only routes (except the public
 * invite routes at the bottom).
 *
 * Rules
 * - Granting or changing access needs the owner's own password.
 * - You can't change or remove your own access.
 * - There is always at least one owner.
 * - Invite links are single-use, expire after 48 hours, and only a hash of
 *   the token is stored.
 */

const ROLES = ['owner', 'admin', 'staff'];
const INVITE_HOURS = 48;
const CLIENT_URL = process.env.CLIENT_URL || 'https://ecommerce-frontend-three-ruby.vercel.app';
const fail = (res, status, message, field) => res.status(status).json({ message, field });
const hash = t => crypto.createHash('sha256').update(t).digest('hex');
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function confirmPassword(req, res) {
  const me = await User.findById(req.user.id).select('password name');
  if (!me || !(await bcrypt.compare(String(req.body.password ?? ''), me.password))) {
    fail(res, 400, 'That isn’t your password. Enter it to confirm the change.', 'password');
    return null;
  }
  return me;
}

async function log(entry) {
  try { await TeamLog.create(entry); } catch (err) { console.error('Team log:', err.message); }
}

async function ownerCount() { return User.countDocuments({ role: 'owner' }); }

const memberView = u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, since: u.updatedAt ?? u.createdAt, createdAt: u.createdAt });

// GET /api/admin/team
export const listTeam = async (req, res) => {
  try {
    const [members, invites, activity] = await Promise.all([
      User.find({ role: { $in: ROLES } }).select('name email role createdAt updatedAt').sort({ role: 1, name: 1 }).lean(),
      Invite.find({ usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).populate('createdBy', 'name').sort({ createdAt: -1 }).lean(),
      TeamLog.find().sort({ createdAt: -1 }).limit(30).lean(),
    ]);
    const order = { owner: 0, admin: 1, staff: 2 };
    res.json({
      me: req.user.id,
      members: members.map(memberView).sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name)),
      invites: invites.map(i => ({ _id: i._id, role: i.role, note: i.note ?? '', expiresAt: i.expiresAt, createdAt: i.createdAt, createdBy: i.createdBy?.name ?? '' })),
      activity,
    });
  } catch (err) {
    fail(res, 500, 'Couldn’t load the team.');
  }
};

// GET /api/admin/team/search?email=  (customer accounts only)
export const searchAccounts = async (req, res) => {
  const q = String(req.query.email ?? '').trim();
  if (q.length < 3) return res.json({ accounts: [] });
  const accounts = await User.find({ email: new RegExp(escapeRegex(q), 'i'), role: { $nin: ROLES } })
    .select('name email createdAt').limit(6).lean();
  res.json({ accounts });
};

// POST /api/admin/team/members  { userId, role, password }
export const addMember = async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!ROLES.includes(role)) return fail(res, 400, 'Choose Owner, Admin or Staff.', 'role');
    if (!mongoose.isValidObjectId(userId)) return fail(res, 400, 'Choose an account.', 'userId');
    const me = await confirmPassword(req, res); if (!me) return;
    const user = await User.findById(userId);
    if (!user) return fail(res, 404, 'That account no longer exists.', 'userId');
    if (ROLES.includes(user.role)) return fail(res, 409, `${user.name} is already on the team.`, 'userId');
    const previousRole = user.role ?? 'user';
    user.role = role;
    await user.save();
    await log({ action: 'granted', actor: me._id, actorName: me.name, target: user._id, targetName: user.name, role, previousRole });
    res.status(201).json(memberView(user.toObject()));
  } catch (err) {
    fail(res, 500, 'Couldn’t add that person.');
  }
};

// PATCH /api/admin/team/members/:id  { role, password }
export const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) return fail(res, 400, 'Choose Owner, Admin or Staff.', 'role');
    if (req.params.id === req.user.id) return fail(res, 400, 'You can’t change your own access. Ask another owner.');
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Team member not found.');
    const user = await User.findById(req.params.id);
    if (!user || !ROLES.includes(user.role)) return fail(res, 404, 'Team member not found.');
    if (user.role === role) return res.json(memberView(user.toObject()));
    if (user.role === 'owner' && (await ownerCount()) <= 1) return fail(res, 409, 'There must always be at least one owner.');
    const me = await confirmPassword(req, res); if (!me) return;
    const previousRole = user.role;
    user.role = role;
    await user.save();
    await log({ action: 'changed', actor: me._id, actorName: me.name, target: user._id, targetName: user.name, role, previousRole });
    res.json(memberView(user.toObject()));
  } catch (err) {
    fail(res, 500, 'Couldn’t change that role.');
  }
};

// POST /api/admin/team/members/:id/remove  { password }
export const removeMember = async (req, res) => {
  try {
    if (req.params.id === req.user.id) return fail(res, 400, 'You can’t remove yourself. Ask another owner.');
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Team member not found.');
    const user = await User.findById(req.params.id);
    if (!user || !ROLES.includes(user.role)) return fail(res, 404, 'Team member not found.');
    if (user.role === 'owner' && (await ownerCount()) <= 1) return fail(res, 409, 'There must always be at least one owner.');
    const me = await confirmPassword(req, res); if (!me) return;
    const previousRole = user.role;
    user.role = 'user';
    await user.save();
    await log({ action: 'removed', actor: me._id, actorName: me.name, target: user._id, targetName: user.name, role: 'user', previousRole });
    res.json({ message: `${user.name} no longer has Studio access. Their shop account stays.` });
  } catch (err) {
    fail(res, 500, 'Couldn’t remove that person.');
  }
};

// POST /api/admin/team/invites  { role, note, password }
export const createInvite = async (req, res) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) return fail(res, 400, 'Choose Owner, Admin or Staff.', 'role');
    const me = await confirmPassword(req, res); if (!me) return;
    const token = crypto.randomBytes(32).toString('base64url');
    const invite = await Invite.create({
      tokenHash: hash(token), role, note: String(req.body.note ?? '').trim().slice(0, 120) || undefined,
      createdBy: me._id, expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000),
    });
    await log({ action: 'invited', actor: me._id, actorName: me.name, targetName: invite.note || 'someone new', role });
    // The plain token exists only in this response: it is never stored.
    res.status(201).json({ _id: invite._id, role, note: invite.note ?? '', expiresAt: invite.expiresAt, link: `${CLIENT_URL}/join/${token}` });
  } catch (err) {
    fail(res, 500, 'Couldn’t create the invite.');
  }
};

// DELETE /api/admin/team/invites/:id
export const revokeInvite = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Invite not found.');
    const invite = await Invite.findOneAndUpdate({ _id: req.params.id, usedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (!invite) return fail(res, 404, 'That invite was already used, cancelled or expired.');
    const me = await User.findById(req.user.id).select('name').lean();
    await log({ action: 'invite-revoked', actor: req.user.id, actorName: me?.name, targetName: invite.note || 'an invite', role: invite.role });
    res.json({ message: 'Invite cancelled. The link no longer works.' });
  } catch (err) {
    fail(res, 500, 'Couldn’t cancel the invite.');
  }
};

// ---------------------------------------------------------------------------
// Public: open and accept an invite link
// ---------------------------------------------------------------------------
async function liveInvite(token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  return Invite.findOne({ tokenHash: hash(token), usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).populate('createdBy', 'name');
}

// GET /api/team/invite/:token
export const peekInvite = async (req, res) => {
  const invite = await liveInvite(req.params.token);
  if (!invite) return fail(res, 404, 'This invite link has expired, been used, or been cancelled. Ask for a new one.');
  res.json({ role: invite.role, expiresAt: invite.expiresAt, invitedBy: invite.createdBy?.name ?? 'KŌRA' });
};

// POST /api/team/invite/:token/accept  { mode: 'new'|'existing', name, email, password }
export const acceptInvite = async (req, res) => {
  try {
    const invite = await liveInvite(req.params.token);
    if (!invite) return fail(res, 404, 'This invite link has expired, been used, or been cancelled. Ask for a new one.');
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Enter an email address like name@example.com.', 'email');

    let user = await User.findOne({ email });
    if (req.body.mode === 'existing') {
      if (!user || !(await bcrypt.compare(password, user.password))) return fail(res, 400, 'That email and password don’t match an account.', 'password');
      if (ROLES.includes(user.role)) return fail(res, 409, 'This account already has Studio access.', 'email');
    } else {
      const name = String(req.body.name ?? '').trim();
      if (!name) return fail(res, 400, 'Enter your name.', 'name');
      if (password.length < 8) return fail(res, 400, 'Use at least 8 characters for your password.', 'password');
      if (user) return fail(res, 409, 'An account with this email already exists. Choose “I already have an account”.', 'email');
      user = new User({ name, email, password, role: 'user' });
    }

    // Claim the invite atomically, so the same link can't be used twice.
    const claimed = await Invite.findOneAndUpdate({ _id: invite._id, usedAt: null, revokedAt: null }, { $set: { usedAt: new Date() } }, { new: true });
    if (!claimed) return fail(res, 409, 'This invite was just used. Ask for a new one.');
    const previousRole = user.role ?? 'user';
    user.role = invite.role;
    await user.save();
    claimed.usedBy = user._id;
    await claimed.save();
    await log({ action: 'invite-accepted', actor: invite.createdBy?._id, actorName: invite.createdBy?.name, target: user._id, targetName: user.name, role: invite.role, previousRole });
    res.status(201).json({ message: 'Welcome to KŌRA Studio.', email: user.email, role: user.role });
  } catch (err) {
    console.error('Accept invite:', err.message);
    fail(res, 500, 'Couldn’t accept the invite. Try again.');
  }
};
