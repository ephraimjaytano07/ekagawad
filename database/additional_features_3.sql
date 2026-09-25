-- ============================================================
-- e-KAGAWAD — MIGRATION v4
-- ------------------------------------------------------------
-- Adds appeal-review support: supporting images for an appeal,
-- and a "reviewed" flag that must be set before an appeal can
-- be approved/denied. No new tables — only ALTERs `appeals`.
-- request_attachments already supports many files per request,
-- so no schema change is needed for multi-file document uploads.
-- ============================================================
USE ekagawad;

ALTER TABLE appeals
  ADD COLUMN appeal_images        TEXT        NULL AFTER appeal_reason,
  ADD COLUMN reviewed             TINYINT(1)  NOT NULL DEFAULT 0 AFTER appeal_status,
  ADD COLUMN reviewed_by_admin_id VARCHAR(20) NULL AFTER reviewed,
  ADD COLUMN reviewed_by_name     VARCHAR(150) NULL AFTER reviewed_by_admin_id,
  ADD COLUMN reviewed_at          DATE        NULL AFTER reviewed_by_name;

ALTER TABLE appeals
  ADD CONSTRAINT fk_app_reviewer FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(adminID);