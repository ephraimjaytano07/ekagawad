<?php
/* ============================================================
   includes/functions.php
   ------------------------------------------------------------
   Shared helpers used by every file in /api. Include this
   AFTER starting the session and AFTER config/db.php.

   NEW in v3:
   - Admin accounts have an access level: 'admin' or 'moderator'
     (see admin_account(), require_admin(), require_administrator()).
     A deactivated account is treated as logged out immediately.
   - Resident names are split into first / middle / last / suffix
     (see read_name_parts(), compose_full_name()).
   - gen_staff_id() creates MOD-001, MOD-002 ... for new moderators.
   ============================================================ */

/* The whole system serves ONE barangay, so this is fixed and
   never typed in by users. Residents only enter their house
   number / street; this suffix is added automatically. */
const BARANGAY_LABEL = 'Barangay San Isidro, Cabuyao, Laguna';
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const NAME_RULE_MESSAGE = 'Please enter a valid full name (letters, spaces, periods, hyphens and apostrophes only, 2–100 characters).';
const FIRST_NAME_RULE_MESSAGE = 'Please enter a valid first name (letters, spaces, periods, hyphens and apostrophes only, 2–50 characters).';
const MIDDLE_NAME_RULE_MESSAGE = 'Middle name may only contain letters, spaces, periods, hyphens and apostrophes (up to 40 characters).';
const LAST_NAME_RULE_MESSAGE = 'Please enter a valid last name (letters, spaces, periods, hyphens and apostrophes only, 2–40 characters).';
const SUFFIX_RULE_MESSAGE = 'Please choose a valid suffix (Jr., Sr., II, III, IV or V).';
const STREET_RULE_MESSAGE = 'Please enter a valid house number / street (5–100 characters; letters, numbers, spaces and . , # - / \' only).';
const CONTACT_RULE_MESSAGE = 'Please enter a valid Philippine mobile number (+63 9XX XXX XXXX).';
const PASSWORD_RULE_MESSAGE = 'Password must be 8–64 characters and include an uppercase letter, a lowercase letter, a number and a special character, with no spaces.';

/* The only suffixes a resident can pick (optional). */
const SUFFIX_OPTIONS = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function fail($message, $code = 400) {
    json_out(['ok' => false, 'error' => $message], $code);
}

function body_json() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ---------- auth guards (PHP session based) ---------- */

function current_resident_id() {
    return $_SESSION['resident_id'] ?? null;
}

/* The admin row of whoever is logged in as Admin/Moderator (looked up once per request).
   Reads the LIVE row from the database, so a deactivated account or a changed
   access level takes effect on the very next request. */
function admin_account() {
    global $pdo;
    static $cache = [];
    $aid = $_SESSION['admin_id'] ?? null;
    if (!$aid) return null;
    if (!array_key_exists($aid, $cache)) {
        $stmt = $pdo->prepare("SELECT adminID, fullName, role, access_level, status FROM admins WHERE adminID = ?");
        $stmt->execute([$aid]);
        $cache[$aid] = $stmt->fetch() ?: null;
    }
    return $cache[$aid];
}

/* Returns the admin ID only when the account exists AND is Active. */
function current_admin_id() {
    $a = admin_account();
    return ($a && $a['status'] === 'Active') ? $a['adminID'] : null;
}

/* 'admin' or 'moderator' (null when nobody is logged in). */
function current_admin_level() {
    $a = admin_account();
    return ($a && $a['status'] === 'Active') ? $a['access_level'] : null;
}

function require_resident() {
    if (!current_resident_id()) fail('Please log in as a resident to continue.', 401);
    return current_resident_id();
}

/* Any logged-in, active Admin OR Moderator. */
function require_admin() {
    if (!current_admin_id()) {
        if (admin_account()) fail('This account has been deactivated. Please contact an Administrator.', 401);
        fail('Please log in as Admin/Staff to continue.', 401);
    }
    return current_admin_id();
}

/* Administrators ONLY (deactivate/delete residents, resolve appeals, manage moderators). */
function require_administrator() {
    $aid = require_admin();
    if (current_admin_level() !== 'admin') fail('This action is only available to an Administrator.', 403);
    return $aid;
}

/* ---------- text cleaning ---------- */

/* trims and collapses repeated spaces/tabs/newlines into one space */
function clean_text($value) {
    return trim(preg_replace('/\s+/u', ' ', (string) $value));
}

/* ---------- validation (mirrors the front-end rules in js/state.js and js/names.js) ---------- */

