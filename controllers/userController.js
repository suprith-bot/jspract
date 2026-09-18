// /controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const Joi = require('joi');

const createUserSchema = Joi.object({
  username: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .required()
      .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      })
});
  
const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .required()
      .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      })
});

// Secret for JWT (must be set in .env - no fallback allowed)
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d';

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

/**
 * Generate JWT access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: 'refresh' }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

/**
 * Save hashed refresh token to database
 */
const saveRefreshTokenToDb = async (userId, refreshToken) => {
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
  const expiryDate = new Date();
  
  // Parse expiry (e.g., "30d" -> 30 days)
  const match = REFRESH_TOKEN_EXPIRY.match(/^(\d+)([dhm])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'd') expiryDate.setDate(expiryDate.getDate() + value);
    else if (unit === 'h') expiryDate.setHours(expiryDate.getHours() + value);
    else if (unit === 'm') expiryDate.setMinutes(expiryDate.getMinutes() + value);
  } else {
    expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days
  }

  await userModel.saveRefreshToken(userId, hashedRefreshToken, expiryDate);
};

// User signup
const signup = async (req, res) => {
  const { error, value } = createUserSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({ error: error.details.map(detail => detail.message).join(', ') });
  }

  const { username, email, password } = value;
  
  try {
    // Check if user already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await userModel.createUser(username, email, hashedPassword);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

// User login
const login = async (req, res) => {
  const { error, value } = loginUserSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({ error: error.details.map(detail => detail.message).join(', ') });
  }

  const { email, password } = value;

  try {
    // Find user by email
    const user = await userModel.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check if user has a password (social-only accounts don't)
    if (!user.password) {
      return res.status(400).json({ 
        error: 'This account uses social login. Please sign in with your social provider.',
        socialAccount: true
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    await saveRefreshTokenToDb(user.id, refreshToken);

    res.json({ token, refreshToken });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * Get current user profile with connected accounts
 * GET /api/users/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await userModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get connected social accounts
    const connectedAccounts = await userModel.getConnectedAccounts(userId);

    const formattedAccounts = connectedAccounts.map(account => ({
      provider: account.provider_type,
      email: account.provider_email,
      connectedAt: account.connected_at
    }));

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      accountSource: user.account_source,
      hasPassword: user.password !== null,
      connectedAccounts: formattedAccounts
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
};

/**
 * Logout user and revoke refresh tokens
 * POST /api/users/logout
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { revokeAllSessions = false } = req.body;

    // Revoke refresh token(s)
    await userModel.revokeRefreshToken(userId);

    // Note: JWT access tokens cannot be truly revoked, they expire naturally after 1 hour
    // For production, consider implementing a token blacklist (Redis) if immediate revocation is needed

    res.json({ 
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed. Please try again.' });
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/users/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Refresh token expired. Please sign in again.' 
        });
      }
      return res.status(401).json({ 
        error: 'Invalid refresh token. Please sign in again.' 
      });
    }

    // Hash the refresh token to compare with database
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    // Find user by refresh token
    // Note: We need to verify the token matches what's in the database
    const user = await userModel.findUserById(decoded.id);
    
    if (!user || !user.refresh_token_hash) {
      return res.status(401).json({ 
        error: 'Invalid refresh token. Please sign in again.' 
      });
    }

    // Verify refresh token hasn't expired in database
    if (user.refresh_token_expiry && new Date(user.refresh_token_expiry) < new Date()) {
      return res.status(401).json({ 
        error: 'Refresh token expired. Please sign in again.' 
      });
    }

    // Verify the refresh token hash matches (simplified check)
    // In production, you might want to store the token hash directly
    const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    
    if (!isValidRefreshToken) {
      return res.status(401).json({ 
        error: 'Invalid refresh token. Please sign in again.' 
      });
    }

    // Generate new tokens (token rotation)
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Save new refresh token (invalidates old one)
    await saveRefreshTokenToDb(user.id, newRefreshToken);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600 // 1 hour in seconds
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  logout,
  refreshToken
};
