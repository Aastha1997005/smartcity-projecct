console.log('loading db.js');
require('dotenv').config();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'PHD#$234asd',
  database: process.env.DB_NAME || 'smartcity_management_system'
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

module.exports = { 
  db, 
  logAuditAction 
};