function valid_email($email) {
    return mb_strlen($email) <= 150 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/* Full name (used for admin / moderator names and "Released By"):
   letters, spaces, . ' - only; 2–100 chars; at least 2 letters. */
function valid_name($name) {
    $len = mb_strlen($name);
    if ($len < 2 || $len > 100) return false;
    if (!preg_match("/^\p{L}[\p{L}\p{M}\s.'\-]*$/u", $name)) return false;
    return preg_match_all('/\p{L}/u', $name) >= 2;
}

/* One part of a person's name (first / middle / last):
   letters, spaces, . ' - only, starts with a letter, at least $minLetters letters, at most $maxLen characters. */
function valid_name_part($value, $minLetters, $maxLen) {
    $len = mb_strlen($value);
    if ($len < 1 || $len > $maxLen) return false;
    if (!preg_match("/^\p{L}[\p{L}\p{M}\s.'\-]*$/u", $value)) return false;
    return preg_match_all('/\p{L}/u', $value) >= $minLetters;
}

/* Returns the proper suffix ('' when empty, null when it is not one of SUFFIX_OPTIONS).
   "jr" and "JR." both become "Jr." */
function normalize_suffix($value) {
    $v = clean_text($value);
    if ($v === '') return '';
    foreach (SUFFIX_OPTIONS as $opt) {
        if (strcasecmp(rtrim($v, '.'), rtrim($opt, '.')) === 0) return $opt;
    }
    return null;
}

/* "Juan" + "Santos" + "Dela Cruz" + "Jr."  ->  "Juan Santos Dela Cruz Jr."
   Empty parts are skipped. The result always fits the fullName column (max 137 chars). */
function compose_full_name($first, $middle, $last, $suffix) {
    $parts = array_filter([$first, $middle, $last, $suffix], function ($p) { return $p !== '' && $p !== null; });
    return implode(' ', $parts);
}

/* Reads firstName / middleName / lastName / suffix from a request body, cleans and
   validates them, and calls fail() on any problem. Middle name and suffix are optional.
   Returns ['first','middle','last','suffix','full'] (middle / suffix are '' when not given). */
function read_name_parts(array $b) {
    $first = clean_text($b['firstName'] ?? '');
    $middle = clean_text($b['middleName'] ?? '');
    $last = clean_text($b['lastName'] ?? '');
    $suffix = normalize_suffix($b['suffix'] ?? '');

    if ($first === '') fail('First name is required.');
    if ($last === '') fail('Last name is required.');
    if (!valid_name_part($first, 2, 50)) fail(FIRST_NAME_RULE_MESSAGE);
    if ($middle !== '' && !valid_name_part($middle, 1, 40)) fail(MIDDLE_NAME_RULE_MESSAGE);
    if (!valid_name_part($last, 2, 40)) fail(LAST_NAME_RULE_MESSAGE);
    if ($suffix === null) fail(SUFFIX_RULE_MESSAGE);

    return [
        'first' => $first, 'middle' => $middle, 'last' => $last, 'suffix' => $suffix,
        'full' => compose_full_name($first, $middle, $last, $suffix),
    ];
}

/* Position / job title of a moderator (free text, e.g. "Barangay Secretary"). Returns an error message or null. */
function position_error($role) {
    $len = mb_strlen($role);
    if ($len < 2 || $len > 80 || !preg_match("/^[\p{L}\p{M}\p{N}\s.,&'\-\/()]+$/u", $role)) {
        return 'Position must be 2–80 characters (letters, numbers, spaces and . , & - / ( ) \' only).';
    }
    return null;
}

/* House number / street: 5–100 chars, must contain a letter. */
function valid_street($street) {
    $len = mb_strlen($street);
    if ($len < 5 || $len > 100) return false;
    if (!preg_match("/^[\p{L}\p{M}\p{N}\s.,#\-\/']+$/u", $street)) return false;
    return (bool) preg_match('/\p{L}/u', $street);
}

/* If someone types the fixed barangay part themselves, drop it so we never store it twice. */
function strip_barangay($address) {
    return trim(preg_replace('/,\s*Barangay San Isidro(,\s*Cabuyao)?(,\s*Laguna)?\s*$/iu', '', (string) $address), " ,");
}

function compose_address($street) {
    return strip_barangay($street) . ', ' . BARANGAY_LABEL;
}

/* Accepts 9XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX
   (spaces/dashes allowed) and returns the canonical +639XXXXXXXXX,
   or null when it is not a valid Philippine mobile number. */
function normalize_contact($contact) {
    $c = preg_replace('/[\s\-()]/', '', (string) $contact);
    if (preg_match('/^\+?63(9\d{9})$/', $c, $m)) return '+63' . $m[1];
    if (preg_match('/^0(9\d{9})$/', $c, $m)) return '+63' . $m[1];
    if (preg_match('/^(9\d{9})$/', $c, $m)) return '+63' . $m[1];
    return null;
}

function valid_contact($contact) {
    return normalize_contact($contact) !== null;
}

/* 8–64 chars, upper + lower + number + special character, no spaces. */
function valid_password($pass) {
    $pass = (string) $pass;
    $len = mb_strlen($pass);
    if ($len < 8 || $len > 64) return false;
    if (preg_match('/\s/', $pass)) return false;
    return preg_match('/[a-z]/', $pass) && preg_match('/[A-Z]/', $pass)
        && preg_match('/\d/', $pass) && preg_match('/[^A-Za-z0-9]/', $pass);
}

/* Returns an error message, or null when the date of birth is fine (13 years old or above). */
function birthdate_error($dob) {
    $dob = (string) $dob;
    $d = DateTime::createFromFormat('!Y-m-d', $dob);
    if (!$d || $d->format('Y-m-d') !== $dob) return 'Please enter a valid date of birth.';
    $today = new DateTime('today');
    if ($d > $today) return 'Date of birth cannot be in the future.';
    $age = $d->diff($today)->y;
    if ($age < 13) return 'You must be at least 13 years old.';
    if ($age > 120) return 'Please enter a valid date of birth.';
    return null;
}

function valid_birthdate($dob) {
    return birthdate_error($dob) === null;
}

/* Preferred release date: optional, today up to one year ahead. */
function release_date_error($date) {
    if ($date === '' || $date === null) return null;
    $d = DateTime::createFromFormat('!Y-m-d', (string) $date);
    if (!$d || $d->format('Y-m-d') !== $date) return 'Please enter a valid preferred release date.';
    $today = new DateTime('today');
    if ($d < $today) return 'Preferred release date cannot be in the past.';
    $limit = (clone $today)->modify('+1 year');
    if ($d > $limit) return 'Preferred release date must be within one year from today.';
    return null;
}

function valid_future_or_today($date) {
    return release_date_error($date) === null;
}

function text_length_error($text, $label, $min, $max) {
    $len = mb_strlen($text);
    if ($len < $min) return "$label must be at least $min characters.";
    if ($len > $max) return "$label must not exceed $max characters.";
    return null;
}

/* Random temporary password that always satisfies valid_password(). */
function gen_temp_password() {
    $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    $lower = 'abcdefghijkmnopqrstuvwxyz';
    $digits = '23456789';
    $special = '!@#$%*?';
    $pick = function ($set) { return $set[random_int(0, strlen($set) - 1)]; };
    $chars = [$pick($upper), $pick($lower), $pick($digits), $pick($special)];
    $all = $upper . $lower . $digits;
    for ($i = 0; $i < 6; $i++) $chars[] = $pick($all);
    for ($i = count($chars) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        $tmp = $chars[$i]; $chars[$i] = $chars[$j]; $chars[$j] = $tmp;
    }
    return implode('', $chars);
}

/* ---------- id generation ---------- */

function gen_resident_id(PDO $pdo) {
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT residentID FROM residents WHERE residentID LIKE ? ORDER BY residentID DESC LIMIT 1");
    $stmt->execute(["$year-%"]);
    $last = $stmt->fetchColumn();
    $next = $last ? ((int) substr($last, 5)) + 1 : 1;
    return $year . '-' . str_pad($next, 5, '0', STR_PAD_LEFT);
}

function gen_request_id(PDO $pdo) {
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT requestID FROM document_requests WHERE requestID LIKE ? ORDER BY requestID DESC LIMIT 1");
    $stmt->execute(["BR-$year-%"]);
    $last = $stmt->fetchColumn();
    $next = $last ? ((int) substr($last, -4)) + 1 : 1;
    return "BR-$year-" . str_pad($next, 4, '0', STR_PAD_LEFT);
}

/* Next Moderator ID: MOD-001, MOD-002 ...  ($prefix is a fixed value from our own code, never user input) */
function gen_staff_id(PDO $pdo, $prefix = 'MOD') {
    $start = strlen($prefix) + 2; // "MOD-" is 4 characters, so the number starts at position 5
    $stmt = $pdo->prepare("SELECT adminID FROM admins WHERE adminID LIKE ? ORDER BY CAST(SUBSTRING(adminID, $start) AS UNSIGNED) DESC LIMIT 1");
    $stmt->execute(["$prefix-%"]);
    $last = $stmt->fetchColumn();
    $next = $last ? ((int) substr($last, strlen($prefix) + 1)) + 1 : 1;
    return $prefix . '-' . str_pad($next, 3, '0', STR_PAD_LEFT);
}

/* ---------- history / audit trail ---------- */

function add_history(PDO $pdo, $requestId, $title, $description, $byName, $byRole) {
    $stmt = $pdo->prepare("INSERT INTO request_status_history (requestID, title, description, changed_by_name, changed_by_role, changed_at) VALUES (?,?,?,?,?,NOW())");
    $stmt->execute([$requestId, $title, mb_substr((string) $description, 0, 500), $byName, $byRole]);
}

/* ---------- notifications ----------
   $residentId = null  ->  broadcast notification for admin/staff.
   $requestId links the notification to a request so the
   notification can show that request's details when clicked. */
function add_notification(PDO $pdo, $residentId, $message, $requestId = null) {
    $stmt = $pdo->prepare("INSERT INTO notifications (residentID, requestID, message) VALUES (?,?,?)");
    $stmt->execute([$residentId, $requestId, mb_substr((string) $message, 0, 500)]);
}

/* ---------- uploads (supporting documents) ---------- */

function detect_mime($path, $fallback = '') {
    if (class_exists('finfo')) {
        $f = new finfo(FILEINFO_MIME_TYPE);
        $m = $f->file($path);
        if ($m) return $m;
    }
    return $fallback;
}

/* Validates an uploaded supporting document. Calls fail() on any problem,
   otherwise returns ['mime' => ..., 'ext' => ...]. The extension comes from
   the REAL file type, never from the file name the browser sent. */
function check_upload(array $file) {
    $err = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) fail('Supporting document must not be larger than 5 MB.');
    if ($err !== UPLOAD_ERR_OK) fail('The supporting document could not be uploaded. Please try again.');
    if ($file['size'] <= 0) fail('The supporting document is empty.');
    if ($file['size'] > UPLOAD_MAX_BYTES) fail('Supporting document must not be larger than 5 MB.');
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
    $mime = detect_mime($file['tmp_name'], $file['type'] ?? '');
    if (!isset($allowed[$mime])) fail('Supporting document must be an image (JPG, PNG, GIF or WEBP) or a PDF file.');
    return ['mime' => $mime, 'ext' => $allowed[$mime]];
}

