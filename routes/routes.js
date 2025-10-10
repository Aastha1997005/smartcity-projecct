const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all routes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Route');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get route by ID
router.get('/:route_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Route WHERE route_id = ?', [req.params.route_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create route
router.post('/', async (req, res) => {
  const { route_id, start_point, end_point, distance, mode } = req.body;
  try {
    await db.query('INSERT INTO Route (route_id, start_point, end_point, distance, mode) VALUES (?, ?, ?, ?, ?)', [route_id, start_point, end_point, distance, mode]);
    res.json({ message: 'Route created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update route
router.put('/:route_id', async (req, res) => {
  const { start_point, end_point, distance, mode } = req.body;
  try {
    await db.query('UPDATE Route SET start_point = ?, end_point = ?, distance = ?, mode = ? WHERE route_id = ?', [start_point, end_point, distance, mode, req.params.route_id]);
    res.json({ message: 'Route updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete route
router.delete('/:route_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Route WHERE route_id = ?', [req.params.route_id]);
    res.json({ message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
