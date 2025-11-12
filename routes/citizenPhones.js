const express = require('express');
const router = express.Router();

// Get all phone numbers for a citizen
const {db} = require('../db');
router.get('/:citizen_id/phones', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT phone_number FROM Citizen_Phone_Number WHERE citizen_id = ?', [req.params.citizen_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add phone number
router.post('/:citizen_id/phones', async (req, res) => {
    const { phone_number } = req.body;
    try {
        await db.query('INSERT INTO Citizen_Phone_Number (citizen_id, phone_number) VALUES (?, ?)', [req.params.citizen_id, phone_number]);
        res.json({ message: 'Phone number added' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete phone number
router.delete('/:citizen_id/phones/:phone_number', async (req, res) => {
    try {
        await db.query('DELETE FROM Citizen_Phone_Number WHERE citizen_id = ? AND phone_number = ?', [req.params.citizen_id, req.params.phone_number]);
        res.json({ message: 'Phone number deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
