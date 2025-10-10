const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all public lights
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Public_Light');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get public light by ID
router.get('/:light_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Public_Light WHERE light_id = ?', [req.params.light_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Public light not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new public light
router.post('/', async (req, res) => {
  const { light_id, location, status, type, installation_date, power_rating } = req.body;
  try {
    await db.query('INSERT INTO Public_Light (light_id, location, status, type, installation_date, power_rating) VALUES (?, ?, ?, ?, ?, ?)', [light_id, location, status, type, installation_date, power_rating]);
    res.json({ message: 'Public light created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update public light
router.put('/:light_id', async (req, res) => {
  const { location, status, type, installation_date, power_rating } = req.body;
  try {
    await db.query('UPDATE Public_Light SET location = ?, status = ?, type = ?, installation_date = ?, power_rating = ? WHERE light_id = ?', [location, status, type, installation_date, power_rating, req.params.light_id]);
    res.json({ message: 'Public light updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete public light
router.delete('/:light_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Public_Light WHERE light_id = ?', [req.params.light_id]);
    res.json({ message: 'Public light deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
