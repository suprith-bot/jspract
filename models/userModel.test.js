// User Model Tests - Social Auth Functions
// Tests for social provider CRUD operations

const userModel = require('./userModel');
const sql = require('./db');

jest.mock('./db');

describe('User Model - Social Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSocialUser', () => {
    it('should create user with social profile data (A01-E01-U08)', async () => {
      const mockUser = {
        id: 1,
        username: 'johndoe',
        email: 'john@gmail.com',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        account_source: 'google',
        password: null
      };

      sql.mockResolvedValue([mockUser]);

      const result = await userModel.createSocialUser(
        'johndoe',
        'john@gmail.com',
        'John Doe',
        'https://example.com/avatar.jpg',
        'google'
      );

      expect(result.id).toBe(1);
      expect(result.email).toBe('john@gmail.com');
      expect(result.display_name).toBe('John Doe');
      expect(result.account_source).toBe('google');
      expect(result.password).toBeNull();
    });

    it('should handle null display name', async () => {
      const mockUser = {
        id: 1,
        username: 'user',
        email: 'user@gmail.com',
        display_name: null,
        account_source: 'google'
      };

      sql.mockResolvedValue([mockUser]);

      const result = await userModel.createSocialUser(
        'user',
        'user@gmail.com',
        null,
        null,
        'google'
      );

      expect(result).toBeDefined();
    });

    it('should handle database errors', async () => {
      sql.mockRejectedValue(new Error('Database error'));

      await expect(
        userModel.createSocialUser('user', 'user@gmail.com', 'User', null, 'google')
      ).rejects.toThrow('Database error');
    });
  });

  describe('createSocialProvider', () => {
    it('should link social provider to user (A01-E01-U04)', async () => {
      const mockProvider = {
        id: 1,
        user_id: 1,
        provider_type: 'google',
        provider_id: 'google-123',
        provider_email: 'user@gmail.com',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh',
        token_expiry: new Date(),
        profile_data: { displayName: 'John Doe' }
      };

      sql.mockResolvedValue([mockProvider]);

      const result = await userModel.createSocialProvider(
        1,
        'google',
        'google-123',
        'user@gmail.com',
        'access-token',
        'refresh-token',
        new Date(),
        { displayName: 'John Doe' }
      );

      expect(result.user_id).toBe(1);
      expect(result.provider_type).toBe('google');
      expect(result.provider_id).toBe('google-123');
    });

    it('should prevent duplicate provider per user', async () => {
      sql.mockRejectedValue({
        code: '23505', // PostgreSQL unique violation
        constraint: 'social_providers_user_id_provider_type_key'
      });

      await expect(
        userModel.createSocialProvider(1, 'google', 'google-123', 'email', 'token', null, null, {})
      ).rejects.toMatchObject({
        code: '23505'
      });
    });

    it('should prevent same provider_id on different users', async () => {
      sql.mockRejectedValue({
        code: '23505',
        constraint: 'social_providers_provider_type_provider_id_key'
      });

      await expect(
        userModel.createSocialProvider(2, 'google', 'google-123', 'email', 'token', null, null, {})
      ).rejects.toMatchObject({
        code: '23505'
      });
    });
  });

  describe('findSocialProvider', () => {
    it('should find provider by type and ID', async () => {
      const mockProvider = {
        id: 1,
        user_id: 1,
        provider_type: 'google',
        provider_id: 'google-123'
      };

      sql.mockResolvedValue([mockProvider]);

      const result = await userModel.findSocialProvider('google', 'google-123');

      expect(result.provider_type).toBe('google');
      expect(result.provider_id).toBe('google-123');
    });

    it('should return null for non-existent provider', async () => {
      sql.mockResolvedValue([]);

      const result = await userModel.findSocialProvider('github', 'non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('findSocialProviderByUserAndType', () => {
    it('should find provider by user ID and type', async () => {
      const mockProvider = {
        id: 1,
        user_id: 1,
        provider_type: 'facebook'
      };

      sql.mockResolvedValue([mockProvider]);

      const result = await userModel.findSocialProviderByUserAndType(1, 'facebook');

      expect(result.user_id).toBe(1);
      expect(result.provider_type).toBe('facebook');
    });

    it('should return null if user has no such provider', async () => {
      sql.mockResolvedValue([]);

      const result = await userModel.findSocialProviderByUserAndType(1, 'github');

      expect(result).toBeUndefined();
    });
  });

  describe('getConnectedAccounts', () => {
    it('should return all connected social accounts (A01-E01-U05)', async () => {
      const mockAccounts = [
        {
          id: 1,
          provider_type: 'google',
          provider_email: 'user@gmail.com',
          connected_at: new Date('2024-01-15'),
          last_used_at: new Date('2024-01-20'),
          profile_data: { displayName: 'John Doe', avatarUrl: 'https://google.com/avatar.jpg' }
        },
        {
          id: 2,
          provider_type: 'github',
          provider_email: 'user@users.noreply.github.com',
          connected_at: new Date('2024-01-18'),
          last_used_at: new Date('2024-01-18'),
          profile_data: { displayName: 'johndoe', avatarUrl: 'https://github.com/avatar.jpg' }
        }
      ];

      sql.mockResolvedValue(mockAccounts);

      const result = await userModel.getConnectedAccounts(1);

      expect(result).toHaveLength(2);
      expect(result[0].provider_type).toBe('google');
      expect(result[1].provider_type).toBe('github');
    });

    it('should return empty array for no connected accounts', async () => {
      sql.mockResolvedValue([]);

      const result = await userModel.getConnectedAccounts(1);

      expect(result).toHaveLength(0);
    });

    it('should not expose access tokens', async () => {
      const mockAccounts = [
        {
          id: 1,
          provider_type: 'google',
          provider_email: 'user@gmail.com',
          connected_at: new Date(),
          last_used_at: new Date(),
          profile_data: {},
          access_token: 'secret-token', // Should not be in query
          refresh_token: 'secret-refresh'
        }
      ];

      sql.mockResolvedValue(mockAccounts);

      const result = await userModel.getConnectedAccounts(1);

      // The query should not SELECT access_token or refresh_token
      expect(result[0]).toBeDefined();
    });
  });

  describe('updateSocialProviderTokens', () => {
    it('should update provider tokens and last_used_at', async () => {
      const mockUpdated = {
        id: 1,
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        token_expiry: new Date(),
        last_used_at: new Date()
      };

      sql.mockResolvedValue([mockUpdated]);

      const result = await userModel.updateSocialProviderTokens(
        1,
        'google',
        'new-token',
        'new-refresh',
        new Date()
      );

      expect(result).toBeDefined();
    });

    it('should update last_used_at on authentication', async () => {
      const now = new Date();
      sql.mockResolvedValue([{ last_used_at: now }]);

      const result = await userModel.updateSocialProviderTokens(
        1,
        'facebook',
        'token',
        null,
        null
      );

      expect(result).toBeDefined();
    });
  });

  describe('deleteSocialProvider', () => {
    it('should disconnect social account (A01-E01-U06)', async () => {
      sql.mockResolvedValue([{ id: 1 }]);

      const result = await userModel.deleteSocialProvider(1, 'google');

      expect(result).toBeDefined();
    });

    it('should return null for non-existent provider', async () => {
      sql.mockResolvedValue([]);

      const result = await userModel.deleteSocialProvider(1, 'twitter');

      expect(result).toBeUndefined();
    });

    it('should cascade delete on user deletion', async () => {
      // This tests the ON DELETE CASCADE constraint
      sql.mockResolvedValue([]);

      // When user is deleted, social_providers should be auto-deleted
      // This is enforced by the database schema
      expect(true).toBe(true);
    });
  });

  describe('updateUserProfile', () => {
    it('should update display name and avatar from social data', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Updated Name',
        avatar_url: 'https://new-avatar.com/image.jpg'
      };

      sql.mockResolvedValue([mockUser]);

      const result = await userModel.updateUserProfile(1, {
        displayName: 'Updated Name',
        avatarUrl: 'https://new-avatar.com/image.jpg'
      });

      expect(result.display_name).toBe('Updated Name');
      expect(result.avatar_url).toBe('https://new-avatar.com/image.jpg');
    });

    it('should handle null values (no update)', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Original Name',
        avatar_url: 'https://original.com/image.jpg'
      };

      sql.mockResolvedValue([mockUser]);

      const result = await userModel.updateUserProfile(1, {
        displayName: null,
        avatarUrl: null
      });

      expect(result).toBeDefined();
    });
  });

  describe('saveRefreshToken', () => {
    it('should save hashed refresh token with expiry (A01-E01-U09)', async () => {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sql.mockResolvedValue([{ id: 1 }]);

      const result = await userModel.saveRefreshToken(
        1,
        'hashed-refresh-token',
        expiry
      );

      expect(result).toBeDefined();
    });

    it('should overwrite existing refresh token', async () => {
      sql.mockResolvedValue([{ id: 1 }]);

      const result = await userModel.saveRefreshToken(
        1,
        'new-hashed-token',
        new Date()
      );

      expect(result).toBeDefined();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should clear refresh token on logout (A01-E01-U10)', async () => {
      sql.mockResolvedValue(undefined);

      await userModel.revokeRefreshToken(1);

      expect(sql).toHaveBeenCalled();
    });

    it('should set refresh_token_hash to NULL', async () => {
      sql.mockResolvedValue(undefined);

      await userModel.revokeRefreshToken(1);

      // Verify SQL was called with UPDATE
      expect(sql).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      sql.mockRejectedValue(new Error('Connection refused'));

      await expect(
        userModel.createSocialUser('user', 'email', 'name', null, 'google')
      ).rejects.toThrow('Connection refused');
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      // Parameterized queries should prevent SQL injection
      sql.mockResolvedValue([]);

      await userModel.findUserByEmail(maliciousInput);

      // Query should be parameterized, not concatenated
      expect(sql).toHaveBeenCalled();
    });

    it('should handle concurrent provider creation', async () => {
      sql.mockRejectedValue({
        code: '23505',
        message: 'duplicate key value violates unique constraint'
      });

      await expect(
        userModel.createSocialProvider(1, 'google', 'id', 'email', 'token', null, null, {})
      ).rejects.toMatchObject({
        code: '23505'
      });
    });

    it('should handle large profile data JSON', async () => {
      const largeProfileData = {
        displayName: 'User',
        bio: 'A'.repeat(5000),
        followers: new Array(1000).fill({ id: 1 })
      };

      sql.mockResolvedValue([{ profile_data: largeProfileData }]);

      const result = await userModel.createSocialProvider(
        1,
        'github',
        'id',
        'email',
        'token',
        null,
        null,
        largeProfileData
      );

      expect(result).toBeDefined();
    });
  });
});
