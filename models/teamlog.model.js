import mongoose, { Schema } from 'mongoose';

/** Who changed whose access, and when. Never edited, only appended. */
const teamLogSchema = new Schema({
  action: { type: String, enum: ['granted', 'changed', 'removed', 'invited', 'invite-revoked', 'invite-accepted'], required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  target: { type: Schema.Types.ObjectId, ref: 'User' },
  targetName: String,
  role: String,
  previousRole: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

export const TeamLog = mongoose.model('TeamLog', teamLogSchema);
