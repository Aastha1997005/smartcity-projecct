const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all bins managed by a waste management entity
router.get('/waste_management/:waste_id/bins', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Smart_Bin WHERE managing_waste_id = ?', [req.params.waste_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign a bin to waste management
router.post('/waste_management/:waste_id/bins', async (req, res) => {
  const { bin_id } = req.body;
  try {
    await db.query('UPDATE Smart_Bin SET managing_waste_id = ? WHERE bin_id = ?', [req.params.waste_id, bin_id]);
    res.json({ message: 'Bin assigned to waste management' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove bin from waste management
router.delete('/waste_management/:waste_id/bins/:bin_id', async (req, res) => {
  try {
    await db.query('UPDATE Smart_Bin SET managing_waste_id = NULL WHERE bin_id = ? AND managing_waste_id = ?', [req.params.bin_id, req.params.waste_id]);
    res.json({ message: 'Bin removed from waste management' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
