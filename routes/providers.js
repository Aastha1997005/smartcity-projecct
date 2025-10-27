const express = require("express");
const router = express.Router();
const db = require("../db");
// Get all service providers (department providers)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Service_Provider");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get provider by ID
router.get("/:provider_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Service_Provider WHERE provider_id = ?",
      [req.params.provider_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Provider not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create provider
router.post("/", async (req, res) => {
  const { provider_id, name, contact_no, service_type } = req.body;
  try {
    await db.query(
      "INSERT INTO Service_Provider (provider_id, name, contact_no, service_type) VALUES (?, ?, ?, ?)",
      [provider_id, name, contact_no, service_type]
    );
    res.json({ message: "Provider created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update provider
router.put("/:provider_id", async (req, res) => {
  const { name, contact_no, service_type } = req.body;
  try {
    await db.query(
      "UPDATE Service_Provider SET name = ?, contact_no = ?, service_type = ? WHERE provider_id = ?",
      [name, contact_no, service_type, req.params.provider_id]
    );
    res.json({ message: "Provider updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete provider
router.delete("/:provider_id", async (req, res) => {
  try {
    await db.query("DELETE FROM Service_Provider WHERE provider_id = ?", [
      req.params.provider_id,
    ]);
    res.json({ message: "Provider deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;