const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all houses located in a zone
router.get('/zones/:zone_id/houses', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM located_in WHERE zone_id = ?', [req.params.zone_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a house to a zone
router.post('/zones/:zone_id/houses', async (req, res) => {
  const { house_id } = req.body;
  try {
    await db.query('INSERT INTO located_in (house_id, zone_id) VALUES (?, ?)', [house_id, req.params.zone_id]);
    res.json({ message: 'House added to zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});