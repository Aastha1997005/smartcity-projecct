
const express = require('express');
const router = express.Router();
const db = require('../db'); // promise-based pool
const { authenticateToken } = require('../middleware/auth');

// GET current user's profile (citizen/doctor/provider) using JWT
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
        const [users] = await db.query('SELECT role, linked_id FROM Users WHERE user_id = ?', [userId]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const role = users[0].role;
        const linkedId = users[0].linked_id;
        if (!linkedId) return res.status(400).json({ error: 'Profile incomplete' });

            if (role === 'citizen') {
                const [rows] = await db.query('SELECT c.* FROM Users u JOIN Citizen c ON u.linked_id = c.citizen_id WHERE u.user_id = ? AND u.role = "citizen"', [userId]);
                if (!rows || rows.length === 0) return res.status(404).json({ error: 'Citizen profile not found' });
                const profile = rows[0];
                // Fetch email from Users table
                const [[userRow]] = await db.query('SELECT email FROM Users WHERE user_id = ?', [userId]);
                if (userRow && userRow.email) profile.email = userRow.email;
                // Fetch phone numbers from Citizen_Phone_Number
                const [phones] = await db.query('SELECT phone_number FROM Citizen_Phone_Number WHERE citizen_id = ?', [profile.citizen_id]);
                profile.phones = phones.map(p => p.phone_number);
                // For backward compatibility set phone as first phone or existing phone field
                profile.phone = profile.phones.length ? profile.phones[0] : profile.phone || null;
                return res.json(profile);
            }

        if (role === 'doctor') {
            const [rows] = await db.query('SELECT d.* FROM Users u JOIN Doctors d ON u.linked_id = d.doctor_id WHERE u.user_id = ? AND u.role = "doctor"', [userId]);
            if (!rows || rows.length === 0) return res.status(404).json({ error: 'Doctor profile not found' });
            return res.json(rows[0]);
        }

        if (role === 'provider') {
            const [rows] = await db.query('SELECT p.* FROM Users u JOIN Service_Provider p ON u.linked_id = p.provider_id WHERE u.user_id = ? AND u.role = "provider"', [userId]);
            if (!rows || rows.length === 0) return res.status(404).json({ error: 'Provider profile not found' });
            return res.json(rows[0]);
        }

        res.status(400).json({ error: 'Unsupported role' });
    } catch (err) {
        console.error('Profile route error:', err);
        res.status(500).json({ error: 'Server error loading profile' });
    }
});

// Generic helper to update a profile table by linked_id and fields
async function patchProfileByRole(userId, roleTable, idField, updates) {
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = ?', [userId, roleTable === 'Citizen' ? 'citizen' : roleTable === 'Doctors' ? 'doctor' : 'provider']);
    if (!users || users.length === 0) throw { status: 404, message: 'User not found' };
    const profileId = users[0].linked_id;
    if (!profileId) throw { status: 400, message: 'Profile incomplete' };
    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    if (!fields) throw { status: 400, message: 'No fields to update' };
    const values = Object.values(updates);
    await db.query(`UPDATE ${roleTable.toLowerCase()} SET ${fields} WHERE ${idField} = ?`, [...values, profileId]);
}

// PATCH profile partial endpoints
router.patch('/citizen/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Citizen', 'citizen_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/doctor/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Doctors', 'doctor_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/provider/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Service_Provider', 'provider_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get specific role profiles
router.get('/citizen/:user_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT c.* FROM Users u JOIN Citizen c ON u.linked_id = c.citizen_id WHERE u.user_id = ? AND u.role = "citizen"', [req.params.user_id]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/citizen/:user_id', async (req, res) => {
    try {
        const { name, address, phone } = req.body;
        const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "citizen"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const citizenId = users[0].linked_id;
        await db.query('UPDATE Citizen SET name = ?, address = ?, phone = ? WHERE citizen_id = ?', [name, address, phone, citizenId]);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/doctor/:user_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT d.* FROM Users u JOIN Doctors d ON u.linked_id = d.doctor_id WHERE u.user_id = ? AND u.role = "doctor"', [req.params.user_id]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/doctor/:user_id', async (req, res) => {
    try {
        const { name, specialization, phone } = req.body;
        const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "doctor"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const doctorId = users[0].linked_id;
        await db.query('UPDATE Doctors SET name = ?, specialization = ?, phone = ? WHERE doctor_id = ?', [name, specialization, phone, doctorId]);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/provider/:user_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT p.* FROM Users u JOIN Service_Provider p ON u.linked_id = p.provider_id WHERE u.user_id = ? AND u.role = "provider"', [req.params.user_id]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/provider/:user_id', async (req, res) => {
    try {
        const { name, service_type, phone } = req.body;
        const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "provider"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const providerId = users[0].linked_id;
        await db.query('UPDATE Service_Provider SET name = ?, service_type = ?, phone = ? WHERE provider_id = ?', [name, service_type, phone, providerId]);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
