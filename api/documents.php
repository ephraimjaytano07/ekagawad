<?php
require_once __DIR__ . '/_bootstrap.php';

/* Public-ish list — used on the landing page and inside both
   portals. These rows come from document_types, seeded once in
   database/schema.sql, and are the real, permanent catalog of
   documents this barangay issues (Clearance, Residency,
   Indigency, Good Moral, Business Clearance, Barangay ID). */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT documentTypeID AS id, name, shortName AS short, icon, description AS `desc`, purpose, requirements, supporting_document AS supportingDocument FROM document_types WHERE is_active = 1 ORDER BY name");
    json_out(['ok' => true, 'documents' => $stmt->fetchAll()]);
}

fail('Method not allowed.', 405);
