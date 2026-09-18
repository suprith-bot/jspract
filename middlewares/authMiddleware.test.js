const jwt = require('jsonwebtoken');
const { verifyToken, optionalAuth } = require('../middlewares/authMiddleware');
const userModel = require('../models/userModel');

jest.mock('../models/userModel');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should authenticate valid JWT token', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      userModel.findUserById.mockResolvedValue(mockUser);

      await verifyToken(req, res, next);

      expect(req.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat';

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided.'
      });
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '0s' });
      req.headers.authorization = `Bearer ${expiredToken}`;

      // Wait to ensure token expires
      await new Promise(resolve => setTimeout(resolve, 100));

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Token expired.',
          code: 'TOKEN_EXPIRED'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token-string';

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token.'
      });
    });

    it('should reject refresh token (wrong token type)', async () => {
      const refreshToken = jwt.sign(
        { id: 1, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      req.headers.authorization = `Bearer ${refreshToken}`;

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token type. Please use access token.'
      });
    });

    it('should reject token for non-existent user', async () => {
      const token = jwt.sign({ id: 999 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      userModel.findUserById.mockResolvedValue(null);

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token.'
      });
    });
  });

  describe('optionalAuth', () => {
    it('should attach user if valid token provided', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      userModel.findUserById.mockResolvedValue(mockUser);

      await optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without user if no token provided', async () => {
      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without user if invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should proceed without user if expired token', async () => {
      const expiredToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '0s' });
      req.headers.authorization = `Bearer ${expiredToken}`;

      await new Promise(resolve => setTimeout(resolve, 100));

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should ignore refresh token', async () => {
      const refreshToken = jwt.sign(
        { id: 1, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      req.headers.authorization = `Bearer ${refreshToken}`;

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
