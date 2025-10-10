
const express = require('express');
const router = express.Router();
const db = require('../db'); // your MySQL connection

// PATCH citizen profile by user_id (partial update)
router.patch('/citizen/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const updates = req.body;
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "citizen"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const citizenId = results[0].linked_id;
            const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            const values = Object.values(updates);
            if (!fields) return res.status(400).json({ error: 'No fields to update' });
            db.query(
                `UPDATE citizens SET ${fields} WHERE citizen_id = ?`,
                [...values, citizenId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated (partial)' });
                }
            );
        }
    );
});

// PATCH doctor profile by user_id (partial update)
router.patch('/doctor/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const updates = req.body;
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "doctor"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const doctorId = results[0].linked_id;
            const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            const values = Object.values(updates);
            if (!fields) return res.status(400).json({ error: 'No fields to update' });
            db.query(
                `UPDATE doctors SET ${fields} WHERE doctor_id = ?`,
                [...values, doctorId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated (partial)' });
                }
            );
        }
    );
});

// PATCH provider profile by user_id (partial update)
router.patch('/provider/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const updates = req.body;
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "provider"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const providerId = results[0].linked_id;
            const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            const values = Object.values(updates);
            if (!fields) return res.status(400).json({ error: 'No fields to update' });
            db.query(
                `UPDATE providers SET ${fields} WHERE provider_id = ?`,
                [...values, providerId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated (partial)' });
                }
            );
        }
    );
});

// Get citizen profile by user_id
router.get('/citizen/:user_id', (req, res) => {
    const userId = req.params.user_id;
    db.query(
        'SELECT c.* FROM Users u JOIN citizens c ON u.linked_id = c.citizen_id WHERE u.user_id = ? AND u.role = "citizen"',
        [userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            if (results.length === 0) return res.status(404).json({ error: 'Profile not found' });
            res.json(results[0]);
        }
    );
});

// Update citizen profile by user_id
router.put('/citizen/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { name, address, phone } = req.body; // example fields
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "citizen"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const citizenId = results[0].linked_id;
            db.query(
                'UPDATE citizens SET name = ?, address = ?, phone = ? WHERE citizen_id = ?',
                [name, address, phone, citizenId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated' });
                }
            );
        }
    );
});

// Get doctor profile by user_id
router.get('/doctor/:user_id', (req, res) => {
    const userId = req.params.user_id;
    db.query(
        'SELECT d.* FROM Users u JOIN doctors d ON u.linked_id = d.doctor_id WHERE u.user_id = ? AND u.role = "doctor"',
        [userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            if (results.length === 0) return res.status(404).json({ error: 'Profile not found' });
            res.json(results[0]);
        }
    );
});

// Update doctor profile by user_id
router.put('/doctor/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { name, specialization, phone } = req.body; // example fields
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "doctor"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const doctorId = results[0].linked_id;
            db.query(
                'UPDATE doctors SET name = ?, specialization = ?, phone = ? WHERE doctor_id = ?',
                [name, specialization, phone, doctorId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated' });
                }
            );
        }
    );
});

// Get provider profile by user_id
router.get('/provider/:user_id', (req, res) => {
    const userId = req.params.user_id;
    db.query(
        'SELECT p.* FROM Users u JOIN providers p ON u.linked_id = p.provider_id WHERE u.user_id = ? AND u.role = "provider"',
        [userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            if (results.length === 0) return res.status(404).json({ error: 'Profile not found' });
            res.json(results[0]);
        }
    );
});

// Update provider profile by user_id
router.put('/provider/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { name, service_type, phone } = req.body; // example fields
    db.query(
        'SELECT linked_id FROM Users WHERE user_id = ? AND role = "provider"',
        [userId],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const providerId = results[0].linked_id;
            db.query(
                'UPDATE providers SET name = ?, service_type = ?, phone = ? WHERE provider_id = ?',
                [name, service_type, phone, providerId],
                (err2, result2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ message: 'Profile updated' });
                }
            );
        }
    );
});

module.exports = router;
