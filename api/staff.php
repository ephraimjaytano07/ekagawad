<?php
require_once __DIR__ . '/_bootstrap.php';

/* ============================================================
   api/staff.php  (NEW)
   ------------------------------------------------------------
   Moderator account management. ADMINISTRATOR ONLY.

   - Only accounts with access_level = 'moderator' can be listed,
     edited, deactivated or reset here. Administrator accounts are
     never touched by this file, so an admin can never lock
     themselves (or another admin) out from this page.
   - Moderators are deactivated, not deleted: rejections, appeals
     and request history point to admins(adminID), so the audit
     trail stays intact.
   ============================================================ */

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

require_administrator();

/* Shared validation for the add / edit form. Returns [name, role, contact, email]. */
function read_staff_fields(array $b) {
    $name = clean_text($b['name'] ?? '');
    $role = clean_text($b['role'] ?? '');
    if ($role === '') $role = 'Moderator';
    $contactRaw = trim($b['contact'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));

    if (!$name || !$contactRaw || !$email) fail('Please fill out all required fields.');
    if (!valid_name($name)) fail(NAME_RULE_MESSAGE);
    if (($e = position_error($role)) !== null) fail($e);
    $contact = normalize_contact($contactRaw);
    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!valid_email($email)) fail('Please enter a valid email address.');

    return [$name, $role, $contact, $email];
}

/* Loads a moderator row by ID, or stops with a 404. */
function load_moderator(PDO $pdo, $id) {
    $stmt = $pdo->prepare("SELECT adminID, fullName, status FROM admins WHERE adminID = ? AND access_level = 'moderator'");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail('Moderator account not found.', 404);
    return $row;
}

/* ---------------------------------------------------------
   GET ?action=list
--------------------------------------------------------- */
if ($action === 'list' && $method === 'GET') {
    $stmt = $pdo->query("SELECT adminID AS id, fullName AS name, role, contactNumber AS contact, email, status
        FROM admins WHERE access_level = 'moderator' ORDER BY adminID ASC");
    json_out(['ok' => true, 'staff' => $stmt->fetchAll()]);
}

/* ---------------------------------------------------------
   POST ?action=add   { name, role?, contact, email }
   Creates MOD-001, MOD-002 ... with a temporary password.
--------------------------------------------------------- */
if ($action === 'add' && $method === 'POST') {
    $b = body_json();
    [$name, $role, $contact, $email] = read_staff_fields($b);

    $stmt = $pdo->prepare("SELECT 1 FROM admins WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) fail('That email address is already in use.');

    $newId = gen_staff_id($pdo, 'MOD');
    $tempPassword = gen_temp_password();
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("INSERT INTO admins (adminID, fullName, role, access_level, status, contactNumber, email, password_hash) VALUES (?,?,?, 'moderator', 'Active', ?,?,?)");
    $stmt->execute([$newId, $name, $role, $contact, $email, $hash]);

    json_out(['ok' => true, 'id' => $newId, 'tempPassword' => $tempPassword]);
}

/* ---------------------------------------------------------
   POST ?action=update   { id, name, role?, contact, email }
--------------------------------------------------------- */
if ($action === 'update' && $method === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    load_moderator($pdo, $id);
    [$name, $role, $contact, $email] = read_staff_fields($b);

    $stmt = $pdo->prepare("SELECT 1 FROM admins WHERE email = ? AND adminID <> ?");
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) fail('That email address is already in use.');

    $stmt = $pdo->prepare("UPDATE admins SET fullName=?, role=?, contactNumber=?, email=? WHERE adminID=? AND access_level='moderator'");
    $stmt->execute([$name, $role, $contact, $email, $id]);

    json_out(['ok' => true]);
}

/* ---------------------------------------------------------
   POST ?action=toggleStatus   { id }
   A deactivated moderator can no longer log in, and an open
   session stops working on its very next request.
--------------------------------------------------------- */
if ($action === 'toggleStatus' && $method === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $row = load_moderator($pdo, $id);
    $newStatus = $row['status'] === 'Active' ? 'Inactive' : 'Active';

    $stmt = $pdo->prepare("UPDATE admins SET status = ? WHERE adminID = ? AND access_level = 'moderator'");
    $stmt->execute([$newStatus, $id]);

    json_out(['ok' => true, 'status' => $newStatus]);
}

/* ---------------------------------------------------------
   POST ?action=resetPassword   { id }
   Generates a new temporary password and returns it once.
--------------------------------------------------------- */
if ($action === 'resetPassword' && $method === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    load_moderator($pdo, $id);

    $tempPassword = gen_temp_password();
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE adminID = ? AND access_level = 'moderator'");
    $stmt->execute([$hash, $id]);

    json_out(['ok' => true, 'tempPassword' => $tempPassword]);
}

fail('Unknown staff action.', 404);
