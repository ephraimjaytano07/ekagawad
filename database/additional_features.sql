-- ============================================================
-- e-KAGAWAD — MIGRATION v2  (for databases created BEFORE this update)
-- ------------------------------------------------------------
-- Run ONCE in phpMyAdmin (or `mysql -u root -p < database/migration_v2.sql`).
-- Fresh installs do not need this: database/schema.sql already includes it.
-- Nothing here deletes or changes your existing residents/requests,
-- except the optional phone-number tidy-up in step 2.
-- ============================================================
USE ekagawad;

-- 1) Notifications can now point to the request they are about.
--    This is what lets a clicked notification show that request's details.
ALTER TABLE notifications
  ADD COLUMN requestID VARCHAR(20) NULL AFTER residentID;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notif_request
  FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE SET NULL;

-- 2) OPTIONAL: convert old 09XXXXXXXXX phone numbers to the new +639XXXXXXXXX format.
--    (The system still displays and accepts the old format, so you can skip this.)
UPDATE residents
   SET contactNumber = CONCAT('+63', SUBSTRING(REPLACE(REPLACE(contactNumber,' ',''),'-',''), 2))
 WHERE REPLACE(REPLACE(contactNumber,' ',''),'-','') REGEXP '^09[0-9]{9}$';

UPDATE admins
   SET contactNumber = CONCAT('+63', SUBSTRING(REPLACE(REPLACE(contactNumber,' ',''),'-',''), 2))
 WHERE REPLACE(REPLACE(contactNumber,' ',''),'-','') REGEXP '^09[0-9]{9}$';

UPDATE document_requests
   SET contactNumber = CONCAT('+63', SUBSTRING(REPLACE(REPLACE(contactNumber,' ',''),'-',''), 2))
 WHERE REPLACE(REPLACE(contactNumber,' ',''),'-','') REGEXP '^09[0-9]{9}$';
