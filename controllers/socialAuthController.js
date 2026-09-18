// /controllers/socialAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const socialAuthService = require('../services/socialAuthService');
const oauthMiddleware = require('../middlewares/oauthMiddleware');
const { validateProviderConfig } = require('../config/oauthConfig');

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
const saveRefreshToken = async (userId, refreshToken) => {
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

/**
 * Generate username from email
 */
const generateUsernameFromEmail = (email) => {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Initiate OAuth flow
 * GET /api/auth/social/:provider/initiate
 */
const initiateOAuth = async (req, res) => {
  try {
    const { provider } = req.params;
    const { mode = 'login' } = req.query;
    const redirectUrl = req.redirectUrl || '/';

    // Validate provider config
    validateProviderConfig(provider);

    // For account linking, user must be authenticated
    let userId = null;
    if (mode === 'link') {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required for account linking'
        });
      }
      userId = req.user.id;

      // Check if provider already linked
      const existing = await userModel.findSocialProviderByUserAndType(userId, provider);
      if (existing) {
        return res.status(400).json({
          error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account already connected to your profile`
        });
      }
    }

    // Generate state token
    const stateToken = await oauthMiddleware.generateState(provider, redirectUrl, userId);

    // Generate authorization URL
    const authUrl = socialAuthService.generateAuthUrl(provider, stateToken);

    // Redirect to OAuth provider
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to initiate authentication. Please try again.'
    });
  }
};

/**
 * Handle OAuth callback
 * GET /api/auth/social/:provider/callback
 */
const handleOAuthCallback = async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors (user cancelled, etc.)
    if (oauthError) {
      const errorInfo = oauthMiddleware.parseOAuthError(req.query);
      const redirectUrl = `/login?error=${errorInfo.code}&message=${encodeURIComponent(errorInfo.message)}`;
      return res.redirect(redirectUrl);
    }

    // Validate state token
    const stateData = await oauthMiddleware.validateState(state);

    // Exchange code for access token
    const tokenData = await socialAuthService.exchangeCodeForToken(provider, code);

    // Fetch user profile from provider
    const profile = await socialAuthService.fetchUserProfile(provider, tokenData.accessToken);

    // Check if this social account already exists
    const existingSocial = await userModel.findSocialProvider(provider, profile.id);

    if (stateData.userId) {
      // ACCOUNT LINKING MODE
      if (existingSocial && existingSocial.user_id !== stateData.userId) {
        // Social account already linked to different user
        const redirectUrl = `/login?error=account_exists&message=${encodeURIComponent(`This ${provider} account is already linked to another profile.`)}`;
        return res.redirect(redirectUrl);
      }

      // Link social account to existing user
      await userModel.createSocialProvider(
        stateData.userId,
        provider,
        profile.id,
        profile.email,
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.tokenExpiry,
        {
          avatarUrl: profile.avatarUrl,
          displayName: profile.name,
          username: profile.username
        }
      );

      // Update user profile with social data if not set
      const user = await userModel.findUserById(stateData.userId);
      if (!user.avatar_url && profile.avatarUrl) {
        await userModel.updateUserProfile(stateData.userId, {
          avatarUrl: profile.avatarUrl,
          displayName: profile.name
        });
      }

      const redirectUrl = `${stateData.redirectUrl}?linked=${provider}`;
      return res.redirect(redirectUrl);
    } else {
      // LOGIN/SIGNUP MODE
      let user;

      if (existingSocial) {
        // User exists with this social account - login
        user = await userModel.findUserById(existingSocial.user_id);

        // Update last used timestamp
        await userModel.updateSocialProviderLastUsed(user.id, provider);

        // Update tokens if changed
        if (tokenData.accessToken !== existingSocial.access_token) {
          await userModel.updateSocialProviderTokens(
            existingSocial.id,
            tokenData.accessToken,
            tokenData.refreshToken,
            tokenData.tokenExpiry
          );
        }
      } else {
        // Check if user exists with same email (account merging)
        const existingUser = await userModel.findUserByEmail(profile.email);

        if (existingUser) {
          // Merge: link social account to existing email account
          user = existingUser;

          await userModel.createSocialProvider(
            user.id,
            provider,
            profile.id,
            profile.email,
            tokenData.accessToken,
            tokenData.refreshToken,
            tokenData.tokenExpiry,
            {
              avatarUrl: profile.avatarUrl,
              displayName: profile.name,
              username: profile.username
            }
          );

          // Update user profile if not set
          if (!user.avatar_url && profile.avatarUrl) {
            await userModel.updateUserProfile(user.id, {
              avatarUrl: profile.avatarUrl,
              displayName: profile.name
            });
          }
        } else {
          // Create new user (social signup)
          const username = generateUsernameFromEmail(profile.email);

          user = await userModel.createSocialUser(
            username,
            profile.email,
            profile.name,
            profile.avatarUrl,
            provider
          );

          // Create social provider linkage
          await userModel.createSocialProvider(
            user.id,
            provider,
            profile.id,
            profile.email,
            tokenData.accessToken,
            tokenData.refreshToken,
            tokenData.tokenExpiry,
            {
              avatarUrl: profile.avatarUrl,
              displayName: profile.name,
              username: profile.username
            }
          );
        }
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Save refresh token
      await saveRefreshToken(user.id, refreshToken);

      // Redirect with tokens
      const redirectParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken
      });

      if (profile.avatarUrl) redirectParams.append('avatar_url', profile.avatarUrl);
      if (profile.name) redirectParams.append('display_name', profile.name);

      const redirectUrl = `${stateData.redirectUrl}?${redirectParams.toString()}`;
      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);

    const errorInfo = oauthMiddleware.handleOAuthError(error, req.params.provider, res);
    const redirectUrl = `/login?error=${errorInfo.error}&message=${encodeURIComponent(errorInfo.message)}`;
    return res.redirect(redirectUrl);
  }
};

/**
 * Get connected social accounts
 * GET /api/auth/social/accounts
 */
const getConnectedAccounts = async (req, res) => {
  try {
    const userId = req.user.id;

    const accounts = await userModel.getConnectedAccounts(userId);
    const user = await userModel.findUserById(userId);

    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      provider: account.provider_type,
      email: account.provider_email,
      connectedAt: account.connected_at,
      lastUsedAt: account.last_used_at,
      profileData: account.profile_data
    }));

    res.json({
      accounts: formattedAccounts,
      primaryEmail: user.email,
      accountSource: user.account_source
    });
  } catch (error) {
    console.error('Get connected accounts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve connected accounts'
    });
  }
};

/**
 * Disconnect social account
 * DELETE /api/auth/social/accounts/:provider
 */
const disconnectSocialAccount = async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user.id;

    // Check if account exists
    const socialAccount = await userModel.findSocialProviderByUserAndType(userId, provider);
    if (!socialAccount) {
      return res.status(404).json({
        error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account is not currently linked`
      });
    }

    // Check if this is the last authentication method
    const authMethods = await userModel.countAuthMethods(userId);
    if (authMethods.totalMethods <= 1) {
      return res.status(400).json({
        error: 'Cannot disconnect last authentication method',
        details: `You must have at least one way to sign in. Please set a password or link another account before disconnecting ${provider}.`
      });
    }

    // Delete social provider
    await userModel.deleteSocialProvider(userId, provider);

    // Get remaining accounts
    const remaining = await userModel.getConnectedAccounts(userId);
    const remainingProviders = remaining.map(a => a.provider_type);

    res.json({
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account disconnected successfully`,
      remainingAccounts: remainingProviders
    });
  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({
      error: 'Failed to disconnect account'
    });
  }
};

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  getConnectedAccounts,
  disconnectSocialAccount
};
