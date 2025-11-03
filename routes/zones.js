const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

/**
 * COMPREHENSIVE ZONES MANAGEMENT ROUTES
 * Complete zone operations including:
 * - Zone CRUD with validation
 * - Infrastructure management per zone
 * - Houses and citizens in zones
 * - Services operating in zones
 * - Statistical analytics per zone
 * - Zone comparison and reports
 * - Smart city resource allocation
 */

// ==================== ZONE CRUD OPERATIONS ====================

// Get all zones with comprehensive statistics
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
          hasWasteManagement: !!wasteInfo
        };
      }
    }
    
    res.json(zones);
  } catch (err) {
    console.error('Zones list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get zone by ID with complete details
router.get("/:zone_id", async (req, res) => {
  try {
    const [[zone]] = await db.query(
      "SELECT * FROM Zone WHERE zone_id = ?",
      [req.params.zone_id]
    );
    
    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    
    // Get all houses in zone
    const [houses] = await db.query(
      `SELECT h.*, COUNT(DISTINCT c.citizen_id) as resident_count 
       FROM House h 
       LEFT JOIN Citizen c ON h.house_id = c.house_id 
       WHERE h.zone_id = ? 
       GROUP BY h.house_id`,
      [req.params.zone_id]
    );
    
    // Get all infrastructure assets
    const [infrastructure] = await db.query(
      `SELECT i.asset_id, 
       CASE
         WHEN pl.light_id IS NOT NULL THEN 'Public Light'
         WHEN p.pipeline_id IS NOT NULL THEN 'Pipeline'
         WHEN pn.node_id IS NOT NULL THEN 'Power Node'
         WHEN sb.bin_id IS NOT NULL THEN 'Smart Bin'
         WHEN s.sensor_id IS NOT NULL THEN 'Sensor'
         ELSE 'General Infrastructure'
       END as asset_type,
       COALESCE(pl.location, p.flow_type, pn.capacity, sb.location, s.location, 'N/A') as details,
       COALESCE(pl.status, pn.status, sb.sensor_status, s.status, 'Active') as status
       FROM Infrastructure i
       LEFT JOIN Public_Light pl ON i.asset_id = pl.light_id
       LEFT JOIN Pipeline p ON i.asset_id = p.pipeline_id
       LEFT JOIN Powernodes pn ON i.asset_id = pn.node_id
       LEFT JOIN Smart_Bin sb ON i.asset_id = sb.bin_id
       LEFT JOIN Sensors s ON i.asset_id = s.sensor_id
       WHERE i.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get public lights specifically
    const [publicLights] = await db.query(
      `SELECT pl.* FROM Public_Light pl 
       JOIN Infrastructure i ON pl.light_id = i.asset_id 
       WHERE i.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get smart bins
    const [smartBins] = await db.query(
      `SELECT sb.* FROM Smart_Bin sb 
       JOIN Infrastructure i ON sb.bin_id = i.asset_id 
       WHERE i.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get sensors
    const [sensors] = await db.query(
      `SELECT s.*, 
       CASE
         WHEN ts.sensor_id IS NOT NULL THEN 'Traffic'
         WHEN aqs.sensor_id IS NOT NULL THEN 'Air Quality'
         WHEN ws.sensor_id IS NOT NULL THEN 'Weather'
         ELSE 'General'
       END as sensor_type
       FROM Sensors s
       LEFT JOIN Traffic_Sensors ts ON s.sensor_id = ts.sensor_id
       LEFT JOIN Air_Quality_Sensors aqs ON s.sensor_id = aqs.sensor_id
       LEFT JOIN Weather_Sensors ws ON s.sensor_id = ws.sensor_id
       JOIN Infrastructure i ON s.sensor_id = i.asset_id
       WHERE i.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get citizens in this zone
    const [citizens] = await db.query(
      `SELECT c.citizen_id, c.first_name, c.last_name, c.street, c.area, 
              c.gender, c.dob, h.house_id, h.type as house_type
       FROM Citizen c
       JOIN House h ON c.house_id = h.house_id
       WHERE h.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get waste management info
    const [wasteManagement] = await db.query(
      `SELECT wm.*, u.unit, u.issue_date 
       FROM Waste_Management wm
       JOIN Utility u ON wm.waste_id = u.utility_id
       WHERE wm.zone_id = ?`,
      [req.params.zone_id]
    );
    
    // Get recent alerts for this zone
    const [alerts] = await db.query(
      `SELECT a.* FROM Alerts a
       JOIN Infrastructure i ON a.asset_id = i.asset_id
       WHERE i.zone_id = ? AND a.acknowledged = 0
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [req.params.zone_id]
    );
    
    // Get maintenance tasks for this zone
    const [maintenanceTasks] = await db.query(
      `SELECT mt.* FROM Maintenance_Task mt
       JOIN Infrastructure i ON mt.asset_id = i.asset_id
       WHERE i.zone_id = ? AND mt.status IN ('Scheduled', 'In Progress')
       ORDER BY mt.scheduled_date DESC
       LIMIT 20`,
      [req.params.zone_id]
    );
    
    // Calculate statistics
    const statistics = {
      totalHouses: houses.length,
      totalCitizens: citizens.length,
      totalInfrastructure: infrastructure.length,
      publicLights: {
        total: publicLights.length,
        active: publicLights.filter(l => l.status === 'Active').length,
        faulty: publicLights.filter(l => l.status === 'Faulty').length
      },
      smartBins: {
        total: smartBins.length,
        needsCollection: smartBins.filter(b => b.fill_level >= 80).length,
        averageFillLevel: smartBins.length > 0 
          ? smartBins.reduce((sum, b) => sum + (parseFloat(b.fill_level) || 0), 0) / smartBins.length 
          : 0
      },
      sensors: {
        total: sensors.length,
        active: sensors.filter(s => s.status === 'Active').length
      },
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length
      },
      maintenance: {
        scheduled: maintenanceTasks.filter(t => t.status === 'Scheduled').length,
        inProgress: maintenanceTasks.filter(t => t.status === 'In Progress').length
      }
    };
    
    res.json({
      zone,
      houses,
      citizens,
      infrastructure,
      publicLights,
      smartBins,
      sensors,
      wasteManagement,
      alerts,
      maintenanceTasks,
      statistics
    });
  } catch (err) {
    console.error('Zone detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new zone
router.post("/", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { zone_name, type } = req.body;
  
  // Validation
  if (!zone_name || !type) {
    return res.status(400).json({ error: "zone_name and type are required" });
  }
  
  if (zone_name.length < 2 || zone_name.length > 255) {
    return res.status(400).json({ error: "zone_name must be between 2 and 255 characters" });
  }
  
  const validTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed-Use', 'Heritage', 'Agricultural', 'Institutional'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ 
      error: `Invalid zone type. Must be one of: ${validTypes.join(', ')}` 
    });
  }
  
  try {
    // Check for duplicate zone name
    const [[existing]] = await db.query(
      'SELECT zone_id FROM Zone WHERE zone_name = ?',
      [zone_name]
    );
    
    if (existing) {
      return res.status(409).json({ error: "Zone with this name already exists" });
    }
    
    const [result] = await db.query(
      "INSERT INTO Zone (zone_name, type) VALUES (?, ?)",
      [zone_name, type]
    );
    
    // Log audit action
    if (req.user && req.user.id) {
      try {
        await db.query(
          'INSERT INTO AuditLog (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
          [req.user.id, 'CREATE', 'Zone', JSON.stringify({ zone_name, type })]
        );
      } catch (e) {
        console.error('Audit log error:', e);
      }
    }
    
    res.status(201).json({ 
      message: "Zone created successfully",
      zone_id: result.insertId 
    });
  } catch (err) {
    console.error('Zone creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update zone
router.put("/:zone_id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { zone_name, type } = req.body;
  
  if (!zone_name && !type) {
    return res.status(400).json({ error: "At least one field (zone_name or type) is required" });
  }
  
  try {
    // Check if zone exists
    const [[zone]] = await db.query(
      'SELECT * FROM Zone WHERE zone_id = ?',
      [req.params.zone_id]
    );
    
    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    
    const updates = [];
    const params = [];
    
    if (zone_name) {
      // Check for duplicate name
      const [[duplicate]] = await db.query(
        'SELECT zone_id FROM Zone WHERE zone_name = ? AND zone_id != ?',
        [zone_name, req.params.zone_id]
      );
      
      if (duplicate) {
        return res.status(409).json({ error: "Another zone with this name already exists" });
      }
      
      updates.push('zone_name = ?');
      params.push(zone_name);
    }
    
    if (type) {
      const validTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed-Use', 'Heritage', 'Agricultural', 'Institutional'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ 
          error: `Invalid zone type. Must be one of: ${validTypes.join(', ')}` 
        });
      }
      updates.push('type = ?');
      params.push(type);
    }
    
    params.push(req.params.zone_id);
    
    await db.query(
      `UPDATE Zone SET ${updates.join(', ')} WHERE zone_id = ?`,
      params
    );
    
    // Log audit action
    if (req.user && req.user.id) {
      try {
        await db.query(
          'INSERT INTO AuditLog (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
          [req.user.id, 'UPDATE', 'Zone', JSON.stringify({ zone_id: req.params.zone_id, zone_name, type })]
        );
      } catch (e) {
        console.error('Audit log error:', e);
      }
    }
    
    res.json({ message: "Zone updated successfully" });
  } catch (err) {
    console.error('Zone update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete zone (with cascade checks)
router.delete("/:zone_id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    // Check if zone exists
    const [[zone]] = await db.query(
      'SELECT * FROM Zone WHERE zone_id = ?',
      [req.params.zone_id]
    );
    
    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    
    // Check dependencies
    const [[houseCount]] = await db.query(
      'SELECT COUNT(*) as count FROM House WHERE zone_id = ?',
      [req.params.zone_id]
    );
    
    const [[infraCount]] = await db.query(
      'SELECT COUNT(*) as count FROM Infrastructure WHERE zone_id = ?',
      [req.params.zone_id]
    );
    
    const [[wasteCount]] = await db.query(
      'SELECT COUNT(*) as count FROM Waste_Management WHERE zone_id = ?',
      [req.params.zone_id]
    );
    
    if (houseCount.count > 0 || infraCount.count > 0 || wasteCount.count > 0) {
      return res.status(409).json({ 
        error: "Cannot delete zone with existing dependencies",
        dependencies: {
          houses: houseCount.count,
          infrastructure: infraCount.count,
          wasteManagement: wasteCount.count
        }
      });
    }
    
    await db.query("DELETE FROM Zone WHERE zone_id = ?", [req.params.zone_id]);
    
    // Log audit action
    if (req.user && req.user.id) {
      try {
        await db.query(
          'INSERT INTO AuditLog (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
          [req.user.id, 'DELETE', 'Zone', JSON.stringify({ zone_id: req.params.zone_id, zone_name: zone.zone_name })]
        );
      } catch (e) {
        console.error('Audit log error:', e);
      }
    }
    
    res.json({ message: "Zone deleted successfully" });
  } catch (err) {
    console.error('Zone deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== HOUSES IN ZONE ====================

// Get all houses in a zone with details
router.get("/:zone_id/houses", async (req, res) => {
  try {
    const [houses] = await db.query(
      `SELECT h.*, COUNT(DISTINCT c.citizen_id) as resident_count
       FROM House h
       LEFT JOIN Citizen c ON h.house_id = c.house_id
       WHERE h.zone_id = ?
       GROUP BY h.house_id`,
      [req.params.zone_id]
    );
    
    res.json(houses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a house to a zone
router.post("/:zone_id/houses", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { type, area } = req.body;
  
  if (!type || !area) {
    return res.status(400).json({ error: "type and area are required" });
  }
  
  try {
    const [result] = await db.query(
      "INSERT INTO House (type, area, zone_id) VALUES (?, ?, ?)",
      [type, area, req.params.zone_id]
    );
    
    res.status(201).json({ 
      message: "House added to zone",
      house_id: result.insertId 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a house from a zone (set zone_id to NULL)
router.delete("/:zone_id/houses/:house_id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    await db.query(
      "UPDATE House SET zone_id = NULL WHERE house_id = ? AND zone_id = ?",
      [req.params.house_id, req.params.zone_id]
    );
    
    res.json({ message: "House removed from zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CITIZENS IN ZONE ====================

// Get all citizens in a zone
router.get("/:zone_id/citizens", async (req, res) => {
  try {
    const [citizens] = await db.query(
      `SELECT c.*, h.house_id, h.type as house_type, h.area as house_area
       FROM Citizen c
       JOIN House h ON c.house_id = h.house_id
       WHERE h.zone_id = ?
       ORDER BY c.last_name, c.first_name`,
      [req.params.zone_id]
    );
    
    res.json(citizens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== INFRASTRUCTURE IN ZONE ====================

// Get all infrastructure in a zone
router.get("/:zone_id/infrastructure", async (req, res) => {
  try {
    const { asset_type } = req.query;
    
    let sql = `
      SELECT i.asset_id, 
       CASE
         WHEN pl.light_id IS NOT NULL THEN 'Public Light'
         WHEN p.pipeline_id IS NOT NULL THEN 'Pipeline'
         WHEN pn.node_id IS NOT NULL THEN 'Power Node'
         WHEN sb.bin_id IS NOT NULL THEN 'Smart Bin'
         WHEN s.sensor_id IS NOT NULL THEN 'Sensor'
         ELSE 'General Infrastructure'
       END as asset_type,
       pl.location as light_location, pl.status as light_status, pl.type as light_type,
       p.length as pipeline_length, p.diameter as pipeline_diameter, p.flow_type,
       pn.capacity as node_capacity, pn.status as node_status,
       sb.location as bin_location, sb.fill_level, sb.capacity as bin_capacity,
       s.location as sensor_location, s.status as sensor_status
       FROM Infrastructure i
       LEFT JOIN Public_Light pl ON i.asset_id = pl.light_id
       LEFT JOIN Pipeline p ON i.asset_id = p.pipeline_id
       LEFT JOIN Powernodes pn ON i.asset_id = pn.node_id
       LEFT JOIN Smart_Bin sb ON i.asset_id = sb.bin_id
       LEFT JOIN Sensors s ON i.asset_id = s.sensor_id
       WHERE i.zone_id = ?
    `;
    
    const params = [req.params.zone_id];
    
    if (asset_type) {
      sql += ` HAVING asset_type = ?`;
      params.push(asset_type);
    }
    
    const [infrastructure] = await db.query(sql, params);
    
    res.json(infrastructure);
  } catch (err) {
    console.error('Zone infrastructure error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add infrastructure to a zone
router.post("/:zone_id/infrastructure", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { asset_id } = req.body;
  
  if (!asset_id) {
    return res.status(400).json({ error: "asset_id is required" });
  }
  
  try {
    await db.query(
      "UPDATE Infrastructure SET zone_id = ? WHERE asset_id = ?",
      [req.params.zone_id, asset_id]
    );
    
    res.json({ message: "Infrastructure added to zone" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove infrastructure from a zone
router.delete("/:zone_id/infrastructure/:asset_id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
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

// ==================== PUBLIC LIGHTS IN ZONE ====================

// Get all public lights in a zone
router.get("/:zone_id/public-lights", async (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT pl.* 
      FROM Public_Light pl
      JOIN Infrastructure i ON pl.light_id = i.asset_id
      WHERE i.zone_id = ?
    `;
    const params = [req.params.zone_id];
    
    if (status) {
      sql += ' AND pl.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY pl.location';
    
    const [lights] = await db.query(sql, params);
    
    // Get status summary
    const [statusSummary] = await db.query(
      `SELECT pl.status, COUNT(*) as count
       FROM Public_Light pl
       JOIN Infrastructure i ON pl.light_id = i.asset_id
       WHERE i.zone_id = ?
       GROUP BY pl.status`,
      [req.params.zone_id]
    );
    
    res.json({ lights, statusSummary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SMART BINS IN ZONE ====================

// Get all smart bins in a zone
router.get("/:zone_id/smart-bins", async (req, res) => {
  try {
    const [bins] = await db.query(
      `SELECT sb.*, wm.collection_schedule, wm.type as waste_type
       FROM Smart_Bin sb
       JOIN Infrastructure i ON sb.bin_id = i.asset_id
       LEFT JOIN Waste_Management wm ON sb.managing_waste_id = wm.waste_id
       WHERE i.zone_id = ?
       ORDER BY sb.fill_level DESC`,
      [req.params.zone_id]
    );
    
    // Calculate statistics
    const stats = {
      total: bins.length,
      needingCollection: bins.filter(b => b.fill_level >= 80).length,
      averageFillLevel: bins.length > 0 
        ? bins.reduce((sum, b) => sum + (parseFloat(b.fill_level) || 0), 0) / bins.length 
        : 0
    };
    
    res.json({ bins, statistics: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SENSORS IN ZONE ====================

// Get all sensors in a zone
router.get("/:zone_id/sensors", async (req, res) => {
  try {
    const [sensors] = await db.query(
      `SELECT s.*, 
       CASE
         WHEN ts.sensor_id IS NOT NULL THEN 'Traffic'
         WHEN aqs.sensor_id IS NOT NULL THEN 'Air Quality'
         WHEN ws.sensor_id IS NOT NULL THEN 'Weather'
         ELSE 'General'
       END as sensor_type
       FROM Sensors s
       LEFT JOIN Traffic_Sensors ts ON s.sensor_id = ts.sensor_id
       LEFT JOIN Air_Quality_Sensors aqs ON s.sensor_id = aqs.sensor_id
       LEFT JOIN Weather_Sensors ws ON s.sensor_id = ws.sensor_id
       JOIN Infrastructure i ON s.sensor_id = i.asset_id
       WHERE i.zone_id = ?`,
      [req.params.zone_id]
    );
    
    res.json(sensors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ZONE ANALYTICS & REPORTS ====================

// Get zone analytics
router.get("/:zone_id/analytics", async (req, res) => {
  try {
    const zoneId = req.params.zone_id;
    
    // Population statistics
    const [[population]] = await db.query(
      `SELECT 
        COUNT(DISTINCT c.citizen_id) as total_citizens,
        COUNT(DISTINCT CASE WHEN c.gender = 'Male' THEN c.citizen_id END) as male_count,
        COUNT(DISTINCT CASE WHEN c.gender = 'Female' THEN c.citizen_id END) as female_count,
        AVG(YEAR(CURDATE()) - YEAR(c.dob)) as average_age
       FROM Citizen c
       JOIN House h ON c.house_id = h.house_id
       WHERE h.zone_id = ?`,
      [zoneId]
    );
    
    // Housing statistics
    const [[housing]] = await db.query(
      `SELECT 
        COUNT(*) as total_houses,
        COUNT(DISTINCT type) as house_types,
        AVG(CAST(SUBSTRING_INDEX(area, ' ', 1) AS UNSIGNED)) as avg_area
       FROM House
       WHERE zone_id = ?`,
      [zoneId]
    );
    
    // Infrastructure health
    const [[infraHealth]] = await db.query(
      `SELECT 
        COUNT(DISTINCT pl.light_id) as total_lights,
        COUNT(DISTINCT CASE WHEN pl.status = 'Faulty' THEN pl.light_id END) as faulty_lights,
        COUNT(DISTINCT sb.bin_id) as total_bins,
        AVG(sb.fill_level) as avg_bin_fill_level
       FROM Infrastructure i
       LEFT JOIN Public_Light pl ON i.asset_id = pl.light_id
       LEFT JOIN Smart_Bin sb ON i.asset_id = sb.bin_id
       WHERE i.zone_id = ?`,
      [zoneId]
    );
    
    // Alert statistics
    const [[alertStats]] = await db.query(
      `SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_alerts
       FROM Alerts a
       JOIN Infrastructure i ON a.asset_id = i.asset_id
       WHERE i.zone_id = ? AND a.acknowledged = 0`,
      [zoneId]
    );
    
    // Maintenance statistics
    const [[maintenanceStats]] = await db.query(
      `SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'Scheduled' THEN 1 END) as scheduled_tasks,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_tasks
       FROM Maintenance_Task mt
       JOIN Infrastructure i ON mt.asset_id = i.asset_id
       WHERE i.zone_id = ?`,
      [zoneId]
    );
    
    // Complaint trends (last 30 days)
    const [complaintTrends] = await db.query(
      `SELECT 
        DATE(complaint_date) as date,
        COUNT(*) as count,
        status
       FROM Complaints c
       JOIN Citizen ci ON c.citizen_id = ci.citizen_id
       JOIN House h ON ci.house_id = h.house_id
       WHERE h.zone_id = ? AND c.complaint_date >= CURDATE() - INTERVAL 30 DAY
       GROUP BY date, status
       ORDER BY date DESC`,
      [zoneId]
    );

    res.json({
      population,
      housing,
      infrastructureHealth: infraHealth,
      alerts: alertStats,
      maintenance: maintenanceStats,
      complaintTrends,
    });
  } catch (err) {
    console.error("Zone analytics error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== SERVICES IN ZONE ====================
// Get services operating in or available to a zone
router.get("/:zone_id/services", async (req, res) => {
  const { zone_id } = req.params;
  try {
    // 1. Waste Management (Direct link via zone_id)
    const [wasteServices] = await db.query(
      `SELECT s.*, wm.type as waste_type, wm.collection_schedule
       FROM Waste_Management wm
       JOIN Utility u ON wm.waste_id = u.utility_id
       JOIN Service s ON u.utility_id = s.service_id
       WHERE wm.zone_id = ?`,
      [zone_id]
    );

    // 2. Electricity (via Powernodes in the zone)
    const [electricityServices] = await db.query(
      `SELECT DISTINCT s.*, e.voltage_level, e.source_type, e.distribution_area
       FROM Service s
       JOIN Electricity e ON s.service_id = e.electricity_id
       JOIN provided_by pb ON e.electricity_id = pb.electricity_id
       JOIN Powernodes pn ON pb.node_id = pn.node_id
       JOIN Infrastructure i ON pn.node_id = i.asset_id
       WHERE i.zone_id = ?`,
      [zone_id]
    );

    // 3. Water (via Pipelines in the zone)
    const [waterServices] = await db.query(
      `SELECT DISTINCT s.*, w.source, w.quality_level, w.distribution_area
       FROM Service s
       JOIN Water w ON s.service_id = w.water_id
       JOIN provided_through pt ON w.water_id = pt.water_id
       JOIN Pipeline p ON pt.pipeline_id = p.pipeline_id
       JOIN Infrastructure i ON p.pipeline_id = i.asset_id
       WHERE i.zone_id = ?`,
      [zone_id]
    );
    
    // 4. Services linked from complaints by citizens in this zone
    const [servicesFromComplaints] = await db.query(
      `SELECT DISTINCT s.*, sc.name as category
       FROM Service s
       JOIN Complaints c ON s.service_id = c.service_id
       JOIN Citizen ci ON c.citizen_id = ci.citizen_id
       JOIN House h ON ci.house_id = h.house_id
       LEFT JOIN service_category_map scm ON s.service_id = scm.service_id
       LEFT JOIN service_category sc ON scm.category_id = sc.category_id
       WHERE h.zone_id = ?`,
      [zone_id]
    );

    res.json({
      wasteServices,
      electricityServices,
      waterServices,
      servicesFromComplaints,
    });
  } catch (err)
    {
    console.error("Zone services error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ZONE REPORTS ====================
// Get a high-level health summary (alerts, maintenance) for all zones
router.get("/report/health-summary", async (req, res) => {
  try {
    const [zoneSummary] = await db.query(
      `SELECT 
         z.zone_id,
         z.zone_name,
         z.type,
         COUNT(DISTINCT h.house_id) as total_houses,
         COUNT(DISTINCT c.citizen_id) as total_citizens,
         COUNT(DISTINCT i.asset_id) as total_infrastructure,
         (SELECT COUNT(*) FROM Alerts a_in JOIN Infrastructure i_in ON a_in.asset_id = i_in.asset_id WHERE i_in.zone_id = z.zone_id AND a_in.acknowledged = 0) as active_alerts,
         (SELECT COUNT(*) FROM Maintenance_Task mt_in JOIN Infrastructure i_in ON mt_in.asset_id = i_in.asset_id WHERE i_in.zone_id = z.zone_id AND mt_in.status IN ('Scheduled', 'In Progress')) as active_maintenance
       FROM Zone z
       LEFT JOIN House h ON z.zone_id = h.zone_id
       LEFT JOIN Citizen c ON h.house_id = c.house_id
       LEFT JOIN Infrastructure i ON z.zone_id = i.zone_id
       GROUP BY z.zone_id, z.zone_name, z.type
       ORDER BY z.zone_name`
    );

    res.json(zoneSummary);
  } catch (err) {
    console.error("Zone health summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
