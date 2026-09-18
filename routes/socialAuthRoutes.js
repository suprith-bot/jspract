// /routes/socialAuthRoutes.js
const express = require('express');
const router = express.Router();
const socialAuthController = require('../controllers/socialAuthController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { validateProvider, validateRedirectUrl } = require('../middlewares/oauthMiddleware');

// OAuth initiation - start OAuth flow
// Supports both login and account linking modes
router.get(
  '/:provider/initiate',
  validateProvider,
  validateRedirectUrl,
  // Optional auth for link mode
  (req, res, next) => {
    const { mode } = req.query;
    if (mode === 'link') {
      return verifyToken(req, res, next);
    }
    next();
  },
  socialAuthController.initiateOAuth
);

// OAuth callback - handle provider redirect after authorization
router.get(
  '/:provider/callback',
  validateProvider,
  socialAuthController.handleOAuthCallback
);

// Link additional social account (requires authentication)
router.post(
  '/link/:provider',
  validateProvider,
  verifyToken,
  (req, res) => {
    // Redirect to initiation endpoint with link mode
    const { provider } = req.params;
    res.redirect(`/api/auth/social/${provider}/initiate?mode=link`);
  }
);

// Get all connected social accounts (requires authentication)
router.get(
  '/accounts',
  verifyToken,
  socialAuthController.getConnectedAccounts
);

// Disconnect a social account (requires authentication)
router.delete(
  '/accounts/:provider',
  validateProvider,
  verifyToken,
  socialAuthController.disconnectSocialAccount
);

module.exports = router;