/* Normalizes a $_FILES['name'][] style field (from a <input multiple name="x[]">)
   into a flat list of single-file arrays, skipping empty slots. */
function normalize_files_array($filesField) {
    if (!isset($filesField['name'])) return [];
    if (!is_array($filesField['name'])) return [$filesField];
    $out = [];
    foreach ($filesField['name'] as $i => $name) {
        if (($filesField['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
        $out[] = [
            'name'     => $filesField['name'][$i],
            'type'     => $filesField['type'][$i],
            'tmp_name' => $filesField['tmp_name'][$i],
            'error'    => $filesField['error'][$i],
            'size'     => $filesField['size'][$i],
        ];
    }
    return $out;
}

function save_upload($requestId, array $file, $ext) {
    $dir = __DIR__ . '/../uploads/requests/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $safeName = $requestId . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . $safeName)) return null;
    return 'uploads/requests/' . $safeName;
}

function delete_upload_file($relPath) {
    $p = __DIR__ . '/../uploads/requests/' . basename((string) $relPath);
    if (is_file($p)) @unlink($p);
}

function clean_file_name($name) {
    $n = basename(str_replace('\\', '/', (string) $name));
    $n = preg_replace('/[^\p{L}\p{N}\s._\-()]/u', '', $n);
    return mb_substr($n !== '' ? $n : 'document', 0, 200);
}

/* ---------- resident account deletion ----------
   Shared by "admin deletes a resident" and "resident deletes own account".
   Old finished/rejected/cancelled requests are removed together with the
   account; accounts that still have a request in progress are protected.
   Returns an error message, or null on success. */
function delete_resident_account(PDO $pdo, $residentId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM document_requests WHERE residentID = ? AND status IN ('Pending','On Hold','Approved','Ready for Pickup')");
    $stmt->execute([$residentId]);
    $active = (int) $stmt->fetchColumn();
    if ($active > 0) {
        return "This account still has $active request(s) in progress (Pending, On Hold, Approved or Ready for Pickup). Please wait until they are Completed, Rejected or Cancelled before deleting the account.";
    }

    $stmt = $pdo->prepare("SELECT ra.filePath FROM request_attachments ra JOIN document_requests dr ON dr.requestID = ra.requestID WHERE dr.residentID = ?");
    $stmt->execute([$residentId]);
    $files = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM document_requests WHERE residentID = ?")->execute([$residentId]);
        $pdo->prepare("DELETE FROM residents WHERE residentID = ?")->execute([$residentId]);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return 'Unable to delete this account right now. Please try again.';
    }

    foreach ($files as $f) delete_upload_file($f);
    return null;
}

/* ---------- display formatting (kept identical to the old UI look, e.g. "Aug 15, 2026") ---------- */

function fmt_date($isoDateOrNull) {
    if (!$isoDateOrNull) return '';
    $t = strtotime($isoDateOrNull);
    if (!$t) return '';
    return date('M j, Y', $t);
}

function fmt_datetime($isoOrNull) {
    if (!$isoOrNull) return '';
    $t = strtotime($isoOrNull);
    if (!$t) return '';
    return date('M j, Y, g:i A', $t);
}

function today_iso() {
    return date('Y-m-d');
}
