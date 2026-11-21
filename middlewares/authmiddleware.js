import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

/** Roles that can sign in to KŌRA Studio, most powerful first. */
export const STUDIO_ROLES = ["owner", "admin", "staff"];

function bearer(req) {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7) : null;
}

/** Any signed-in user. Trusts the token (no database read). */
export const protect = (req, res, next) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ message: "Not authorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Signed in AND holding one of `roles` right now. The role is read from the
 * database on every request, not from the token, so removing someone from
 * the team takes effect immediately rather than when their token expires.
 */
export const requireRole = (...roles) => async (req, res, next) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ message: "Sign in to continue." });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Your session has ended. Sign in again." });
  }
  try {
    const user = await User.findById(decoded.id).select("role name email").lean();
    if (!user) return res.status(401).json({ message: "Your account no longer exists." });
    const role = user.role ?? "user";
    if (!roles.includes(role)) return res.status(403).json({ message: "You don’t have access to this." });
    req.user = { id: String(user._id), role, name: user.name, email: user.email };
    next();
  } catch (err) {
    res.status(500).json({ message: "Couldn’t check your access." });
  }
};

/** Anyone on the team: can open Studio, see the overview and handle orders. */
export const isStudio = requireRole(...STUDIO_ROLES);
/** Owner and Admin: can change the catalogue, customers and categories. */
export const isAdmin = requireRole("owner", "admin");
/** Owner only: can manage the team. */
export const isOwner = requireRole("owner");

/** Optional sign-in: attaches req.user when a valid token is present. */
export const session = (req, res, next) => {
  const token = bearer(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
