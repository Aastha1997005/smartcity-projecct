const express = require("express");
const router = express.Router();
const {db} = require("../db");
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ==================== DIAGNOSTIC TEST ROUTE ====================
router.get("/test", (req, res) => {
  res.send("Utilities test route is working!");
});

// Create a new Utility entry (admin only)
router.post("/", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { utility_id, type, unit, issue_date } = req.body;
  try {
    await db.query(
      "INSERT INTO Utility (utility_id, type, unit, issue_date) VALUES (?, ?, ?, ?)",
      [utility_id, type, unit, issue_date]
    );
    res.json({ message: "Utility created successfully", utility_id });
  } catch (err) {
    console.error('Error creating utility:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * UTILITIES PAGE ROUTES
 * Covers all essential civic services:
 * - Water Supply (pipelines, distribution, quality)
 * - Electricity (power nodes, distribution, sources)
 * - Public Lighting (street lights, status, zones)
 * - Waste Management (smart bins, collection schedules)
 * - Infrastructure (general city assets)
 * - Internet/Connectivity services
 */

// ==================== WATER SUPPLY ====================

// Get all water utilities with pipeline information
router.get("/water", async (req, res) => {
  try {
    const [waterServices] = await db.query(`
      SELECT w.*, u.unit, u.issue_date, s.service_name, s.availability_status, s.operating_hours
      FROM Water w
      JOIN Utility u ON w.water_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      ORDER BY w.water_id
    `);
    
    // Get pipelines for each water service
    for (let water of waterServices) {
      const [pipelines] = await db.query(`
        SELECT p.*
        FROM provided_through pt
        JOIN Pipeline p ON pt.pipeline_id = p.pipeline_id
        WHERE pt.water_id = ?
      `, [water.water_id]);
      
      water.pipelines = pipelines;
      water.pipeline_count = pipelines.length;
    }
    
    res.json(waterServices);
  } catch (err) {
    console.error('Water utilities error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get water supply details by ID
router.get("/water/:water_id", async (req, res) => {
  try {
    const [[water]] = await db.query(`
      SELECT w.*, u.unit, u.issue_date, s.service_name, s.availability_status, s.operating_hours
      FROM Water w
      JOIN Utility u ON w.water_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      WHERE w.water_id = ?
    `, [req.params.water_id]);
    
    if (!water) {
      return res.status(404).json({ error: 'Water service not found' });
    }
    
    // Get associated pipelines
    const [pipelines] = await db.query(`
      SELECT p.*, i.zone_id, z.zone_name
      FROM provided_through pt
      JOIN Pipeline p ON pt.pipeline_id = p.pipeline_id
      JOIN Infrastructure i ON p.pipeline_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE pt.water_id = ?
    `, [req.params.water_id]);
    
    res.json({
      water,
      pipelines,
      statistics: {
        pipelineCount: pipelines.length,
        totalLength: pipelines.reduce((sum, p) => sum + (parseFloat(p.length) || 0), 0),
        source: water.source,
        qualityLevel: water.quality_level
      }
    });
  } catch (err) {
    console.error('Water detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all pipelines
router.get("/pipelines", async (req, res) => {
  try {
    const [pipelines] = await db.query(`
      SELECT p.*, i.zone_id, z.zone_name, z.type as zone_type
      FROM Pipeline p
      JOIN Infrastructure i ON p.pipeline_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      ORDER BY p.pipeline_id
    `);
    
    res.json(pipelines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ELECTRICITY ====================

// Get all electricity utilities
router.get("/electricity", async (req, res) => {
  try {
    const [electricServices] = await db.query(`
      SELECT e.*, u.unit, u.issue_date, s.service_name, s.availability_status
      FROM Electricity e
      JOIN Utility u ON e.electricity_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      ORDER BY e.electricity_id
    `);
    
    // Get power nodes for each electricity service
    for (let electric of electricServices) {
      const [powerNodes] = await db.query(`
        SELECT pn.*
        FROM provided_by pb
        JOIN Powernodes pn ON pb.node_id = pn.node_id
        WHERE pb.electricity_id = ?
      `, [electric.electricity_id]);
      
      electric.powerNodes = powerNodes;
      electric.powerNodeCount = powerNodes.length;
    }
    
    res.json(electricServices);
  } catch (err) {
    console.error('Electricity utilities error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get electricity details by ID
router.get("/electricity/:electricity_id", async (req, res) => {
  try {
    const [[electric]] = await db.query(`
      SELECT e.*, u.unit, u.issue_date, s.service_name, s.availability_status
      FROM Electricity e
      JOIN Utility u ON e.electricity_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      WHERE e.electricity_id = ?
    `, [req.params.electricity_id]);
    
    if (!electric) {
      return res.status(404).json({ error: 'Electricity service not found' });
    }
    
    // Get power nodes
    const [powerNodes] = await db.query(`
      SELECT pn.*, i.zone_id, z.zone_name
      FROM provided_by pb
      JOIN Powernodes pn ON pb.node_id = pn.node_id
      JOIN Infrastructure i ON pn.node_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE pb.electricity_id = ?
    `, [req.params.electricity_id]);
    
    res.json({
      electric,
      powerNodes,
      statistics: {
        nodeCount: powerNodes.length,
        voltageLevel: electric.voltage_level,
        sourceType: electric.source_type,
        distributionArea: electric.distribution_area
      }
    });
  } catch (err) {
    console.error('Electricity detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all power nodes
router.get("/powernodes", async (req, res) => {
  try {
    const [powerNodes] = await db.query(`
      SELECT pn.*, i.zone_id, z.zone_name, z.type as zone_type
      FROM Powernodes pn
      JOIN Infrastructure i ON pn.node_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      ORDER BY pn.node_id
    `);
    
    res.json(powerNodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PUBLIC LIGHTING ====================

// Get all public lights with zone information
router.get("/public-lights", async (req, res) => {
  try {
    const { status, zone_id } = req.query;
    
    let sql = `
      SELECT pl.*, i.zone_id, z.zone_name, z.type as zone_type
      FROM Public_Light pl
      JOIN Infrastructure i ON pl.light_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND pl.status = ?';
      params.push(status);
    }
    if (zone_id) {
      sql += ' AND i.zone_id = ?';
      params.push(zone_id);
    }
    
    sql += ' ORDER BY z.zone_name, pl.location';
    
    const [lights] = await db.query(sql, params);
    
    // Get status summary
    const [statusSummary] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM Public_Light
      GROUP BY status
    `);
    
    res.json({
      lights,
      statusSummary,
      total: lights.length
    });
  } catch (err) {
    console.error('Public lights error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get public light details by ID
router.get("/public-lights/:light_id", async (req, res) => {
  try {
    const [[light]] = await db.query(`
      SELECT pl.*, i.zone_id, z.zone_name, z.type as zone_type
      FROM Public_Light pl
      JOIN Infrastructure i ON pl.light_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE pl.light_id = ?
    `, [req.params.light_id]);
    
    if (!light) {
      return res.status(404).json({ error: 'Public light not found' });
    }
    
    // Get maintenance history from Maintenance_Task
    const [maintenance] = await db.query(`
      SELECT *
      FROM Maintenance_Task
      WHERE asset_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.params.light_id]);
    
    res.json({
      light,
      maintenanceHistory: maintenance
    });
  } catch (err) {
    console.error('Public light detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update public light status
router.put("/public-lights/:light_id/status", authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Active', 'Inactive', 'Under Maintenance', 'Faulty'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.query(
      'UPDATE Public_Light SET status = ? WHERE light_id = ?',
      [status, req.params.light_id]
    );
    
    res.json({ message: 'Public light status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== WASTE MANAGEMENT ====================

// Get all waste management services with smart bins
router.get("/waste", async (req, res) => {
  try {
    const [wasteServices] = await db.query(`
      SELECT wm.*, u.unit, u.issue_date, z.zone_name
      FROM Waste_Management wm
      JOIN Utility u ON wm.waste_id = u.utility_id
      LEFT JOIN Zone z ON wm.zone_id = z.zone_id
      ORDER BY wm.waste_id
    `);
    
    // Get smart bins for each waste service
    for (let waste of wasteServices) {
      const [bins] = await db.query(`
        SELECT sb.*, i.zone_id, z.zone_name
        FROM Smart_Bin sb
        JOIN Infrastructure i ON sb.bin_id = i.asset_id
        LEFT JOIN Zone z ON i.zone_id = z.zone_id
        WHERE sb.managing_waste_id = ?
      `, [waste.waste_id]);
      
      waste.smartBins = bins;
      waste.binCount = bins.length;
    }
    
    res.json(wasteServices);
  } catch (err) {
    console.error('Waste management error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all smart bins with fill levels
router.get("/smart-bins", async (req, res) => {
  try {
    const { zone_id, fill_level_above } = req.query;
    
    let sql = `
      SELECT sb.*, i.zone_id, z.zone_name, z.type as zone_type, wm.collection_schedule
      FROM Smart_Bin sb
      JOIN Infrastructure i ON sb.bin_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      LEFT JOIN Waste_Management wm ON sb.managing_waste_id = wm.waste_id
      WHERE 1=1
    `;
    const params = [];
    
    if (zone_id) {
      sql += ' AND i.zone_id = ?';
      params.push(zone_id);
    }
    if (fill_level_above) {
      sql += ' AND sb.fill_level >= ?';
      params.push(fill_level_above);
    }
    
    sql += ' ORDER BY sb.fill_level DESC, z.zone_name';
    
    const [bins] = await db.query(sql, params);
    
    // Calculate statistics
    const stats = {
      total: bins.length,
      needingCollection: bins.filter(b => (b.fill_level || 0) >= 80).length,
      averageFillLevel: bins.reduce((sum, b) => sum + (parseFloat(b.fill_level) || 0), 0) / bins.length
    };
    
    res.json(bins); // Return just the bins for the frontend table
  } catch (err) {
    console.error('Smart bins error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get smart bin details by ID
router.get("/smart-bins/:bin_id", async (req, res) => {
  try {
    const [[bin]] = await db.query(`
      SELECT sb.*, i.zone_id, z.zone_name, z.type as zone_type, wm.collection_schedule
      FROM Smart_Bin sb
      JOIN Infrastructure i ON sb.bin_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      LEFT JOIN Waste_Management wm ON sb.managing_waste_id = wm.waste_id
      WHERE sb.bin_id = ?
    `, [req.params.bin_id]);
    
    if (!bin) {
      return res.status(404).json({ error: 'Smart bin not found' });
    }
    
    res.json(bin);
  } catch (err) {
    console.error('Smart bin detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update smart bin fill level (sensor data)
router.put("/smart-bins/:bin_id/fill-level", authenticateToken, async (req, res) => {
  try {
    const { fill_level } = req.body;
    
    if (fill_level < 0 || fill_level > 100) {
      return res.status(400).json({ error: 'Fill level must be between 0 and 100' });
    }
    
    await db.query(
      'UPDATE Smart_Bin SET fill_level = ? WHERE bin_id = ?',
      [fill_level, req.params.bin_id]
    );
    
    // Create alert if fill level is high
    if (fill_level >= 85) {
      // The Alerts table is dropped in newDB.txt, so this is commented out.
      // console.warn('Alerts table not found. Skipping alert insertion.');
    }
    
    res.json({ message: 'Fill level updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==================== INTERNET/CONNECTIVITY ====================

// Get all internet services
router.get("/internet", async (req, res) => {
  console.log("Accessed /internet route");
  try {
    const [internetServices] = await db.query(`
      SELECT 
        i.internet_id,
        i.provider_name,
        i.bandwidth AS speed_mbps,
        '99.9' AS uptime_percentage,
        s.availability_status,
        z.zone_name as zone_name,
        s.service_name,
        s.operating_hours,
        u.unit,
        u.issue_date
      FROM Internet i
      JOIN Utility u ON i.internet_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN Infrastructure infra ON i.internet_id = infra.asset_id
      LEFT JOIN Zone z ON infra.zone_id = z.zone_id
      ORDER BY i.internet_id
    `);
    
    res.json(internetServices);
  } catch (err) {
    console.error('Internet services error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get internet service details
router.get("/internet/:internet_id", async (req, res) => {
  try {
    const [[internet]] = await db.query(`
      SELECT i.*, u.unit, u.issue_date, s.service_name, s.availability_status, s.operating_hours
      FROM Internet i
      JOIN Utility u ON i.internet_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      WHERE i.internet_id = ?
    `, [req.params.internet_id]);
    
    if (!internet) {
      return res.status(404).json({ error: 'Internet service not found' });
    }
    
    res.json({ internet });
  } catch (err) {
    console.error('Internet detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== FUEL ====================

// Get all fuel utilities
router.get("/fuel", async (req, res) => {
  try {
    const [fuelServices] = await db.query(`
      SELECT f.*, u.unit, u.issue_date, p.name as provider_name
      FROM Fuel f
      JOIN Utility u ON f.fuel_id = u.utility_id
      LEFT JOIN Service_Provider p ON f.provider_id = p.provider_id
      ORDER BY f.fuel_id
    `);
    
    res.json(fuelServices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get fuel utility details by ID
router.get("/fuel/:fuel_id", async (req, res) => {
  try {
    const [[fuel]] = await db.query(`
      SELECT f.*, u.unit, u.issue_date, p.name as provider_name
      FROM Fuel f
      JOIN Utility u ON f.fuel_id = u.utility_id
      LEFT JOIN Service_Provider p ON f.provider_id = p.provider_id
      WHERE f.fuel_id = ?
    `, [req.params.fuel_id]);
    
    if (!fuel) {
      return res.status(404).json({ error: 'Fuel service not found' });
    }
    
    res.json(fuel);
  } catch (err) {
    console.error('Fuel detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GENERAL INFRASTRUCTURE ====================

// Get infrastructure overview by type
router.get("/infrastructure/overview", async (req, res) => {
  try {
    // Count each infrastructure type
    const [[lights]] = await db.query('SELECT COUNT(*) as count FROM Public_Light');
    const [[pipelines]] = await db.query('SELECT COUNT(*) as count FROM Pipeline');
    const [[powerNodes]] = await db.query('SELECT COUNT(*) as count FROM Powernodes');
    const [[bins]] = await db.query('SELECT COUNT(*) as count FROM Smart_Bin');
    const [[sensors]] = await db.query('SELECT COUNT(*) as count FROM Sensors');
    const [[networks]] = await db.query('SELECT COUNT(*) as count FROM Internet');
    const [[fuelStations]] = await db.query('SELECT COUNT(*) as count FROM Fuel');
    const [[waters]] = await db.query('SELECT COUNT(*) as count FROM Water');
    
    // Get maintenance statistics, trying both singular and plural table names
    let maintenanceStats;
    const [stats] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM Maintenance_Task
      GROUP BY status
    `);
    maintenanceStats = stats;
    
    // The Alerts table is dropped in newDB.txt, so this query is removed.
    const alertStats = [];
    
    res.json({
      infrastructure: {
        lightCount: lights.count,
        pipelineCount: pipelines.count,
        powerNodeCount: powerNodes.count,
        binCount: bins.count,
        sensorCount: sensors.count,
        networkCount: networks.count,
        fuelStationCount: fuelStations.count,
        waterCount: waters.count
      },
      maintenance: maintenanceStats,
      alerts: alertStats
    });
  } catch (err) {
    console.error('Infrastructure overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get infrastructure by zone
router.get("/infrastructure/by-zone/:zone_id", async (req, res) => {
  try {
    const [infrastructure] = await db.query(`
      SELECT i.asset_id, 
             CASE
               WHEN pl.light_id IS NOT NULL THEN 'Public Light'
               WHEN p.pipeline_id IS NOT NULL THEN 'Pipeline'
               WHEN pn.node_id IS NOT NULL THEN 'Power Node'
               WHEN sb.bin_id IS NOT NULL THEN 'Smart Bin'
               WHEN s.sensor_id IS NOT NULL THEN 'Sensor'
               ELSE 'Other'
             END as type,
             z.zone_name
      FROM Infrastructure i
      LEFT JOIN Public_Light pl ON i.asset_id = pl.light_id
      LEFT JOIN Pipeline p ON i.asset_id = p.pipeline_id
      LEFT JOIN Powernodes pn ON i.asset_id = pn.node_id
      LEFT JOIN Smart_Bin sb ON i.asset_id = sb.bin_id
      LEFT JOIN Sensors s ON i.asset_id = s.sensor_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE i.zone_id = ?
    `, [req.params.zone_id]);
    
    res.json(infrastructure);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;