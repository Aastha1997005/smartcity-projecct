const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all citizens in a house using lives_in table
router.get('/:house_id/citizens', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT c.* FROM lives_in l JOIN Citizen c ON l.citizen_id = c.citizen_id WHERE l.house_id = ?',
      [req.params.house_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a citizen to a house using lives_in table
router.post('/:house_id/citizens', async (req, res) => {
  const { citizen_id } = req.body;
  try {
    await db.query('INSERT INTO lives_in (house_id, citizen_id) VALUES (?, ?)', [req.params.house_id, citizen_id]);
    res.json({ message: 'Citizen added to house' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a citizen from a house using lives_in table
router.delete('/:house_id/citizens/:citizen_id', async (req, res) => {
  try {
    await db.query('DELETE FROM lives_in WHERE house_id = ? AND citizen_id = ?', [req.params.house_id, req.params.citizen_id]);
    res.json({ message: 'Citizen removed from house' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
