const express = require("express");
const router = express.Router();
const {db} = require("../db");


// Get all houses
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM House");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get house by ID
router.get("/:house_id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM House WHERE house_id = ?", [
      req.params.house_id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "House not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new house
router.post("/", async (req, res) => {
  const { house_id, type, area, zone_id } = req.body;
  try {
    await db.query(
      "INSERT INTO House (house_id, type, area, zone_id) VALUES (?, ?, ?, ?)",
      [house_id, type, area, zone_id]
    );
    res.json({ message: "House created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update house
router.put("/:house_id", async (req, res) => {
  const { type, area, zone_id } = req.body;
  try {
    await db.query(
      "UPDATE House SET type = ?, area = ?, zone_id = ? WHERE house_id = ?",
      [type, area, zone_id, req.params.house_id]
    );
    res.json({ message: "House updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete house
router.delete("/:house_id", async (req, res) => {
  try {
    await db.query("DELETE FROM House WHERE house_id = ?", [req.params.house_id]);
    res.json({ message: "House deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all citizens in a house using lives_in table
router.get("/:house_id/citizens", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT c.* FROM lives_in l JOIN Citizen c ON l.citizen_id = c.citizen_id WHERE l.house_id = ?",
      [req.params.house_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a citizen to a house using lives_in table
router.post("/:house_id/citizens", async (req, res) => {
  const { error, value } = addCitizenSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  try {
    await db.query("INSERT INTO lives_in (house_id, citizen_id) VALUES (?, ?)", [
      req.params.house_id,
      value.citizen_id,
    ]);
    res.json({ message: "Citizen added to house" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a citizen from a house using lives_in table
router.delete("/:house_id/citizens/:citizen_id", async (req, res) => {
  try {
    await db.query("DELETE FROM lives_in WHERE house_id = ? AND citizen_id = ?", [
      req.params.house_id,
      req.params.citizen_id,
    ]);
    res.json({ message: "Citizen removed from house" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;