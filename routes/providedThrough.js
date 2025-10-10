const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all water sources provided through a pipeline
router.get('/pipelines/:pipeline_id/water', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT w.* FROM provided_through pt JOIN Water w ON pt.water_id = w.water_id WHERE pt.pipeline_id = ?', [req.params.pipeline_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link a water source to a pipeline
router.post('/pipelines/:pipeline_id/water', async (req, res) => {
  const { water_id } = req.body;
  try {
    await db.query('INSERT INTO provided_through (pipeline_id, water_id) VALUES (?, ?)', [req.params.pipeline_id, water_id]);
    res.json({ message: 'Water source linked to pipeline' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unlink a water source from a pipeline
router.delete('/pipelines/:pipeline_id/water/:water_id', async (req, res) => {
  try {
    await db.query('DELETE FROM provided_through WHERE pipeline_id = ? AND water_id = ?', [req.params.pipeline_id, req.params.water_id]);
    res.json({ message: 'Water source unlinked from pipeline' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
