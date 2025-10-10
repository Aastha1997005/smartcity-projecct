const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Register new user
router.post('/register', async (req, res) => {
    res.send('Register user');
});

// Login user
router.post('/login', async (req, res) => {
    res.send('Login user');
});

// Get user profile (self or admin)
router.get('/:user_id', authenticateToken, (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id == req.params.user_id) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: insufficient rights' });
}, async (req, res) => {
    res.send(`Get user ${req.params.user_id}`);
});

// Update user (self or admin)
router.put('/:user_id', authenticateToken, (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id == req.params.user_id) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: insufficient rights' });
}, async (req, res) => {
    res.send(`Update user ${req.params.user_id}`);
});

// Delete user (admin only)
router.delete('/:user_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    res.send(`Delete user ${req.params.user_id}`);
});

module.exports = router;
