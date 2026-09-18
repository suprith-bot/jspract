// /models/userModel.js
const sql = require('../models/db');

// ===== USER CRUD =====

const createUser = async (username, email, hashedPassword) => {
  const result = await sql`INSERT INTO users (username, email, password) VALUES (${username}, ${email}, ${hashedPassword}) RETURNING *`;
  console.log(result);
  return result[0];
};

const createSocialUser = async (username, email, displayName, avatarUrl, accountSource) => {
  const result = await sql`
    INSERT INTO users (username, email, display_name, avatar_url, account_source, password) 
    VALUES (${username}, ${email}, ${displayName}, ${avatarUrl}, ${accountSource}, NULL) 
    RETURNING *
  `;
  return result[0];
};

const findUserByEmail = async (email) => {
  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  console.log(result);
  return result[0];
};

const findUserById = async (id) => {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  console.log(result);
  return result[0];
};

const updateUserProfile = async (userId, updates) => {
  const { displayName, avatarUrl } = updates;
  const result = await sql`
    UPDATE users 
    SET display_name = COALESCE(${displayName}, display_name),
        avatar_url = COALESCE(${avatarUrl}, avatar_url)
    WHERE id = ${userId}
    RETURNING *
  `;
  return result[0];
};

// ===== PASSWORD RESET =====

const updateResetToken = async (userId, resetToken, resetTokenExpiry) => {
  const query = await sql`
    UPDATE users 
    SET reset_token = ${resetToken}, reset_token_expiry = ${resetTokenExpiry} 
    WHERE id = ${userId} 
    RETURNING *
  `;
  return query[0];
};

const findUserByResetToken = async (token) => {
  const query = await sql`
    SELECT * FROM users 
    WHERE reset_token = ${token} 
    AND reset_token_expiry > NOW()
  `;
  console.log(query);
  return query[0];
};

const updatePassword = async (userId, hashedPassword) => {
  const query = await sql`
    UPDATE users 
    SET password = ${hashedPassword}, 
        reset_token = NULL, 
        reset_token_expiry = NULL 
    WHERE id = ${userId} 
    RETURNING *
  `;
  return query[0];
};

// ===== REFRESH TOKEN MANAGEMENT =====

const saveRefreshToken = async (userId, hashedRefreshToken, expiryDate) => {
  const result = await sql`
    UPDATE users 
    SET refresh_token_hash = ${hashedRefreshToken},
        refresh_token_expiry = ${expiryDate}
    WHERE id = ${userId}
    RETURNING id
  `;
  return result[0];
};

const findUserByRefreshToken = async (hashedRefreshToken) => {
  const result = await sql`
    SELECT * FROM users 
    WHERE refresh_token_hash = ${hashedRefreshToken}
    AND refresh_token_expiry > NOW()
  `;
  return result[0];
};

const revokeRefreshToken = async (userId) => {
  await sql`
    UPDATE users 
    SET refresh_token_hash = NULL,
        refresh_token_expiry = NULL
    WHERE id = ${userId}
  `;
};

// ===== SOCIAL PROVIDERS =====

const findSocialProvider = async (providerType, providerId) => {
  const result = await sql`
    SELECT sp.*, u.id as user_id, u.email as user_email, u.username
    FROM social_providers sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.provider_type = ${providerType} 
    AND sp.provider_id = ${providerId}
  `;
  return result[0];
};

const findSocialProviderByUserAndType = async (userId, providerType) => {
  const result = await sql`
    SELECT * FROM social_providers
    WHERE user_id = ${userId} 
    AND provider_type = ${providerType}
  `;
  return result[0];
};

const createSocialProvider = async (userId, providerType, providerId, providerEmail, accessToken, refreshToken, tokenExpiry, profileData) => {
  const result = await sql`
    INSERT INTO social_providers 
      (user_id, provider_type, provider_id, provider_email, access_token, refresh_token, token_expiry, profile_data)
    VALUES 
      (${userId}, ${providerType}, ${providerId}, ${providerEmail}, ${accessToken}, ${refreshToken}, ${tokenExpiry}, ${JSON.stringify(profileData)})
    RETURNING *
  `;
  return result[0];
};

const updateSocialProviderTokens = async (id, accessToken, refreshToken, tokenExpiry) => {
  const result = await sql`
    UPDATE social_providers
    SET access_token = ${accessToken},
        refresh_token = ${refreshToken},
        token_expiry = ${tokenExpiry},
        last_used_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
};

const updateSocialProviderLastUsed = async (userId, providerType) => {
  await sql`
    UPDATE social_providers
    SET last_used_at = NOW()
    WHERE user_id = ${userId} AND provider_type = ${providerType}
  `;
};

const getConnectedAccounts = async (userId) => {
  const result = await sql`
    SELECT id, provider_type, provider_email, connected_at, last_used_at, profile_data
    FROM social_providers
    WHERE user_id = ${userId}
    ORDER BY connected_at DESC
  `;
  return result;
};

const deleteSocialProvider = async (userId, providerType) => {
  const result = await sql`
    DELETE FROM social_providers
    WHERE user_id = ${userId} AND provider_type = ${providerType}
    RETURNING *
  `;
  return result[0];
};

const countAuthMethods = async (userId) => {
  const user = await findUserById(userId);
  const socialAccounts = await sql`
    SELECT COUNT(*) as count FROM social_providers WHERE user_id = ${userId}
  `;
  
  const hasPassword = user && user.password !== null;
  const socialCount = parseInt(socialAccounts[0].count);
  
  return {
    hasPassword,
    socialCount,
    totalMethods: (hasPassword ? 1 : 0) + socialCount
  };
};

// ===== OAUTH STATES =====

const createOAuthState = async (stateToken, providerType, redirectUrl, userId) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const result = await sql`
    INSERT INTO oauth_states (state_token, provider_type, redirect_url, user_id, expires_at)
    VALUES (${stateToken}, ${providerType}, ${redirectUrl}, ${userId}, ${expiresAt})
    RETURNING *
  `;
  return result[0];
};

const findOAuthState = async (stateToken) => {
  const result = await sql`
    SELECT * FROM oauth_states
    WHERE state_token = ${stateToken}
    AND expires_at > NOW()
  `;
  return result[0];
};

const deleteOAuthState = async (stateToken) => {
  await sql`DELETE FROM oauth_states WHERE state_token = ${stateToken}`;
};

const cleanExpiredOAuthStates = async () => {
  const result = await sql`
    DELETE FROM oauth_states WHERE expires_at < NOW()
  `;
  return result;
};

module.exports = {
  // User CRUD
  createUser,
  createSocialUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
  
  // Password reset
  updateResetToken,
  findUserByResetToken,
  updatePassword,
  
  // Refresh tokens
  saveRefreshToken,
  findUserByRefreshToken,
  revokeRefreshToken,
  
  // Social providers
  findSocialProvider,
  findSocialProviderByUserAndType,
  createSocialProvider,
  updateSocialProviderTokens,
  updateSocialProviderLastUsed,
  getConnectedAccounts,
  deleteSocialProvider,
  countAuthMethods,
  
  // OAuth states
  createOAuthState,
  findOAuthState,
  deleteOAuthState,
  cleanExpiredOAuthStates
};
