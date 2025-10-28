Migration runner and safe steps

Purpose
- Small helper to preview and apply `migrations/004_remap_users_and_alter_enum.sql` in a controlled way.

Prereqs
- Node.js installed (v16+ recommended).
- `mysql` server accessible and credentials available.
- `mysql2` and `dotenv` are already project dependencies.

Usage
1. Copy `.env.example` to `.env` and update DB_* values.
2. Preview and optionally apply the migration:

   npm run run-migration

The script shows distinct `service_type` values, previews affected Users, and asks for a confirmation `YES` before applying the migration.

Safety notes
- Always back up the DB (mysqldump) before applying migrations.
- Run this on a staging DB first.
