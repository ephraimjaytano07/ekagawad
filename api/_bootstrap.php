<?php
/* Included at the top of every file in /api */

/* Session cookie hardening: not readable by JavaScript, not sent
   from other sites, and only over HTTPS when the site uses HTTPS. */
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

/* Any unexpected server error is returned as clean JSON instead of an
   HTML error page, so the front end can show a friendly message. */
set_exception_handler(function ($e) {
    error_log($e);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Something went wrong on the server. Please try again.']);
    exit;
});

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/functions.php';
