-- Migration 004: Remap existing Users.role values and alter enum to new service-aware set
-- BACKUP your DB before running this migration.

-- Remap existing rows (no-op for admin -> admin included for completeness)
UPDATE Users SET role='admin' WHERE role='admin';
UPDATE Users SET role='healthcare' WHERE role='doctor';
UPDATE Users SET role='transport' WHERE role='provider';

-- Active mapping: remap Users.role for rows where Users.linked_id points to Service_Provider
-- This attempts to classify providers by their service_type. It's conservative: if no pattern
-- matches, the user's role is left unchanged.
UPDATE Users u
JOIN Service_Provider p ON u.linked_id = p.provider_id
SET u.role = CASE
    -- transport-related providers
    WHEN LOWER(p.service_type) LIKE '%transport%' OR LOWER(p.service_type) LIKE '%bus%' OR LOWER(p.service_type) LIKE '%rail%' OR LOWER(p.service_type) LIKE '%metro%' OR LOWER(p.service_type) LIKE '%tram%' OR LOWER(p.service_type) LIKE '%taxi%' OR LOWER(p.service_type) LIKE '%cab%' OR LOWER(p.service_type) LIKE '%parking%' THEN 'transport'
    -- utility-related providers (water, sanitation, electricity, lighting, sewage, waste)
    WHEN LOWER(p.service_type) LIKE '%water%' OR LOWER(p.service_type) LIKE '%utility%' OR LOWER(p.service_type) LIKE '%sanitation%' OR LOWER(p.service_type) LIKE '%sewage%' OR LOWER(p.service_type) LIKE '%sewer%' OR LOWER(p.service_type) LIKE '%waste%' OR LOWER(p.service_type) LIKE '%garbage%' OR LOWER(p.service_type) LIKE '%electric%' OR LOWER(p.service_type) LIKE '%electricity%' OR LOWER(p.service_type) LIKE '%light%' OR LOWER(p.service_type) LIKE '%lighting%' OR LOWER(p.service_type) LIKE '%streetlight%' OR LOWER(p.service_type) LIKE '%street light%' THEN 'utility'
    -- healthcare-related
    WHEN LOWER(p.service_type) LIKE '%health%' OR LOWER(p.service_type) LIKE '%hospital%' OR LOWER(p.service_type) LIKE '%health care%' OR LOWER(p.service_type) LIKE '%clinic%' OR LOWER(p.service_type) LIKE '%ambulance%' OR LOWER(p.service_type) LIKE '%doctor%' THEN 'healthcare'
    -- internet / telecom
    WHEN LOWER(p.service_type) LIKE '%internet%' OR LOWER(p.service_type) LIKE '%telecom%' OR LOWER(p.service_type) LIKE '%wifi%' OR LOWER(p.service_type) LIKE '%broadband%' OR LOWER(p.service_type) LIKE '%isp%' THEN 'internet'
    ELSE u.role END
WHERE u.role IN ('provider') OR u.role IS NULL;

-- Alter enum to the new role set. MySQL requires re-creating the enum values in the MODIFY statement.
ALTER TABLE Users
MODIFY COLUMN role ENUM(
    'admin',
    'citizen',
    'transport',
    'utility',
    'healthcare',
    'internet'
) NOT NULL;

-- NOTE: If MySQL rejects the ALTER due to existing values not covered by the new enum,
-- run the UPDATE mappings first to ensure all Users.role values are in the target set.
-- Also ensure there are no rows with role=NULL.
