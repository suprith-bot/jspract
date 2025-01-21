// /routes/userRoutes.js
const express = require('express');
const { signup, login } = require('../controllers/userController');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { sendResetEmail } = require('../middlewares/emailService');
const  UserModel  = require('../models/userModel'); 

const router = express.Router();

// POST /api/users/signup
router.post('/register', signup);

// POST /api/users/login
router.post('/login', login);







// Request password reset
router.post('/request-reset', async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by email
        const user = await UserModel.findUserByEmail( email);
        if (!user) {
            return res.status(404).json({ 
                message: 'If a user with this email exists, a password reset link will be sent.' 
            });
        }

        // Create reset token
        const resetToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

         // Calculate expiry time
         const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

         // Save reset token and expiry
         await UserModel.updateResetToken(
             user.id, 
             resetToken, 
             resetTokenExpiry
         );
 

     

        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Send email
        await sendResetEmail(user.email, resetUrl);

        res.json({ 
            message: 'If a user with this email exists, a password reset link will be sent.' 
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ 
            message: 'Error processing password reset request' 
        });
    }
});

// Reset password with token
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const {password} = req.body;
       console.log(password);

        

                // Find user by reset token
                const user = await UserModel.findUserByResetToken(token);
console.log(user);
                if (!user) {
                    return res.status(400).json({ 
                        message: 'Invalid or expired reset token' 
                    });
                }
        
                // Hash new password
                const hashedPassword = await bcrypt.hash(password, 10);
        
                // Update user password and clear reset token
                await UserModel.updatePassword(user.id, hashedPassword);
        
                res.json({ message: 'Password successfully reset' });
        
            } catch (error) {
                if (error.name === 'JsonWebTokenError') {
                    return res.status(400).json({ message: 'Invalid reset token' });
                }
                console.error('Password reset error:', error);
                res.status(500).json({ message: 'Error resetting password' });
            }
        });
        



module.exports = router;
