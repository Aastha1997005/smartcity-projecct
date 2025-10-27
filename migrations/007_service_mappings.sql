-- Migration 007: Add Service_Category, Service_To_Provider, and Service_Category_Map
-- This migration creates mapping tables only; it does not alter the existing Service or Service_Provider tables.
-- BACKUP your DB before running.

CREATE TABLE IF NOT EXISTS Service_Category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS Service_To_Provider (
  service_id INT NOT NULL,
  provider_id INT NOT NULL,
  PRIMARY KEY (service_id, provider_id),
  FOREIGN KEY (service_id) REFERENCES Service(service_id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES Service_Provider(provider_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Service_Category_Map (
  service_id INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (service_id, category_id),
  FOREIGN KEY (service_id) REFERENCES Service(service_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES Service_Category(category_id) ON DELETE CASCADE
);

-- Insert common categories if they don't exist
INSERT IGNORE INTO Service_Category (name, description) VALUES
  ('water','Water supply and distribution services'),
  ('electricity','Power generation and distribution services'),
  ('internet','Internet and telecom services'),
  ('transport','Public transport and related services'),
  ('waste','Waste collection and management services'),
  ('healthcare','Healthcare and medical services');
