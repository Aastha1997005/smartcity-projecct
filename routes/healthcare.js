const express = require("express");
const router = express.Router();
const db = require("../db");
// Get all healthcare facilities
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Healthcare");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get healthcare by ID
router.get("/:hospital_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Healthcare WHERE hospital_id = ?",
      [req.params.hospital_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Healthcare facility not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create healthcare
router.post("/", async (req, res) => {
  const { hospital_id, name, capacity, type } = req.body;
  try {
    await db.query(
      "INSERT INTO Healthcare (hospital_id, name, capacity, type) VALUES (?, ?, ?, ?)",
      [hospital_id, name, capacity, type]
    );
    res.json({ message: "Healthcare facility created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update healthcare
router.put("/:hospital_id", async (req, res) => {
  const { name, capacity, type } = req.body;
  try {
    await db.query(
      "UPDATE Healthcare SET name = ?, capacity = ?, type = ? WHERE hospital_id = ?",
      [name, capacity, type, req.params.hospital_id]
    );
    res.json({ message: "Healthcare facility updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete healthcare
router.delete("/:hospital_id", async (req, res) => {
  try {
    await db.query("DELETE FROM Healthcare WHERE hospital_id = ?", [
      req.params.hospital_id,
    ]);
    res.json({ message: "Healthcare facility deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all doctors in a hospital
router.get("/:hospital_id/doctors", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT d.* FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?",
      [req.params.hospital_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a doctor to a hospital
router.post("/:hospital_id/doctors", async (req, res) => {
  const { error, value } = addDoctorSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  try {
    await db.query("INSERT INTO works_in (doctor_id, hospital_id) VALUES (?, ?)", [
      value.doctor_id,
      req.params.hospital_id,
    ]);
    res.json({ message: "Doctor added to hospital" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove doctor from hospital
router.delete("/:hospital_id/doctors/:doctor_id", async (req, res) => {
  try {
    await db.query("DELETE FROM works_in WHERE doctor_id = ? AND hospital_id = ?", [
      req.params.doctor_id,
      req.params.hospital_id,
    ]);
    res.json({ message: "Doctor removed from hospital" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;