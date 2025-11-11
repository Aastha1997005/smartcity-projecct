const express = require("express");
const router = express.Router();
const {db} = require("../db");
// Get all infrastructure assets
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Infrastructure");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get asset by ID
router.get("/:asset_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Infrastructure WHERE asset_id = ?",
      [req.params.asset_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Asset not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new asset
router.post("/", async (req, res) => {
  const { asset_id, zone_id } = req.body;
  try {
    await db.query("INSERT INTO Infrastructure (asset_id, zone_id) VALUES (?, ?)", [
      asset_id,
      zone_id,
    ]);
    res.json({ message: "Infrastructure asset created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update asset
router.put("/:asset_id", async (req, res) => {
  const { zone_id } = req.body;
  try {
    await db.query("UPDATE Infrastructure SET zone_id = ? WHERE asset_id = ?", [
      zone_id,
      req.params.asset_id,
    ]);
    res.json({ message: "Infrastructure asset updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete asset
router.delete("/:asset_id", async (req, res) => {
  try {
    await db.query("DELETE FROM Infrastructure WHERE asset_id = ?", [
      req.params.asset_id,
    ]);
    res.json({ message: "Infrastructure asset deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all infrastructure in a zone
router.get("/zones/:zone_id/infrastructure", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Infrastructure WHERE zone_id = ?",
      [req.params.zone_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add infrastructure to a zone
router.post("/zones/:zone_id/infrastructure", async (req, res) => {
  const { asset_id } = req.body;
  try {
    await db.query("UPDATE Infrastructure SET zone_id = ? WHERE asset_id = ?", [
      req.params.zone_id,
      asset_id,
    ]);
    res.json({ message: "Infrastructure added to zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove infrastructure from a zone
router.delete("/zones/:zone_id/infrastructure/:asset_id", async (req, res) => {
  try {
    await db.query(
      "UPDATE Infrastructure SET zone_id = NULL WHERE asset_id = ? AND zone_id = ?",
      [req.params.asset_id, req.params.zone_id]
    );
    res.json({ message: "Infrastructure removed from zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;