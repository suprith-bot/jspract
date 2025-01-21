// /controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const Joi = require('joi');
const createUserSchema = Joi.object({
  username: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .required()
      .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      })});
  
const loginUserSchema = Joi.object({
  
  email: Joi.string().email().required(),
  password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .required()
      .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      })
});

// Secret for JWT (should be stored in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// User signup
const signup = async (req, res) => {
 
  const { error, value }= createUserSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({error: error.details.map(detail => detail.message).join(', ')});
   
}

  const { username, email, password }=value;
  try {
    // Check if user already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await userModel.createUser(username, email, hashedPassword);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

// User login
const login = async (req, res) => {
   
  const { error, value }= loginUserSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({error: error.details.map(detail => detail.message).join(', ')});
   
}

  const {  email, password }=value;
  

  try {
    // Find user by email
    const user = await userModel.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = {
  signup,
  login,
};
