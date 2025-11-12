const readline = require('readline');
const bcrypt = require('bcrypt');
const { db } = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter admin email: ', (email) => {
  rl.question('Enter admin password: ', async (password) => {
    if (!email || !password) {
      console.error('Email and password are required.');
      rl.close();
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        "INSERT INTO Users (email, password_hash, role) VALUES (?, ?, 'admin')",
        [email, hashedPassword]
      );
      console.log('Admin user created successfully.');
    } catch (error) {
      console.error('Error creating admin user:', error);
    } finally {
      db.end();
      rl.close();
    }
  });
});