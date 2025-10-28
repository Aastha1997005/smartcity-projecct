-- Migration 006: Ensure Service_Booking table exists and add helpful cache columns
-- This migration avoids changing existing Service or Service_Provider tables.
-- BACKUP your DB before running.

-- Create or ensure Service_Booking table with desired columns (safe for existing setups)
CREATE TABLE IF NOT EXISTS Service_Booking (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NOT NULL,
  service_id INT NOT NULL,
  booking_start DATETIME NOT NULL,
  booking_end DATETIME NULL,
  status ENUM('upcoming','scheduled','in_progress','completed','cancelled','no_show') DEFAULT 'upcoming',
  details JSON NULL,
  priority ENUM('low','medium','high') DEFAULT 'medium',
  assigned_to INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  provider_id INT NULL, -- denormalized cache from Service -> Service_Provider (if available)
  service_name_cache VARCHAR(255) NULL, -- denormalized service name for quick frontend display
  service_category_cache VARCHAR(100) NULL, -- optional category/tag for frontend grouping
  FOREIGN KEY (citizen_id) REFERENCES Citizen(citizen_id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES Service(service_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES Users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- Add indexes if not present (MySQL 8 supports IF NOT EXISTS for ADD INDEX by name check isn't standard; we'll use simple CREATE INDEX with IGNORE-like behavior via conditional INSERT into INFORMATION_SCHEMA not portable.
CREATE INDEX IF NOT EXISTS idx_booking_citizen ON Service_Booking(citizen_id);
CREATE INDEX IF NOT EXISTS idx_booking_service ON Service_Booking(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_start ON Service_Booking(booking_start);
CREATE INDEX IF NOT EXISTS idx_booking_status ON Service_Booking(status);

-- If the table existed already, ensure new columns exist (MySQL 8+ supports ADD COLUMN IF NOT EXISTS)
ALTER TABLE Service_Booking
  ADD COLUMN IF NOT EXISTS provider_id INT NULL,
  ADD COLUMN IF NOT EXISTS service_name_cache VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS service_category_cache VARCHAR(100) NULL;

-- Note: This migration intentionally avoids modifying Service and Service_Provider tables as requested.
