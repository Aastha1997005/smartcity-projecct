const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'devanshi19',
  database: 'smartcity_management_system'
});

// Helper to log audit actions
async function logAuditAction(userId, action, resource, details = null) {
  try {
    await db.query(
      `INSERT INTO AuditLog (user_id, action, resource, details, timestamp)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, action, resource, details]
    );
  } catch (err) {
    // Optionally log error
  }
}

module.exports = db;
module.exports.logAuditAction = logAuditAction;