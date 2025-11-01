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
    const hospitalId = req.params.hospital_id;
    const [rows] = await db.query(
      "SELECT * FROM Healthcare WHERE hospital_id = ?",
      [hospitalId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Healthcare facility not found" });
    const hospital = rows[0];

    // Fetch doctors that work in this hospital, include optional columns if present
    const [cols] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Doctors' AND COLUMN_NAME IN ('capacity','type')");
    const colNames = (cols || []).map(c => c.COLUMN_NAME.toLowerCase());
    const selectCols = ['d.doctor_id', 'd.name', 'd.specialisation'];
    if (colNames.includes('capacity')) selectCols.push('d.capacity');
    if (colNames.includes('type')) selectCols.push('d.type');

    const doctorSql = `SELECT ${selectCols.join(', ')} FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?`;
    const [doctors] = await db.query(doctorSql, [hospitalId]);

    // Fetch recent bookings made by citizens for this hospital/service (Service_Booking.service_id == hospital_id)
    // Join to Citizen and Users to show citizen name and email when available
    const bookingSql = `
      SELECT b.booking_id, b.citizen_id, b.booking_start, b.booking_end, b.status, b.details, b.priority, b.provider_id, b.service_name_cache, b.service_category_cache, b.created_at,
             c.first_name AS citizen_first_name, c.last_name AS citizen_last_name, u.email AS citizen_email,
             sp.name AS provider_name, d.name AS doctor_name
      FROM Service_Booking b
      LEFT JOIN Citizen c ON b.citizen_id = c.citizen_id
      LEFT JOIN Users u ON u.linked_id = c.citizen_id
      LEFT JOIN Service_Provider sp ON b.provider_id = sp.provider_id
      LEFT JOIN Doctors d ON b.provider_id = d.doctor_id
      WHERE b.service_id = ?
      ORDER BY b.booking_start DESC
    `;
    const [bookings] = await db.query(bookingSql, [hospitalId]);

    res.json({ healthcare: hospital, doctors: doctors || [], bookings: bookings || [] });
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
  // Determine if Doctors table contains optional columns 'capacity' or 'type'
  const [cols] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Doctors' AND COLUMN_NAME IN ('capacity','type')");
  const colNames = (cols || []).map(c => c.COLUMN_NAME.toLowerCase());
  const selectCols = ['d.doctor_id', 'd.name', 'd.specialisation'];
  if (colNames.includes('capacity')) selectCols.push('d.capacity');
  if (colNames.includes('type')) selectCols.push('d.type');

  const sql = `SELECT ${selectCols.join(', ')} FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?`;
  const [rows] = await db.query(sql, [req.params.hospital_id]);
  res.json(rows || []);
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