const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all houses in a zone
router.get('/:zone_id/houses', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM House WHERE zone_id = ?', [req.params.zone_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a house to a zone
router.post('/:zone_id/houses', async (req, res) => {
  const { house_id, type, area } = req.body;
  try {
    await db.query('INSERT INTO House (house_id, type, area, zone_id) VALUES (?, ?, ?, ?)', [house_id, type, area, req.params.zone_id]);
    res.json({ message: 'House added to zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a house from a zone
router.delete('/:zone_id/houses/:house_id', async (req, res) => {
  try {
    await db.query('DELETE FROM House WHERE house_id = ? AND zone_id = ?', [req.params.house_id, req.params.zone_id]);
    res.json({ message: 'House removed from zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
