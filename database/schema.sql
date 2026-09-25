-- ============================================================
-- e-KAGAWAD SYSTEM — REAL DATABASE SCHEMA
-- Barangay San Isidro, Cabuyao, Laguna
-- ============================================================
-- Run this once to create the database and all tables.
-- No fake residents / requests / notifications are seeded.
-- The only seeded data is:
--   1) the 6 official document types (real system configuration)
--   2) ONE default admin account so someone can log in for the
--      first time and start adding real staff / residents.
--      CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.
--
-- ALREADY HAVE THE DATABASE? Do NOT re-run this file. Run
-- database/migration_v2.sql instead (it only adds what is new).
-- ============================================================

CREATE DATABASE IF NOT EXISTS ekagawad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ekagawad;

-- ---------------------------------------------------------
-- RESIDENTS
-- ---------------------------------------------------------
CREATE TABLE residents (
  residentID      VARCHAR(20)  PRIMARY KEY,
  fullName        VARCHAR(150) NOT NULL,
  date_of_birth   DATE         NOT NULL,
  address         VARCHAR(255) NOT NULL,   -- "<house no./street>, Barangay San Isidro, Cabuyao, Laguna"
  contactNumber   VARCHAR(20)  NOT NULL,   -- stored as +639XXXXXXXXX
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  status          ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- ADMIN / BARANGAY STAFF
-- ---------------------------------------------------------
CREATE TABLE admins (
  adminID         VARCHAR(20)  PRIMARY KEY,
  fullName        VARCHAR(150) NOT NULL,
  role            VARCHAR(80)  NOT NULL DEFAULT 'Admin/Staff',
  contactNumber   VARCHAR(20)  NULL,
  email           VARCHAR(150) NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- DOCUMENT TYPES (the official barangay documents residents
-- can request — this is real, permanent system configuration,
-- not sample data, and should not be changed lightly)
-- ---------------------------------------------------------
CREATE TABLE document_types (
  documentTypeID     VARCHAR(30) PRIMARY KEY,
  name               VARCHAR(150) NOT NULL,
  shortName          VARCHAR(60)  NOT NULL,
  icon               VARCHAR(60)  NOT NULL,
  description        VARCHAR(255) NOT NULL,
  purpose            VARCHAR(255) NOT NULL,
  requirements       VARCHAR(255) NOT NULL,
  supporting_document ENUM('required','optional') NOT NULL DEFAULT 'optional',
  is_active          TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- DOCUMENT REQUESTS
-- ---------------------------------------------------------
CREATE TABLE document_requests (
  requestID              VARCHAR(20) PRIMARY KEY,
  residentID             VARCHAR(20) NOT NULL,
  documentTypeID         VARCHAR(30) NOT NULL,
  purpose                VARCHAR(255) NOT NULL,
  contactNumber          VARCHAR(20)  NOT NULL,
  copies                 INT NOT NULL DEFAULT 1,
  preferred_release_date DATE NULL,
  notes                  VARCHAR(500) NULL,
  date_requested         DATE NOT NULL,
  status                 ENUM('Pending','On Hold','Approved','Ready for Pickup','Completed','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  comments               VARCHAR(500) NULL,
  verified               TINYINT(1) NOT NULL DEFAULT 0,
  approved_by_name       VARCHAR(150) NULL,
  approved_by_role       VARCHAR(80)  NULL,
  approved_date          DATE NULL,
  held_by_name           VARCHAR(150) NULL,
  held_by_role           VARCHAR(80)  NULL,
  held_date              DATE NULL,
  ready_by_name          VARCHAR(150) NULL,
  ready_by_role          VARCHAR(80)  NULL,
  ready_date             DATE NULL,
  release_date           DATE NULL,
  released_by            VARCHAR(150) NULL,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dr_resident FOREIGN KEY (residentID) REFERENCES residents(residentID) ON DELETE RESTRICT,
  CONSTRAINT fk_dr_doctype  FOREIGN KEY (documentTypeID) REFERENCES document_types(documentTypeID)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- SUPPORTING ATTACHMENTS (real uploaded files, stored on disk;
-- only the path is stored in the database)
-- ---------------------------------------------------------
CREATE TABLE request_attachments (
  attachmentID  INT AUTO_INCREMENT PRIMARY KEY,
  requestID     VARCHAR(20) NOT NULL,
  fileName      VARCHAR(255) NOT NULL,
  filePath      VARCHAR(255) NOT NULL,
  fileType      VARCHAR(100) NOT NULL,
  fileSize      INT NOT NULL,
  uploaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_request FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- STATUS HISTORY / AUDIT TRAIL
-- ---------------------------------------------------------
CREATE TABLE request_status_history (
  historyID       INT AUTO_INCREMENT PRIMARY KEY,
  requestID       VARCHAR(20) NOT NULL,
  title           VARCHAR(100) NOT NULL,
  description     VARCHAR(500) NULL,
  changed_by_name VARCHAR(150) NULL,
  changed_by_role VARCHAR(80)  NULL,
  changed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_request FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- REJECTIONS
-- ---------------------------------------------------------
CREATE TABLE request_rejections (
  rejectionID   INT AUTO_INCREMENT PRIMARY KEY,
  requestID     VARCHAR(20) NOT NULL UNIQUE,
  adminID       VARCHAR(20) NOT NULL,
  reason        VARCHAR(500) NOT NULL,
  rejected_at   DATE NOT NULL,
  CONSTRAINT fk_rej_request FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE CASCADE,
  CONSTRAINT fk_rej_admin   FOREIGN KEY (adminID) REFERENCES admins(adminID)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- CANCELLATIONS
-- ---------------------------------------------------------
CREATE TABLE request_cancellations (
  cancellationID INT AUTO_INCREMENT PRIMARY KEY,
  requestID      VARCHAR(20) NOT NULL UNIQUE,
  residentID     VARCHAR(20) NOT NULL,
  reason         VARCHAR(500) NOT NULL,
  cancelled_at   DATE NOT NULL,
  CONSTRAINT fk_can_request  FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE CASCADE,
  CONSTRAINT fk_can_resident FOREIGN KEY (residentID) REFERENCES residents(residentID)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- APPEALS (against a rejection)
-- ---------------------------------------------------------
CREATE TABLE appeals (
  appealID              INT AUTO_INCREMENT PRIMARY KEY,
  requestID             VARCHAR(20) NOT NULL,
  appeal_reason         VARCHAR(500) NOT NULL,
  appeal_date           DATE NOT NULL,
  appeal_status         ENUM('Pending','Approved','Denied') NOT NULL DEFAULT 'Pending',
  resolved_by_admin_id  VARCHAR(20) NULL,
  resolved_at           DATE NULL,
  resolution_remarks    VARCHAR(500) NULL,
  CONSTRAINT fk_app_request FOREIGN KEY (requestID) REFERENCES document_requests(requestID) ON DELETE CASCADE,
  CONSTRAINT fk_app_admin   FOREIGN KEY (resolved_by_admin_id) REFERENCES admins(adminID)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- residentID = NULL  ->  broadcast notification for admin/staff
-- requestID  = the request the notification is about (if any),
--              used to show the request's details when the
--              notification is clicked
-- ---------------------------------------------------------
CREATE TABLE notifications (
  notificationID INT AUTO_INCREMENT PRIMARY KEY,
  residentID     VARCHAR(20) NULL,
  requestID      VARCHAR(20) NULL,
  message        VARCHAR(500) NOT NULL,
  is_read        TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_resident FOREIGN KEY (residentID) REFERENCES residents(residentID) ON DELETE CASCADE,
  CONSTRAINT fk_notif_request  FOREIGN KEY (requestID)  REFERENCES document_requests(requestID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SEED: the 6 official document types
-- (kept exactly as in the original front end — do not remove)
-- ============================================================
INSERT INTO document_types (documentTypeID, name, shortName, icon, description, purpose, requirements, supporting_document, is_active) VALUES
('clearance',   'Barangay Clearance',               'Clearance', 'file-circle-check', 'General-purpose clearance for employment, business, and other transactions.', 'Employment, business, or general transaction requirement.', 'Valid ID, proof of residency', 'required', 1),
('residency',   'Certificate of Residency',         'Residency', 'home',              'Proof that you currently reside within the barangay.', 'School enrollment, transfer of residence, or verification purposes.', 'Valid ID', 'optional', 1),
('indigency',   'Certificate of Indigency',         'Indigency', 'heart',             'For residents availing of financial or medical assistance programs.', 'Medical assistance, scholarship, or aid application.', 'Valid ID, proof of income (if available)', 'required', 1),
('goodmoral',   'Certificate of Good Moral Character','Good Moral','user-check',      'Commonly required for school admission or job applications.', 'School admission or employment requirement.', 'Valid ID', 'optional', 1),
('business',    'Barangay Business Clearance',      'Business',  'briefcase',         'Required for registering or renewing a business within the barangay.', 'Business permit registration or renewal.', 'Valid ID, DTI/SEC registration (if applicable)', 'required', 1),
('barangayid',  'Barangay ID Application',          'ID App',    'id-card',           'Official barangay identification card for residents proving local residency.', 'Local identification, discounts, and verification purposes.', 'Valid ID, 1x1 photo, proof of residency', 'required', 1);

-- ============================================================
-- SEED: default admin account (ADM-001 / password), so you can
-- log in immediately. This hash was generated and verified with
-- this exact PHP's password_hash()/password_verify(), so it is
-- guaranteed to work on setups running a compatible PHP version.
-- CHANGE THIS PASSWORD from the Account page after your first
-- real login — "password" is not a safe password for production use.
-- (The Account page now enforces the stronger password rules
-- for any NEW password: 8–64 chars, upper + lower + number + symbol.)
-- ============================================================
INSERT INTO admins (adminID, fullName, role, contactNumber, email, password_hash) VALUES
('ADM-001', 'Admin Staff', 'Administrator', '+639179990000', 'admin@ekagawad.gov.ph',
 '$2y$10$1oBwpV0iVBPLb4EHtx7D9.5MicVEFGwDDzlHy8e.bSEwBHIoed492');

-- ============================================================
-- setup_admin.php (in the project root) will detect that an
-- admin already exists and lock itself automatically — you do
-- not need to run it unless you delete this seeded row first.
-- ============================================================
