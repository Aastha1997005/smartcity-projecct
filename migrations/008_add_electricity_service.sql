-- Insert a new service for Electricity if it doesn't exist
INSERT IGNORE INTO Service (service_id, service_name, cost, availability_status, operating_hours, provider_id)
VALUES (7, 'Electricity Bill', 0, 'Active', '24/7', 1);

-- Insert a new utility for the Electricity service
INSERT IGNORE INTO Utility (utility_id, unit, issue_date)
VALUES (7, 'monthly', '2025-11-01');

-- Insert a new electricity record for the utility
INSERT IGNORE INTO Electricity (electricity_id, provider_id, voltage_level, distribution_area, source_type, traffic_rate)
VALUES (7, 1, '230V', 'City-wide', 'Mixed', 8.50);

-- Map the new Electricity service to the 'electricity' category
INSERT IGNORE INTO Service_Category_Map (service_id, category_id)
VALUES (7, (SELECT category_id FROM Service_Category WHERE name = 'electricity'));
