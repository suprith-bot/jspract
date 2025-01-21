// middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');

const privateRouteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5,
    message: {
        status: 429,
        error: 'Too many requests. Please try again later.'
    },
    // Custom key generator based on user token or IP
    keyGenerator: (req) => {
        // If user is authenticated, use their ID
        if (req.user && req.user.id) {
            return req.user.id;
        }
        // Fallback to IP address
        return req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            status: 429,
            error: 'Too many requests. Please try again later.',
            nextValidRequestTime: req.rateLimit.resetTime
        });
    }
});

module.exports = { privateRouteLimiter };
