const express = require('express');
const router = express.Router();
const {db} = require('../db');

// Get all power nodes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Powernodes');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get power node by ID
router.get('/:node_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Powernodes WHERE node_id = ?', [req.params.node_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Power node not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new power node
router.post('/', async (req, res) => {
  const { node_id, capacity, installation_date, status } = req.body;
  try {
    await db.query('INSERT INTO Powernodes (node_id, capacity, installation_date, status) VALUES (?, ?, ?, ?)', [node_id, capacity, installation_date, status]);
    res.json({ message: 'Power node created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update power node
router.put('/:node_id', async (req, res) => {
  const { capacity, installation_date, status } = req.body;
  try {
    await db.query('UPDATE Powernodes SET capacity = ?, installation_date = ?, status = ? WHERE node_id = ?', [capacity, installation_date, status, req.params.node_id]);
    res.json({ message: 'Power node updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete power node
router.delete('/:node_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Powernodes WHERE node_id = ?', [req.params.node_id]);
    res.json({ message: 'Power node deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
