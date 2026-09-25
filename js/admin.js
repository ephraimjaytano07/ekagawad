/* ============================================================
   ADMIN.JS
   ------------------------------------------------------------
   Everything for the ADMIN / BARANGAY STAFF portal. Every action
   that used to mutate a JS array now calls the real PHP API
   (api/residents.php, api/requests.php, api/reports.php,
   api/account.php) which reads/writes MySQL.

   NEW in this version:
   - confirmation windows (dialog.js) instead of alert()/confirm()
   - stricter form checks; errors show inside the form without
     erasing what was typed; Enter submits
   - Add / Edit Resident: house no./street with a FIXED barangay,
     +63 phone box, birthday limits (13+)
   - residents can be deleted even with old (completed / rejected /
     cancelled) history; the list is sorted by Barangay ID
   - the resident search no longer loses focus while typing
   ============================================================ */

let _resSearchTimer = null;

function residentsCountText() {
  const total = (state.cache.residents || []).length;
  return `${total} matching resident${total === 1 ? '' : 's'}`;
}

/* Searching updates only the table (with a short delay), so the search box keeps focus. */
function updateResidentSearch(val) {
  state.residentSearch = val;
  clearTimeout(_resSearchTimer);
  _resSearchTimer = setTimeout(async () => {
    try {
      const r = await api.get(`residents.php?action=list&q=${encodeURIComponent(val.trim())}`);
      state.cache.residents = r.residents;
      const body = document.getElementById('residentsTableBody');
      if (body) body.innerHTML = renderResidentRows();
      const sub = document.getElementById('residentsCount');
      if (sub) sub.textContent = residentsCountText();
    } catch (e) { toast(e.message || 'Unable to search right now.'); }
  }, 250);
}

