const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all operators for a service
router.get('/services/:service_id/operators', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM operated_by WHERE service_id = ?', [req.params.service_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add an operator to a service
router.post('/services/:service_id/operators', async (req, res) => {
  const { citizen_id, provider_id } = req.body;
  try {
    await db.query('INSERT INTO operated_by (citizen_id, service_id, provider_id) VALUES (?, ?, ?)', [citizen_id, req.params.service_id, provider_id]);
    res.json({ message: 'Operator added to service' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove operator from service
router.delete('/services/:service_id/operators/:provider_id/:citizen_id', async (req, res) => {
  try {
    await db.query('DELETE FROM operated_by WHERE service_id = ? AND provider_id = ? AND citizen_id = ?', [req.params.service_id, req.params.provider_id, req.params.citizen_id]);
    res.json({ message: 'Operator removed from service' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
