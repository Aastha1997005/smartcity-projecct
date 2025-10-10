const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all fuel consumption records for a vehicle
router.get('/vehicles/:vehicle_no/consumes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM consumes WHERE vehicle_id = ?', [req.params.vehicle_no]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a fuel consumption record
router.post('/vehicles/:vehicle_no/consumes', async (req, res) => {
  const { fuel_id, time, date, quantity, Cost } = req.body;
  try {
    await db.query('INSERT INTO consumes (fuel_id, vehicle_id, time, date, quantity, Cost) VALUES (?, ?, ?, ?, ?, ?)', [fuel_id, req.params.vehicle_no, time, date, quantity, Cost]);
    res.json({ message: 'Fuel consumption record added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific consumption record
router.delete('/vehicles/:vehicle_no/consumes/:fuel_id/:time/:date', async (req, res) => {
  try {
    await db.query('DELETE FROM consumes WHERE fuel_id = ? AND vehicle_id = ? AND time = ? AND date = ?', [req.params.fuel_id, req.params.vehicle_no, req.params.time, req.params.date]);
    res.json({ message: 'Fuel consumption record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
