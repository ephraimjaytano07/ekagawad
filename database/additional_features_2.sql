-- ============================================================
-- e-KAGAWAD — MIGRATION v3
-- ------------------------------------------------------------
-- 1) Resident names are split into First / Middle / Last / Suffix
-- 2) Admin table gets an access level (admin | moderator) and a
--    status (Active | Inactive) so Moderator accounts can exist
--
-- Run ONCE in phpMyAdmin (SQL tab) or:
--     mysql -u root -p < database/migration_v3.sql
--
-- Works on an existing database AND on a fresh install
-- (fresh install: import schema.sql first, then this file).
-- Nothing is deleted. `residents.fullName` is KEPT: the PHP code
-- now builds it from the four parts, so every existing query,
-- report, certificate and notification keeps working.
-- ============================================================
USE ekagawad;

-- ------------------------------------------------------------
-- 1) RESIDENTS — split the name
-- ------------------------------------------------------------
ALTER TABLE residents
  ADD COLUMN firstName  VARCHAR(50) NULL AFTER fullName,
  ADD COLUMN middleName VARCHAR(40) NULL AFTER firstName,
  ADD COLUMN lastName   VARCHAR(40) NULL AFTER middleName,
  ADD COLUMN suffix     VARCHAR(10) NULL AFTER lastName;

-- Best-effort split of the names that already exist.
-- (A temporary helper column is used and dropped again below.)
ALTER TABLE residents ADD COLUMN _base VARCHAR(150) NULL;

-- a) detect a trailing suffix (Jr., Sr., II, III, IV)
UPDATE residents
SET suffix = CASE UPPER(SUBSTRING_INDEX(TRIM(fullName), ' ', -1))
      WHEN 'JR.' THEN 'Jr.'  WHEN 'JR' THEN 'Jr.'
      WHEN 'SR.' THEN 'Sr.'  WHEN 'SR' THEN 'Sr.'
      WHEN 'II'  THEN 'II'   WHEN 'III' THEN 'III'  WHEN 'IV' THEN 'IV'
      ELSE NULL END
WHERE LOCATE(' ', TRIM(fullName)) > 0;

-- b) the name without its suffix
UPDATE residents
SET _base = CASE
      WHEN suffix IS NULL THEN TRIM(fullName)
      ELSE TRIM(LEFT(TRIM(fullName), CHAR_LENGTH(TRIM(fullName)) - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(fullName), ' ', -1))))
    END;

-- c) last word = last name, everything before it = first name
UPDATE residents
SET lastName  = LEFT(SUBSTRING_INDEX(_base, ' ', -1), 40),
    firstName = LEFT(
        CASE WHEN LOCATE(' ', _base) > 0
             THEN TRIM(LEFT(_base, CHAR_LENGTH(_base) - CHAR_LENGTH(SUBSTRING_INDEX(_base, ' ', -1))))
             ELSE _base END, 50);

ALTER TABLE residents DROP COLUMN _base;

ALTER TABLE residents
  MODIFY firstName VARCHAR(50) NOT NULL,
  MODIFY lastName  VARCHAR(40) NOT NULL;

-- ------------------------------------------------------------
-- 2) ADMINS — access level + status
--    'moderator' is the safe default (least privilege). Every
--    account that exists right now was a full admin, so they
--    are set to 'admin' here.
-- ------------------------------------------------------------
ALTER TABLE admins
  ADD COLUMN access_level ENUM('admin','moderator') NOT NULL DEFAULT 'moderator' AFTER role,
  ADD COLUMN status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active' AFTER access_level;

UPDATE admins SET access_level = 'admin';

-- ------------------------------------------------------------
-- OPTIONAL: a ready-made test moderator (MOD-001 / password).
-- Remove it (or change the password) before real use.
-- You can also just create moderators from the Admin portal
-- (sidebar > Moderators) — no SQL needed.
-- ------------------------------------------------------------
-- INSERT INTO admins (adminID, fullName, role, access_level, status, contactNumber, email, password_hash) VALUES
-- ('MOD-001', 'Test Moderator', 'Moderator', 'moderator', 'Active', '+639170001111', 'moderator@ekagawad.gov.ph',
--  '$2y$10$1oBwpV0iVBPLb4EHtx7D9.5MicVEFGwDDzlHy8e.bSEwBHIoed492');

-- ------------------------------------------------------------
-- CHECK: names the automatic split may have guessed wrong
-- (one-word names, or "Juan Dela Cruz" style names). Fix them
-- from Admin > Residents > Edit.
-- ------------------------------------------------------------
-- SELECT residentID, fullName, firstName, middleName, lastName, suffix
--   FROM residents WHERE firstName = lastName OR fullName LIKE '% % %';
