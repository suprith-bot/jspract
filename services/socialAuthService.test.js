const socialAuthService = require('../services/socialAuthService');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Social Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange Google authorization code for tokens', async () => {
      axios.post.mockResolvedValue({
        data: {
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          expires_in: 3600
        }
      });

      const result = await socialAuthService.exchangeCodeForToken('google', 'auth-code-123');

      expect(result.accessToken).toBe('google-access-token');
      expect(result.refreshToken).toBe('google-refresh-token');
      expect(result.expiresIn).toBe(3600);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('oauth2.googleapis.com'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should exchange Facebook authorization code for tokens', async () => {
      axios.post.mockResolvedValue({
        data: {
          access_token: 'facebook-access-token',
          expires_in: 5184000 // 60 days
        }
      });

      const result = await socialAuthService.exchangeCodeForToken('facebook', 'fb-auth-code');

      expect(result.accessToken).toBe('facebook-access-token');
      expect(result.expiresIn).toBe(5184000);
    });

    it('should exchange GitHub authorization code for tokens', async () => {
      axios.post.mockResolvedValue({
        data: {
          access_token: 'github-access-token',
          token_type: 'bearer',
          scope: 'user:email'
        }
      });

      const result = await socialAuthService.exchangeCodeForToken('github', 'gh-auth-code');

      expect(result.accessToken).toBe('github-access-token');
    });

    it('should handle provider timeout error', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      await expect(
        socialAuthService.exchangeCodeForToken('google', 'auth-code')
      ).rejects.toMatchObject({
        code: 'PROVIDER_TIMEOUT',
        provider: 'google',
        statusCode: 504
      });
    });

    it('should handle invalid authorization code', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'invalid_grant' }
        }
      });

      await expect(
        socialAuthService.exchangeCodeForToken('google', 'invalid-code')
      ).rejects.toMatchObject({
        code: 'AUTH_FAILED',
        provider: 'google',
        statusCode: 401
      });
    });

    it('should handle network error', async () => {
      axios.post.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Network timeout'
      });

      await expect(
        socialAuthService.exchangeCodeForToken('facebook', 'auth-code')
      ).rejects.toMatchObject({
        code: 'PROVIDER_TIMEOUT'
      });
    });
  });

  describe('fetchUserProfile', () => {
    it('should fetch Google user profile', async () => {
      axios.get.mockResolvedValue({
        data: {
          id: 'google-user-123',
          email: 'user@gmail.com',
          name: 'John Doe',
          picture: 'https://example.com/avatar.jpg',
          verified_email: true
        }
      });

      const profile = await socialAuthService.fetchUserProfile('google', 'access-token');

      expect(profile.id).toBe('google-user-123');
      expect(profile.email).toBe('user@gmail.com');
      expect(profile.name).toBe('John Doe');
      expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(profile.verified).toBe(true);
    });

    it('should fetch Facebook user profile', async () => {
      axios.get.mockResolvedValue({
        data: {
          id: 'facebook-user-456',
          email: 'user@facebook.com',
          name: 'Jane Smith',
          picture: {
            data: {
              url: 'https://facebook.com/picture.jpg'
            }
          }
        }
      });

      const profile = await socialAuthService.fetchUserProfile('facebook', 'fb-access-token');

      expect(profile.id).toBe('facebook-user-456');
      expect(profile.email).toBe('user@facebook.com');
      expect(profile.name).toBe('Jane Smith');
      expect(profile.avatarUrl).toBe('https://facebook.com/picture.jpg');
    });

    it('should fetch GitHub user profile and emails', async () => {
      axios.get
        .mockResolvedValueOnce({
          // Profile endpoint
          data: {
            id: 12345,
            login: 'johndoe',
            name: 'John Doe',
            avatar_url: 'https://github.com/avatar.jpg'
          }
        })
        .mockResolvedValueOnce({
          // Emails endpoint
          data: [
            { email: 'john@example.com', primary: true, verified: true },
            { email: 'backup@example.com', primary: false, verified: true }
          ]
        });

      const profile = await socialAuthService.fetchUserProfile('github', 'gh-access-token');

      expect(profile.id).toBe('12345');
      expect(profile.email).toBe('john@example.com');
      expect(profile.name).toBe('John Doe');
      expect(profile.username).toBe('johndoe');
      expect(profile.avatarUrl).toBe('https://github.com/avatar.jpg');
    });

    it('should handle missing email from provider', async () => {
      axios.get.mockResolvedValue({
        data: {
          id: 'google-user-789',
          name: 'User Without Email'
          // email field missing
        }
      });

      await expect(
        socialAuthService.fetchUserProfile('google', 'access-token')
      ).rejects.toMatchObject({
        code: 'PROFILE_INCOMPLETE',
        missingFields: expect.arrayContaining(['email'])
      });
    });

    it('should handle GitHub profile with no verified emails', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            id: 99999,
            login: 'testuser',
            name: 'Test User',
            avatar_url: 'https://github.com/avatar.jpg'
          }
        })
        .mockResolvedValueOnce({
          data: [
            { email: 'unverified@example.com', primary: true, verified: false }
          ]
        });

      await expect(
        socialAuthService.fetchUserProfile('github', 'gh-access-token')
      ).rejects.toMatchObject({
        code: 'PROFILE_INCOMPLETE'
      });
    });

    it('should handle provider API timeout', async () => {
      axios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      await expect(
        socialAuthService.fetchUserProfile('google', 'access-token')
      ).rejects.toMatchObject({
        code: 'PROVIDER_TIMEOUT'
      });
    });

    it('should handle invalid access token', async () => {
      axios.get.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'invalid_token' }
        }
      });

      await expect(
        socialAuthService.fetchUserProfile('facebook', 'invalid-token')
      ).rejects.toMatchObject({
        code: 'PROVIDER_ERROR'
      });
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate Google OAuth URL with correct parameters', () => {
      const url = socialAuthService.generateAuthUrl('google', 'state-token-123');

      expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state-token-123');
      expect(url).toContain('scope=');
      expect(url).toContain('access_type=offline');
    });

    it('should generate Facebook OAuth URL', () => {
      const url = socialAuthService.generateAuthUrl('facebook', 'state-token-456');

      expect(url).toContain('facebook.com');
      expect(url).toContain('state=state-token-456');
      expect(url).toContain('scope=');
    });

    it('should generate GitHub OAuth URL', () => {
      const url = socialAuthService.generateAuthUrl('github', 'state-token-789');

      expect(url).toContain('github.com/login/oauth/authorize');
      expect(url).toContain('state=state-token-789');
      expect(url).toContain('scope=');
    });
  });
});
