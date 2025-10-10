const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all infrastructure in a zone
router.get('/zones/:zone_id/infrastructure', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Infrastructure WHERE zone_id = ?', [req.params.zone_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add infrastructure to a zone
router.post('/zones/:zone_id/infrastructure', async (req, res) => {
  const { asset_id } = req.body;
  try {
    await db.query('UPDATE Infrastructure SET zone_id = ? WHERE asset_id = ?', [req.params.zone_id, asset_id]);
    res.json({ message: 'Infrastructure added to zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove infrastructure from a zone
router.delete('/zones/:zone_id/infrastructure/:asset_id', async (req, res) => {
  try {
    await db.query('UPDATE Infrastructure SET zone_id = NULL WHERE asset_id = ? AND zone_id = ?', [req.params.asset_id, req.params.zone_id]);
    res.json({ message: 'Infrastructure removed from zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
