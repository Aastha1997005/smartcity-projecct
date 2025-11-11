const express = require('express');
const router = express.Router();
const {db} = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ADMIN DASHBOARD ROUTES
 * Consolidates all key administrative data including citizens, providers,
 * complaints, infrastructure, and analytics
 */

// Get comprehensive dashboard statistics
router.get('/dashboard/stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Get counts for all major entities
    const [[citizenCount]] = await db.query('SELECT COUNT(*) as count FROM Citizen');
    const [[complaintCount]] = await db.query('SELECT COUNT(*) as count FROM Complaints');
    const [[serviceCount]] = await db.query('SELECT COUNT(*) as count FROM Service');
    const [[providerCount]] = await db.query('SELECT COUNT(*) as count FROM Service_Provider');
    const [[vehicleCount]] = await db.query('SELECT COUNT(*) as count FROM Vehicle');
    const [[infrastructureCount]] = await db.query('SELECT COUNT(*) as count FROM Infrastructure');
    
    // Get complaint statistics by status
    const [complaintStats] = await db.query(
      'SELECT status, COUNT(*) as count FROM Complaints GROUP BY status'
    );
    
    // Get service availability statistics
    const [serviceStats] = await db.query(
      'SELECT availability_status, COUNT(*) as count FROM Service GROUP BY availability_status'
    );
    
    // Get recent activity (last 10 complaints)
    const [recentComplaints] = await db.query(
      `SELECT c.complaint_id, c.complaint_text, c.status, c.complaint_date,
              CONCAT(ci.first_name, ' ', ci.last_name) as citizen_name
       FROM Complaints c
       JOIN Citizen ci ON c.citizen_id = ci.citizen_id
       ORDER BY c.complaint_date DESC
       LIMIT 10`
    );
    
    res.json({
      summary: {
        citizens: citizenCount.count,
        complaints: complaintCount.count,
        services: serviceCount.count,
        providers: providerCount.count,
        vehicles: vehicleCount.count,
        infrastructure: infrastructureCount.count
      },
      complaintStats,
      serviceStats,
      recentActivity: recentComplaints
    });
  } catch (err) {
    console.error('Admin dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get all citizens with pagination and filtering
router.get('/citizens', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, city, area } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `SELECT c.*, z.zone_name, h.type as house_type
               FROM Citizen c
               LEFT JOIN House h ON c.house_id = h.house_id
               LEFT JOIN Zone z ON h.zone_id = z.zone_id
               WHERE 1=1`;
    const params = [];
    
    if (search) {
      sql += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.citizen_id = ?)`;
      params.push(`%${search}%`, `%${search}%`, search);
    }
    if (city) {
      sql += ` AND c.city = ?`;
      params.push(city);
    }
    if (area) {
      sql += ` AND c.area = ?`;
      params.push(area);
    }
    
    sql += ` ORDER BY c.citizen_id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const [citizens] = await db.query(sql, params);
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM Citizen c WHERE 1=1';
    const countParams = [];
    if (search) {
      countSql += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.citizen_id = ?)`;
      countParams.push(`%${search}%`, `%${search}%`, search);
    }
    if (city) {
      countSql += ` AND c.city = ?`;
      countParams.push(city);
    }
    if (area) {
      countSql += ` AND c.area = ?`;
      countParams.push(area);
    }
    
    const [[{ total }]] = await db.query(countSql, countParams);
    
    res.json({
      citizens,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Admin citizens list error:', err);
    res.status(500).json({ error: 'Failed to fetch citizens' });
  }
});

// Get all service providers with details
router.get('/providers', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const [providers] = await db.query(
      `SELECT p.*, COUNT(DISTINCT stp.service_id) as service_count
       FROM Service_Provider p
       LEFT JOIN Service_To_Provider stp ON p.provider_id = stp.provider_id
       GROUP BY p.provider_id
       ORDER BY p.provider_id`
    );
    
    res.json(providers);
  } catch (err) {
    console.error('Admin providers list error:', err);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get all complaints with filtering
router.get('/complaints', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `SELECT c.*, CONCAT(ci.first_name, ' ', ci.last_name) as citizen_name,
                      ci.area, ci.city
               FROM Complaints c
               JOIN Citizen ci ON c.citizen_id = ci.citizen_id
               WHERE 1=1`;
    const params = [];
    
    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (c.complaint_text LIKE ? OR c.complaint_id = ?)`;
      params.push(`%${search}%`, search);
    }
    
    sql += ` ORDER BY c.complaint_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const [complaints] = await db.query(sql, params);
    
    res.json(complaints);
  } catch (err) {
    console.error('Admin complaints list error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get infrastructure overview
router.get('/infrastructure', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Get all infrastructure with zone details
    const [infrastructure] = await db.query(
      `SELECT i.asset_id, i.zone_id, z.zone_name, z.type as zone_type
       FROM Infrastructure i
       LEFT JOIN Zone z ON i.zone_id = z.zone_id
       ORDER BY i.asset_id`
    );
    
    // Get public lights
    const [lights] = await db.query(
      `SELECT pl.*, z.zone_name
       FROM Public_Light pl
       JOIN Infrastructure i ON pl.light_id = i.asset_id
       LEFT JOIN Zone z ON i.zone_id = z.zone_id`
    );
    
    // Get pipelines
    const [pipelines] = await db.query('SELECT * FROM Pipeline');
    
    // Get power nodes
    const [powerNodes] = await db.query('SELECT * FROM Powernodes');
    
    // Get smart bins
    const [smartBins] = await db.query(
      `SELECT sb.*, z.zone_name
       FROM Smart_Bin sb
       JOIN Infrastructure i ON sb.bin_id = i.asset_id
       LEFT JOIN Zone z ON i.zone_id = z.zone_id`
    );
    
    res.json({
      summary: {
        total: infrastructure.length,
        lights: lights.length,
        pipelines: pipelines.length,
        powerNodes: powerNodes.length,
        smartBins: smartBins.length
      },
      infrastructure,
      lights,
      pipelines,
      powerNodes,
      smartBins
    });
  } catch (err) {
    console.error('Admin infrastructure error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure data' });
  }
});

// Get service bookings overview
router.get('/bookings', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `SELECT b.*, 
                      CONCAT(c.first_name, ' ', c.last_name) as citizen_name,
                      s.service_name,
                      b.service_category_cache as category
               FROM Service_Booking b
               JOIN Citizen c ON b.citizen_id = c.citizen_id
               LEFT JOIN Service s ON b.service_id = s.service_id
               WHERE 1=1`;
    const params = [];
    
    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY b.booking_start DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const [bookings] = await db.query(sql, params);
    
    // Get status summary
    const [statusSummary] = await db.query(
      'SELECT status, COUNT(*) as count FROM Service_Booking GROUP BY status'
    );
    
    res.json({
      bookings,
      statusSummary
    });
  } catch (err) {
    console.error('Admin bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get zones with statistics
router.get('/zones', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const [zones] = await db.query(
      `SELECT z.*,
              COUNT(DISTINCT h.house_id) as house_count,
              COUNT(DISTINCT i.asset_id) as infrastructure_count
       FROM Zone z
       LEFT JOIN House h ON z.zone_id = h.zone_id
       LEFT JOIN Infrastructure i ON z.zone_id = i.zone_id
       GROUP BY z.zone_id`
    );
    
    res.json(zones);
  } catch (err) {
    console.error('Admin zones error:', err);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// Analytics: Complaint trends over time
router.get('/analytics/complaints', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = '7' } = req.query; // days
    
    const [trends] = await db.query(
      `SELECT DATE(complaint_date) as date, 
              COUNT(*) as count,
              status
       FROM Complaints
       WHERE complaint_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(complaint_date), status
       ORDER BY date DESC`,
      [parseInt(period)]
    );
    
    res.json(trends);
  } catch (err) {
    console.error('Admin complaint analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch complaint analytics' });
  }
});

// Analytics: Service usage statistics
router.get('/analytics/services', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const [usage] = await db.query(
      `SELECT s.service_name,
              COUNT(b.booking_id) as booking_count,
              s.availability_status,
              COALESCE(b.service_category_cache, 'uncategorized') as category
       FROM Service s
       LEFT JOIN Service_Booking b ON s.service_id = b.service_id
       GROUP BY s.service_id
       ORDER BY booking_count DESC`
    );
    
    res.json(usage);
  } catch (err) {
    console.error('Admin service analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch service analytics' });
  }
});

// Update complaint status (admin action)
router.put('/complaints/:complaint_id/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['New', 'In Progress', 'Resolved', 'Closed', 'Pending'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.query(
      'UPDATE Complaints SET status = ? WHERE complaint_id = ?',
      [status, req.params.complaint_id]
    );
    
    res.json({ message: 'Complaint status updated successfully' });
  } catch (err) {
    console.error('Admin complaint update error:', err);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
});

// Get audit logs
router.get('/audit-logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const [logs] = await db.query(
      `SELECT a.*, u.email as user_email
       FROM AuditLog a
       LEFT JOIN Users u ON a.user_id = u.user_id
       ORDER BY a.timestamp DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );
    
    res.json(logs);
  } catch (err) {
    console.error('Admin audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Export data (for reports)
router.get('/export/:entity', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { entity } = req.params;
    const { format = 'json' } = req.query;
    
    let data = [];
    
    switch (entity) {
      case 'citizens':
        [data] = await db.query('SELECT * FROM Citizen');
        break;
      case 'complaints':
        [data] = await db.query(`
          SELECT c.*, CONCAT(ci.first_name, ' ', ci.last_name) as citizen_name
          FROM Complaints c
          JOIN Citizen ci ON c.citizen_id = ci.citizen_id
        `);
        break;
      case 'services':
        [data] = await db.query('SELECT * FROM Service');
        break;
      case 'bookings':
        [data] = await db.query(`
          SELECT b.*, CONCAT(c.first_name, ' ', c.last_name) as citizen_name, s.service_name
          FROM Service_Booking b
          JOIN Citizen c ON b.citizen_id = c.citizen_id
          LEFT JOIN Service s ON b.service_id = s.service_id
        `);
        break;
      default:
        return res.status(400).json({ error: 'Invalid entity type' });
    }
    
    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}_export.csv"`);
      return res.send(csv);
    }
    
    res.json(data);
  } catch (err) {
    console.error('Admin export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
}

module.exports = router;