/* ============================================================
   STAFF.JS  (NEW FILE — load it right AFTER js/admin.js)
   ------------------------------------------------------------
   The "Moderators" page of the Admin portal (Administrator only)
   plus the small helper the rest of the admin portal uses to
   know what the logged-in person may do.

   isAdminLevel()  -> true for an Administrator, false for a Moderator

   The server enforces every rule again (api/staff.php uses
   require_administrator()), so hiding a button here is only about
   a cleaner screen — it is never the security.
   ============================================================ */

function isAdminLevel(){
  return !!(state.currentAdmin && state.currentAdmin.accessLevel === 'admin');
}

function staffCountText(){
  const n = (state.cache.staff || []).length;
  return `${n} moderator${n === 1 ? '' : 's'}`;
}

/* Position / job title: 2–80 characters. Returns '' when fine. */
function positionError(value){
  if(value.length < 2 || value.length > 80 || !/^[\p{L}\p{M}\p{N}\s.,&'\-\/()]+$/u.test(value)){
    return "Position must be 2–80 characters (letters, numbers, spaces and . , & - / ( ) ' only).";
  }
  return '';
}

/* ---------- add / edit window ---------- */

function openStaffModal(mode, id){
  state.staffModal = { mode, id: id || null };
  render(true);
  setTimeout(() => { const el = document.getElementById('st-name'); if(el) el.focus(); }, 30);
}

function closeStaffModal(){
  state.staffModal = null;
  render(true);
}

function staffModalHtml(){
  const m = state.staffModal;
  if(!m) return '';
  const editing = m.mode === 'edit';
  const s = editing ? (state.cache.staff || []).find(x => x.id === m.id) : null;
  if(editing && !s) return '';
  return `<div class="modal-overlay">
    <div class="modal-box reason-modal" onclick="event.stopPropagation()">
      <button class="modal-close" type="button" aria-label="Close" onclick="closeStaffModal()">${icon('xmark')}</button>
      <div class="reason-modal-body" data-form style="overflow-y:auto">
        <h3>${editing ? 'Edit Moderator' : 'Add Moderator'}</h3>
        <p>${editing ? `Update the information of ${escapeHtml(s.name)}.` : 'A Moderator ID and a temporary password are created automatically when you save.'}</p>
        ${formErrorBox('')}
        ${editing ? `<div class="field"><label>Moderator ID</label><input value="${escapeHtml(s.id)}" disabled></div>` : ''}
        <div class="field"><label>Full Name</label><input id="st-name" maxlength="100" placeholder="e.g. Maria Santos" value="${escapeHtml(s ? s.name : '')}"></div>
        <div class="field"><label>Position <span style="font-weight:400;color:var(--slate)">(optional)</span></label><input id="st-role" maxlength="80" placeholder="e.g. Barangay Secretary" value="${escapeHtml(s ? s.role : '')}"></div>
        <div class="field"><label>Contact Number</label>${phoneField('st-contact', s ? s.contact : '')}</div>
        <div class="field"><label>Email</label><input id="st-email" type="email" maxlength="150" placeholder="moderator@example.com" value="${escapeHtml(s ? (s.email || '') : '')}"></div>
        <div class="action-row">
          <button class="abtn hold" type="button" onclick="closeStaffModal()">${icon('xmark')} Cancel</button>
          <button class="abtn ready" type="button" data-submit onclick="submitStaff()">${icon(editing ? 'floppy-disk' : 'user-plus')} ${editing ? 'Save Changes' : 'Add Moderator'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function submitStaff(){
  return once('saveStaff', async () => {
    const m = state.staffModal;
    if(!m) return;
    const name = cleanText(document.getElementById('st-name').value);
    const role = cleanText(document.getElementById('st-role').value) || 'Moderator';
    const contactRaw = document.getElementById('st-contact').value.trim();
    const email = document.getElementById('st-email').value.trim().toLowerCase();
    clearFormError();
    if(!name || !contactRaw || !email){ showFormError('Please fill out all required fields.'); return; }
    const err = nameError(name) || positionError(role) || contactError(contactRaw) || emailError(email);
    if(err){ showFormError(err); return; }
    const contact = normalizeContact(contactRaw);
    const editing = m.mode === 'edit';

    const ok = await showConfirm({
      icon: editing ? 'floppy-disk' : 'user-plus',
      title: editing ? 'Save changes?' : 'Add this moderator?',
      message: editing ? 'The moderator\'s information will be updated.' : 'A Moderator ID and a temporary password will be created for this person.',
      details: [
        { label: 'Name', value: name },
        { label: 'Position', value: role },
        { label: 'Contact', value: contact },
        { label: 'Email', value: email },
      ],
      confirmText: editing ? 'Save Changes' : 'Add Moderator', cancelText: 'Review Again'
    });
    if(!ok) return;

    try{
      if(editing){
        await api.post('staff.php?action=update', { id: m.id, name, role, contact, email });
        await navAdmin('staff');
        toast('Moderator information updated.');
      }else{
        const res = await api.post('staff.php?action=add', { name, role, contact, email });
        await navAdmin('staff');
        await showAlert({
          title: 'Moderator Added',
          message: 'Give these login details to the moderator. They log in with "Login as: Moderator" and can change the password from their Account page.',
          details: [
            { label: 'Moderator ID', value: res.id, mono: true },
            { label: 'Temporary Password', value: res.tempPassword, mono: true },
          ],
          confirmText: 'Done'
        });
      }
    }catch(e){ showFormError(e.message); }
  });
}

/* ---------- row actions ---------- */

async function toggleStaffStatus(id){
  const s = (state.cache.staff || []).find(x => x.id === id);
  const activating = !!s && s.status !== 'Active';
  const name = s ? s.name : 'this moderator';
  const ok = await showConfirm({
    icon: activating ? 'user-check' : 'user-slash', tone: activating ? 'primary' : 'danger',
    title: activating ? 'Activate this moderator?' : 'Deactivate this moderator?',
    message: activating ? `${name} will be able to log in again.` : `${name} will be logged out and cannot log in until the account is activated again. Their past activity stays in the records.`,
    confirmText: activating ? 'Activate' : 'Deactivate', cancelText: 'Cancel'
  });
  if(!ok) return;
  try{
    await api.post('staff.php?action=toggleStatus', { id });
    await navAdmin('staff');
    toast(activating ? 'Moderator activated.' : 'Moderator deactivated.');
  }catch(e){ toast(e.message || 'Unable to update this moderator right now.'); }
}

async function resetStaffPassword(id){
  const s = (state.cache.staff || []).find(x => x.id === id);
  const ok = await showConfirm({
    icon: 'lock', tone: 'warning', title: 'Reset this password?',
    message: `A new temporary password will be created for ${s ? s.name : 'this moderator'}. The old password stops working immediately.`,
    confirmText: 'Reset Password', cancelText: 'Cancel'
  });
  if(!ok) return;
  try{
    const res = await api.post('staff.php?action=resetPassword', { id });
    await showAlert({
      title: 'Password Reset',
      message: 'Give this temporary password to the moderator. They can change it from their Account page.',
      details: [
        { label: 'Moderator ID', value: id, mono: true },
        { label: 'Temporary Password', value: res.tempPassword, mono: true },
      ],
      confirmText: 'Done'
    });
  }catch(e){
    await showAlert({ icon: 'circle-exclamation', tone: 'danger', title: 'Password not reset', message: e.message || 'Unable to reset the password right now.', confirmText: 'OK' });
  }
}

/* ================= RENDER: MODERATORS PAGE ================= */

function adminStaff(){
  const rows = state.cache.staff || [];
  return `
  <div class="topbar"><div><h2>Moderators</h2><div class="sub" id="staffCount">${staffCountText()}</div></div>${topbarRight('admin')}</div>
  <div class="info-box" style="margin-bottom:20px"><b>What a Moderator can do:</b> add and edit residents, verify, approve, hold, reject and release requests, view reports, and manage notifications.<br><b>Administrator only:</b> activate / deactivate / delete residents, decide appeals, and manage moderator accounts (this page).</div>
  <div class="panel">
    <div class="panel-head"><h3>Moderator Accounts</h3><button class="btn-sm primary" onclick="openStaffModal('add')">${icon('user-plus')} Add Moderator</button></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Moderator ID</th><th>Name</th><th>Position</th><th>Contact</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(s => `<tr class="rowhover">
        <td class="mono">${escapeHtml(s.id)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.role)}</td>
        <td>${escapeHtml(s.contact || '—')}</td>
        <td>${escapeHtml(s.email || '—')}</td>
        <td><span class="badge ${s.status === 'Active' ? 'completed' : 'cancelled'}">${escapeHtml(s.status)}</span></td>
        <td>
          <button class="btn-sm primary" onclick="openStaffModal('edit','${esc(s.id)}')">${icon('pen')} Edit</button>
          <button class="btn-sm outline" onclick="resetStaffPassword('${esc(s.id)}')">${icon('lock')} Reset Password</button>
          <button class="btn-sm ${s.status === 'Active' ? 'danger' : 'primary'}" onclick="toggleStaffStatus('${esc(s.id)}')">${icon(s.status === 'Active' ? 'user-slash' : 'user-check')} ${s.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>`).join('')}
    </tbody></table></div>` : emptyState('user-shield', 'No moderators yet', 'Add a moderator so staff can help process resident requests.', `<button class="btn-sm primary" onclick="openStaffModal('add')">${icon('user-plus')} Add Moderator</button>`)}
  </div>${staffModalHtml()}`;
}
