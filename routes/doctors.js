const express = require('express');
const router = express.Router();

const {db} = require('../db');
// Get all doctors (healthcare professionals)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Doctors');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get doctor by ID
router.get('/:doctor_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Doctors WHERE doctor_id = ?', [req.params.doctor_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Create doctor
router.post('/', async (req, res) => {
    const { doctor_id, name, specialisation } = req.body;
    try {
        await db.query('INSERT INTO Doctors (doctor_id, name, specialisation) VALUES (?, ?, ?)', [doctor_id, name, specialisation]);
        res.json({ message: 'Doctor created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update doctor
router.put('/:doctor_id', async (req, res) => {
    const { name, specialisation } = req.body;
    try {
        await db.query('UPDATE Doctors SET name = ?, specialisation = ? WHERE doctor_id = ?', [name, specialisation, req.params.doctor_id]);
        res.json({ message: 'Doctor updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete doctor
router.delete('/:doctor_id', async (req, res) => {
    try {
        await db.query('DELETE FROM Doctors WHERE doctor_id = ?', [req.params.doctor_id]);
        res.json({ message: 'Doctor deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
