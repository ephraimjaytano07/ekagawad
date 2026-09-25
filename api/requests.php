<?php
require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* ---------------------------------------------------------
   Build a request's full history array in the exact shape
   the front end already expects: {title, description, date, byName, byRole}
--------------------------------------------------------- */
function fetch_history(PDO $pdo, $requestId) {
    $stmt = $pdo->prepare("SELECT title, description, changed_by_name AS byName, changed_by_role AS byRole, changed_at FROM request_status_history WHERE requestID = ? ORDER BY changed_at ASC, historyID ASC");
    $stmt->execute([$requestId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['date'] = fmt_date($r['changed_at']); unset($r['changed_at']); }
    return $rows;
}

/* Shape a full request row (with joins) into the object the
   front end's admin.js / resident.js already render. */
function shape_request(PDO $pdo, $r) {
    $out = [
        'id' => $r['requestID'],
        'residentId' => $r['residentID'],
        'residentName' => $r['resident_name'],
        'docType' => $r['doc_type_name'],
        'purpose' => $r['purpose'],
        'contactNumber' => $r['contactNumber'],
        'copies' => (int) $r['copies'],
        'preferredDate' => $r['preferred_release_date'] ? fmt_date($r['preferred_release_date']) : '',
        'notes' => $r['notes'] ?? '',
        'date' => fmt_date($r['date_requested']),
        'status' => $r['status'],
        'comments' => $r['comments'] ?? '',
        'verified' => (bool) $r['verified'],
        'residentAddress' => $r['resident_address'] ?? '',
        'approvedByName' => $r['approved_by_name'], 'approvedByRole' => $r['approved_by_role'], 'approvedDate' => fmt_date($r['approved_date']),
        'heldByName' => $r['held_by_name'], 'heldByRole' => $r['held_by_role'], 'heldDate' => fmt_date($r['held_date']),
        'readyByName' => $r['ready_by_name'], 'readyByRole' => $r['ready_by_role'], 'readyDate' => fmt_date($r['ready_date']),
        'releaseDate' => fmt_date($r['release_date']), 'releasedBy' => $r['released_by'],
    ];

    // attachments (ALL of them, in upload order)
    $stmt = $pdo->prepare("SELECT attachmentID, fileName, filePath, fileType FROM request_attachments WHERE requestID = ? ORDER BY attachmentID ASC");
    $stmt->execute([$r['requestID']]);
    $atts = $stmt->fetchAll();
    $out['attachments'] = array_map(function ($a) {
        return ['id' => (int) $a['attachmentID'], 'fileName' => $a['fileName'], 'fileData' => $a['filePath'], 'fileType' => $a['fileType']];
    }, $atts);
    // kept for backward compatibility with any code still reading a single file
    $out['fileName'] = $atts ? $atts[0]['fileName'] : '';
    $out['fileData'] = $atts ? $atts[0]['filePath'] : null;
    $out['fileType'] = $atts ? $atts[0]['fileType'] : '';

    // rejection
    $stmt = $pdo->prepare("SELECT rr.reason, rr.rejected_at, a.fullName AS admin_name, a.role AS admin_role FROM request_rejections rr JOIN admins a ON a.adminID = rr.adminID WHERE rr.requestID = ?");
    $stmt->execute([$r['requestID']]);
    $rej = $stmt->fetch();
    $out['rejectionReason'] = $rej['reason'] ?? '';
    $out['rejectedByName'] = $rej['admin_name'] ?? '';
    $out['rejectedByRole'] = $rej['admin_role'] ?? '';
    $out['rejectedDate'] = $rej ? fmt_date($rej['rejected_at']) : '';

    // cancellation
    $stmt = $pdo->prepare("SELECT rc.reason, rc.cancelled_at, res.fullName AS resident_name FROM request_cancellations rc JOIN residents res ON res.residentID = rc.residentID WHERE rc.requestID = ?");
    $stmt->execute([$r['requestID']]);
    $can = $stmt->fetch();
    $out['cancellationReason'] = $can['reason'] ?? '';
    $out['cancelledByName'] = $can['resident_name'] ?? '';
    $out['cancellationDate'] = $can ? fmt_date($can['cancelled_at']) : '';

    // appeal (latest)
    $stmt = $pdo->prepare("SELECT ap.*, res.fullName AS resident_name, a.fullName AS resolved_by_name FROM appeals ap JOIN document_requests dr2 ON dr2.requestID = ap.requestID JOIN residents res ON res.residentID = dr2.residentID LEFT JOIN admins a ON a.adminID = ap.resolved_by_admin_id WHERE ap.requestID = ? ORDER BY ap.appealID DESC LIMIT 1");
    $stmt->execute([$r['requestID']]);
    $ap = $stmt->fetch();
        if ($ap) {
        $out['appealStatus'] = $ap['appeal_status'];
        $out['appealReason'] = $ap['appeal_reason'];
        $out['appealImages'] = $ap['appeal_images'] ? (json_decode($ap['appeal_images'], true) ?: []) : [];
        $out['appealReviewed'] = (bool) $ap['reviewed'];
        $out['appealReviewedBy'] = $ap['reviewed_by_name'];
        $out['appealReviewedDate'] = fmt_date($ap['reviewed_at']);
        $out['appealBy'] = $ap['resident_name'];
        $out['appealDate'] = fmt_date($ap['appeal_date']);
        $out['appealResolvedBy'] = $ap['resolved_by_name'];
        $out['appealResolvedDate'] = fmt_date($ap['resolved_at']);
        $out['appealResolution'] = $ap['resolution_remarks'];
    } else {
        $out['appealStatus'] = 'None';
        $out['appealReason'] = ''; $out['appealImages'] = []; $out['appealReviewed'] = false;
        $out['appealBy'] = ''; $out['appealDate'] = '';
    }

    $out['history'] = fetch_history($pdo, $r['requestID']);
    return $out;
}

const REQUEST_SELECT = "SELECT dr.*, res.fullName AS resident_name, res.address AS resident_address, dt.name AS doc_type_name
    FROM document_requests dr
    JOIN residents res ON res.residentID = dr.residentID
    JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID";

/* Loads one request (with resident + document type names) for the write actions below. */
function load_request(PDO $pdo, $id) {
    $stmt = $pdo->prepare("SELECT dr.*, res.fullName AS resident_name, dt.name AS doc_type_name, dt.supporting_document FROM document_requests dr JOIN residents res ON res.residentID = dr.residentID JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID WHERE dr.requestID = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function load_admin(PDO $pdo, $aid) {
    $stmt = $pdo->prepare("SELECT fullName, role FROM admins WHERE adminID = ?");
    $stmt->execute([$aid]);
    return $stmt->fetch();
}

/* ===========================================================
   RESIDENT: my own requests (list)
=========================================================== */
if ($action === 'myList' && $method === 'GET') {
    $rid = require_resident();
    $stmt = $pdo->prepare("SELECT dr.requestID AS id, dt.name AS docType, dr.date_requested, dr.status
        FROM document_requests dr JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
        WHERE dr.residentID = ? ORDER BY dr.date_requested DESC, dr.requestID DESC");
    $stmt->execute([$rid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['date'] = fmt_date($r['date_requested']); unset($r['date_requested']); }
    json_out(['ok' => true, 'requests' => $rows]);
}

/* ===========================================================
   RESIDENT: dashboard stats + recent
=========================================================== */
if ($action === 'myStats' && $method === 'GET') {
    $rid = require_resident();
    $stmt = $pdo->prepare("SELECT status, COUNT(*) AS total FROM document_requests WHERE residentID = ? GROUP BY status");
    $stmt->execute([$rid]);
    $counts = [];
    foreach ($stmt->fetchAll() as $row) $counts[$row['status']] = (int) $row['total'];

    $stmt = $pdo->prepare("SELECT dr.requestID AS id, dt.name AS docType, dr.date_requested, dr.status
        FROM document_requests dr JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
        WHERE dr.residentID = ? ORDER BY dr.date_requested DESC, dr.requestID DESC LIMIT 3");
    $stmt->execute([$rid]);
    $recent = $stmt->fetchAll();
    foreach ($recent as &$r) { $r['date'] = fmt_date($r['date_requested']); unset($r['date_requested']); }

    json_out(['ok' => true, 'counts' => $counts, 'recent' => $recent]);
}

/* ===========================================================
   GET one request (resident: must own it / admin: any)
=========================================================== */
if ($action === 'get' && $method === 'GET') {
    $id = $_GET['id'] ?? '';
    if (!$id) fail('Missing request id.');
    $stmt = $pdo->prepare(REQUEST_SELECT . " WHERE dr.requestID = ?");
    $stmt->execute([$id]);
    $r = $stmt->fetch();
    if (!$r) fail('Request not found.', 404);

    if (current_resident_id()) {
        if ($r['residentID'] !== current_resident_id()) fail('Not authorized to view this request.', 403);
    } elseif (!current_admin_id()) {
        fail('Please log in to continue.', 401);
    }

    json_out(['ok' => true, 'request' => shape_request($pdo, $r)]);
}

/* ===========================================================
   RESIDENT: submit a new request (multipart/form-data)
=========================================================== */
if ($action === 'create' && $method === 'POST') {
    $rid = require_resident();

    $documentTypeId = trim($_POST['documentTypeId'] ?? '');
    $purpose = clean_text($_POST['purpose'] ?? '');
    $contactRaw = trim($_POST['contact'] ?? '');
    $copiesRaw = trim((string) ($_POST['copies'] ?? ''));
    $preferredDate = trim($_POST['preferredDate'] ?? '');
    $notes = trim($_POST['notes'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM document_types WHERE documentTypeID = ? AND is_active = 1");
    $stmt->execute([$documentTypeId]);
    $doc = $stmt->fetch();
    if (!$doc) fail('Please choose a valid document type.');

    if (!$purpose) fail('Please state the purpose of your request.');
    if ($e = text_length_error($purpose, 'Purpose of request', 5, 255)) fail($e);
    if (!$contactRaw) fail('Please provide a contact number for this request.');
    $contact = normalize_contact($contactRaw);
    if ($contact === null) fail(CONTACT_RULE_MESSAGE);
    if (!ctype_digit($copiesRaw) || (int) $copiesRaw < 1 || (int) $copiesRaw > 20) fail('Number of copies must be a whole number from 1 to 20.');
    $copies = (int) $copiesRaw;
    if ($e = release_date_error($preferredDate)) fail($e);
    if (mb_strlen($notes) > 500) fail('Additional notes must not exceed 500 characters.');

    $filesRaw = normalize_files_array($_FILES['files'] ?? []);
    if (count($filesRaw) > 10) fail('You may upload up to 10 supporting files.');
    $hasFile = count($filesRaw) > 0;
    if ($doc['supporting_document'] === 'required' && !$hasFile) fail('A supporting document is required for this document type. Please choose one or more image or PDF files.');
    $checks = [];
    foreach ($filesRaw as $f) $checks[] = check_upload($f);

    // prevent duplicate active request for same document type
    $stmt = $pdo->prepare("SELECT 1 FROM document_requests WHERE residentID = ? AND documentTypeID = ? AND status IN ('Pending','On Hold','Approved','Ready for Pickup') LIMIT 1");
    $stmt->execute([$rid, $documentTypeId]);
    if ($stmt->fetch()) fail("You already have an active {$doc['name']} request. You can request again once it is Completed.");

    $stmt = $pdo->prepare("SELECT fullName FROM residents WHERE residentID = ?");
    $stmt->execute([$rid]);
    $residentName = $stmt->fetchColumn();

    $newId = gen_request_id($pdo);
    $savedPaths = [];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO document_requests
            (requestID, residentID, documentTypeID, purpose, contactNumber, copies, preferred_release_date, notes, date_requested, status)
            VALUES (?,?,?,?,?,?,?,?, CURDATE(), 'Pending')");
        $stmt->execute([$newId, $rid, $documentTypeId, $purpose, $contact, $copies, $preferredDate ?: null, $notes ?: null]);

        foreach ($filesRaw as $i => $f) {
            $savedPath = save_upload($newId, $f, $checks[$i]['ext']);
            if (!$savedPath) throw new Exception('Upload could not be saved.');
            $savedPaths[] = $savedPath;
            $stmt = $pdo->prepare("INSERT INTO request_attachments (requestID, fileName, filePath, fileType, fileSize) VALUES (?,?,?,?,?)");
            $stmt->execute([$newId, clean_file_name($f['name']), $savedPath, $checks[$i]['mime'], $f['size']]);
        }

        add_history($pdo, $newId, 'Request Submitted', "Request submitted for {$doc['name']}.", $residentName, 'Resident');

        add_notification($pdo, $rid, "Your {$doc['name']} request ($newId) has been submitted and is Pending.", $newId);
        add_notification($pdo, null, "$residentName submitted a {$doc['name']} request ($newId).", $newId);

        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($savedPaths as $p) delete_upload_file($p);
        fail('Unable to submit the request right now. Please try again.', 500);
    }

    json_out(['ok' => true, 'id' => $newId]);
}

/* ===========================================================
   RESIDENT: replace or remove the supporting document of a
   request that is still Pending or On Hold (multipart/form-data)
   { id, file }  -> replace / attach
   { id, remove=1 } -> remove (only when the document type says the
                       supporting document is optional)
=========================================================== */
if ($action === 'updateAttachment' && $method === 'POST') {
    $rid = require_resident();
    $id = trim($_POST['id'] ?? '');
    $remove = ($_POST['remove'] ?? '') === '1';

    $r = load_request($pdo, $id);
    if (!$r || $r['residentID'] !== $rid) fail('Request not found.', 404);
    if (!in_array($r['status'], ['Pending', 'On Hold'], true)) fail('Supporting documents can only be changed while the request is Pending or On Hold.');

    $stmt = $pdo->prepare("SELECT attachmentID, filePath FROM request_attachments WHERE requestID = ?");
    $stmt->execute([$id]);
    $old = $stmt->fetchAll();

    if ($remove) {
        if ($r['supporting_document'] === 'required') fail('A supporting document is required for this document type. You can replace it with another file instead.');
        if (!$old) fail('There is no supporting document to remove.');
        $pdo->prepare("DELETE FROM request_attachments WHERE requestID = ?")->execute([$id]);
        foreach ($old as $o) delete_upload_file($o['filePath']);
        add_history($pdo, $id, 'Supporting Document Removed', 'Resident removed the supporting document.', $r['resident_name'], 'Resident');
        add_notification($pdo, null, "{$r['resident_name']} removed the supporting document of a {$r['doc_type_name']} request ($id).", $id);
        json_out(['ok' => true, 'message' => 'Supporting document removed.']);
    }

    $filesRaw = normalize_files_array($_FILES['files'] ?? []);
    if (!$filesRaw) fail('Please choose one or more image or PDF files.');
    if (count($filesRaw) > 10) fail('You may upload up to 10 supporting files.');
    $checks = [];
    foreach ($filesRaw as $f) $checks[] = check_upload($f);

    $toSave = [];
    foreach ($filesRaw as $i => $f) {
        $p = save_upload($id, $f, $checks[$i]['ext']);
        if (!$p) { foreach ($toSave as $s) delete_upload_file($s['path']); fail('The supporting document(s) could not be saved. Please try again.', 500); }
        $toSave[] = ['path' => $p, 'file' => $f, 'mime' => $checks[$i]['mime']];
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM request_attachments WHERE requestID = ?")->execute([$id]);
        $stmt = $pdo->prepare("INSERT INTO request_attachments (requestID, fileName, filePath, fileType, fileSize) VALUES (?,?,?,?,?)");
        foreach ($toSave as $s) {
            $stmt->execute([$id, clean_file_name($s['file']['name']), $s['path'], $s['mime'], $s['file']['size']]);
        }
        add_history($pdo, $id, 'Supporting Document Updated', 'Resident uploaded new supporting document(s).', $r['resident_name'], 'Resident');
        add_notification($pdo, null, "{$r['resident_name']} updated the supporting document(s) of a {$r['doc_type_name']} request ($id).", $id);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($toSave as $s) delete_upload_file($s['path']);
        fail('Unable to update the supporting document(s) right now. Please try again.', 500);
    }
    foreach ($old as $o) delete_upload_file($o['filePath']);

    json_out(['ok' => true, 'message' => 'Supporting document(s) updated.']);
}

/* ===========================================================
   RESIDENT: cancel a request
=========================================================== */
if ($action === 'cancel' && $method === 'POST') {
    $rid = require_resident();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $reason = clean_text($b['reason'] ?? '');
    if (!$reason) fail('Please provide a reason for cancelling the request.');
    if ($e = text_length_error($reason, 'Cancellation reason', 5, 500)) fail($e);

    $r = load_request($pdo, $id);
    if (!$r || $r['residentID'] !== $rid || !in_array($r['status'], ['Pending', 'On Hold'])) fail('This request can no longer be cancelled.');

    $stmt = $pdo->prepare("UPDATE document_requests SET status = 'Cancelled' WHERE requestID = ?");
    $stmt->execute([$id]);
    $stmt = $pdo->prepare("INSERT INTO request_cancellations (requestID, residentID, reason, cancelled_at) VALUES (?,?,?,CURDATE())");
    $stmt->execute([$id, $rid, $reason]);
    add_history($pdo, $id, 'Cancelled', $reason, $r['resident_name'], 'Resident');
    add_notification($pdo, null, "{$r['resident_name']} cancelled a {$r['doc_type_name']} request ($id). Reason: $reason", $id);

    json_out(['ok' => true]);
}

/* ===========================================================
   RESIDENT: appeal a rejected request
=========================================================== */
if ($action === 'appeal' && $method === 'POST') {
    $rid = require_resident();
    $id = trim($_POST['id'] ?? '');
    $reason = clean_text($_POST['reason'] ?? '');
    if (!$reason) fail('Please provide a reason for your appeal.');
    if ($e = text_length_error($reason, 'Appeal reason', 5, 500)) fail($e);

    $r = load_request($pdo, $id);
    if (!$r || $r['residentID'] !== $rid || $r['status'] !== 'Rejected') fail('Only rejected requests can be appealed.');

    $stmt = $pdo->prepare("SELECT 1 FROM appeals WHERE requestID = ? AND appeal_status = 'Pending'");
    $stmt->execute([$id]);
    if ($stmt->fetch()) fail('Your appeal is already pending review.');

    $filesRaw = normalize_files_array($_FILES['images'] ?? []);
    if (count($filesRaw) < 2) fail('Please upload at least 2 supporting images for your appeal.');
    if (count($filesRaw) > 6) fail('You may upload up to 6 supporting images.');

    $checks = [];
    foreach ($filesRaw as $f) $checks[] = check_upload($f);

    $savedPaths = [];
    foreach ($filesRaw as $i => $f) {
        $path = save_upload($id . '-appeal', $f, $checks[$i]['ext']);
        if (!$path) {
            foreach ($savedPaths as $p) delete_upload_file($p);
            fail('Unable to save the appeal images. Please try again.', 500);
        }
        $savedPaths[] = $path;
    }

    $stmt = $pdo->prepare("INSERT INTO appeals (requestID, appeal_reason, appeal_images, appeal_date, appeal_status) VALUES (?,?,?,CURDATE(),'Pending')");
    $stmt->execute([$id, $reason, json_encode($savedPaths)]);
    add_history($pdo, $id, 'Appeal Submitted', $reason, $r['resident_name'], 'Resident');
    add_notification($pdo, null, "{$r['resident_name']} appealed the rejected {$r['doc_type_name']} request ($id).", $id);

    json_out(['ok' => true]);
}

/* ===========================================================
   ADMIN: filtered / tabbed request list
=========================================================== */
if ($action === 'adminList' && $method === 'GET') {
    require_admin();
    $status = $_GET['status'] ?? 'All';
    $doc = $_GET['doc'] ?? 'All';

    $sql = "SELECT dr.requestID AS id, res.fullName AS residentName, dt.name AS docType, dr.date_requested, dr.status
        FROM document_requests dr
        JOIN residents res ON res.residentID = dr.residentID
        JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
        WHERE 1=1";
    $params = [];
    if ($status !== 'All') { $sql .= " AND dr.status = ?"; $params[] = $status; }
    if ($doc !== 'All') { $sql .= " AND dt.name = ?"; $params[] = $doc; }
    $sql .= " ORDER BY dr.date_requested DESC, dr.requestID DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['date'] = fmt_date($r['date_requested']); unset($r['date_requested']); }
    json_out(['ok' => true, 'requests' => $rows]);
}

/* ===========================================================
   ADMIN: dashboard stats + recent
=========================================================== */
if ($action === 'adminStats' && $method === 'GET') {
    require_admin();
    $stmt = $pdo->query("SELECT status, COUNT(*) AS total FROM document_requests GROUP BY status");
    $counts = [];
    foreach ($stmt->fetchAll() as $row) $counts[$row['status']] = (int) $row['total'];

    $residentCount = (int) $pdo->query("SELECT COUNT(*) FROM residents")->fetchColumn();

    $stmt = $pdo->query("SELECT dr.requestID AS id, res.fullName AS residentName, dt.name AS docType, dr.date_requested, dr.status
        FROM document_requests dr JOIN residents res ON res.residentID = dr.residentID JOIN document_types dt ON dt.documentTypeID = dr.documentTypeID
        ORDER BY dr.date_requested DESC, dr.requestID DESC LIMIT 5");
    $recent = $stmt->fetchAll();
    foreach ($recent as &$r) { $r['date'] = fmt_date($r['date_requested']); unset($r['date_requested']); }

    json_out(['ok' => true, 'counts' => $counts, 'residentCount' => $residentCount, 'recent' => $recent]);
}

/* ===========================================================
   ADMIN: toggle "resident verified" flag on a request
=========================================================== */
if ($action === 'toggleVerify' && $method === 'POST') {
    require_admin();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $stmt = $pdo->prepare("UPDATE document_requests SET verified = NOT verified WHERE requestID = ?");
    $stmt->execute([$id]);
    json_out(['ok' => true]);
}

/* ===========================================================
   ADMIN: approve / hold
=========================================================== */
if ($action === 'review' && $method === 'POST') {
    $aid = require_admin();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $decision = $b['decision'] ?? ''; // approve | hold
    $comments = clean_text($b['comments'] ?? '');
    if (!in_array($decision, ['approve', 'hold'], true)) fail('Unknown decision.');
    if (mb_strlen($comments) > 500) fail('Comments must not exceed 500 characters.');

    $r = load_request($pdo, $id);
    if (!$r || !in_array($r['status'], ['Pending', 'On Hold'])) fail('This request is no longer available for review.');

    $admin = load_admin($pdo, $aid);

    if ($decision === 'approve') {
        $stmt = $pdo->prepare("UPDATE document_requests SET status='Approved', comments=?, approved_by_name=?, approved_by_role=?, approved_date=CURDATE() WHERE requestID = ?");
        $stmt->execute([$comments, $admin['fullName'], $admin['role'], $id]);
        add_history($pdo, $id, 'Approved', $comments ?: 'Request approved.', $admin['fullName'], $admin['role']);
        add_notification($pdo, $r['residentID'], "{$admin['fullName']} ({$admin['role']}) approved your {$r['doc_type_name']} request ($id).", $id);
        json_out(['ok' => true, 'message' => 'Request approved.']);
    }

    $stmt = $pdo->prepare("UPDATE document_requests SET status='On Hold', comments=?, held_by_name=?, held_by_role=?, held_date=CURDATE() WHERE requestID = ?");
    $stmt->execute([$comments, $admin['fullName'], $admin['role'], $id]);
    add_history($pdo, $id, 'Put on Hold', $comments ?: 'Request placed on hold.', $admin['fullName'], $admin['role']);
    add_notification($pdo, $r['residentID'], "{$admin['fullName']} ({$admin['role']}) placed your {$r['doc_type_name']} request ($id) On Hold. Please check the comments.", $id);
    json_out(['ok' => true, 'message' => 'Request placed on hold.']);
}

/* ===========================================================
   ADMIN: reject with reason
=========================================================== */
if ($action === 'reject' && $method === 'POST') {
    $aid = require_admin();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $reason = clean_text($b['reason'] ?? '');
    if (!$reason) fail('Please select a rejection reason.');
    if ($e = text_length_error($reason, 'Rejection reason', 3, 500)) fail($e);

    $r = load_request($pdo, $id);
    if (!$r || !in_array($r['status'], ['Pending', 'On Hold'])) fail('This request is no longer available for review.');

    $admin = load_admin($pdo, $aid);

    $stmt = $pdo->prepare("UPDATE document_requests SET status='Rejected', comments=? WHERE requestID = ?");
    $stmt->execute([$reason, $id]);
    $stmt = $pdo->prepare("INSERT INTO request_rejections (requestID, adminID, reason, rejected_at) VALUES (?,?,?,CURDATE())");
    $stmt->execute([$id, $aid, $reason]);
    add_history($pdo, $id, 'Rejected', $reason, $admin['fullName'], $admin['role']);
    add_notification($pdo, $r['residentID'], "{$admin['fullName']} ({$admin['role']}) has rejected your {$r['doc_type_name']} request ($id). Reason: $reason", $id);

    json_out(['ok' => true, 'message' => 'Request rejected with reason.']);
}

/* ===========================================================
   ADMIN/MODERATOR: mark an appeal as reviewed (looked at the
   reason + evidence images). Required before an Administrator
   can approve/deny it.
=========================================================== */
if ($action === 'reviewAppeal' && $method === 'POST') {
    $aid = require_admin(); // admin OR moderator may review
    $b = body_json();
    $id = trim($b['id'] ?? '');

    $r = load_request($pdo, $id);
    if (!$r || $r['status'] !== 'Rejected') fail('This request cannot be reviewed.');

    $stmt = $pdo->prepare("SELECT appealID FROM appeals WHERE requestID = ? AND appeal_status = 'Pending' ORDER BY appealID DESC LIMIT 1");
    $stmt->execute([$id]);
    $appeal = $stmt->fetch();
    if (!$appeal) fail('No pending appeal found for this request.');

    $admin = load_admin($pdo, $aid);
    $stmt = $pdo->prepare("UPDATE appeals SET reviewed = 1, reviewed_by_admin_id = ?, reviewed_by_name = ?, reviewed_at = CURDATE() WHERE appealID = ?");
    $stmt->execute([$aid, $admin['fullName'], $appeal['appealID']]);

    json_out(['ok' => true, 'message' => 'Appeal marked as reviewed.']);
}

/* ===========================================================
   ADMIN: resolve an appeal
=========================================================== */
if ($action === 'resolveAppeal' && $method === 'POST') {
    $aid = require_administrator(); // final decision stays Administrator-only
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $decision = $b['decision'] ?? ''; // approve | deny
    $remarks = clean_text($b['remarks'] ?? '');
    if (!in_array($decision, ['approve', 'deny'], true)) fail('Unknown decision.');
    if (mb_strlen($remarks) > 500) fail('Remarks must not exceed 500 characters.');

    $r = load_request($pdo, $id);
    if (!$r || $r['status'] !== 'Rejected') fail('This request cannot be appealed.');

    $stmt = $pdo->prepare("SELECT appealID, reviewed FROM appeals WHERE requestID = ? AND appeal_status = 'Pending' ORDER BY appealID DESC LIMIT 1");
    $stmt->execute([$id]);
    $appeal = $stmt->fetch();
    if (!$appeal) fail('No pending appeal found for this request.');
    if (!$appeal['reviewed']) fail('Please review the appeal and its supporting images before making a decision.');

    $admin = load_admin($pdo, $aid);

    $newStatus = $decision === 'approve' ? 'Approved' : 'Denied';
    $finalRemarks = $remarks ?: ($decision === 'approve' ? 'Appeal approved.' : 'Rejection upheld.');

    $stmt = $pdo->prepare("UPDATE appeals SET appeal_status=?, resolved_by_admin_id=?, resolved_at=CURDATE(), resolution_remarks=? WHERE appealID=?");
    $stmt->execute([$newStatus, $aid, $finalRemarks, $appeal['appealID']]);

    if ($decision === 'approve') {
        $stmt = $pdo->prepare("UPDATE document_requests SET status='Approved', approved_by_name=?, approved_by_role=?, approved_date=CURDATE() WHERE requestID=?");
        $stmt->execute([$admin['fullName'], $admin['role'], $id]);
        add_history($pdo, $id, 'Appeal Approved', $finalRemarks, $admin['fullName'], $admin['role']);
        add_notification($pdo, $r['residentID'], "{$admin['fullName']} approved your appeal. Your {$r['doc_type_name']} request ($id) is now Approved.", $id);
        json_out(['ok' => true, 'message' => 'Appeal approved.']);
    }

    add_history($pdo, $id, 'Appeal Denied', $finalRemarks, $admin['fullName'], $admin['role']);
    add_notification($pdo, $r['residentID'], "{$admin['fullName']} upheld the rejection of your {$r['doc_type_name']} request ($id).", $id);
    json_out(['ok' => true, 'message' => 'Rejection upheld.']);
}

/* ===========================================================
   ADMIN: mark Ready for Pickup (after generating/printing doc)
=========================================================== */
if ($action === 'markReady' && $method === 'POST') {
    $aid = require_admin();
    $b = body_json();
    $id = trim($b['id'] ?? '');

    $r = load_request($pdo, $id);
    if (!$r || $r['status'] !== 'Approved') fail('Only approved requests can be marked ready for pickup.');

    $admin = load_admin($pdo, $aid);

    $stmt = $pdo->prepare("UPDATE document_requests SET status='Ready for Pickup', ready_by_name=?, ready_by_role=?, ready_date=CURDATE() WHERE requestID=?");
    $stmt->execute([$admin['fullName'], $admin['role'], $id]);
    add_history($pdo, $id, 'Ready for Pickup', 'Document generated and ready for pickup.', $admin['fullName'], $admin['role']);
    add_notification($pdo, $r['residentID'], "Your {$r['doc_type_name']} ($id) is ready for pickup at the Barangay Office.", $id);

    json_out(['ok' => true, 'message' => 'Document generated. Status set to Ready for Pickup.']);
}

/* ===========================================================
   ADMIN: record release / claim
=========================================================== */
if ($action === 'release' && $method === 'POST') {
    require_admin();
    $b = body_json();
    $id = trim($b['id'] ?? '');
    $releasedBy = clean_text($b['releasedBy'] ?? '');
    if (!$releasedBy) fail('Please enter who released the document.');
    if (!valid_name($releasedBy)) fail('"Released By" must be a valid name (letters, spaces, periods, hyphens and apostrophes only).');

    $r = load_request($pdo, $id);
    if (!$r || $r['status'] !== 'Ready for Pickup') fail('Only documents marked Ready for Pickup can be released.');

    $stmt = $pdo->prepare("UPDATE document_requests SET status='Completed', release_date=CURDATE(), released_by=? WHERE requestID=?");
    $stmt->execute([$releasedBy, $id]);
    add_history($pdo, $id, 'Claimed', "Released " . fmt_date(today_iso()) . " by $releasedBy.", $releasedBy, 'Admin/Staff');
    add_notification($pdo, $r['residentID'], "Your {$r['doc_type_name']} ($id) has been successfully released.", $id);

    json_out(['ok' => true, 'message' => 'Release recorded. Request marked Completed.']);
}

fail('Unknown request action.', 404);
