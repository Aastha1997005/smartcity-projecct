const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all routes operated by a transport
router.get('/transport/:transport_id/routes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM operates_on WHERE transport_id = ?', [req.params.transport_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign a route to transport
router.post('/transport/:transport_id/routes', async (req, res) => {
  const { route_id } = req.body;
  try {
    await db.query('INSERT INTO operates_on (transport_id, route_id) VALUES (?, ?)', [req.params.transport_id, route_id]);
    res.json({ message: 'Route assigned to transport' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove route from transport
router.delete('/transport/:transport_id/routes/:route_id', async (req, res) => {
  try {
    await db.query('DELETE FROM operates_on WHERE transport_id = ? AND route_id = ?', [req.params.transport_id, req.params.route_id]);
    res.json({ message: 'Route removed from transport' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
