const express = require("express");
const router = express.Router();
const {db} = require("../db");
const Joi = require('joi'); // Added Joi import

// Get all smart bins
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Smart_Bin");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get smart bin by ID
router.get("/:bin_id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Smart_Bin WHERE bin_id = ?", [
      req.params.bin_id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Smart bin not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new smart bin
router.post("/", async (req, res) => {
  const {
    bin_id,
    location,
    capacity,
    fill_level,
    sensor_status,
    collection_schedule,
    managing_waste_id,
  } = req.body;
  try {
    await db.query(
      "INSERT INTO Smart_Bin (bin_id, location, capacity, fill_level, sensor_status, collection_schedule, managing_waste_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        bin_id,
        location,
        capacity,
        fill_level,
        sensor_status,
        collection_schedule,
        managing_waste_id,
      ]
    );
    res.json({ message: "Smart bin created", bin_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update smart bin
router.put("/:bin_id", async (req, res) => {
  const {
    location,
    capacity,
    fill_level,
    sensor_status,
    collection_schedule,
    managing_waste_id,
  } = req.body;
  try {
    await db.query(
      "UPDATE Smart_Bin SET location = ?, capacity = ?, fill_level = ?, sensor_status = ?, collection_schedule = ?, managing_waste_id = ? WHERE bin_id = ?",
      [
        location,
        capacity,
        fill_level,
        sensor_status,
        collection_schedule,
        managing_waste_id,
        req.params.bin_id,
      ]
    );
    res.json({ message: "Smart bin updated", bin_id: req.params.bin_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete smart bin
router.delete("/:bin_id", async (req, res) => {
  try {
    await db.query("DELETE FROM Smart_Bin WHERE bin_id = ?", [req.params.bin_id]);
    res.json({ message: "Smart bin deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get the waste management entity for a smart bin
router.get("/:bin_id/waste-management", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT managing_waste_id FROM Smart_Bin WHERE bin_id = ?",
      [req.params.bin_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Smart bin not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const manageWasteSchema = Joi.object({
  managing_waste_id: Joi.number().integer().required(),
});

// Assign a waste management entity to a smart bin
router.put("/:bin_id/waste-management", async (req, res) => {
  const { error, value } = manageWasteSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  try {
    await db.query("UPDATE Smart_Bin SET managing_waste_id = ? WHERE bin_id = ?", [
      value.managing_waste_id,
      req.params.bin_id,
    ]);
    res.json({ message: "Waste management assigned to smart bin" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a waste management entity from a smart bin
router.delete("/:bin_id/waste-management", async (req, res) => {
  try {
    await db.query(
      "UPDATE Smart_Bin SET managing_waste_id = NULL WHERE bin_id = ?",
      [req.params.bin_id]
    );
    res.json({ message: "Waste management removed from smart bin" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;