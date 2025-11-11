const express = require('express');
const router = express.Router();
const {db} = require('../db');

// Get all transport schedules
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
        SELECT ts.*, t.mode, s.service_name, r.start_point, r.end_point
        FROM Transport_Schedule ts
        JOIN Transport t ON ts.transport_id = t.transport_id
        JOIN Service s ON t.transport_id = s.service_id
        JOIN Route r ON ts.route_id = r.route_id
        ORDER BY ts.start_time
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get schedule by ID
router.get('/:schedule_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transport_Schedule WHERE schedule_id = ?', [req.params.schedule_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new schedule
router.post('/', async (req, res) => {
  const { schedule_id, transport_id, route_id, start_time, end_time, frequency, days_of_operation, status } = req.body;
  try {
    await db.query('INSERT INTO Transport_Schedule (schedule_id, transport_id, route_id, start_time, end_time, frequency, days_of_operation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [schedule_id, transport_id, route_id, start_time, end_time, frequency, days_of_operation, status]);
    res.json({ message: 'Schedule created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a schedule
router.put('/:schedule_id', async (req, res) => {
  const { transport_id, route_id, start_time, end_time, frequency, days_of_operation, status } = req.body;
  try {
    await db.query('UPDATE Transport_Schedule SET transport_id = ?, route_id = ?, start_time = ?, end_time = ?, frequency = ?, days_of_operation = ?, status = ? WHERE schedule_id = ?', [transport_id, route_id, start_time, end_time, frequency, days_of_operation, status, req.params.schedule_id]);
    res.json({ message: 'Schedule updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a schedule
router.delete('/:schedule_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Transport_Schedule WHERE schedule_id = ?', [req.params.schedule_id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all schedules for a specific transport
router.get('/transport/:transport_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transport_Schedule WHERE transport_id = ?', [req.params.transport_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all schedules for a specific route
router.get('/route/:route_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transport_Schedule WHERE route_id = ?', [req.params.route_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
