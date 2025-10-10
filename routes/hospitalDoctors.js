const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all doctors in a hospital
router.get('/hospitals/:hospital_id/doctors', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT d.* FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?', [req.params.hospital_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a doctor to a hospital
router.post('/hospitals/:hospital_id/doctors', async (req, res) => {
  const { doctor_id } = req.body;
  try {
    await db.query('INSERT INTO works_in (doctor_id, hospital_id) VALUES (?, ?)', [doctor_id, req.params.hospital_id]);
    res.json({ message: 'Doctor added to hospital' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove doctor from hospital
router.delete('/hospitals/:hospital_id/doctors/:doctor_id', async (req, res) => {
  try {
    await db.query('DELETE FROM works_in WHERE doctor_id = ? AND hospital_id = ?', [req.params.doctor_id, req.params.hospital_id]);
    res.json({ message: 'Doctor removed from hospital' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
