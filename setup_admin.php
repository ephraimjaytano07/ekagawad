<?php
/* ============================================================
   setup_admin.php
   ------------------------------------------------------------
   Run this ONCE in your browser after importing database/schema.sql,
   e.g. http://localhost/ekagawad/setup_admin.php

   It creates the very first real Admin/Staff account using PHP's
   own password_hash() function (so the hash is guaranteed correct
   for your server), then writes a lock file so this page refuses
   to run again. Delete setup_admin.lock manually if you ever need
   to re-run it (e.g. on a fresh database).
   ============================================================ */

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

$lockFile = __DIR__ . '/setup_admin.lock';
$alreadyHasAdmin = (int) $pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn() > 0;

$error = '';
$success = false;

if (file_exists($lockFile) || $alreadyHasAdmin) {
    $locked = true;
} else {
    $locked = false;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $id = trim($_POST['id'] ?? '');
        $name = clean_text($_POST['name'] ?? '');
        $role = clean_text($_POST['role'] ?? 'Administrator');
        $contactRaw = trim($_POST['contact'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $pass = $_POST['password'] ?? '';
        $confirm = $_POST['confirm'] ?? '';
        $contact = $contactRaw === '' ? null : normalize_contact($contactRaw);

        if (!$id || !$name || !$email || !$pass) {
            $error = 'Please fill out all required fields.';
        } elseif (!preg_match('/^[A-Za-z0-9\-]{3,20}$/', $id)) {
            $error = 'Admin/Staff ID may only contain letters, numbers and hyphens (3–20 characters).';
        } elseif (!valid_name($name)) {
            $error = NAME_RULE_MESSAGE;
        } elseif ($role === '' || mb_strlen($role) > 80) {
            $error = 'Please enter a role/position (up to 80 characters).';
        } elseif ($contactRaw !== '' && $contact === null) {
            $error = CONTACT_RULE_MESSAGE;
        } elseif (!valid_email($email)) {
            $error = 'Please enter a valid email address.';
        } elseif (!valid_password($pass)) {
            $error = PASSWORD_RULE_MESSAGE;
        } elseif ($pass !== $confirm) {
            $error = 'Passwords do not match.';
        } else {
            $hash = password_hash($pass, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("INSERT INTO admins (adminID, fullName, role, access_level, contactNumber, email, password_hash) VALUES (?,?,?, 'admin', ?,?,?)");
            $stmt->execute([$id, $name, $role, $contact, $email, $hash]);
            file_put_contents($lockFile, "Admin account $id created on " . date('c'));
            $success = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>e-Kagawad — Initial Setup</title>
<style>
body{font-family:Arial,sans-serif;background:#F4F8FE;color:#10203D;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#fff;padding:36px 40px;border-radius:14px;box-shadow:0 20px 40px rgba(11,30,61,0.12);max-width:440px;width:100%;}
h2{margin-top:0;}
label{display:block;font-size:13px;font-weight:700;margin:14px 0 6px;}
input,select{width:100%;padding:10px;border:1px solid #E3EAF7;border-radius:8px;box-sizing:border-box;font-size:14px;}
button{margin-top:20px;width:100%;padding:12px;background:#2452C4;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;}
.err{background:#FDECEC;color:#B91C1C;padding:10px 14px;border-radius:8px;margin-bottom:10px;font-size:13.5px;}
.ok{background:#E7F8ED;color:#15803D;padding:14px;border-radius:8px;font-size:13.5px;}
.hint{font-size:12px;color:#5B6B8C;margin-top:5px;}
</style>
</head>
<body>
<div class="box">
<h2>e-Kagawad — Initial Setup</h2>
<?php if ($success): ?>
  <div class="ok">Admin account created successfully. You can now log in from the system's Admin/Staff Login screen. This setup page is now locked.</div>
<?php elseif ($locked): ?>
  <div class="ok">Setup has already been completed. An admin account already exists. Delete <code>setup_admin.lock</code> to re-run this (only do this on a fresh database).</div>
<?php else: ?>
  <?php if ($error): ?><div class="err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
  <form method="post">
    <label>Admin/Staff ID</label>
    <input name="id" placeholder="e.g. ADM-001" maxlength="20" required value="<?= htmlspecialchars($_POST['id'] ?? '') ?>">
    <label>Full Name</label>
    <input name="name" placeholder="e.g. Juan Dela Cruz" maxlength="100" required value="<?= htmlspecialchars($_POST['name'] ?? '') ?>">
    <label>Role/Position</label>
    <input name="role" value="<?= htmlspecialchars($_POST['role'] ?? 'Administrator') ?>" maxlength="80" required>
    <label>Contact Number</label>
    <input name="contact" placeholder="+63 9XX XXX XXXX" maxlength="16" value="<?= htmlspecialchars($_POST['contact'] ?? '') ?>">
    <label>Email</label>
    <input name="email" type="email" maxlength="150" required value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
    <label>Password</label>
    <input name="password" type="password" minlength="8" maxlength="64" required>
    <div class="hint">8–64 characters with an uppercase letter, a lowercase letter, a number and a special character. No spaces.</div>
    <label>Confirm Password</label>
    <input name="confirm" type="password" minlength="8" maxlength="64" required>
    <button type="submit">Create Admin Account</button>
  </form>
<?php endif; ?>
</div>
</body>
</html>
