/*
Simple migration runner for migrations/004_remap_users_and_alter_enum.sql
Usage: set env vars (or create .env) and run `node scripts/run-migration.js`
The script prints previews, asks for confirmation, and optionally applies the migration.
This script is intentionally synchronous/simple and uses mysql2/promise.
*/

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

const MIGRATION_FILE = path.join(__dirname, '..', 'migrations', '004_remap_users_and_alter_enum.sql');

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function run() {
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'smartcity'
  };

  // If password is not provided via env, prompt the user for it.
  if (!cfg.password) {
    // Warning: input will be visible in the terminal. This avoids failing when no .env is present.
    cfg.password = await prompt('DB password (input visible) - press Enter if using socket auth: ');
  }

  console.log('Using DB:', `${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

  const conn = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, multipleStatements: true });

  try {
    // Preview distinct service types
    console.log('\nPreview: distinct service_type samples');
    const [types] = await conn.query("SELECT LOWER(service_type) AS service_type_normalized, COUNT(*) AS cnt FROM Service_Provider GROUP BY service_type_normalized ORDER BY cnt DESC LIMIT 200");
    console.table(types.slice(0, 50));

    // Preview mapped users
    console.log('\nPreview: users mapped by service_type (first 200 rows)');
    const previewSql = `SELECT u.user_id, u.email, u.role AS current_role, p.provider_id, p.service_type,
  CASE
    WHEN LOWER(p.service_type) LIKE '%transport%' THEN 'transport'
    WHEN LOWER(p.service_type) LIKE '%water%' OR LOWER(p.service_type) LIKE '%utility%' THEN 'utility'
    WHEN LOWER(p.service_type) LIKE '%health%' OR LOWER(p.service_type) LIKE '%hospital%' OR LOWER(p.service_type) LIKE '%health care%' THEN 'healthcare'
    WHEN LOWER(p.service_type) LIKE '%internet%' OR LOWER(p.service_type) LIKE '%telecom%' THEN 'internet'
    ELSE NULL
  END AS derived_role
FROM Users u
JOIN Service_Provider p ON u.linked_id = p.provider_id
WHERE (u.role IN ('provider') OR u.role IS NULL)
ORDER BY derived_role IS NULL, derived_role, u.user_id
LIMIT 200;`;
    const [mapped] = await conn.query(previewSql);
    console.table(mapped.slice(0, 200));

    const proceed = (await prompt('\nDo you want to APPLY the migration on this database now? Type YES to proceed: '));
    if (proceed !== 'YES') {
      console.log('Aborted by user. No changes made.');
      return;
    }

    // Read migration file
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('\nApplying migration file:', MIGRATION_FILE);
    const [res] = await conn.query(sql);
    console.log('Migration applied. Result summary:', res);

    // Post-check: show role counts
    const [roleCounts] = await conn.query('SELECT role, COUNT(*) AS cnt FROM Users GROUP BY role');
    console.table(roleCounts);

  } finally {
    await conn.end();
  }
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
