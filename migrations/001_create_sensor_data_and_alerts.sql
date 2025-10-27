-- Migration: create Sensor_Data and Alerts (safe: use IF NOT EXISTS)
-- Run against your smartcity_management_system database

CREATE TABLE IF NOT EXISTS Sensor_Data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  metric VARCHAR(100) NOT NULL,
  value DOUBLE NULL,
  unit VARCHAR(50) NULL,
  recorded_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (sensor_id),
  INDEX (recorded_at)
);

CREATE TABLE IF NOT EXISTS Alerts (
  alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NULL,
  sensor_id INT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity ENUM('info','warning','critical') DEFAULT 'warning',
  details JSON NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL
);

-- Note: add foreign keys manually if you prefer (depends on existing table names/casing)
-- ALTER TABLE Sensor_Data ADD CONSTRAINT fk_sd_sensor FOREIGN KEY (sensor_id) REFERENCES Sensors(sensor_id);
-- ALTER TABLE Alerts ADD CONSTRAINT fk_alert_asset FOREIGN KEY (asset_id) REFERENCES Infrastructure(asset_id);
-- ALTER TABLE Alerts ADD CONSTRAINT fk_alert_sensor FOREIGN KEY (sensor_id) REFERENCES Sensors(sensor_id);
