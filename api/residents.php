<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

require_admin(); // every action on this file needs a logged-in Admin OR Moderator
                 // (deactivate + delete additionally need require_administrator(), see below)

/* Columns returned to the front end for a resident. */
const RESIDENT_COLUMNS = "residentID AS id, fullName AS name, firstName, middleName, lastName, suffix, date_of_birth AS dob, address, contactNumber AS contact, email, status";

/* Shared validation for the add / update forms.
   Returns [nameParts, dob, address, contact, email]. */
function read_resident_fields(array $b) {
    $n = read_name_parts($b);
    $dob = trim($b['dob'] ?? '');
    $street = strip_barangay(clean_text($b['street'] ?? ''));
    $contactRaw = trim($b['contact'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));

    if (!$dob || !$street || !$contactRaw || !$email) fail('Please fill out all required fields.');
    if (($err = birthdate_error($dob)) !== null) fail($err);
    if (!valid_street($street)) fail(STREET_RULE_MESSAGE);
    $contact = normalize_contact($contactRaw);
    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!valid_email($email)) fail('Please enter a valid email address.');

    return [$n, $dob, compose_address($street), $contact, $email];
}

/* ---------------------------------------------------------
   GET ?action=list&q=search           (Admin + Moderator)
   Sorted by account number (Barangay ID), oldest first.
--------------------------------------------------------- */
if ($action === 'list' && $method === 'GET') {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $stmt = $pdo->prepare("SELECT " . RESIDENT_COLUMNS . "
            FROM residents WHERE fullName LIKE ? OR residentID LIKE ? OR email LIKE ? ORDER BY residentID ASC");
        $like = "%$q%";
        $stmt->execute([$like, $like, $like]);
    } else {
        $stmt = $pdo->query("SELECT " . RESIDENT_COLUMNS . " FROM residents ORDER BY residentID ASC");
    }
    json_out(['ok' => true, 'residents' => $stmt->fetchAll()]);
}

/* ---------------------------------------------------------
   GET ?action=get&id=...              (Admin + Moderator)
--------------------------------------------------------- */
if ($action === 'get' && $method === 'GET') {
    $id = $_GET['id'] ?? '';
    $stmt = $pdo->prepare("SELECT " . RESIDENT_COLUMNS . " FROM residents WHERE residentID = ?");
    $stmt->execute([$id]);
    $r = $stmt->fetch();
    if (!$r) fail('Resident record not found.', 404);
    json_out(['ok' => true, 'resident' => $r]);
}

/* ---------------------------------------------------------
   POST ?action=add                    (Admin + Moderator)
   { firstName, middleName?, lastName, suffix?, dob, street, contact, email }
--------------------------------------------------------- */
if ($action === 'add' && $method === 'POST') {
    $b = body_json();
    [$n, $dob, $address, $contact, $email] = read_resident_fields($b);

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) fail('That email address is already registered.');

    $newId = gen_resident_id($pdo);
    // Temporary password (always meets the password rules). The resident
    // should change it from the Account page after the first login.
    $tempPassword = gen_temp_password();
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("INSERT INTO residents (residentID, fullName, firstName, middleName, lastName, suffix, date_of_birth, address, contactNumber, email, password_hash, status) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Active')");
    $stmt->execute([$newId, $n['full'], $n['first'], $n['middle'] ?: null, $n['last'], $n['suffix'] ?: null, $dob, $address, $contact, $email, $hash]);

    json_out(['ok' => true, 'id' => $newId, 'tempPassword' => $tempPassword]);
}

/* ---------------------------------------------------------
   POST ?action=update                 (Admin + Moderator)
   { id, firstName, middleName?, lastName, suffix?, dob, street, contact, email }
--------------------------------------------------------- */
if ($action === 'update' && $method === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    [$n, $dob, $address, $contact, $email] = read_resident_fields($b);

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE residentID = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) fail('Resident record not found.', 404);

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE email = ? AND residentID <> ?");
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) fail('That email address is already in use.');

    $stmt = $pdo->prepare("UPDATE residents SET fullName=?, firstName=?, middleName=?, lastName=?, suffix=?, date_of_birth=?, address=?, contactNumber=?, email=? WHERE residentID=?");
    $stmt->execute([$n['full'], $n['first'], $n['middle'] ?: null, $n['last'], $n['suffix'] ?: null, $dob, $address, $contact, $email, $id]);

    json_out(['ok' => true]);
}

/* ---------------------------------------------------------
   POST ?action=toggleStatus  { id }   (ADMINISTRATOR ONLY)
--------------------------------------------------------- */
if ($action === 'toggleStatus' && $method === 'POST') {
    require_administrator();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $stmt = $pdo->prepare("UPDATE residents SET status = IF(status='Active','Inactive','Active') WHERE residentID = ?");
    $stmt->execute([$id]);
    json_out(['ok' => true]);
}

/* ---------------------------------------------------------
   POST ?action=delete  { id }         (ADMINISTRATOR ONLY)
   The account can be deleted even when it has old (Completed,
   Rejected or Cancelled) requests — those are removed with it.
   It is only blocked while a request is still in progress.
--------------------------------------------------------- */
if ($action === 'delete' && $method === 'POST') {
    require_administrator();
    $b = body_json();
    $id = trim($b['id'] ?? '');

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE residentID = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) fail('Resident record not found.', 404);

    $err = delete_resident_account($pdo, $id);
    if ($err !== null) fail($err);

    json_out(['ok' => true]);
}

fail('Unknown residents action.', 404);
