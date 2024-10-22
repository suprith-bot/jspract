// /routes/userRoutes.js
const express = require('express');
const { signup, login } = require('../controllers/userController');

const router = express.Router();

// POST /api/users/signup
router.post('/signup', signup);

// POST /api/users/login
router.post('/login', login);

module.exports = router;
