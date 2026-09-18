const request = require('supertest');
const express = require('express');
const socialAuthRoutes = require('../routes/socialAuthRoutes');
const userModel = require('../models/userModel');
const socialAuthService = require('../services/socialAuthService');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../models/userModel');
jest.mock('../services/socialAuthService');
jest.mock('../middlewares/oauthMiddleware', () => ({
  generateState: jest.fn().mockResolvedValue('test-state-token-123'),
  validateState: jest.fn().mockResolvedValue({
    provider: 'google',
    redirectUrl: '/',
    userId: null
  }),
  parseOAuthError: jest.fn((query) => {
    const errorMap = {
      'access_denied': { code: 'auth_denied', message: 'You cancelled the sign-in process' },
      'server_error': { code: 'provider_error', message: 'Provider error occurred' }
    };
    return errorMap[query.error] || { code: 'auth_failed', message: 'Authentication failed' };
  }),
  handleOAuthError: jest.fn((error, provider, res) => {
    const errorCodeMap = {
      'PROVIDER_TIMEOUT': 'timeout',
      'PROFILE_INCOMPLETE': 'profile_incomplete',
      'AUTH_FAILED': 'auth_failed'
    };
    return {
      error: errorCodeMap[error.code] || 'auth_failed',
      message: error.message || 'Authentication failed'
    };
  }),
  validateProvider: (req, res, next) => {
    const validProviders = ['google', 'facebook', 'github'];
    if (!validProviders.includes(req.params.provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    next();
  },
  validateRedirectUrl: (req, res, next) => {
    req.redirectUrl = req.query.redirect || '/';
    next();
  }
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth/social', socialAuthRoutes);

describe('Social Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/social/:provider/initiate', () => {
    it('should redirect to OAuth provider for valid provider (Google)', async () => {
      socialAuthService.generateAuthUrl = jest.fn().mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test'
      );

      const response = await request(app)
        .get('/api/auth/social/google/initiate')
        .expect(302);

      expect(response.header.location).toContain('accounts.google.com');
    });

    it('should redirect to OAuth provider for Facebook', async () => {
      socialAuthService.generateAuthUrl = jest.fn().mockReturnValue(
        'https://www.facebook.com/v12.0/dialog/oauth?client_id=test'
      );

      const response = await request(app)
        .get('/api/auth/social/facebook/initiate')
        .expect(302);

      expect(response.header.location).toContain('facebook.com');
    });

    it('should redirect to OAuth provider for GitHub', async () => {
      socialAuthService.generateAuthUrl = jest.fn().mockReturnValue(
        'https://github.com/login/oauth/authorize?client_id=test'
      );

      const response = await request(app)
        .get('/api/auth/social/github/initiate')
        .expect(302);

      expect(response.header.location).toContain('github.com');
    });

    it('should reject invalid provider', async () => {
      const response = await request(app)
        .get('/api/auth/social/twitter/initiate')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle redirect parameter', async () => {
      socialAuthService.generateAuthUrl = jest.fn().mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test'
      );

      await request(app)
        .get('/api/auth/social/google/initiate?redirect=/dashboard')
        .expect(302);

      expect(socialAuthService.generateAuthUrl).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/social/:provider/callback', () => {
    it('should handle successful Google OAuth callback', async () => {
      const mockUser = {
        id: 1,
        email: 'test@gmail.com',
        username: 'testuser',
        display_name: 'Test User'
      };

      socialAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue({
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
        expiresIn: 3600,
        tokenExpiry: new Date()
      });

      socialAuthService.fetchUserProfile = jest.fn().mockResolvedValue({
        id: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      });

      userModel.findSocialProvider = jest.fn().mockResolvedValue(null);
      userModel.findUserByEmail = jest.fn().mockResolvedValue(null);
      userModel.createSocialUser = jest.fn().mockResolvedValue(mockUser);
      userModel.createSocialProvider = jest.fn().mockResolvedValue({});
      userModel.saveRefreshToken = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .get('/api/auth/social/google/callback?code=auth-code&state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('token=');
      expect(socialAuthService.exchangeCodeForToken).toHaveBeenCalledWith('google', 'auth-code');
      expect(socialAuthService.fetchUserProfile).toHaveBeenCalled();
      expect(userModel.createSocialUser).toHaveBeenCalled();
    });

    it('should authenticate existing user with Google account', async () => {
      const mockExistingProvider = {
        id: 1,
        user_id: 1,
        provider_type: 'google',
        provider_id: 'google-123'
      };

      const mockUser = {
        id: 1,
        email: 'test@gmail.com',
        username: 'testuser'
      };

      socialAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue({
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
        expiresIn: 3600,
        tokenExpiry: new Date()
      });

      socialAuthService.fetchUserProfile = jest.fn().mockResolvedValue({
        id: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      });

      userModel.findSocialProvider = jest.fn().mockResolvedValue(mockExistingProvider);
      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.updateSocialProviderTokens = jest.fn().mockResolvedValue({});
      userModel.saveRefreshToken = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .get('/api/auth/social/google/callback?code=auth-code&state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('token=');
      expect(userModel.findSocialProvider).toHaveBeenCalledWith('google', 'google-123');
      expect(userModel.updateSocialProviderTokens).toHaveBeenCalled();
    });

    it('should handle user cancellation (error=access_denied)', async () => {
      const response = await request(app)
        .get('/api/auth/social/google/callback?error=access_denied&state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('error=auth_denied');
    });

    it('should handle missing authorization code', async () => {
      socialAuthService.exchangeCodeForToken = jest.fn().mockRejectedValue({
        code: 'AUTH_FAILED',
        message: 'Authorization code is required'
      });

      const response = await request(app)
        .get('/api/auth/social/google/callback?state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('error=');
    });

    it('should handle provider timeout error', async () => {
      socialAuthService.exchangeCodeForToken = jest.fn().mockRejectedValue({
        code: 'PROVIDER_TIMEOUT',
        message: 'OAuth provider timeout'
      });

      const response = await request(app)
        .get('/api/auth/social/google/callback?code=auth-code&state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('error=timeout');
    });

    it('should handle incomplete profile data', async () => {
      socialAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue({
        accessToken: 'token',
        refreshToken: null,
        expiresIn: 3600,
        tokenExpiry: new Date()
      });

      socialAuthService.fetchUserProfile = jest.fn().mockRejectedValue({
        code: 'PROFILE_INCOMPLETE',
        message: 'Missing required profile fields'
      });

      const response = await request(app)
        .get('/api/auth/social/facebook/callback?code=auth-code&state=test-state-token-123')
        .expect(302);

      expect(response.header.location).toContain('error=profile_incomplete');
    });
  });

  describe('GET /api/auth/social/accounts', () => {
    it('should return connected accounts for authenticated user', async () => {
      const mockAccounts = [
        {
          id: 1,
          provider_type: 'google',
          provider_email: 'test@gmail.com',
          connected_at: new Date('2024-01-15'),
          last_used_at: new Date('2024-01-20'),
          profile_data: { avatarUrl: 'https://example.com/avatar.jpg', displayName: 'Test User' }
        }
      ];

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        account_source: 'google',
        password: 'hashedpassword'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.getConnectedAccounts = jest.fn().mockResolvedValue(mockAccounts);

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/auth/social/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(1);
      expect(response.body.accounts[0].provider).toBe('google');
      expect(response.body.primaryEmail).toBe('test@example.com');
    });

    it('should return empty array when no accounts are connected', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        account_source: 'email',
        password: 'hashedpassword'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.getConnectedAccounts = jest.fn().mockResolvedValue([]);

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/auth/social/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.accounts).toEqual([]);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/auth/social/accounts')
        .expect(401);

      expect(response.body.error).toContain('Access denied');
    });
  });

  describe('DELETE /api/auth/social/accounts/:provider', () => {
    it('should disconnect a social account', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.findSocialProviderByUserAndType = jest.fn().mockResolvedValue({
        id: 1,
        user_id: 1,
        provider_type: 'google'
      });
      userModel.countAuthMethods = jest.fn().mockResolvedValue({
        totalMethods: 2,
        hasPassword: true,
        socialProviders: ['google', 'facebook']
      });
      userModel.getConnectedAccounts = jest.fn().mockResolvedValue([
        { provider_type: 'facebook' }
      ]);
      userModel.deleteSocialProvider = jest.fn().mockResolvedValue({});

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .delete('/api/auth/social/accounts/google')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.message).toContain('disconnected');
      expect(response.body.remainingAccounts).toContain('facebook');
      expect(userModel.deleteSocialProvider).toHaveBeenCalled();
    });

    it('should prevent disconnecting last authentication method', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: null // Social-only account
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.findSocialProviderByUserAndType = jest.fn().mockResolvedValue({
        id: 1,
        user_id: 1,
        provider_type: 'google'
      });
      userModel.countAuthMethods = jest.fn().mockResolvedValue({
        totalMethods: 1,
        hasPassword: false,
        socialProviders: ['google']
      });

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .delete('/api/auth/social/accounts/google')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.error).toContain('Cannot disconnect last authentication method');
    });

    it('should return 404 for non-existent social account', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.findSocialProviderByUserAndType = jest.fn().mockResolvedValue(null);

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .delete('/api/auth/social/accounts/github')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.error).toContain('not currently linked');
    });
  });
});
