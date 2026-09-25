<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';

/* ---------------------------------------------------------
   GET ?action=session
   Returns who (if anyone) is currently logged in, so the
   front end can restore state on page refresh.
   Admin / Moderator users also get their `accessLevel`.
--------------------------------------------------------- */
if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (current_resident_id()) {
        $stmt = $pdo->prepare("SELECT residentID AS id, fullName AS name, address, contactNumber AS contact, email, status FROM residents WHERE residentID = ?");
        $stmt->execute([current_resident_id()]);
        $r = $stmt->fetch();
        if ($r) json_out(['ok' => true, 'role' => 'resident', 'user' => $r]);
        session_destroy();
    }
    if (current_admin_id()) {
        $stmt = $pdo->prepare("SELECT adminID AS id, fullName AS name, role, access_level AS accessLevel, contactNumber AS contact, email FROM admins WHERE adminID = ?");
        $stmt->execute([current_admin_id()]);
        $a = $stmt->fetch();
        if ($a) json_out(['ok' => true, 'role' => 'admin', 'user' => $a]);
        session_destroy();
    }
    if (!empty($_SESSION['admin_id'])) { // the account was deactivated or removed
        $_SESSION = [];
        session_destroy();
    }
    json_out(['ok' => true, 'role' => null, 'user' => null]);
}

/* ---------------------------------------------------------
   GET ?action=nextResidentId
   Public preview of the Barangay ID a new registrant would
   receive, computed the same way as the real assignment
   (see gen_resident_id()). This is a preview only — the ID is
   actually reserved at the moment of INSERT during
   residentRegister, so if two people register at the exact
   same instant the second one simply gets the next number
   after that. Purely informational for the registration form.
--------------------------------------------------------- */
if ($action === 'nextResidentId' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(['ok' => true, 'nextId' => gen_resident_id($pdo)]);
}

/* ---------------------------------------------------------
   POST ?action=residentLogin   { id, password }
--------------------------------------------------------- */
if ($action === 'residentLogin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $pass = (string) ($b['password'] ?? '');
    if (!$id || !$pass) fail('Please enter your Barangay ID and password.');
    if (mb_strlen($id) > 20) fail('Resident account not found. Please check your Barangay ID.');

    $stmt = $pdo->prepare("SELECT * FROM residents WHERE residentID = ?");
    $stmt->execute([$id]);
    $r = $stmt->fetch();
    if (!$r) fail('Resident account not found. Please check your Barangay ID.');
    if ($r['status'] !== 'Active') fail('This resident account is inactive. Please contact the Barangay Office.');
    if (!password_verify($pass, $r['password_hash'])) fail('Incorrect password. Please try again.');

    session_regenerate_id(true);
    $_SESSION['resident_id'] = $r['residentID'];
    unset($_SESSION['admin_id']);

    json_out(['ok' => true, 'user' => [
        'id' => $r['residentID'], 'name' => $r['fullName'], 'address' => $r['address'],
        'contact' => $r['contactNumber'], 'email' => $r['email'], 'status' => $r['status'],
    ]]);
}

/* ---------------------------------------------------------
   POST ?action=residentRegister
   { firstName, middleName?, lastName, suffix?, dob, street,
     contact, email, password, confirm }
   `street` is only the house number / street. The barangay
   (San Isidro, Cabuyao, Laguna) is added automatically.
   The four name parts are joined into residents.fullName.
--------------------------------------------------------- */
if ($action === 'residentRegister' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body_json();
    $n = read_name_parts($b);
    $dob = trim($b['dob'] ?? '');
    $street = strip_barangay(clean_text($b['street'] ?? ''));
    $contactRaw = trim($b['contact'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));
    $pass = (string) ($b['password'] ?? '');
    $confirm = (string) ($b['confirm'] ?? '');

    if (!$dob || !$street || !$contactRaw || !$email || $pass === '' || $confirm === '') fail('Please fill out all required fields.');
    if (($err = birthdate_error($dob)) !== null) fail($err);
    if (!valid_street($street)) fail(STREET_RULE_MESSAGE);
    $contact = normalize_contact($contactRaw);
    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!valid_email($email)) fail('Please enter a valid email address.');
    if (!valid_password($pass)) fail(PASSWORD_RULE_MESSAGE);
    if ($pass !== $confirm) fail('Passwords do not match.');

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) fail('That email address is already registered.');

    $address = compose_address($street);
    $newId = gen_resident_id($pdo);
    $hash = password_hash($pass, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("INSERT INTO residents (residentID, fullName, firstName, middleName, lastName, suffix, date_of_birth, address, contactNumber, email, password_hash, status) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Active')");
    $stmt->execute([$newId, $n['full'], $n['first'], $n['middle'] ?: null, $n['last'], $n['suffix'] ?: null, $dob, $address, $contact, $email, $hash]);

    session_regenerate_id(true);
    $_SESSION['resident_id'] = $newId;
    unset($_SESSION['admin_id']);

    json_out(['ok' => true, 'user' => [
        'id' => $newId, 'name' => $n['full'], 'address' => $address, 'contact' => $contact, 'email' => $email, 'status' => 'Active',
    ]]);
}

/* ---------------------------------------------------------
   POST ?action=adminLogin   { id, password, type }
   type = 'admin' | 'moderator'  (the "Login as" dropdown).
   The chosen type must match the account's real access level.
--------------------------------------------------------- */
if ($action === 'adminLogin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $pass = (string) ($b['password'] ?? '');
    $type = (string) ($b['type'] ?? 'admin');
    if (!in_array($type, ['admin', 'moderator'], true)) fail('Please choose whether you are logging in as an Administrator or a Moderator.');
    if (!$id || !$pass) fail('Please enter your ID and password.');
    if (mb_strlen($id) > 20) fail('Account not found. Please check your ID.');

    $stmt = $pdo->prepare("SELECT * FROM admins WHERE adminID = ?");
    $stmt->execute([$id]);
    $a = $stmt->fetch();
    if (!$a) fail('Account not found. Please check your ID.');
    if (!password_verify($pass, $a['password_hash'])) fail('Incorrect password. Please try again.');
    if ($a['status'] !== 'Active') fail('This account has been deactivated. Please contact an Administrator.');
    if ($a['access_level'] !== $type) {
        $label = $a['access_level'] === 'admin' ? 'Administrator' : 'Moderator';
        fail("This is an $label account. Please change \"Login as\" to $label.");
    }

    session_regenerate_id(true);
    $_SESSION['admin_id'] = $a['adminID'];
    unset($_SESSION['resident_id']);

    json_out(['ok' => true, 'user' => [
        'id' => $a['adminID'], 'name' => $a['fullName'], 'role' => $a['role'], 'accessLevel' => $a['access_level'],
        'contact' => $a['contactNumber'], 'email' => $a['email'],
    ]]);
}

/* ---------------------------------------------------------
   POST ?action=logout
--------------------------------------------------------- */
if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

fail('Unknown auth action.', 404);
