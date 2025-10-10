const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all vehicles owned by a citizen
router.get('/citizens/:citizen_id/vehicles', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Vehicle WHERE owner_citizen_id = ?', [req.params.citizen_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign a vehicle to a citizen
router.post('/citizens/:citizen_id/vehicles', async (req, res) => {
  const { vehicle_no } = req.body;
  try {
    await db.query('UPDATE Vehicle SET owner_citizen_id = ? WHERE vehicle_no = ?', [req.params.citizen_id, vehicle_no]);
    res.json({ message: 'Vehicle assigned to citizen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove vehicle from citizen
router.delete('/citizens/:citizen_id/vehicles/:vehicle_no', async (req, res) => {
  try {
    await db.query('UPDATE Vehicle SET owner_citizen_id = NULL WHERE vehicle_no = ? AND owner_citizen_id = ?', [req.params.vehicle_no, req.params.citizen_id]);
    res.json({ message: 'Vehicle removed from citizen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
