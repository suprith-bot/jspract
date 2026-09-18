// /middlewares/oauthMiddleware.js
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { stateSecret, supportedProviders } = require('../config/oauthConfig');
const userModel = require('../models/userModel');

/**
 * Generate CSRF state token for OAuth flow
 * @param {string} provider - OAuth provider
 * @param {string} redirectUrl - Post-auth redirect URL
 * @param {number} userId - User ID (for account linking, null for login)
 * @returns {Promise<string>} State token
 */
const generateState = async (provider, redirectUrl = '/', userId = null) => {
  const stateToken = uuidv4();
  
  try {
    await userModel.createOAuthState(stateToken, provider, redirectUrl, userId);
    return stateToken;
  } catch (error) {
    console.error('State generation error:', error);
    throw new Error('Failed to generate OAuth state');
  }
};

/**
 * Validate OAuth state token
 * @param {string} stateToken - State token from callback
 * @returns {Promise<{provider, redirectUrl, userId}>}
 */
const validateState = async (stateToken) => {
  if (!stateToken) {
    const error = new Error('Missing state parameter');
    error.code = 'INVALID_STATE';
    error.statusCode = 400;
    throw error;
  }

  try {
    const state = await userModel.findOAuthState(stateToken);
    
    if (!state) {
      const error = new Error('Invalid or expired state token');
      error.code = 'INVALID_STATE';
      error.statusCode = 400;
      throw error;
    }

    // Delete state after validation (one-time use)
    await userModel.deleteOAuthState(stateToken);

    return {
      provider: state.provider_type,
      redirectUrl: state.redirect_url || '/',
      userId: state.user_id
    };
  } catch (error) {
    if (error.code === 'INVALID_STATE') {
      throw error;
    }
    console.error('State validation error:', error);
    const validationError = new Error('State validation failed');
    validationError.code = 'INVALID_STATE';
    validationError.statusCode = 400;
    throw validationError;
  }
};

/**
 * Parse OAuth error from callback
 * @param {Object} query - Query parameters from callback
 * @returns {Object|null} Error details or null
 */
const parseOAuthError = (query) => {
  if (query.error) {
    const errorMap = {
      'access_denied': {
        code: 'AUTH_DENIED',
        message: 'You cancelled the sign-in process. Please try again.',
        userMessage: 'Authorization denied. Please grant permission to continue.'
      },
      'consent_required': {
        code: 'MISSING_PERMISSIONS',
        message: 'Additional permissions required. Please authorize the requested access to continue.',
        userMessage: 'Additional permissions required'
      },
      'invalid_scope': {
        code: 'MISSING_PERMISSIONS',
        message: 'Required permissions not available',
        userMessage: 'Invalid permissions requested'
      }
    };

    const errorInfo = errorMap[query.error] || {
      code: 'PROVIDER_ERROR',
      message: query.error_description || 'Authentication failed',
      userMessage: 'An error occurred during authentication'
    };

    return {
      code: errorInfo.code,
      message: errorInfo.userMessage,
      details: errorInfo.message,
      provider: query.error,
      canRetry: query.error === 'access_denied'
    };
  }

  return null;
};

/**
 * Middleware to validate provider parameter
 */
const validateProvider = (req, res, next) => {
  const { provider } = req.params;
  
  if (!provider || !supportedProviders.includes(provider)) {
    return res.status(400).json({
      error: `Invalid provider. Supported providers: ${supportedProviders.join(', ')}`
    });
  }

  req.provider = provider;
  next();
};

/**
 * Middleware to require authentication (for account linking)
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required for account linking'
    });
  }

  // Auth will be verified by verifyToken middleware
  next();
};

/**
 * Middleware to validate redirect URL
 */
const validateRedirectUrl = (req, res, next) => {
  const { redirect } = req.query;
  
  if (!redirect) {
    req.redirectUrl = '/';
    return next();
  }

  // Security: Only allow relative paths or whitelisted domains
  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS environment variable is required');
  }
  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
  
  try {
    // If it's a relative path, it's safe
    if (redirect.startsWith('/')) {
      req.redirectUrl = redirect;
      return next();
    }

    // If it's an absolute URL, check against whitelist
    const url = new URL(redirect);
    const origin = `${url.protocol}//${url.host}`;
    
    if (allowedOrigins.includes(origin)) {
      req.redirectUrl = redirect;
      return next();
    }

    // Default to safe redirect
    req.redirectUrl = '/';
    next();
  } catch (error) {
    // Invalid URL, default to safe redirect
    req.redirectUrl = '/';
    next();
  }
};

/**
 * Error handler for OAuth-specific errors
 */
const handleOAuthError = (error, provider, res) => {
  console.error(`OAuth error for ${provider}:`, error);

  const errorResponses = {
    'PROVIDER_TIMEOUT': {
      code: 'timeout',
      message: 'Connection timed out. Please check your internet connection and try again.',
      statusCode: 504
    },
    'PROVIDER_UNAVAILABLE': {
      code: 'provider_error',
      message: 'Service temporarily unavailable. Please try again later or use a different login method.',
      statusCode: 503
    },
    'AUTH_FAILED': {
      code: 'auth_failed',
      message: 'Authentication failed. Please try again.',
      statusCode: 401
    },
    'INVALID_STATE': {
      code: 'invalid_state',
      message: 'Authentication session expired. Please try again.',
      statusCode: 400
    },
    'ACCOUNT_EXISTS': {
      code: 'account_exists',
      message: `This ${provider} account is already linked to another profile.`,
      statusCode: 400
    },
    'PROFILE_INCOMPLETE': {
      code: 'profile_incomplete',
      message: 'Unable to retrieve required profile information. Please try again or use a different login method.',
      statusCode: 400
    },
    'NO_EMAIL': {
      code: 'no_email',
      message: `GitHub account has no accessible email. Please make your primary email public in GitHub settings, or grant the user:email permission when authorizing.`,
      statusCode: 400
    },
    'NETWORK_ERROR': {
      code: 'network_error',
      message: 'Network connectivity issue. Please check your connection and try again.',
      statusCode: 503
    }
  };

  const errorResponse = errorResponses[error.code] || {
    code: 'auth_failed',
    message: 'Authentication failed. Please try again.',
    statusCode: 500
  };

  return {
    error: errorResponse.code,
    message: errorResponse.message,
    details: error.message,
    statusCode: errorResponse.statusCode,
    canRetry: !['ACCOUNT_EXISTS', 'PROFILE_INCOMPLETE', 'NO_EMAIL'].includes(error.code)
  };
};

module.exports = {
  generateState,
  validateState,
  parseOAuthError,
  validateProvider,
  requireAuth,
  validateRedirectUrl,
  handleOAuthError
};
