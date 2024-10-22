// /middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // Check if authorization header is present
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Expected format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = { id: user.id, username: user.username, email: user.email }; // Attach user info to request
    next();
  } catch (error) {
    console.error('Token Verification Error:', error);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

module.exports = {
  verifyToken,
};