function renderResidentRows() {
  const rows = state.cache.residents || [];
  const canManage = isAdminLevel();
  if (rows.length === 0) return `<tr><td colspan="6"><div class="empty-state">No residents match your search.</div></td></tr>`;
  return rows.map(r => `
    <tr class="rowhover">
      <td class="mono">${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.address)}</td><td>${escapeHtml(r.contact)}</td>
      <td><span class="badge ${r.status === 'Active' ? 'completed' : 'cancelled'}">${r.status}</span></td>
      <td>
        <button class="btn-sm outline" onclick="viewResidentDetails('${esc(r.id)}')">${icon('eye')} View</button>
        <button class="btn-sm primary" onclick="navAdmin('editResident',{activeResidentId:'${esc(r.id)}'})">${icon('pen')} Edit</button>
        ${canManage ? `<button class="btn-sm ${r.status === 'Active' ? 'danger' : 'primary'}" onclick="toggleResidentStatus('${esc(r.id)}')">${icon(r.status === 'Active' ? 'user-slash' : 'user-check')} ${r.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
        <button class="btn-sm danger" onclick="deleteResident('${esc(r.id)}')">${icon('trash')} Delete</button>` : ''}
      </td>
    </tr>`).join('');
}

function viewResidentDetails(id) {
  const r = (state.cache.residents || []).find(x => x.id === id);
  if (!r) return;
  showAlert({
    icon: 'user', tone: 'primary', title: r.name, confirmText: 'Close',
    details: [
      { label: 'Barangay ID', value: r.id, mono: true },
      { label: 'First Name', value: r.firstName || '—' },
      { label: 'Middle Name', value: r.middleName || '—' },
      { label: 'Last Name', value: r.lastName || '—' },
      { label: 'Suffix', value: r.suffix || '—' },
      { label: 'Date of Birth', value: r.dob },
      { label: 'Address', value: r.address },
      { label: 'Contact', value: r.contact },
      { label: 'Email', value: r.email },
      { label: 'Status', value: r.status },
    ]
  });
}

async function toggleResidentStatus(id) {
  const r = (state.cache.residents || []).find(x => x.id === id);
  const activating = !!r && r.status !== 'Active';
  const name = r ? r.name : 'this resident';
  const ok = await showConfirm({
    icon: activating ? 'user-check' : 'user-slash', tone: activating ? 'primary' : 'danger',
    title: activating ? 'Activate this account?' : 'Deactivate this account?',
    message: activating ? `${name} will be able to log in again.` : `${name} will not be able to log in until the account is activated again.`,
    confirmText: activating ? 'Activate' : 'Deactivate', cancelText: 'Cancel'
  });
  if (!ok) return;
  try {
    await api.post('residents.php?action=toggleStatus', { id });
    await navAdmin('residents');
    toast(activating ? 'Account activated.' : 'Account deactivated.');
  } catch (e) { toast(e.message || 'Unable to update this resident right now.'); }
}

async function deleteResident(id) {
  const r = (state.cache.residents || []).find(x => x.id === id);
  const ok = await showConfirm({
    icon: 'trash', tone: 'danger', title: 'Delete this resident?',
    message: `${r ? r.name : 'This resident'}'s account will be permanently deleted, together with their old request records (completed, rejected and cancelled). This cannot be undone.\n\nAccounts with a request still in progress cannot be deleted.`,
    confirmText: 'Delete Resident', cancelText: 'Keep Resident'
  });
  if (!ok) return;
  try {
    await api.post('residents.php?action=delete', { id });
    await navAdmin('residents');
    toast('Resident record deleted.');
  } catch (e) {
    await showAlert({ icon: 'circle-exclamation', tone: 'danger', title: 'Resident not deleted', message: e.message || 'Unable to delete this resident right now.', confirmText: 'OK' });
  }
}

/* shared by the Add and Edit Resident forms. prefix = 'ar' or 'er'. Returns {error} or the clean values. */
/* shared by the Add and Edit Resident forms. prefix = 'ar' or 'er'. Returns {error} or the clean values. */
function readResidentForm(prefix) {
  const n = readNameFields(prefix);
  const dob = document.getElementById(`${prefix}-dob`).value.trim();
  const street = stripBarangay(cleanText(document.getElementById(`${prefix}-street`).value));
  const contactRaw = document.getElementById(`${prefix}-contact`).value.trim();
  const email = document.getElementById(`${prefix}-email`).value.trim().toLowerCase();
  const nameErr = nameFieldsError(n);
  if (nameErr) return { error: nameErr };
  if (!dob || !street || !contactRaw || !email) return { error: 'Please fill out all required fields.' };
  const error = birthDateError(dob) || streetError(street) || contactError(contactRaw) || emailError(email);
  if (error) return { error };
  return { firstName: n.firstName, middleName: n.middleName, lastName: n.lastName, suffix: n.suffix, fullName: composeFullName(n), dob, street, contact: normalizeContact(contactRaw), email };
}

async function submitAddResident() {
  return once('addResident', async () => {
    clearFormError();
    const f = readResidentForm('ar');
    if (f.error) { showFormError(f.error); return; }
    const ok = await showConfirm({
      icon: 'user-plus', title: 'Add this resident?',
      message: 'A Barangay ID and a temporary password will be created for this resident.',
      details: [
        { label: 'Name', value: f.fullName },
        { label: 'Address', value: `${f.street}, Barangay San Isidro` },
        { label: 'Contact', value: f.contact },
        { label: 'Email', value: f.email },
      ],
      confirmText: 'Add Resident', cancelText: 'Review Again'
    });
    if (!ok) return;
    try {
      const res = await api.post('residents.php?action=add', {
        firstName: f.firstName, middleName: f.middleName, lastName: f.lastName, suffix: f.suffix,
        dob: f.dob, street: f.street, contact: f.contact, email: f.email
      });
      state.requestErr = '';
      await navAdmin('residents');
      await showAlert({
        title: 'Resident Added',
        message: 'Give these login details to the resident. They can change the password from their Account page.',
        details: [
          { label: 'Barangay ID', value: res.id, mono: true },
          { label: 'Temporary Password', value: res.tempPassword, mono: true },
        ],
        confirmText: 'Done'
      });
    } catch (e) { showFormError(e.message); }
  });
}

function adminNextResidentIdPreview() {
  // Best-effort live preview shown on the Add Resident form; the real
  // ID is assigned by the server at submit time (same rule: next
  // sequential number for the current year).
  return state.cache.residents ? '' : '';
}

async function saveEditedResident(id) {
  return once('editResident', async () => {
    clearFormError();
    const f = readResidentForm('er');
    if (f.error) { showFormError(f.error); return; }
    const ok = await showConfirm({
      icon: 'floppy-disk', title: 'Save changes?',
      message: `Update the record of ${f.fullName}?`,
      confirmText: 'Save Changes', cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      await api.post('residents.php?action=update', {
        id, firstName: f.firstName, middleName: f.middleName, lastName: f.lastName, suffix: f.suffix,
        dob: f.dob, street: f.street, contact: f.contact, email: f.email
      });
      state.requestErr = '';
      await navAdmin('residents');
      toast('Resident information updated successfully.');
    } catch (e) { showFormError(e.message); }
  });
}

function setRequestTab(tab) { state.requestTab = tab; navAdmin('documentRequests'); }

function setDocFilter(val) { state.requestDocFilter = val; navAdmin('documentRequests'); }

async function toggleVerify(id) {
  try {
    await api.post('requests.php?action=toggleVerify', { id });
    await navAdmin('reviewRequest', { activeRequestId: id });
  } catch (e) { toast(e.message || 'Unable to update verification right now.'); }
}

async function reviewAction(id, action) {
  const comments = cleanText(document.getElementById('review-comments')?.value || '');
  if (comments.length > 500) { toast('Comments must not exceed 500 characters.'); return; }
  try {
    if (action === 'approve') {
      const ok = await showConfirm({ icon: 'circle-check', tone: 'success', title: 'Approve this request?', message: 'The resident will be notified that the request is approved.', confirmText: 'Approve', cancelText: 'Cancel' });
      if (!ok) return;
      const res = await api.post('requests.php?action=review', { id, decision: 'approve', comments });
      await navAdmin('reviewRequest', { activeRequestId: id });
      toast(res.message || 'Request approved.');
    } else if (action === 'hold') {
      const ok = await showConfirm({ icon: 'pause', tone: 'warning', title: 'Put this request on hold?', message: 'The resident will be notified and can read your comments.', confirmText: 'Put on Hold', cancelText: 'Cancel' });
      if (!ok) return;
      const res = await api.post('requests.php?action=review', { id, decision: 'hold', comments });
      await navAdmin('reviewRequest', { activeRequestId: id });
      toast(res.message || 'Request placed on hold.');
    } else if (action === 'reject') {
      state.rejectRequestId = id;
      state.requestErr = '';
      render();
    }
  } catch (e) { toast(e.message || 'Unable to process the request right now.'); }
}

async function confirmRejectRequest(id) {
  return once('rejectRequest', async () => {
    const reason = document.getElementById('reject-reason')?.value || '';
    const other = cleanText(document.getElementById('reject-other')?.value || '');
    clearFormError();
    if (!reason) { showFormError(friendlyError('rejectionReason')); return; }
    const finalReason = reason === 'Other' ? other : reason;
    if (!finalReason) { showFormError('Please explain the rejection reason when selecting Other.'); return; }
    const err = lengthError(finalReason, 'Rejection reason', 5, 500);
    if (err) { showFormError(err); return; }
    try {
      const res = await api.post('requests.php?action=reject', { id, reason: finalReason });
      state.rejectRequestId = null; state.requestErr = '';
      await navAdmin('reviewRequest', { activeRequestId: id });
      toast(res.message || 'Request rejected with reason.');
    } catch (e) { showFormError(e.message); }
  });
}

function closeRejectRequest() { state.rejectRequestId = null; state.requestErr = ''; render(); }

async function resolveAppeal(id, decision) {
  const remarks = cleanText(document.getElementById('appeal-review-comments')?.value || '');
  if (remarks.length > 500) { toast('Remarks must not exceed 500 characters.'); return; }
  const approving = decision === 'approve';
  const ok = await showConfirm({
    icon: approving ? 'circle-check' : 'circle-exclamation', tone: approving ? 'success' : 'danger',
    title: approving ? 'Approve this appeal?' : 'Uphold the rejection?',
    message: approving ? 'The request will return to Approved.' : 'The request will remain Rejected.',
    confirmText: approving ? 'Approve Appeal' : 'Uphold Rejection', cancelText: 'Cancel'
  });
  if (!ok) return;
  try {
    const res = await api.post('requests.php?action=resolveAppeal', { id, decision, remarks });
    await navAdmin('reviewRequest', { activeRequestId: id });
    toast(res.message || 'Appeal resolved.');
  } catch (e) { toast(e.message || 'Unable to resolve the appeal right now.'); }
}

async function markAppealReviewed(id){
  const ok = await showConfirm({
    icon:'eye', title:'Mark appeal as reviewed?',
    message:'Confirm that you have checked the appeal reason and its supporting images.',
    confirmText:'Mark Reviewed', cancelText:'Cancel'
  });
  if(!ok) return;
  try{
    await api.post('requests.php?action=reviewAppeal', { id });
    await navAdmin('reviewRequest', { activeRequestId: id });
    toast('Appeal marked as reviewed.');
  }catch(e){ toast(e.message || 'Unable to mark this appeal as reviewed.'); }
}

function generatePdfReady(id) {
  const r = state.cache.activeRequest;
  if (!r || r.id !== id || r.status !== 'Approved') { toast('Only approved requests can be prepared for pickup.'); return; }
  state.pdfPreviewId = id;
  render();
}

async function confirmPdfAndReady(id) {
  const ok = await showConfirm({ icon: 'box', title: 'Mark as Ready for Pickup?', message: 'The resident will be notified to claim the document at the Barangay Office.', confirmText: 'Mark Ready', cancelText: 'Cancel' });
  if (!ok) return;
  try {
    const res = await api.post('requests.php?action=markReady', { id });
    state.pdfPreviewId = null;
    await navAdmin('reviewRequest', { activeRequestId: id });
    toast(res.message || 'Document generated. Status set to Ready for Pickup.');
  } catch (e) { toast(e.message || 'Unable to update this request right now.'); }
}

function closePdfPreview() { state.pdfPreviewId = null; render(); }

function pdfModalHtml() {
  if (!state.pdfPreviewId) return '';
  const r = state.cache.activeRequest;
  if (!r || r.id !== state.pdfPreviewId) return '';
  const bodyText = {
    'Barangay Clearance': `This is to certify that the person named above is a bona fide resident of Barangay San Isidro, Cabuyao, Laguna, and has no derogatory record on file with this office as of the date of issuance.`,
    'Certificate of Residency': `This is to certify that the person named above is a bona fide resident of Barangay San Isidro, Cabuyao, Laguna, and has resided within this barangay for a considerable period of time.`,
    'Certificate of Indigency': `This is to certify that the person named above belongs to an indigent family of this barangay, based on the records and assessment of this office, and is qualified to avail of assistance programs.`,
    'Certificate of Good Moral Character': `This is to certify that the person named above is known to this office to be a person of good moral character and reputation, and has not been involved in any activity contrary to law and morals.`,
    'Barangay Business Clearance': `This is to certify that the business operated by the person named above, located within this barangay, has been inspected and found to be compliant with barangay ordinances and regulations.`,
    'Barangay ID Application': `This is to certify that the person named above is a registered resident of this barangay and is qualified to be issued an official Barangay Identification Card.`
  }[r.docType] || `This is to certify that the person named above is a bona fide resident of this barangay in good standing.`;
  return `<div class="modal-overlay print-cert-overlay" onclick="closePdfPreview()">
    <div class="modal-box pdf-modal-box" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closePdfPreview()">${icon('xmark')}</button>
      <div class="pdf-modal-scroll">
        <div class="cert-paper">
          <div class="cert-letterhead">
            <div class="cert-letterhead-brand">
              ${logoMark(52)}
              <div>
                <div class="cert-letterhead-name">Barangay San Isidro</div>
                <div class="cert-letterhead-sub">Republic of the Philippines<br>City of Cabuyao, Province of Laguna<br>Office of the Barangay Captain</div>
              </div>
            </div>
            <div class="cert-letterhead-meta">OFFICIAL DOCUMENT<span>Control No. ${escapeHtml(r.id)}</span><span>Date Issued: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
          </div>
          <h3 class="cert-title">${escapeHtml(r.docType)}</h3>
          <p class="cert-lead">TO WHOM IT MAY CONCERN:</p>
          <p class="cert-body">This is to certify that <b>${escapeHtml(r.residentName)}</b>, of legal age, Filipino, is a resident of this barangay with Barangay ID No. <b>${escapeHtml(r.residentId)}</b>.</p>
          <p class="cert-body">${bodyText}</p>
          <p class="cert-body">This certification is issued upon the request of the above-named person for <b>${escapeHtml(r.purpose)}</b> purposes, and for whatever legal intent it may serve.</p>
          <p class="cert-body">Issued this ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at Barangay San Isidro, Cabuyao, Laguna.</p>
          <div class="cert-sign-row">
            <div class="cert-sign-block">
              <div class="cert-sig-line"></div>
              <div class="cert-sig-label">${escapeHtml(r.residentName)}</div>
              <div class="cert-sig-role">Requesting Party</div>
            </div>
            <div class="cert-sign-block">
              <div class="cert-sig-line"></div>
              <div class="cert-sig-label">Hon. Barangay Captain</div>
              <div class="cert-sig-role">Barangay San Isidro</div>
            </div>
          </div>
        </div>
      </div>
      <div class="pdf-modal-actions">
        <button class="btn-sm outline" onclick="window.print()">${icon('print')} Print Preview</button>
        <button class="abtn ready" onclick="confirmPdfAndReady('${r.id}')">${icon('circle-check')} Confirm &amp; Mark Ready for Pickup</button>
      </div>
    </div>
  </div>`;
}

async function recordRelease(id) {
  return once('recordRelease', async () => {
    const releasedBy = cleanText(document.getElementById('release-by')?.value || '') || state.currentAdmin.name;
    clearFormError();
    if (nameError(releasedBy)) { showFormError('"Released By" must be a valid name (letters, spaces, periods, hyphens and apostrophes only).'); return; }
    const ok = await showConfirm({
      icon: 'box-open', title: 'Record release?',
      message: 'The request will be marked Completed and the resident will be notified.',
      details: [{ label: 'Released by', value: releasedBy }],
      confirmText: 'Record Release', cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      const res = await api.post('requests.php?action=release', { id, releasedBy });
      await navAdmin('reviewRequest', { activeRequestId: id });
      toast(res.message || 'Release recorded. Request marked Completed.');
    } catch (e) { showFormError(e.message || 'Unable to record the release right now.'); }
  });
}

async function saveAdminAccount() {
  return once('saveAdminAccount', async () => {
    const name = cleanText(document.getElementById('admin-name').value);
    const contactRaw = document.getElementById('admin-contact').value.trim();
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('admin-password').value;
    const confirmPass = document.getElementById('admin-confirm').value;
    clearFormError();
    if (!name) { showFormError('Please enter your name.'); return; }
    const err = nameError(name) || contactError(contactRaw) || emailError(email) || (pass ? passwordError(pass) : '');
    if (err) { showFormError(err); return; }
    if (pass !== confirmPass) { showFormError('New passwords do not match.'); return; }
    const contact = normalizeContact(contactRaw);
    const ok = await showConfirm({
      icon: 'floppy-disk', title: 'Save your changes?',
      message: 'Your account information will be updated.',
      details: [
        { label: 'Name', value: name },
        { label: 'Contact number', value: contact },
        { label: 'Email', value: email },
        { label: 'Password', value: pass ? 'Will be changed' : 'Not changed' },
      ],
      confirmText: 'Save Changes', cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      const res = await api.post('account.php?action=updateAdmin', { name, contact, email, newPassword: pass, confirmPassword: confirmPass });
      state.currentAdmin.name = res.name || name;
      state.currentAdmin.contact = res.contact || contact;
      state.currentAdmin.email = res.email || email;
      render(true);
      toast('Account information updated.');
    } catch (e) { showFormError(e.message || 'Unable to update your account right now.'); }
  });
}

/* ================= RENDER: ADMIN PORTAL ================= */

function adminSidebar() {
  const items = [
    ['dashboard', 'gauge-high', 'Dashboard'], ['residents', 'users', 'Residents'],
    ['documentRequests', 'folder-open', 'Document Requests'], ['notifications', 'bell', 'Notifications'],
    ['reports', 'chart-pie', 'Reports']
  ];
  if (isAdminLevel()) items.push(['staff', 'user-shield', 'Moderators']);
  items.push(['account', 'user-gear', 'Account']);
  const title = isAdminLevel() ? 'e-Kagawad Admin' : 'e-Kagawad Moderator';
  return `<div class="sidebar">
    <div class="brand">${logoMark(26)} ${title}</div>
    ${items.map(([k, ic, label]) => `<div class="nav-item ${state.adminPage === k ? 'active' : ''}" onclick="navAdmin('${k}')"><span class="nav-ic">${icon(ic)}</span> ${label}</div>`).join('')}
    <div class="sidebar-bottom"><div class="nav-item logout-item" onclick="logout()"><span class="nav-ic">${icon('right-from-bracket')}</span> Logout</div></div>
  </div>`;
}

function adminShell() {
  let content = '';
  if (state.adminPage === 'dashboard') content = adminDashboard();
  else if (state.adminPage === 'residents') content = adminResidents();
  else if (state.adminPage === 'addResident') content = adminAddResident();
  else if (state.adminPage === 'editResident') content = adminEditResident();
  else if (state.adminPage === 'documentRequests') content = adminDocumentRequests();
  else if (state.adminPage === 'reviewRequest') content = adminReviewRequest();
  else if (state.adminPage === 'notifications') content = adminNotifications();
  else if (state.adminPage === 'reports') content = adminReports();
  else if (state.adminPage === 'staff') content = isAdminLevel() ? adminStaff() : adminDashboard();
  else if (state.adminPage === 'account') content = adminAccount();
  return `<div class="portal">${adminSidebar()}<div class="main"><div class="main-inner">${content}</div></div></div>${toastHtml()}`;
}

function adminDashboard() {
  const s = state.cache.adminStats || { counts: {}, residentCount: 0, recent: [] };
  const c = st => s.counts[st] || 0;
  const recent = s.recent || [];
  return `
  <div class="topbar"><div><h2>Admin Dashboard</h2><div class="sub">Barangay Staff Overview</div></div>${topbarRight('admin')}</div>
  <div class="stat-row">
    <div class="stat-card"><div class="n">${s.residentCount}</div><div class="l">Registered Residents</div></div>
    <div class="stat-card"><div class="n">${c('Pending')}</div><div class="l">Pending</div></div>
    <div class="stat-card"><div class="n">${c('Ready for Pickup')}</div><div class="l">Ready for Pickup</div></div>
    <div class="stat-card"><div class="n">${c('Completed')}</div><div class="l">Completed</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Quick Actions</h3></div>
    <div class="quick-row">
      <button class="quick-btn" onclick="navAdmin('documentRequests')"><span class="ic">${icon('folder-open')}</span><span class="t">View Requests</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
      <button class="quick-btn" onclick="navAdmin('addResident')"><span class="ic">${icon('user-plus')}</span><span class="t">Add Resident</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
      <button class="quick-btn" onclick="navAdmin('reports')"><span class="ic">${icon('chart-pie')}</span><span class="t">View Reports</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
    </div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Recent Requests</h3><span class="link-btn" onclick="navAdmin('documentRequests')">View all ${icon('arrow-right')}</span></div>
    ${recent.length ? `<div class="table-wrap"><table><thead><tr><th>Request ID</th><th>Resident</th><th>Document</th><th>Date</th><th>Status</th></tr></thead><tbody>
      ${recent.map(r => `<tr class="rowhover" style="cursor:pointer" onclick="navAdmin('reviewRequest',{activeRequestId:'${r.id}'})"><td class="mono">${r.id}</td><td>${escapeHtml(r.residentName)}</td><td>${r.docType}</td><td>${r.date}</td><td>${badge(r.status)}</td></tr>`).join('')}
    </tbody></table></div>` : emptyState('folder-open', 'No requests yet', 'Resident document requests will appear here as they come in.')}
  </div>`;
}

function adminResidents() {
  return `
  <div class="topbar"><div><h2>Registered Residents</h2><div class="sub" id="residentsCount">${residentsCountText()}</div></div>${topbarRight('admin')}</div>
  <div class="panel">
    <div class="panel-head">
      <div class="search-box"><span class="ic">${icon('magnifying-glass')}</span><input placeholder="Search by name or ID..." value="${escapeHtml(state.residentSearch)}" oninput="updateResidentSearch(this.value)"></div>
      <button class="btn-sm primary" onclick="navAdmin('addResident')">${icon('user-plus')} Add Resident</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Barangay ID</th><th>Name</th><th>Address</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="residentsTableBody">${renderResidentRows()}</tbody>
    </table></div>
  </div>`;
}

function adminAddResident() {
  const dob = birthDateBounds();
  return `
  <span class="back-link" onclick="navAdmin('residents')">${icon('arrow-left')} Back to Residents</span>
  <div class="panel" data-form>
    <h3 style="font-size:17px;color:var(--navy);margin-bottom:16px">Add New Resident</h3>
    <div class="info-box" style="margin-bottom:16px">A Barangay ID and a temporary password will be generated automatically once you submit this form. You'll be shown both so you can give them to the resident.</div>
    ${formErrorBox(state.requestErr)}
    ${nameFields('ar')}
    <div class="form-grid-2">
      <div class="field"><label>Date of Birth <span style="font-weight:400;color:var(--slate)">(13 years old or above)</span></label><input id="ar-dob" type="date" min="${dob.min}" max="${dob.max}"></div>
      <div class="field"><label>Contact Number</label>${phoneField('ar-contact', '')}</div>
    </div>
    ${addressFields('ar', '')}
    <div class="field"><label>Email</label><input id="ar-email" type="email" maxlength="150" placeholder="email@example.com"></div>
    <div class="action-row"><button class="abtn ready" data-submit onclick="submitAddResident()">${icon('user-plus')} Add Resident</button></div>
  </div>`;
}

function adminEditResident() {
  const r = state.cache.activeResident;
  if (!r) return `<div class="panel"><div class="err-msg">Resident record not found.</div><button class="btn-sm primary" onclick="navAdmin('residents')">Back to Residents</button></div>`;
  const dob = birthDateBounds();
  return `
  <span class="back-link" onclick="navAdmin('residents')">${icon('arrow-left')} Back to Residents</span>
  <div class="panel" data-form>
    <h3 style="font-size:17px;color:var(--navy);margin-bottom:16px">Edit Resident</h3>
    ${formErrorBox(state.requestErr)}
    <div class="form-grid-2">
      <div class="field"><label>Barangay ID</label><input value="${escapeHtml(r.id)}" disabled></div>
      <div class="field"><label>Status</label><input value="${escapeHtml(r.status)}" disabled></div>
    </div>
    ${nameFields('er', r)}
    <div class="form-grid-2">
      <div class="field"><label>Date of Birth <span style="font-weight:400;color:var(--slate)">(13 years old or above)</span></label><input id="er-dob" type="date" min="${dob.min}" max="${dob.max}" value="${escapeHtml(r.dob)}"></div>
      <div class="field"><label>Contact Number</label>${phoneField('er-contact', r.contact)}</div>
    </div>
    ${addressFields('er', r.address)}
    <div class="field"><label>Email</label><input id="er-email" type="email" maxlength="150" value="${escapeHtml(r.email)}"></div>
    <div class="action-row"><button class="abtn ready" data-submit onclick="saveEditedResident('${esc(r.id)}')">${icon('floppy-disk')} Save Changes</button><button class="abtn hold" onclick="navAdmin('residents')">${icon('xmark')} Cancel</button></div>
  </div>`;
}

function adminDocumentRequests() {
  const tabs = ['All', 'Pending', 'On Hold', 'Approved', 'Ready for Pickup', 'Completed', 'Rejected'];
  const rows = state.cache.adminRequests || [];
  return `
  <div class="topbar"><div><h2>Document Requests</h2><div class="sub">Review and process resident requests</div></div>${topbarRight('admin')}</div>
  <div class="tabs-row">${tabs.map(t => `<div class="tab-btn ${state.requestTab === t ? 'active' : ''}" onclick="setRequestTab('${t}')">${t}</div>`).join('')}</div>
  <div class="panel">
    <div class="panel-head">
      <select onchange="setDocFilter(this.value)" style="padding:8px 12px;border:1.5px solid var(--line);border-radius:8px;font-size:13px">
        <option value="All" ${state.requestDocFilter === 'All' ? 'selected' : ''}>All Document Types</option>
        ${documentsData.map(d => `<option value="${d.name}" ${state.requestDocFilter === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
      </select>
    </div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Request ID</th><th>Resident</th><th>Document</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="rowhover"><td class="mono">${r.id}</td><td>${escapeHtml(r.residentName)}</td><td>${r.docType}</td><td>${r.date}</td><td>${badge(r.status)}</td><td><button class="btn-sm primary" onclick="navAdmin('reviewRequest',{activeRequestId:'${r.id}'})">Review</button></td></tr>`).join('')}
    </tbody></table></div>` : emptyState('folder-open', 'No matching requests', 'Try a different status tab or document type filter.')}
  </div>`;
}

function adminReviewRequest() {
  const r = state.cache.activeRequest;
  if (!r) return `<div class="panel"><div class="err-msg">Request not found.</div><button class="btn-sm primary" onclick="navAdmin('documentRequests')">Back to Document Requests</button></div>`;
  const docDef = documentsData.find(d => d.name === r.docType);
  let nextStepActions = '';
  if (r.status === 'Approved') {
    nextStepActions = `<div class="action-row"><button class="abtn ready" onclick="generatePdfReady('${r.id}')">${icon('file-pdf')} Generate PDF &amp; Mark Ready for Pickup</button></div>`;
  } else if (r.status === 'Ready for Pickup') {
    nextStepActions = `<div data-form>${formErrorBox('')}<div class="field" style="margin-top:14px"><label>Released By</label><input id="release-by" maxlength="100" placeholder="${escapeHtml(state.currentAdmin.name)}" value="${escapeHtml(state.currentAdmin.name)}"></div>
      <div class="action-row"><button class="abtn release" data-submit onclick="recordRelease('${r.id}')">${icon('box-open')} Record Release &amp; Mark Completed</button></div></div>`;
  } else if (r.status === 'Completed') {
    nextStepActions = `<div class="info-box">${icon('circle-check', ' style="color:var(--st-completed);margin-right:6px"')}Completed — released ${escapeHtml(r.releaseDate)} by ${escapeHtml(r.releasedBy)}.</div>`;
  }
  const doneStates = ['Rejected', 'Completed', 'Cancelled'];
  const canReview = ['Pending', 'On Hold'].includes(r.status);

  const atts = r.attachments || [];
  let docPreviewHtml;
  if (atts.length) {
    docPreviewHtml = atts.map(a => (a.fileType||'').startsWith('image/')
      ? `<img class="doc-preview-img" style="margin-bottom:10px" src="${escapeHtml(a.fileData)}" alt="${escapeHtml(a.fileName)}" onclick="openMedia('${esc(a.fileData)}','${escapeHtml(esc(a.fileName))}')">`
      : `<div class="doc-preview-file" style="margin-bottom:10px"><div class="dpf-ic">${icon('file-lines')}</div><div><div style="font-weight:700;color:var(--navy);font-size:13px">${escapeHtml(a.fileName)}</div><a href="${escapeHtml(a.fileData)}" target="_blank" rel="noopener" style="font-size:12.5px;color:var(--blue-mid);font-weight:700;display:inline-flex;align-items:center;gap:4px">Open attachment ${icon('arrow-right')}</a></div></div>`
    ).join('');
  } else {
    docPreviewHtml = `<div class="empty-state">${icon('paperclip')}<br>No supporting document attached.</div>`;
  }

  const verified = ['Approved', 'Ready for Pickup', 'Completed'].includes(r.status) || r.verified;
  const approved = ['Approved', 'Ready for Pickup', 'Completed'].includes(r.status);
  const ready = ['Ready for Pickup', 'Completed'].includes(r.status);
  const claimed = r.status === 'Completed';
  const steps = [
    { title: 'Submitted', desc: r.date, state: 'done' },
    { title: 'Verified', desc: verified ? 'Resident information confirmed' : (r.status === 'On Hold' ? 'Pending admin action' : 'Awaiting verification'), state: verified ? 'done' : (r.status === 'On Hold' ? 'now' : '') },
    { title: 'Approved', desc: approved ? 'Request approved by admin' : 'Not yet approved', state: approved ? 'done' : (!verified && r.status !== 'On Hold' && !doneStates.includes(r.status) ? 'now' : '') },
    { title: 'Ready for Pickup', desc: ready ? 'Document generated and printed' : 'Pending document generation', state: ready ? 'done' : (approved ? 'now' : '') },
    { title: 'Claimed', desc: claimed ? `Released ${r.releaseDate} by ${r.releasedBy}` : 'Awaiting resident pickup', state: claimed ? 'done' : (ready ? 'now' : '') }
  ];
  const history = r.history || [];
  const timelineHtml = history.map((h, i) => `
    <div class="v-step done">
      <div class="v-dot-wrap"><div class="v-dot"></div>${i < history.length - 1 ? '<div class="v-line"></div>' : ''}</div>
      <div class="v-content"><div class="v-title">${escapeHtml(h.title)}</div><div class="v-desc">${escapeHtml(h.description)}${h.byName ? ` • ${escapeHtml(h.byName)}${h.byRole ? ` (${escapeHtml(h.byRole)})` : ''}` : ''} • ${escapeHtml(h.date)}</div></div>
    </div>`).join('');

  const rejectModal = state.rejectRequestId === r.id ? `<div class="modal-overlay" onclick="closeRejectRequest()"><div class="modal-box reason-modal" onclick="event.stopPropagation()"><button class="modal-close" onclick="closeRejectRequest()">${icon('xmark')}</button><div class="reason-modal-body"><h3>Reject Request</h3><p>Select a predefined reason for rejecting this request.</p>${formErrorBox(state.requestErr)}<div class="field"><label>Rejection Reason</label><select id="reject-reason" onchange="document.getElementById('reject-other-wrap').style.display=this.value==='Other'?'block':'none'"><option value="">Select a reason</option><option>Incomplete requirements</option><option>Invalid or expired supporting document</option><option>Information does not match barangay records</option><option>Resident is not eligible for this document</option><option>Duplicate or existing active request</option><option>Other</option></select></div><div class="field" id="reject-other-wrap" style="display:none"><label>Other Reason</label><textarea id="reject-other" maxlength="500" placeholder="Explain the reason..."></textarea></div><div class="action-row"><button class="abtn hold" onclick="closeRejectRequest()">${icon('xmark')} Cancel</button><button class="abtn reject" onclick="confirmRejectRequest('${r.id}')">${icon('xmark')} Confirm Rejection</button></div></div></div></div>` : '';
  const appealImages = r.appealImages || [];
  const appealGallery = appealImages.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">${appealImages.map(p=>`<img src="${escapeHtml(p)}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:pointer" onclick="openMedia('${esc(p)}','Appeal evidence')">`).join('')}</div>` : '';
  const appealIntro = `<b>Resident Appeal Pending</b><br>${escapeHtml(r.appealBy || r.residentName)} submitted an appeal on ${escapeHtml(r.appealDate || '—')}.<br><b>Appeal reason:</b> ${escapeHtml(r.appealReason || '—')}${appealGallery}`;
  const appealPanel = r.appealStatus === 'Pending'
    ? `<div class="info-box appeal-box" style="margin-bottom:16px">
        ${appealIntro}
        <div style="margin-top:12px;font-size:12.5px;font-weight:700;color:${r.appealReviewed ? '#15803D' : '#B7791F'}">${icon(r.appealReviewed ? 'circle-check' : 'circle-exclamation')} ${r.appealReviewed ? `Reviewed by ${escapeHtml(r.appealReviewedBy||'')} on ${escapeHtml(r.appealReviewedDate||'')}` : 'Not yet reviewed — please check the reason and evidence images above'}</div>
        ${!r.appealReviewed ? `<div class="action-row"><button class="abtn hold" onclick="markAppealReviewed('${r.id}')">${icon('eye')} Mark as Reviewed</button></div>` : ''}
        ${isAdminLevel()
          ? `<div class="field" style="margin-top:12px"><label>Appeal Decision Remarks</label><textarea id="appeal-review-comments" maxlength="500" placeholder="Add remarks for the appeal decision..."></textarea></div>
             <div class="action-row"><button class="abtn approve" ${r.appealReviewed?'':'disabled'} onclick="resolveAppeal('${r.id}','approve')">${icon('check')} Approve Appeal</button><button class="abtn reject" ${r.appealReviewed?'':'disabled'} onclick="resolveAppeal('${r.id}','deny')">${icon('xmark')} Uphold Rejection</button></div>`
          : `<div style="margin-top:10px;font-size:12.5px;color:var(--slate)">${icon('lock')} Only an Administrator can make the final decision on an appeal.</div>`}
      </div>`
    : (r.appealStatus && r.appealStatus !== 'None' ? `<div class="info-box" style="margin-bottom:16px"><b>Appeal ${escapeHtml(r.appealStatus)}.</b> ${escapeHtml(r.appealResolution || '')}${appealGallery}</div>` : '');
  return `
  <span class="back-link" onclick="navAdmin('documentRequests')">${icon('arrow-left')} Back to Document Requests</span>
  <div class="review-grid">
    <div>
      <div class="panel">
        <div class="review-header">
          <div class="review-header-ic">${icon(docDef ? docDef.icon : 'file-lines')}</div>
          <div>
            <h3 class="mono" style="margin-bottom:2px">${escapeHtml(r.id)}</h3>
            <div style="font-size:12.5px;color:var(--slate)">${escapeHtml(r.docType)}</div>
          </div>
          <div style="margin-left:auto">${badge(r.status)}</div>
        </div>
        <div class="verify-pill ${r.verified ? 'yes' : 'no'}" onclick="toggleVerify('${r.id}')">${icon(r.verified ? 'circle-check' : 'circle-exclamation')} Resident ${r.verified ? 'Verified' : 'Not Verified — click to verify'}</div>
        <div class="kv">
          <div><div>Resident</div><b>${escapeHtml(r.residentName)}</b></div>
          <div><div>Document Type</div><b>${escapeHtml(r.docType)}</b></div>
          <div><div>Address</div><b>${escapeHtml(r.residentAddress || '—')}</b></div>
          <div><div>Purpose</div><b>${escapeHtml(r.purpose)}</b></div>
          <div><div>Date Requested</div><b>${escapeHtml(r.date)}</b></div>
          <div><div>Contact Number</div><b>${escapeHtml(r.contactNumber)}</b></div>
          <div><div>Number of Copies</div><b>${escapeHtml(r.copies || '1')}</b></div>
          <div><div>Preferred Release Date</div><b>${escapeHtml(r.preferredDate || 'Not specified')}</b></div>
        </div>
        ${r.notes ? `<div class="info-box" style="margin-top:16px"><b>Resident's Notes:</b> ${escapeHtml(r.notes)}</div>` : ''}
        ${r.status === 'Cancelled' && r.cancellationReason ? `<div class="info-box cancellation-info" style="margin-top:16px"><b>${escapeHtml(r.cancelledByName || r.residentName)} cancelled the request.</b><br><b>Reason:</b> ${escapeHtml(r.cancellationReason)}<br><span style="font-size:12px;color:var(--slate)">${escapeHtml(r.cancellationDate || '')}</span></div>` : ''}
        ${r.status === 'Rejected' && r.rejectionReason ? `<div class="info-box rejection-info" style="margin-top:16px"><b>${escapeHtml(r.rejectedByName || 'Admin Staff')} rejected the request.</b><br><b>Reason:</b> ${escapeHtml(r.rejectionReason)}<br><span style="font-size:12px;color:var(--slate)">Position: ${escapeHtml(r.rejectedByRole || state.currentAdmin?.role || 'Admin/Staff')} • ${escapeHtml(r.rejectedDate || '')}</span></div>` : ''}
        ${appealPanel}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Resident Snapshot</h3></div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="avatar" style="width:52px;height:52px;font-size:20px">${icon('user')}</div>
          <div>
            <div style="font-weight:700;color:var(--navy);font-size:14.5px">${escapeHtml(r.residentName)}</div>
            <div class="mono" style="font-size:12.5px;color:var(--slate)">${escapeHtml(r.residentId)}</div>
          </div>
        </div>
        <div class="action-row"><button class="btn-sm outline" onclick="navAdmin('residents')">${icon('users')} View in Residents</button></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Decision</h3></div>
        <div class="field"><label>Comments / Remarks</label><textarea id="review-comments" maxlength="500" placeholder="Add remarks for the resident...">${escapeHtml(r.comments)}</textarea></div>
        <div class="action-row">
          <button class="abtn approve" ${canReview ? '' : 'disabled'} onclick="reviewAction('${r.id}','approve')">${icon('check')} Approve</button>
          <button class="abtn hold" ${canReview ? '' : 'disabled'} onclick="reviewAction('${r.id}','hold')">${icon('pause')} Put on Hold</button>
          <button class="abtn reject" ${canReview ? '' : 'disabled'} onclick="reviewAction('${r.id}','reject')">${icon('xmark')} Reject</button>
        </div>
        ${nextStepActions}
      </div>
    </div>
    <div>
      <div class="panel">
        <div class="panel-head"><h3>Supporting Document</h3></div>
        ${docPreviewHtml}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Request Timeline</h3></div>
        <div class="v-timeline">${timelineHtml}</div>
      </div>
    </div>
  </div>${rejectModal}`;
}

function adminNotifications() {
  return `
  <div class="topbar"><div><h2>Notifications</h2><div class="sub">Recent activity across the system — click one to see its details</div></div>${topbarRight('admin')}</div>
  ${notificationsPanelHtml('admin')}`;
}

function setReportFilter(name, value) {
  state[name] = value;
  navAdmin('reports');
}

function clearReportFilters() {
  state.reportFrom = ''; state.reportTo = ''; state.reportStatus = 'All'; state.reportDocFilter = 'All';
  navAdmin('reports');
}

function printFilteredReport() {
  window.print();
}

function adminReports() {
  const data = state.cache.reportData || { requests: [], byStatus: {}, byDoc: {}, totalResidents: 0, activeResidents: 0, requestedCount: 0 };
  const filtered = data.requests;
  const byStatus = data.byStatus;
  const byDoc = data.byDoc;
  const activeResidents = data.activeResidents;
  const requestedCount = data.requestedCount;
  const statusIcons = { 'Pending': 'hourglass-half', 'On Hold': 'pause', 'Approved': 'circle-check', 'Ready for Pickup': 'box', 'Completed': 'flag-checkered', 'Rejected': 'xmark', 'Cancelled': 'ban' };
  const statusColorVar = { 'Pending': 'var(--st-pending)', 'On Hold': 'var(--st-hold)', 'Approved': 'var(--st-approved)', 'Ready for Pickup': 'var(--st-ready)', 'Completed': 'var(--st-completed)', 'Rejected': 'var(--st-rejected)', 'Cancelled': 'var(--st-cancelled)' };
  const statusOrder = ['Pending', 'On Hold', 'Approved', 'Ready for Pickup', 'Completed', 'Rejected', 'Cancelled'];
  const totalReq = filtered.length || 1;
  let cursor = 0;
  const gradientStops = [];
  const legendItems = [];
  statusOrder.forEach(s => {
    const v = byStatus[s] || 0;
    if (v === 0) return;
    const pct = v / totalReq * 100;
    gradientStops.push(`${statusColorVar[s]} ${cursor}% ${cursor + pct}%`); cursor += pct;
    legendItems.push({ label: s, value: v, pct: Math.round(pct), colorClass: statusClass(s), ic: statusIcons[s] || 'circle' });
  });
  const donutGradient = gradientStops.length ? gradientStops.join(', ') : 'var(--line) 0% 100%';
  const rows = filtered.slice(0, 50);
  return `
  <div class="topbar"><div><h2>Reports</h2><div class="sub">Filtered summaries generated from current system records</div></div>${topbarRight('admin')}</div>

  <div class="panel">
    <div class="panel-head"><h3>Report Filters</h3><span class="report-pill">${filtered.length} matching requests</span></div>
    <div class="form-grid-2">
      <div class="field"><label>Date From</label><input type="date" value="${state.reportFrom}" onchange="setReportFilter('reportFrom',this.value)"></div>
      <div class="field"><label>Date To</label><input type="date" value="${state.reportTo}" onchange="setReportFilter('reportTo',this.value)"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Status</label><select onchange="setReportFilter('reportStatus',this.value)">
        <option value="All">All Statuses</option>${statusOrder.map(x => `<option value="${x}" ${state.reportStatus === x ? 'selected' : ''}>${x}</option>`).join('')}
      </select></div>
      <div class="field"><label>Document Type</label><select onchange="setReportFilter('reportDocFilter',this.value)">
        <option value="All">All Document Types</option>${documentsData.map(d => `<option value="${d.name}" ${state.reportDocFilter === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
      </select></div>
    </div>
    <div class="action-row"><button class="btn-sm outline" onclick="clearReportFilters()">${icon('rotate-left')} Clear Filters</button><button class="abtn ready report-print-btn" onclick="printFilteredReport()">${icon('print')} Print Filtered Report</button></div>
  </div>

  <div class="stat-row">
    <div class="stat-card accent-blue"><div class="sc-top"><span class="sc-ic">${icon('file-lines')}</span><span class="sc-tag">Filtered</span></div><div class="n">${filtered.length}</div><div class="l">Total Requests</div></div>
    <div class="stat-card accent-teal"><div class="sc-top"><span class="sc-ic">${icon('users')}</span><span class="sc-tag">System</span></div><div class="n">${data.totalResidents}</div><div class="l">Registered Residents</div></div>
    <div class="stat-card accent-green"><div class="sc-top"><span class="sc-ic">${icon('circle-check')}</span><span class="sc-tag">Filtered</span></div><div class="n">${byStatus['Completed'] || 0}</div><div class="l">Completed Transactions</div></div>
    <div class="stat-card accent-amber"><div class="sc-top"><span class="sc-ic">${icon('hourglass-half')}</span><span class="sc-tag">Filtered</span></div><div class="n">${byStatus['Pending'] || 0}</div><div class="l">Awaiting Review</div></div>
  </div>

  <div class="report-grid-2">
    <div class="panel report-modern"><div class="report-modern-head"><h4>Requests by Status</h4><span class="report-pill">${filtered.length} total</span></div>
      <div class="donut-wrap"><div class="donut-chart" style="background:conic-gradient(${donutGradient});"><div class="donut-hole"><div class="donut-total">${filtered.length}</div><div class="donut-label">Total</div></div></div>
      <div class="donut-legend">${legendItems.map(it => `<div class="legend-row"><span class="bar-ic ${it.colorClass}" style="width:22px;height:22px;font-size:10px">${icon(it.ic)}</span><span class="legend-label">${it.label}</span><span class="legend-value">${it.value}</span><span class="legend-pct">${it.pct}%</span></div>`).join('')}</div></div>
    </div>
    <div class="panel report-modern"><div class="report-modern-head"><h4>Requests by Document Type</h4><span class="report-pill">${Object.keys(byDoc).length} types</span></div>
      <div class="line-chart-wrap">${lineChartSVG(Object.entries(byDoc).map(([k, v]) => { const d = documentsData.find(x => x.name === k); return { label: d ? d.short : k, value: v }; }))}</div>
    </div>
  </div>

  <div class="panel report-modern"><div class="report-modern-head"><h4>Filtered Transaction Report</h4><span class="report-pill">Showing ${Math.min(filtered.length, 50)} of ${filtered.length}</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Request ID</th><th>Resident</th><th>Document</th><th>Date</th><th>Status</th><th>Processed By</th></tr></thead><tbody>${rows.map(r => `<tr><td class="mono">${escapeHtml(r.id)}</td><td>${escapeHtml(r.residentName)}</td><td>${escapeHtml(r.docType)}</td><td>${escapeHtml(r.date)}</td><td>${badge(r.status)}</td><td>${escapeHtml(r.releasedBy || '—')}</td></tr>`).join('')}</tbody></table></div>` : emptyState('chart-pie', 'No matching records', 'Change the filters to view report results.')}
  </div>

  <div class="panel report-modern"><div class="report-modern-head"><h4>Resident Report</h4><span class="report-pill">Snapshot</span></div>
    <div class="mini-stats-row"><div class="mini-stat"><div class="mn">${data.totalResidents}</div><div class="ml">Total Registered</div></div><div class="mini-stat"><div class="mn">${activeResidents}</div><div class="ml">Active Residents</div></div><div class="mini-stat"><div class="mn">${requestedCount}</div><div class="ml">Residents in Filtered Report</div></div></div>
  </div>

  <section class="print-report">
    <div class="print-report-header">
      <div class="print-brand">${logoMark(54)}<div><div class="print-brand-name">e-Kagawad System</div><div class="print-brand-sub">Barangay San Isidro • Cabuyao, Laguna</div></div></div>
      <div class="print-meta"><div>OFFICIAL TRANSACTION REPORT</div><span>Generated: ${new Date().toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
    </div>
    <div class="print-title-block"><h1>Filtered Transaction Report</h1><p>Summary of document requests based on the selected report filters.</p></div>
    <div class="print-filter-box">
      <div><span>Date From</span><b>${state.reportFrom || 'All dates'}</b></div>
      <div><span>Date To</span><b>${state.reportTo || 'All dates'}</b></div>
      <div><span>Status</span><b>${escapeHtml(state.reportStatus === 'All' ? 'All Statuses' : state.reportStatus)}</b></div>
      <div><span>Document Type</span><b>${escapeHtml(state.reportDocFilter === 'All' ? 'All Document Types' : state.reportDocFilter)}</b></div>
    </div>
    <div class="print-summary">
      <div><strong>${filtered.length}</strong><span>Total Requests</span></div>
      <div><strong>${byStatus['Completed'] || 0}</strong><span>Completed</span></div>
      <div><strong>${byStatus['Pending'] || 0}</strong><span>Pending</span></div>
      <div><strong>${requestedCount}</strong><span>Residents</span></div>
    </div>
    <div class="print-section-title"><h2>Transaction Details</h2><span>${filtered.length} record${filtered.length === 1 ? '' : 's'}</span></div>
    ${filtered.length ? `<table class="print-table"><thead><tr><th>#</th><th>Request ID</th><th>Resident</th><th>Document</th><th>Date</th><th>Status</th><th>Processed By</th></tr></thead><tbody>${filtered.map((r, i) => `<tr><td>${i + 1}</td><td class="mono">${escapeHtml(r.id)}</td><td>${escapeHtml(r.residentName)}</td><td>${escapeHtml(r.docType)}</td><td>${escapeHtml(r.date)}</td><td><span class="print-status status-${statusClass(r.status)}">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.releasedBy || '—')}</td></tr>`).join('')}</tbody></table>` : `<div class="print-empty">No transaction records match the selected filters.</div>`}
    <div class="print-footer"><span>e-Kagawad System • Barangay San Isidro</span><span>Prepared for official record/reference purposes</span></div>
  </section>`;
}

function adminAccount() {
  const a = state.currentAdmin;
  return `
  <div class="topbar"><div><h2>Account Management</h2><div class="sub">Update your admin account information</div></div>${topbarRight('admin')}</div>
  <div class="panel" data-form>
    ${formErrorBox('')}
    <div class="form-grid-2">
      <div class="field"><label>Admin/Staff ID</label><input value="${escapeHtml(a.id)}" disabled></div>
      <div class="field"><label>Name</label><input id="admin-name" maxlength="100" value="${escapeHtml(a.name)}"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Contact Number</label>${phoneField('admin-contact', a.contact || '')}</div>
      <div class="field"><label>Email</label><input id="admin-email" type="email" maxlength="150" value="${escapeHtml(a.email || '')}" placeholder="admin@ekagawad.gov.ph"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>New Password</label>${passwordField('admin-password', 'Leave blank to keep current', { rules: true, autocomplete: 'new-password' })}</div>
      <div class="field"><label>Confirm New Password</label>${passwordField('admin-confirm', 'Confirm new password', { autocomplete: 'new-password' })}</div>
    </div>
    <div class="field" style="margin-top:-6px">${pwRulesHtml('admin-password')}</div>
    <div class="action-row"><button class="abtn ready" data-submit onclick="saveAdminAccount()">${icon('floppy-disk')} Save Changes</button></div>
  </div>`;
}
