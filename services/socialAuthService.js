// /services/socialAuthService.js
const axios = require('axios');
const { oauthConfig } = require('../config/oauthConfig');

/**
 * Generate OAuth authorization URL
 * @param {string} provider - OAuth provider (google/facebook/github)
 * @param {string} stateToken - CSRF state token
 * @returns {string} Authorization URL
 */
const generateAuthUrl = (provider, stateToken) => {
  const config = oauthConfig[provider];
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state: stateToken,
    scope: config.scopes.join(' ')
  });

  // Provider-specific parameters
  if (provider === 'google') {
    params.append('response_type', 'code');
    params.append('access_type', config.accessType || 'offline');
    params.append('prompt', config.prompt || 'consent');
  } else if (provider === 'facebook') {
    params.append('response_type', 'code');
  } else if (provider === 'github') {
    params.append('response_type', 'code');
  }

  return `${config.authUrl}?${params.toString()}`;
};

/**
 * Exchange authorization code for access token
 * @param {string} provider - OAuth provider (google/facebook/github)
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<{accessToken, refreshToken, expiresIn}>}
 */
const exchangeCodeForToken = async (provider, code) => {
  const config = oauthConfig[provider];
  
  const params = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code,
    redirect_uri: config.redirectUri
  };

  // Provider-specific parameters
  if (provider === 'google') {
    params.grant_type = 'authorization_code';
  } else if (provider === 'github') {
    params.grant_type = 'authorization_code';
  }

  try {
    const response = await axios.post(config.tokenUrl, params, {
      headers: {
        'Accept': provider === 'github' ? 'application/json' : 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000 // 10 second timeout
    });

    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in || 3600,
      tokenExpiry: new Date(Date.now() + (data.expires_in || 3600) * 1000)
    };
  } catch (error) {
    console.error(`Token exchange failed for ${provider}:`, error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      const timeoutError = new Error('OAuth provider timeout');
      timeoutError.code = 'PROVIDER_TIMEOUT';
      timeoutError.provider = provider;
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    
    const authError = new Error('Token exchange failed');
    authError.code = 'AUTH_FAILED';
    authError.provider = provider;
    authError.statusCode = 401;
    authError.details = error.response?.data;
    throw authError;
  }
};

/**
 * Fetch user profile from OAuth provider
 * @param {string} provider - OAuth provider
 * @param {string} accessToken - Access token
 * @returns {Promise<{id, email, name, avatarUrl, rawData}>}
 */
const fetchUserProfile = async (provider, accessToken) => {
  const config = oauthConfig[provider];
  
  try {
    let profileData;
    
    if (provider === 'google') {
      const response = await axios.get(config.profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });
      
      profileData = {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        avatarUrl: response.data.picture,
        verified: response.data.verified_email,
        rawData: response.data
      };
    } 
    else if (provider === 'facebook') {
      const response = await axios.get(config.profileUrl, {
        params: { 
          fields: config.profileFields,
          access_token: accessToken 
        },
        timeout: 10000
      });
      
      profileData = {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        avatarUrl: response.data.picture?.data?.url || null,
        rawData: response.data
      };
    } 
    else if (provider === 'github') {
      // Fetch user profile
      const profileResponse = await axios.get(config.profileUrl, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'CheckIt-TaskManager'
        },
        timeout: 10000
      });
      
      let email = profileResponse.data.email; // Public email (if set)
      
      // If email is not public, try fetching from emails endpoint
      if (!email && config.emailsUrl) {
        try {
          const emailsResponse = await axios.get(config.emailsUrl, {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'CheckIt-TaskManager'
            },
            timeout: 10000
          });
          
          // Get primary verified email
          const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
          email = primaryEmail?.email || emailsResponse.data.find(e => e.verified)?.email;
        } catch (emailError) {
          // If emails endpoint fails (403 permission issue), log warning but continue
          console.warn(`GitHub emails fetch failed (continuing with public email):`, emailError.response?.data || emailError.message);
          // email remains as profileResponse.data.email (could be null)
        }
      }
      
      // If still no email, we need to handle this case
      if (!email) {
        const noEmailError = new Error('GitHub account has no accessible email address. Please make your primary email public or grant user:email permission.');
        noEmailError.code = 'NO_EMAIL';
        noEmailError.provider = provider;
        noEmailError.statusCode = 400;
        throw noEmailError;
      }
      
      profileData = {
        id: profileResponse.data.id.toString(),
        email: email,
        name: profileResponse.data.name || profileResponse.data.login,
        avatarUrl: profileResponse.data.avatar_url,
        username: profileResponse.data.login,
        rawData: profileResponse.data
      };
    }
    
    return profileData;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.code === 'NO_EMAIL') {
      throw error;
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      const timeoutError = new Error('Profile fetch timeout');
      timeoutError.code = 'PROVIDER_TIMEOUT';
      timeoutError.provider = provider;
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    
    console.error(`Profile fetch failed for ${provider}:`, error.response?.data || error.message);
    
    const profileError = new Error('Failed to fetch user profile');
    profileError.code = 'PROVIDER_ERROR';
    profileError.provider = provider;
    profileError.statusCode = 500;
    throw profileError;
  }
};

/**
 * Refresh access token using refresh token
 * @param {string} provider - OAuth provider
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{accessToken, refreshToken, expiresIn}>}
 */
const refreshAccessToken = async (provider, refreshToken) => {
  const config = oauthConfig[provider];
  
  // GitHub doesn't support refresh tokens
  if (provider === 'github') {
    const error = new Error('GitHub does not support token refresh');
    error.code = 'REFRESH_NOT_SUPPORTED';
    error.provider = provider;
    error.statusCode = 400;
    throw error;
  }
  
  const params = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  };

  try {
    const response = await axios.post(config.tokenUrl, params, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in || 3600,
      tokenExpiry: new Date(Date.now() + (data.expires_in || 3600) * 1000)
    };
  } catch (error) {
    console.error(`Token refresh failed for ${provider}:`, error.response?.data || error.message);
    
    const refreshError = new Error('Failed to refresh access token');
    refreshError.code = 'REFRESH_FAILED';
    refreshError.provider = provider;
    refreshError.statusCode = 401;
    throw refreshError;
  }
};

/**
 * Revoke OAuth token (disconnect social account)
 * @param {string} provider - OAuth provider
 * @param {string} accessToken - Access token to revoke
 */
const revokeToken = async (provider, accessToken) => {
  try {
    if (provider === 'google') {
      await axios.post(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, null, {
        timeout: 10000
      });
    } else if (provider === 'github') {
      const config = oauthConfig[provider];
      await axios.delete(`https://api.github.com/applications/${config.clientId}/token`, {
        auth: {
          username: config.clientId,
          password: config.clientSecret
        },
        data: {
          access_token: accessToken
        },
        headers: {
          'User-Agent': 'CheckIt-TaskManager'
        },
        timeout: 10000
      });
    } else if (provider === 'facebook') {
      const config = oauthConfig[provider];
      await axios.delete(`https://graph.facebook.com/me/permissions`, {
        params: {
          access_token: accessToken
        },
        timeout: 10000
      });
    }
    
    return true;
  } catch (error) {
    console.error(`Token revocation failed for ${provider}:`, error.response?.data || error.message);
    // Don't throw - revocation failures are non-critical
    return false;
  }
};

module.exports = {
  generateAuthUrl,
  exchangeCodeForToken,
  fetchUserProfile,
  refreshAccessToken,
  revokeToken
};
