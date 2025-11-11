const express = require('express');
const router = express.Router();
const {db} = require('../db');

// Get all pipelines
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Pipeline');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pipeline by ID
router.get('/:pipeline_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Pipeline WHERE pipeline_id = ?', [req.params.pipeline_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pipeline not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new pipeline
router.post('/', async (req, res) => {
  const { pipeline_id, length, diameter, flow_type, material_type } = req.body;
  try {
    await db.query('INSERT INTO Pipeline (pipeline_id, length, diameter, flow_type, material_type) VALUES (?, ?, ?, ?, ?)', [pipeline_id, length, diameter, flow_type, material_type]);
    res.json({ message: 'Pipeline created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update pipeline
router.put('/:pipeline_id', async (req, res) => {
  const { length, diameter, flow_type, material_type } = req.body;
  try {
    await db.query('UPDATE Pipeline SET length = ?, diameter = ?, flow_type = ?, material_type = ? WHERE pipeline_id = ?', [length, diameter, flow_type, material_type, req.params.pipeline_id]);
    res.json({ message: 'Pipeline updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete pipeline
router.delete('/:pipeline_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Pipeline WHERE pipeline_id = ?', [req.params.pipeline_id]);
    res.json({ message: 'Pipeline deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
