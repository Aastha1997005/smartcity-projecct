const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all public lights in a zone
router.get('/zone/:zone_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Public_Light WHERE zone_id = ?', [req.params.zone_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// Get all public lights in a zone
router.get("/:zone_id/public-lights", async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Public_Light WHERE zone_id = ?', [req.params.zone_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});