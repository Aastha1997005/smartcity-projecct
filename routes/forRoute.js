const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all schedules for a route
router.get('/routes/:route_id/schedules', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM for_ WHERE route_id = ?', [req.params.route_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a schedule to a route
router.post('/routes/:route_id/schedules', async (req, res) => {
  const { schedule_id } = req.body;
  try {
    await db.query('INSERT INTO for_ (schedule_id, route_id) VALUES (?, ?)', [schedule_id, req.params.route_id]);
    res.json({ message: 'Schedule added to route' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove schedule from route
router.delete('/routes/:route_id/schedules/:schedule_id', async (req, res) => {
  try {
    await db.query('DELETE FROM for_ WHERE schedule_id = ? AND route_id = ?', [req.params.schedule_id, req.params.route_id]);
    res.json({ message: 'Schedule removed from route' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
