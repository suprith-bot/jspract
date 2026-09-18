// /middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

/**
 * Verify JWT access token
 * Middleware for protected routes
 */
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
    
    // Ensure this is not a refresh token
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token type. Please use access token.' });
    }

    const user = await userModel.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = { id: user.id, username: user.username, email: user.email }; // Attach user info to request
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please refresh your token or sign in again.'
      });
    }
    
    console.error('Token Verification Error:', error);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't fail if missing/invalid
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type === 'refresh') {
      return next();
    }

    const user = await userModel.findUserById(decoded.id);

    if (user) {
      req.user = { id: user.id, username: user.username, email: user.email };
    }
    
    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

module.exports = {
  verifyToken,
  optionalAuth
};
