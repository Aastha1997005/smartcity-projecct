const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all zones
router.get("/", async (req, res) => {
  try {
    const { include_stats } = req.query;
    
    let query = "SELECT * FROM Zone ORDER BY zone_name";
    const [zones] = await db.query(query);
    
    if (include_stats === 'true') {
      // Enrich each zone with detailed statistics
      for (let zone of zones) {
        // Count houses
        const [[houseCount]] = await db.query(
          'SELECT COUNT(*) as count FROM House WHERE zone_id = ?',
          [zone.zone_id]
        );
        
        // Count citizens (through houses)
        const [[citizenCount]] = await db.query(
          `SELECT COUNT(DISTINCT c.citizen_id) as count 
           FROM Citizen c 
           JOIN House h ON c.house_id = h.house_id 
           WHERE h.zone_id = ?`,
          [zone.zone_id]
        );
        
        // Count infrastructure assets
        const [[infraCount]] = await db.query(
          'SELECT COUNT(*) as count FROM Infrastructure WHERE zone_id = ?',
          [zone.zone_id]
        );
        
        // Count public lights
        const [[lightCount]] = await db.query(
          `SELECT COUNT(*) as count FROM Public_Light pl 
           JOIN Infrastructure i ON pl.light_id = i.asset_id 
           WHERE i.zone_id = ?`,
          [zone.zone_id]
        );
        
        // Count smart bins
        const [[binCount]] = await db.query(
          `SELECT COUNT(*) as count FROM Smart_Bin sb 
           JOIN Infrastructure i ON sb.bin_id = i.asset_id 
           WHERE i.zone_id = ?`,
          [zone.zone_id]
        );
        
        // Count sensors
        const [[sensorCount]] = await db.query(
          `SELECT COUNT(*) as count FROM Sensors s 
           JOIN Infrastructure i ON s.sensor_id = i.asset_id 
           WHERE i.zone_id = ?`,
          [zone.zone_id]
        );

        // Count pipelines
        const [[pipelineCount]] = await db.query(
          `SELECT COUNT(*) as count FROM Pipeline p
           JOIN Infrastructure i ON p.pipeline_id = i.asset_id 
           WHERE i.zone_id = ?`,
          [zone.zone_id]
        );

        // Count power nodes
        const [[powerNodeCount]] = await db.query(
          `SELECT COUNT(*) as count FROM Powernodes pn
           JOIN Infrastructure i ON pn.node_id = i.asset_id 
           WHERE i.zone_id = ?`,
          [zone.zone_id]
        );
        
        // Get waste management info
        const [[wasteInfo]] = await db.query(
          `SELECT waste_id, type, collection_schedule 
           FROM Waste_Management WHERE zone_id = ? LIMIT 1`,
          [zone.zone_id]
        );
        
        zone.statistics = {
          houses: houseCount.count,
          citizens: citizenCount.count,
          infrastructure: infraCount.count,
          publicLights: lightCount.count,
          smartBins: binCount.count,
          sensors: sensorCount.count,
          pipelines: pipelineCount.count,
          powerNodes: powerNodeCount.count,
          hasWasteManagement: !!wasteInfo
        };
      }
    }
    
    res.json(zones);

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