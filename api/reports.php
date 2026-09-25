<?php
require_once __DIR__ . '/_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed.', 405);

$from = $_GET['from'] ?? '';
$to = $_GET['to'] ?? '';
$status = $_GET['status'] ?? 'All';
$doc = $_GET['doc'] ?? 'All';

$sql = "SELECT dr.requestID AS id, res.fullName AS residentName, dr.residentID, dt.name AS docType, dr.date_requested, dr.status, dr.released_by AS releasedBy
    FROM document_requests dr
    JOIN residents res ON res.residentID = dr.residentID
    JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
    WHERE 1=1";
$params = [];
if ($from) { $sql .= " AND dr.date_requested >= ?"; $params[] = $from; }
if ($to)   { $sql .= " AND dr.date_requested <= ?"; $params[] = $to; }
if ($status !== 'All') { $sql .= " AND dr.status = ?"; $params[] = $status; }
if ($doc !== 'All')    { $sql .= " AND dt.name = ?"; $params[] = $doc; }
$sql .= " ORDER BY dr.date_requested DESC, dr.requestID DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$byStatus = [];
$byDoc = [];
$residentIds = [];
foreach ($rows as &$r) {
    $byStatus[$r['status']] = ($byStatus[$r['status']] ?? 0) + 1;
    $byDoc[$r['docType']] = ($byDoc[$r['docType']] ?? 0) + 1;
    $residentIds[$r['residentID']] = true;
    $r['date'] = fmt_date($r['date_requested']);
    unset($r['date_requested'], $r['residentID']);
}

$totalResidents = (int) $pdo->query("SELECT COUNT(*) FROM residents")->fetchColumn();
$activeResidents = (int) $pdo->query("SELECT COUNT(*) FROM residents WHERE status='Active'")->fetchColumn();

json_out([
    'ok' => true,
    'requests' => $rows,
    'byStatus' => $byStatus,
    'byDoc' => $byDoc,
    'totalResidents' => $totalResidents,
    'activeResidents' => $activeResidents,
    'requestedCount' => count($residentIds),
    'filters' => ['from' => $from, 'to' => $to, 'status' => $status, 'doc' => $doc],
]);
