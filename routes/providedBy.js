const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all powernodes providing electricity
router.get('/electricity/:electricity_id/powernodes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT p.* FROM provided_by pb JOIN Powernodes p ON pb.node_id = p.node_id WHERE pb.electricity_id = ?', [req.params.electricity_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link a powernode to electricity
router.post('/electricity/:electricity_id/powernodes', async (req, res) => {
  const { node_id } = req.body;
  try {
    await db.query('INSERT INTO provided_by (electricity_id, node_id) VALUES (?, ?)', [req.params.electricity_id, node_id]);
    res.json({ message: 'Powernode linked to electricity' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unlink a powernode from electricity
router.delete('/electricity/:electricity_id/powernodes/:node_id', async (req, res) => {
  try {
    await db.query('DELETE FROM provided_by WHERE electricity_id = ? AND node_id = ?', [req.params.electricity_id, req.params.node_id]);
    res.json({ message: 'Powernode unlinked from electricity' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
