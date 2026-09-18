// /config/oauthConfig.js
require('dotenv').config();

// SECURITY: Fail immediately if required OAuth secrets are missing
if (!process.env.OAUTH_STATE_SECRET) {
  throw new Error('FATAL: OAUTH_STATE_SECRET environment variable is required');
}

const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    scopes: ['openid', 'profile', 'email'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    // Request offline access for refresh token
    accessType: 'offline',
    prompt: 'consent'
  },
  
  facebook: {
    clientId: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI,
    scopes: ['email', 'public_profile'],
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/me',
    profileFields: 'id,name,email,picture.type(large)'
  },
  
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: process.env.GITHUB_REDIRECT_URI,
    scopes: ['read:user', 'user:email'],
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails'
  }
};

// Validate that OAuth configs exist when needed
const validateProviderConfig = (provider) => {
  const config = oauthConfig[provider];
  if (!config) {
    throw new Error(`Invalid OAuth provider: ${provider}`);
  }
  
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(`Missing OAuth configuration for ${provider}. Check environment variables.`);
  }
  
  return config;
};

module.exports = {
  oauthConfig,
  validateProviderConfig,
  stateSecret: process.env.OAUTH_STATE_SECRET,
  supportedProviders: ['google', 'facebook', 'github']
};
