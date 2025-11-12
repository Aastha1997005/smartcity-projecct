const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {db} = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {db} = require("../db");
const bcrypt = require("bcrypt");

// Register new user
router.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            "INSERT INTO Users (email, password_hash, role) VALUES (?, ?, ?)",
            [email, hashedPassword, role || 'citizen']
        );
        res.status(201).json({ message: "User registered successfully", userId: result.insertId });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, role: user.role, linked_id: user.linked_id });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get user profile (self or admin)
router.get('/:user_id', authenticateToken, (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id == req.params.user_id) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: insufficient rights' });
}, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT user_id, email, role, linked_id, created_at FROM Users WHERE user_id = ?", [req.params.user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Get user profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update user (self or admin)
router.put('/:user_id', authenticateToken, (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id == req.params.user_id) {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: insufficient rights' });
}, async (req, res) => {
    const { email, password, role, linked_id } = req.body;
    try {
        const updates = [];
        const params = [];
        if (email) {
            updates.push('email = ?');
            params.push(email);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(hashedPassword);
        }
        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (linked_id) {
            updates.push('linked_id = ?');
            params.push(linked_id);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.user_id);
        await db.query(`UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`, params);
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete user (admin only)
router.delete('/:user_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        await db.query("DELETE FROM Users WHERE user_id = ?", [req.params.user_id]);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
