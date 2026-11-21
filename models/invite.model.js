import mongoose, { Schema } from 'mongoose';

/**
 * A one-time link that gives someone a Studio role. Only a SHA-256 hash of
 * the token is stored, so a database leak can't be turned into working links.
 */
const inviteSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  role: { type: String, enum: ['owner', 'admin', 'staff'], required: true },
  note: { type: String, trim: true, maxlength: 120 }, // who it's for, e.g. their email
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  usedAt: Date,
  usedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  revokedAt: Date,
}, { timestamps: true });

export const Invite = mongoose.model('Invite', inviteSchema);
