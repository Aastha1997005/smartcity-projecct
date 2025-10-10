const db = require('./db');
const bcrypt = require('bcrypt');

async function addAdmin() {
  const username = 'admin@example.com'; // Change as needed
  const password = '1234admin'; // Change as needed
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await db.query(
      'INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'admin']
    );
    console.log('Admin user created successfully!');
  } catch (err) {
    console.error('Error creating admin user:', err.message);
  } finally {
    process.exit();
  }
}

addAdmin();
