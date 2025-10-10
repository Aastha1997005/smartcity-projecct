const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all zones
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Zone");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get zone by ID
router.get("/:zone_id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Zone WHERE zone_id = ?", [
      req.params.zone_id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Zone not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new zone
router.post("/", async (req, res) => {
  const { zone_id, zone_name, type } = req.body;
  try {
    await db.query(
      "INSERT INTO Zone (zone_id, zone_name, type) VALUES (?, ?, ?)",
      [zone_id, zone_name, type]
    );
    res.json({ message: "Zone created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update zone
router.put("/:zone_id", async (req, res) => {
  const { zone_name, type } = req.body;
  try {
    await db.query("UPDATE Zone SET zone_name = ?, type = ? WHERE zone_id = ?", [
      zone_name,
      type,
      req.params.zone_id,
    ]);
    res.json({ message: "Zone updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete zone
router.delete("/:zone_id", async (req, res) => {
  try {
    await db.query("DELETE FROM Zone WHERE zone_id = ?", [req.params.zone_id]);
    res.json({ message: "Zone deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all houses in a zone
router.get("/:zone_id/houses", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM House WHERE zone_id = ?", [
      req.params.zone_id,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a house to a zone
router.post("/:zone_id/houses", async (req, res) => {
  const { house_id } = req.body;
  try {
    await db.query("INSERT INTO located_in (house_id, zone_id) VALUES (?, ?)", [
      house_id,
      req.params.zone_id,
    ]);
    res.json({ message: "House added to zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a house from a zone
router.delete("/:zone_id/houses/:house_id", async (req, res) => {
  try {
    await db.query("DELETE FROM located_in WHERE house_id = ? AND zone_id = ?", [
      req.params.house_id,
      req.params.zone_id,
    ]);
    res.json({ message: "House removed from zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all public lights in a zone
router.get("/:zone_id/public-lights", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Public_Light WHERE zone_id = ?",
      [req.params.zone_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;