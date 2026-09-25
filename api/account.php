<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);

/* ---------------------------------------------------------
   POST ?action=updateResident
   { contact, email, newPassword, confirmPassword }
--------------------------------------------------------- */
if ($action === 'updateResident') {
    $rid = require_resident();
    $b = body_json();
    $contact = normalize_contact(trim($b['contact'] ?? ''));
    $email = strtolower(trim($b['email'] ?? ''));
    $newPass = (string) ($b['newPassword'] ?? '');
    $confirmPass = (string) ($b['confirmPassword'] ?? '');

    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!valid_email($email)) fail('Please enter a valid email address.');

    $stmt = $pdo->prepare("SELECT 1 FROM residents WHERE email = ? AND residentID <> ?");
    $stmt->execute([$email, $rid]);
    if ($stmt->fetch()) fail('That email address is already in use.');

    if ($newPass !== '' && !valid_password($newPass)) fail(PASSWORD_RULE_MESSAGE);
    if ($newPass !== $confirmPass) fail('New passwords do not match.');

    if ($newPass !== '') {
        $hash = password_hash($newPass, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("UPDATE residents SET contactNumber=?, email=?, password_hash=? WHERE residentID=?");
        $stmt->execute([$contact, $email, $hash, $rid]);
    } else {
        $stmt = $pdo->prepare("UPDATE residents SET contactNumber=?, email=? WHERE residentID=?");
        $stmt->execute([$contact, $email, $rid]);
    }

    json_out(['ok' => true, 'contact' => $contact, 'email' => $email]);
}

/* ---------------------------------------------------------
   POST ?action=updateAdmin
   { name, contact, email, newPassword, confirmPassword }
--------------------------------------------------------- */
if ($action === 'updateAdmin') {
    $aid = require_admin();
    $b = body_json();
    $name = clean_text($b['name'] ?? '');
    $contact = normalize_contact(trim($b['contact'] ?? ''));
    $email = strtolower(trim($b['email'] ?? ''));
    $newPass = (string) ($b['newPassword'] ?? '');
    $confirmPass = (string) ($b['confirmPassword'] ?? '');

    if (!$name) fail('Please enter your name.');
    if (!valid_name($name)) fail(NAME_RULE_MESSAGE);
    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!valid_email($email)) fail('Please enter a valid email address.');

    $stmt = $pdo->prepare("SELECT 1 FROM admins WHERE email = ? AND adminID <> ?");
    $stmt->execute([$email, $aid]);
    if ($stmt->fetch()) fail('That email address is already in use.');

    if ($newPass !== '' && !valid_password($newPass)) fail(PASSWORD_RULE_MESSAGE);
    if ($newPass !== $confirmPass) fail('New passwords do not match.');

    if ($newPass !== '') {
        $hash = password_hash($newPass, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("UPDATE admins SET fullName=?, contactNumber=?, email=?, password_hash=? WHERE adminID=?");
        $stmt->execute([$name, $contact, $email, $hash, $aid]);
    } else {
        $stmt = $pdo->prepare("UPDATE admins SET fullName=?, contactNumber=?, email=? WHERE adminID=?");
        $stmt->execute([$name, $contact, $email, $aid]);
    }

    json_out(['ok' => true, 'name' => $name, 'contact' => $contact, 'email' => $email]);
}

/* ---------------------------------------------------------
   POST ?action=deleteResident   { password }
   A resident deletes their OWN account. The password must be
   re-entered. Accounts with a request still in progress are
   protected (see delete_resident_account()).
--------------------------------------------------------- */
if ($action === 'deleteResident') {
    $rid = require_resident();
    $b = body_json();
    $pass = (string) ($b['password'] ?? '');
    if ($pass === '') fail('Please enter your password to confirm.');

    $stmt = $pdo->prepare("SELECT fullName, password_hash FROM residents WHERE residentID = ?");
    $stmt->execute([$rid]);
    $r = $stmt->fetch();
    if (!$r || !password_verify($pass, $r['password_hash'])) fail('Incorrect password. Your account was not deleted.');

    $err = delete_resident_account($pdo, $rid);
    if ($err !== null) fail($err);

    add_notification($pdo, null, "{$r['fullName']} ($rid) deleted their resident account.");

    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

fail('Unknown account action.', 404);
