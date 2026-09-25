<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* Every action only touches the logged-in person's own notifications:
   a resident's own rows, or the admin broadcast rows (residentID IS NULL). */
function notif_scope() {
    if (current_resident_id()) return ['n.residentID = ?', [current_resident_id()]];
    if (current_admin_id()) return ['n.residentID IS NULL', []];
    fail('Please log in to continue.', 401);
}

/* ---------------------------------------------------------
   GET ?action=list
   Resident sees their own notifications.
   Admin sees the broadcast (residentID IS NULL) notifications.
   Each row includes the linked request's key details (when the
   notification belongs to a request) so the front end can show
   them when the notification is clicked.
--------------------------------------------------------- */
if ($action === 'list' && $method === 'GET') {
    [$where, $params] = notif_scope();
    $stmt = $pdo->prepare("SELECT n.notificationID AS id, n.message AS text, n.is_read AS `read`, n.created_at,
            n.requestID AS requestId, dt.name AS docType, dr.status AS requestStatus, dr.purpose,
            dr.date_requested, res.fullName AS residentName
        FROM notifications n
        LEFT JOIN document_requests dr ON dr.requestID = n.requestID
        LEFT JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
        LEFT JOIN residents res ON res.residentID = dr.residentID
        WHERE $where ORDER BY n.created_at DESC, n.notificationID DESC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['read'] = (bool) $r['read'];
        $r['date'] = fmt_datetime($r['created_at']);
        $r['requestDate'] = fmt_date($r['date_requested']);
        unset($r['created_at'], $r['date_requested']);
    }
    json_out(['ok' => true, 'notifications' => $rows]);
}

/* ---------------------------------------------------------
   POST ?action=markRead  { id }
--------------------------------------------------------- */
if ($action === 'markRead' && $method === 'POST') {
    [$where, $params] = notif_scope();
    $b = body_json();
    $id = (int) ($b['id'] ?? 0);
    $stmt = $pdo->prepare("UPDATE notifications n SET n.is_read = 1 WHERE n.notificationID = ? AND $where");
    $stmt->execute(array_merge([$id], $params));
    json_out(['ok' => true]);
}

/* ---------------------------------------------------------
   POST ?action=markAllRead
--------------------------------------------------------- */
if ($action === 'markAllRead' && $method === 'POST') {
    [$where, $params] = notif_scope();
    $stmt = $pdo->prepare("UPDATE notifications n SET n.is_read = 1 WHERE n.is_read = 0 AND $where");
    $stmt->execute($params);
    json_out(['ok' => true, 'updated' => $stmt->rowCount()]);
}

/* ---------------------------------------------------------
   POST ?action=delete  { id }
--------------------------------------------------------- */
if ($action === 'delete' && $method === 'POST') {
    [$where, $params] = notif_scope();
    $b = body_json();
    $id = (int) ($b['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE n FROM notifications n WHERE n.notificationID = ? AND $where");
    $stmt->execute(array_merge([$id], $params));
    json_out(['ok' => true]);
}

/* ---------------------------------------------------------
   POST ?action=deleteAll
--------------------------------------------------------- */
if ($action === 'deleteAll' && $method === 'POST') {
    [$where, $params] = notif_scope();
    $stmt = $pdo->prepare("DELETE n FROM notifications n WHERE $where");
    $stmt->execute($params);
    json_out(['ok' => true, 'deleted' => $stmt->rowCount()]);
}

/* ---------------------------------------------------------
   GET ?action=unreadCount  (used for the little bell badge)
--------------------------------------------------------- */
if ($action === 'unreadCount' && $method === 'GET') {
    if (current_resident_id()) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE residentID = ? AND is_read = 0");
        $stmt->execute([current_resident_id()]);
    } elseif (current_admin_id()) {
        $stmt = $pdo->query("SELECT COUNT(*) FROM notifications WHERE residentID IS NULL AND is_read = 0");
    } else {
        json_out(['ok' => true, 'count' => 0]);
    }
    json_out(['ok' => true, 'count' => (int) $stmt->fetchColumn()]);
}

fail('Unknown notifications action.', 404);
