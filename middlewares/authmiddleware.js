import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer"))
    return res.status(401).json({ message: "Not authorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { id, role }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Role-based
export const isAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

 if (!authHeader || !authHeader.startsWith("Bearer"))
    return res.status(401).json({ message: "Not authorized" });
  const token = authHeader.split(" ")[1];
try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { id, role }
 if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin access only" });
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
 };


 export const session = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer"))
    return next()
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { id, role }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};