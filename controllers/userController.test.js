const request = require('supertest');
const express = require('express');
const userRoutes = require('../routes/userRoutes');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

jest.mock('../models/userModel');
jest.mock('bcrypt');

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('User Controller - Refresh Token & Logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        refresh_token_hash: 'hashed-refresh-token',
        refresh_token_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days future
      };

      const refreshToken = jwt.sign(
        { id: 1, type: 'refresh' },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d' }
      );

      bcrypt.compare = jest.fn().mockResolvedValue(true);
      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.saveRefreshToken = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/api/users/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.expiresIn).toBe(3600);
      expect(userModel.saveRefreshToken).toHaveBeenCalled();
    });

    it('should reject expired refresh token (A01-E01-U09)', async () => {
      const expiredRefreshToken = jwt.sign(
        { id: 1, type: 'refresh' },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '0s' }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .post('/api/users/refresh')
        .send({ refreshToken: expiredRefreshToken })
        .expect(401);

      expect(response.body.error).toContain('expired');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/users/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject refresh token for non-existent user', async () => {
      const refreshToken = jwt.sign(
        { id: 999, type: 'refresh' },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d' }
      );

      userModel.findUserById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/users/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should reject access token in refresh endpoint', async () => {
      const accessToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .post('/api/users/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/users/logout', () => {
    it('should successfully logout and revoke refresh token (A01-E01-U10)', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.revokeRefreshToken = jest.fn().mockResolvedValue({});

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .post('/api/users/logout')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      expect(response.body.message).toContain('Signed out');
      expect(userModel.revokeRefreshToken).toHaveBeenCalledWith(1);
    });

    it('should revoke all sessions when revokeAllSessions is true', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.revokeRefreshToken = jest.fn().mockResolvedValue({});

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .post('/api/users/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ revokeAllSessions: true })
        .expect(200);

      expect(response.body.message).toBeDefined();
      expect(userModel.revokeRefreshToken).toHaveBeenCalledWith(1);
    });

    it('should reject logout without authentication', async () => {
      const response = await request(app)
        .post('/api/users/logout')
        .send()
        .expect(401);

      expect(response.body.error).toContain('Access denied');
    });

    it('should handle logout errors gracefully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.revokeRefreshToken = jest.fn().mockRejectedValue(new Error('Database error'));

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .post('/api/users/logout')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/users/me', () => {
    it('should return current user with connected accounts (A01-E01-U05)', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        account_source: 'google',
        password: null
      };

      const mockSocialAccounts = [
        {
          provider_type: 'google',
          provider_email: 'test@gmail.com',
          connected_at: new Date('2024-01-15'),
          profile_data: { displayName: 'Test User' }
        }
      ];

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.getConnectedAccounts = jest.fn().mockResolvedValue(mockSocialAccounts);

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.displayName).toBe('Test User');
      expect(response.body.hasPassword).toBe(false);
      expect(response.body.connectedAccounts).toHaveLength(1);
      expect(response.body.connectedAccounts[0].provider).toBe('google');
    });

    it('should indicate if user has password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        account_source: 'email',
        password: 'hashed-password'
      };

      userModel.findUserById = jest.fn().mockResolvedValue(mockUser);
      userModel.getConnectedAccounts = jest.fn().mockResolvedValue([]);

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.hasPassword).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.error).toContain('Access denied');
    });
  });
});
