-- Migration: make Users table use `email` column instead of `username`
-- IMPORTANT: Back up your database before running this migration.

START TRANSACTION;

-- 1) Add email column if it does not exist
ALTER TABLE `Users`
  ADD COLUMN IF NOT EXISTS `email` VARCHAR(100) NULL;

-- 2) If there is a `username` column and `email` is NULL, move username -> email for rows where username looks like email
-- This attempts to preserve existing accounts where username was an email address.
UPDATE `Users` SET `email` = `username` WHERE `email` IS NULL AND `username` LIKE '%@%';

-- 3) Make email NOT NULL and UNIQUE if possible. If existing NULLs remain, you may want to fill them first.
-- Create unique index only if there is no conflicting data.
ALTER TABLE `Users`
  MODIFY COLUMN `email` VARCHAR(100) NOT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `ux_users_email` (`email`);

-- 4) Drop username column if it exists (only if you no longer need it)
ALTER TABLE `Users`
  DROP COLUMN IF EXISTS `username`;

COMMIT;

-- Notes
-- - MySQL 8+ supports `IF NOT EXISTS` and `IF EXISTS` in ALTER TABLE; if your server is older, run safe conditional SQL instead.
-- - Review rows with NULL email before forcing NOT NULL. If you have non-email usernames that must be preserved, decide whether to convert them to email-like values or to keep username as a separate column.
-- - After running, verify auth flows (register/login) and back up the DB.
