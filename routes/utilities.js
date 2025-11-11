const express = require("express");
const router = express.Router();
const {db} = require("../db");

// Get all utilities
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Utility');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get utility by ID
router.get('/:utility_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Utility WHERE utility_id = ?', [req.params.utility_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utility not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new utility
router.post('/', async (req, res) => {
  const { utility_id, price_per_unit, unit, issue_date, consumption_amount } = req.body;
  try {
    await db.query('INSERT INTO Utility (utility_id, price_per_unit, unit, issue_date, consumption_amount) VALUES (?, ?, ?, ?, ?)', [utility_id, price_per_unit, unit, issue_date, consumption_amount]);
    res.json({ message: 'Utility record added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a utility
router.put('/:utility_id', async (req, res) => {
  const { price_per_unit, unit, issue_date, consumption_amount } = req.body;
  try {
    await db.query('UPDATE Utility SET price_per_unit = ?, unit = ?, issue_date = ?, consumption_amount = ? WHERE utility_id = ?', [price_per_unit, unit, issue_date, consumption_amount, req.params.utility_id]);
    res.json({ message: 'Utility updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a utility
router.delete('/:utility_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Utility WHERE utility_id = ?', [req.params.utility_id]);
    res.json({ message: 'Utility deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all internet utilities
router.get('/internet/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Internet');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all water utilities
router.get('/water/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Water');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forwarding endpoints: expose pipeline routes under utilities/water/pipelines
// These call the same DB queries as routes/pipelines.js but are namespaced under utilities/water
router.get('/water/pipelines', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Pipeline');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/water/pipelines/:pipeline_id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Pipeline WHERE pipeline_id = ?', [req.params.pipeline_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pipeline not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/water/pipelines', async (req, res) => {
  const { pipeline_id, length, diameter, flow_type, material_type } = req.body;
  try {
    await db.query('INSERT INTO Pipeline (pipeline_id, length, diameter, flow_type, material_type) VALUES (?, ?, ?, ?, ?)', [pipeline_id, length, diameter, flow_type, material_type]);
    res.json({ message: 'Pipeline created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/water/pipelines/:pipeline_id', async (req, res) => {
  const { length, diameter, flow_type, material_type } = req.body;
  try {
    await db.query('UPDATE Pipeline SET length = ?, diameter = ?, flow_type = ?, material_type = ? WHERE pipeline_id = ?', [length, diameter, flow_type, material_type, req.params.pipeline_id]);
    res.json({ message: 'Pipeline updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/water/pipelines/:pipeline_id', async (req, res) => {
  try {
    await db.query('DELETE FROM Pipeline WHERE pipeline_id = ?', [req.params.pipeline_id]);
    res.json({ message: 'Pipeline deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all fuel utilities
router.get('/fuel/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Fuel');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all electricity utilities
router.get('/electricity/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Electricity');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all waste management utilities
router.get('/waste/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Waste_Management');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new utility
router.post("/", async (req, res) => {
  const {
    utility_id,
    price_per_unit,
    unit,
    issue_date,
    consumption_amount
  } = req.body;
  try {
    await db.query(
      `INSERT INTO Utility (utility_id, price_per_unit, unit, issue_date, consumption_amount)
      VALUES (?, ?, ?, ?, ?)`,
      [utility_id, price_per_unit, unit, issue_date, consumption_amount]
    );
    res.json({ message: "Utility record added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;