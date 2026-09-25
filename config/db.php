<?php
/* ============================================================
   config/db.php
   ------------------------------------------------------------
   Single place that opens the database connection. Every PHP
   file that needs the database includes this file.

   EDIT THESE FOUR VALUES to match your actual MySQL setup
   (XAMPP/WAMP default is usually host=localhost, user=root,
   password='' — empty).
   ============================================================ */

$DB_HOST = 'localhost';
$DB_NAME = 'ekagawad';
$DB_USER = 'root';
$DB_PASS = '';

$dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['ok' => false, 'error' => 'Database connection failed. Check config/db.php.']));
}
