/* ============================================================
   RESIDENT.JS
   ------------------------------------------------------------
   Everything for the RESIDENT portal. Every action that used to
   just push into a JS array now calls the real PHP API
   (api/requests.php, api/account.php) which reads/writes MySQL.

   NEW in this version:
   - confirmation windows (dialog.js) instead of alert/confirm/prompt
   - stricter form checks; errors show inside the form without
     erasing what was typed; Enter submits
   - +63 phone box, password eye + rules, house no./street style
   - supporting document: remove it before sending, or replace /
     remove it later while the request is Pending / On Hold
   - "Delete My Account" on the Account page
   ============================================================ */

  function openClaimStub(id){ state.claimStubId = id; render(true); }
  function closeClaimStub(){ state.claimStubId = null; render(true); }

  function claimStubModalHtml(){
    if(!state.claimStubId) return '';
    const r = state.cache.activeRequest;
    if(!r || r.id !== state.claimStubId) return '';
    const claimed = r.status === 'Completed';
    return `<div class="modal-overlay print-cert-overlay" onclick="closeClaimStub()">
      <div class="modal-box pdf-modal-box" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeClaimStub()">${icon('xmark')}</button>
        <div class="pdf-modal-scroll">
          <div class="stub-paper" style="position:relative;overflow:hidden">
            ${claimed ? `<div class="stub-claimed-badge">CLAIMED</div>` : ''}
            <div class="cert-letterhead">
              <div class="cert-letterhead-brand">
                ${logoMark(48)}
                <div>
                  <div class="cert-letterhead-name">Barangay San Isidro</div>
                  <div class="cert-letterhead-sub">Republic of the Philippines<br>City of Cabuyao, Province of Laguna<br>Office of the Barangay Captain</div>
                </div>
              </div>
              <div class="cert-letterhead-meta">CLAIM STUB<span>${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>
            </div>
            <h3 class="stub-title">Document Claim Stub</h3>
            <div class="stub-refbox">
              <div class="rl">Reference Number</div>
              <div class="rv">${escapeHtml(r.id)}</div>
            </div>
            <div class="stub-kv">
              <div><span>Resident Name</span><b>${escapeHtml(r.residentName)}</b></div>
              <div><span>Barangay ID</span><b>${escapeHtml(r.residentId)}</b></div>
              <div><span>Document Type</span><b>${escapeHtml(r.docType)}</b></div>
              <div><span>Number of Copies</span><b>${escapeHtml(r.copies||'1')}</b></div>
              <div><span>Date Requested</span><b>${escapeHtml(r.date)}</b></div>
              <div><span>Status</span><b>${escapeHtml(r.status)}</b></div>
            </div>
            <div class="stub-note">${icon('circle-exclamation')} Present this stub together with one (1) valid government-issued ID to claim your document at the Barangay Office. This stub is void once the document has been released.</div>
            <div class="stub-sign-row">
              <div class="stub-sign-block"><div class="stub-sig-line"></div><div class="stub-sig-label">Resident's Signature</div></div>
              <div class="stub-sign-block"><div class="stub-sig-line"></div><div class="stub-sig-label">Released By / Date</div></div>
            </div>
          </div>
        </div>
        <div class="pdf-modal-actions">
          <button class="btn-sm outline" onclick="window.print()">${icon('print')} Print Claim Stub</button>
        </div>
      </div>
    </div>`;
  }


async function submitDocRequest(){
  return once('submitRequest', async ()=>{
    const doc = documentsData.find(d=>d.id===state.activeDocId);
    if(!doc){ toast('Please choose a document type again.'); return; }

    const purpose = cleanText(document.getElementById('req-purpose').value);
    const contactRaw = document.getElementById('req-contact').value.trim();
    const copies = document.getElementById('req-copies').value.trim();
    const preferredDate = document.getElementById('req-date').value;
    const notes = document.getElementById('req-notes').value.trim();
    const fileInput = document.getElementById('req-file');
    const files = fileInput ? Array.from(fileInput.files || []) : [];

    clearFormError();
    if(!purpose){ showFormError('Please state the purpose of your request.'); return; }
    const purposeErr = lengthError(purpose, 'Purpose of request', 5, 255);
    if(purposeErr){ showFormError(purposeErr); return; }
    if(!contactRaw){ showFormError('Please provide a contact number for this request.'); return; }
    if(contactError(contactRaw)){ showFormError(contactError(contactRaw)); return; }
    const copiesNum = Number(copies);
    if(!/^\d+$/.test(copies) || !Number.isInteger(copiesNum) || copiesNum < 1 || copiesNum > 20){ showFormError('Number of copies must be a whole number from 1 to 20.'); return; }
    if(releaseDateError(preferredDate)){ showFormError(releaseDateError(preferredDate)); return; }
    if(notes.length > 500){ showFormError('Additional notes must not exceed 500 characters.'); return; }
    if(doc.supportingDocument==='required' && files.length===0){ showFormError('A supporting document is required for this document type. Please choose one or more image or PDF files.'); return; }
    if(files.length > 10){ showFormError('You may upload up to 10 supporting files.'); return; }
    for(const f of files){ const fe = fileError(f); if(fe){ showFormError(fe); return; } }

    const contact = normalizeContact(contactRaw);
    const ok = await showConfirm({
      icon:'paper-plane', tone:'primary', title:'Submit this request?',
      message:'Please review your request. It will be sent to the Barangay Office for review.',
      details:[
        {label:'Document', value:doc.name},
        {label:'Copies', value:String(copiesNum)},
        {label:'Contact', value:contact},
        {label:'Supporting document(s)', value:files.length ? `${files.length} file(s) attached` : 'None attached'},
      ],
      confirmText:'Submit Request', cancelText:'Review Again'
    });
    if(!ok) return;

    const fd = new FormData();
    fd.append('documentTypeId', doc.id);
    fd.append('purpose', purpose);
    fd.append('contact', contact);
    fd.append('copies', String(copiesNum));
    fd.append('preferredDate', preferredDate || '');
    fd.append('notes', notes);
    files.forEach(f => fd.append('files[]', f));

    try{
      const res = await api.postForm('requests.php?action=create', fd);
      state.requestErr='';
      await navResident('myRequests');
      toast(`Request submitted! Reference: ${res.id}`);
    }catch(e){
      showFormError(e.message || 'Unable to submit the request right now. Please check the form and try again.');
    }
  });
}

/* ---------- supporting document: replace / remove after submitting ---------- */

function pickAttachment(){
  const input = document.getElementById('att-file');
  if(input){ input.value=''; input.click(); }
}

async function onAttachmentPicked(input, id){
  const files = Array.from(input.files || []);
  if(!files.length) return;
  for(const f of files){ const err = fileError(f); if(err){ input.value=''; toast(err); return; } }
  const ok = await showConfirm({
    icon:'paperclip', title:'Use these files?',
    message:`The ${files.length} selected file(s) will replace the current supporting document(s) of this request.`,
    confirmText:'Upload Files', cancelText:'Cancel'
  });
  if(!ok){ input.value=''; return; }
  const fd = new FormData();
  fd.append('id', id);
  files.forEach(f=>fd.append('files[]', f));
  try{
    const res = await api.postForm('requests.php?action=updateAttachment', fd);
    await navResident('requestView', {activeRequestId:id});
    toast(res.message || 'Supporting document(s) updated.');
  }catch(e){ input.value=''; toast(e.message || 'Unable to upload the files right now.'); }
}

async function removeAttachment(id){
  const ok = await showConfirm({
    icon:'trash', tone:'danger', title:'Remove supporting document(s)?',
    message:'All attached files will be deleted from this request.',
    confirmText:'Remove Files', cancelText:'Keep Them'
  });
  if(!ok) return;
  const fd = new FormData();
  fd.append('id', id);
  fd.append('remove', '1');
  try{
    const res = await api.postForm('requests.php?action=updateAttachment', fd);
    await navResident('requestView', {activeRequestId:id});
    toast(res.message || 'Supporting document(s) removed.');
  }catch(e){ toast(e.message || 'Unable to remove the files right now.'); }
}

function cancelRequest(id){
  state.cancelRequestId=id;
  state.requestErr='';
  render();
}

async function confirmCancelRequest(id){
  return once('cancelRequest', async ()=>{
    const reason = cleanText(document.getElementById('cancel-reason')?.value||'');
    clearFormError();
    if(!reason){ showFormError(friendlyError('cancellationReason')); return; }
    const err = lengthError(reason, 'Cancellation reason', 5, 500);
    if(err){ showFormError(err); return; }
    try{
      await api.post('requests.php?action=cancel', { id, reason });
      state.cancelRequestId=null; state.requestErr='';
      await navResident('myRequests');
      toast(`Request ${id} cancelled.`);
    }catch(e){ showFormError(e.message); }
  });
}

function closeCancelRequest(){ state.cancelRequestId=null; state.requestErr=''; render(); }

function appealRequest(id){
  state.appealRequestId = id;
  state.requestErr = '';
  render();
}

function closeAppealRequest(){ state.appealRequestId = null; state.requestErr=''; render(); }

async function confirmAppealRequest(id){
  return once('appealRequest', async ()=>{
    const reason = cleanText(document.getElementById('appeal-reason')?.value || '');
    const input = document.getElementById('appeal-images');
    const files = input ? Array.from(input.files || []) : [];
    clearFormError();
    if(!reason){ showFormError('Please provide a reason for your appeal.'); return; }
    const err = lengthError(reason, 'Appeal reason', 5, 500);
    if(err){ showFormError(err); return; }
    if(files.length < 2){ showFormError('Please upload at least 2 supporting images for your appeal.'); return; }
    if(files.length > 6){ showFormError('You may upload up to 6 supporting images.'); return; }
    for(const f of files){ const fe = fileError(f); if(fe){ showFormError(fe); return; } }

    const fd = new FormData();
    fd.append('id', id);
    fd.append('reason', reason);
    files.forEach(f => fd.append('images[]', f));

    try{
      await api.postForm('requests.php?action=appeal', fd);
      state.appealRequestId = null; state.requestErr='';
      await navResident('requestView', {activeRequestId:id});
      toast('Appeal submitted to the Barangay Office.');
    }catch(e){ showFormError(e.message || 'Unable to submit the appeal right now.'); }
  });
}

function appealModalHtml(){
  if(!state.appealRequestId) return '';
  const r = state.cache.activeRequest;
  if(!r || r.id !== state.appealRequestId) return '';
  return `<div class="modal-overlay" onclick="closeAppealRequest()"><div class="modal-box reason-modal" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeAppealRequest()">${icon('xmark')}</button>
    <div class="reason-modal-body" data-form>
      <h3>Appeal Rejection</h3>
      <p>Explain why you are appealing, and attach at least 2 supporting images as evidence.</p>
      ${formErrorBox(state.requestErr)}
      <div class="field"><label>Appeal Reason</label><textarea id="appeal-reason" maxlength="500" placeholder="Explain your side..."></textarea></div>
      <div class="field"><label>Supporting Images <span style="font-weight:400;color:var(--slate)">(minimum 2, up to 6)</span></label>
        <input id="appeal-images" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" onchange="handleFilesSelect(this,{chipWrapId:'appeal-images-chip', max:6})">
        <div id="appeal-images-chip" class="file-chip-list" hidden></div>
      </div>
      <div class="action-row">
        <button class="abtn hold" onclick="closeAppealRequest()">${icon('xmark')} Cancel</button>
        <button class="abtn ready" data-submit onclick="confirmAppealRequest('${r.id}')">${icon('paper-plane')} Submit Appeal</button>
      </div>
    </div>
  </div></div>`;
}

function saveEditedRequest(id){
  // Editing the purpose on an existing Pending/On-Hold request is not
  // supported by the current API surface (cancel-and-resubmit is the
  // reliable path). Keeping this action available to cancel + point
  // the resident to submitting a fresh, corrected request.
  toast('To change the purpose, please cancel this request and submit a new one with the correct details.');
  state.editMode=false;
  render();
}

async function saveResidentAccount(){
  return once('saveResidentAccount', async ()=>{
    const contactRaw = document.getElementById('acc-contact').value.trim();
    const email = document.getElementById('acc-email').value.trim().toLowerCase();
    const newPass = document.getElementById('acc-password').value;
    const confirmPass = document.getElementById('acc-confirm').value;
    clearFormError();
    const err = contactError(contactRaw) || emailError(email) || (newPass ? passwordError(newPass) : '');
    if(err){ showFormError(err); return; }
    if(newPass!==confirmPass){ showFormError('New passwords do not match.'); return; }

    const contact = normalizeContact(contactRaw);
    const ok = await showConfirm({
      icon:'floppy-disk', title:'Save your changes?',
      message:'Your account information will be updated.',
      details:[
        {label:'Contact number', value:contact},
        {label:'Email', value:email},
        {label:'Password', value:newPass ? 'Will be changed' : 'Not changed'},
      ],
      confirmText:'Save Changes', cancelText:'Cancel'
    });
    if(!ok) return;

    try{
      const res = await api.post('account.php?action=updateResident', { contact, email, newPassword: newPass, confirmPassword: confirmPass });
      state.currentResident.contact = res.contact || contact;
      state.currentResident.email = res.email || email;
      render(true);
      toast('Account information updated.');
    }catch(e){ showFormError(e.message || 'Unable to update your account right now.'); }
  });
}

/* Resident deletes their OWN account (asks twice: a warning, then the password). */
async function deleteMyAccount(){
  const ok = await showConfirm({
    icon:'trash', tone:'danger', title:'Delete your account?',
    message:'This permanently deletes your resident account and all of your past request records (completed, rejected and cancelled). This cannot be undone.',
    confirmText:'Continue', cancelText:'Keep My Account'
  });
  if(!ok) return;
  const pw = await showPrompt({
    icon:'lock', tone:'danger', title:'Confirm with your password',
    message:'Enter your password to permanently delete your account.',
    confirmText:'Delete My Account',
    input:{ label:'Password', type:'password', placeholder:'Your password', required:true, requiredMessage:'Please enter your password.' }
  });
  if(pw===null) return;
  try{
    await api.post('account.php?action=deleteResident', { password: pw });
    resetToLanding();
    await showAlert({ title:'Account deleted', message:'Your resident account has been deleted. Thank you for using e-Kagawad.', confirmText:'Close' });
  }catch(e){
    await showAlert({ icon:'circle-exclamation', tone:'danger', title:'Account not deleted', message:e.message || 'Unable to delete your account right now.', confirmText:'OK' });
  }
}

/* ================= RENDER: RESIDENT PORTAL ================= */

function residentSidebar(){
  const items = [
    ['dashboard','gauge-high','Dashboard'],['requestDocuments','file-circle-plus','Request Documents'],
    ['myRequests','list-check','My Requests'],['notifications','bell','Notifications'],['account','user-gear','Account']
  ];
  return `<div class="sidebar">
    <div class="brand">${logoMark(26)} e-Kagawad</div>
    ${items.map(([k,ic,label])=>`<div class="nav-item ${state.residentPage===k?'active':''}" onclick="navResident('${k}')"><span class="nav-ic">${icon(ic)}</span> ${label}</div>`).join('')}
    <div class="sidebar-bottom"><div class="nav-item logout-item" onclick="logout()"><span class="nav-ic">${icon('right-from-bracket')}</span> Logout</div></div>
  </div>`;
}

function residentShell(){
  let content='';
  if(state.residentPage==='dashboard') content=residentDashboard();
  else if(state.residentPage==='requestDocuments') content=residentRequestDocs();
  else if(state.residentPage==='docDetail') content=residentDocDetail();
  else if(state.residentPage==='requestForm') content=residentRequestForm();
  else if(state.residentPage==='myRequests') content=residentMyRequests();
  else if(state.residentPage==='requestView') content=residentRequestView();
  else if(state.residentPage==='notifications') content=residentNotifications();
  else if(state.residentPage==='account') content=residentAccount();
  return `<div class="portal">${residentSidebar()}<div class="main"><div class="main-inner">${content}</div></div></div>${toastHtml()}`;
}

function residentDashboard(){
  const s = state.cache.myStats || { counts:{}, recent:[] };
  const count = st => s.counts[st] || 0;
  const recent = s.recent || [];
  return `
  <div class="topbar"><div><h2>Welcome back, ${escapeHtml(state.currentResident.name.split(' ')[0])}</h2><div class="sub">Barangay ID: ${escapeHtml(state.currentResident.id)}</div></div>${topbarRight('resident')}</div>
  <div class="stat-row">
    <div class="stat-card"><div class="n">${count('Pending')}</div><div class="l">Pending</div></div>
    <div class="stat-card"><div class="n">${count('Ready for Pickup')}</div><div class="l">Ready for Pickup</div></div>
    <div class="stat-card"><div class="n">${count('Completed')}</div><div class="l">Completed</div></div>
    <div class="stat-card"><div class="n">${count('Rejected')}</div><div class="l">Rejected</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Quick Actions</h3></div>
    <div class="quick-row">
      <button class="quick-btn" onclick="navResident('requestDocuments')"><span class="ic">${icon('file-circle-plus')}</span><span class="t">Request a Document</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
      <button class="quick-btn" onclick="navResident('myRequests')"><span class="ic">${icon('list-check')}</span><span class="t">View My Requests</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
      <button class="quick-btn" onclick="navResident('notifications')"><span class="ic">${icon('bell')}</span><span class="t">Notifications</span><span class="qa-arrow">Go ${icon('arrow-right')}</span></button>
    </div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Available Documents</h3><span class="link-btn" onclick="navResident('requestDocuments')">View all ${icon('arrow-right')}</span></div>
    <div class="doc-grid">${documentsData.slice(0,3).map(d=>`
      <div class="doc-card"><div class="doc-card-icon">${icon(d.icon||'file-lines')}</div><h4>${d.name}</h4><p>${d.desc}</p>
        <div class="row"><button class="btn-sm outline" onclick="navResident('docDetail',{activeDocId:'${d.id}'})">Details</button><button class="btn-sm primary" onclick="navResident('docDetail',{activeDocId:'${d.id}'})">Request</button></div>
      </div>`).join('')}
    </div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Recent Requests</h3><span class="link-btn" onclick="navResident('myRequests')">View all ${icon('arrow-right')}</span></div>
    ${recent.length? `<div class="table-wrap"><table><thead><tr><th>Request ID</th><th>Document</th><th>Date</th><th>Status</th></tr></thead><tbody>
      ${recent.map(r=>`<tr class="rowhover" style="cursor:pointer" onclick="navResident('requestView',{activeRequestId:'${r.id}'})"><td class="mono">${r.id}</td><td>${r.docType}</td><td>${r.date}</td><td>${badge(r.status)}</td></tr>`).join('')}
    </tbody></table></div>` : emptyState('file-lines','No requests yet','Once you submit a request, you\'ll be able to track its status here.',`<button class="btn-sm primary" onclick="navResident('requestDocuments')">${icon('file-circle-plus')} Request a Document</button>`)}
  </div>`;
}

function residentRequestDocs(){
  return `
  <div class="topbar"><div><h2>Request Documents</h2><div class="sub">Choose a document to view details and request</div></div>${topbarRight('resident')}</div>
  <div class="doc-grid">${documentsData.map(d=>`
    <div class="doc-card"><div class="doc-card-icon">${icon(d.icon||'file-lines')}</div><h4>${d.name}</h4><p>${d.desc}</p>
      <div class="row"><button class="btn-sm outline" onclick="navResident('docDetail',{activeDocId:'${d.id}'})">View Details</button><button class="btn-sm primary" onclick="navResident('docDetail',{activeDocId:'${d.id}'})">Request</button></div>
    </div>`).join('')}
  </div>`;
}

function residentDocDetail(){
  const d = documentsData.find(x=>x.id===state.activeDocId);
  if(!d) return `<div class="panel"><div class="empty-state">Document not found.</div><button class="btn-sm primary" onclick="navResident('requestDocuments')">Back to documents</button></div>`;
  return `
  <span class="back-link" onclick="navResident('requestDocuments')">${icon('arrow-left')} Back to documents</span>
  <div class="panel">
    <h3 style="font-size:18px;color:var(--navy);margin-bottom:14px">${d.name}</h3>
    <div class="kv"><div><div>Description</div><b>${d.desc}</b></div><div><div>Purpose / Uses</div><b>${d.purpose}</b></div></div>
    <div class="kv"><div><div>Requirements</div><b>${d.requirements}</b></div></div>
    <div class="action-row"><button class="abtn ready" onclick="navResident('requestForm',{activeDocId:'${d.id}'})">${icon('file-circle-plus')} Request This Document</button></div>
  </div>`;
}

function residentRequestForm(){
  const d = documentsData.find(x=>x.id===state.activeDocId);
  if(!d) return `<div class="panel"><div class="empty-state">Document not found.</div><button class="btn-sm primary" onclick="navResident('requestDocuments')">Back to documents</button></div>`;
  const r = state.currentResident;
  const rd = releaseDateBounds();
  return `
  <span class="back-link" onclick="navResident('docDetail',{activeDocId:'${d.id}'})">${icon('arrow-left')} Back</span>
  <div class="panel" data-form>
    <h3 style="font-size:17px;color:var(--navy);margin-bottom:16px">Request Form — ${d.name}</h3>
    ${formErrorBox(state.requestErr)}
    <div class="kv">
      <div><div>Resident Name</div><b>${escapeHtml(r.name)}</b></div>
      <div><div>Barangay ID</div><b class="mono">${escapeHtml(r.id)}</b></div>
      <div><div>Address</div><b>${escapeHtml(r.address)}</b></div>
      <div><div>Document</div><b>${d.name}</b></div>
    </div>
    <div class="info-box" style="margin-top:18px;margin-bottom:18px"><b>Document Requirements:</b> ${escapeHtml(d.requirements)}<br><span style="font-size:12px;color:var(--slate)">Supporting document: ${d.supportingDocument==='required'?'Required for this document type':'Optional for this document type'}</span></div>
    <div class="form-grid-2" style="margin-top:20px">
      <div class="field"><label>Contact Number</label>${phoneField('req-contact', r.contact&&r.contact!=='—'?r.contact:'')}</div>
      <div class="field"><label>Number of Copies</label><input id="req-copies" type="number" min="1" max="20" step="1" value="1"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Preferred Release Date</label><input id="req-date" type="date" min="${rd.min}" max="${rd.max}"></div>
        <div class="field"><label>Supporting Document(s) <span style="font-weight:400;color:var(--slate)">(${d.supportingDocument==='required'?'required':'optional'})</span></label>
        <input id="req-file" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" onchange="handleFilesSelect(this,{chipWrapId:'req-file-chip'})">
        <div id="req-file-chip" class="file-chip-list" hidden></div>
        <div style="font-size:12px;color:var(--slate);margin-top:6px">Accepted: JPG, PNG, GIF, WEBP or PDF, up to 5 MB each. Select multiple files if this document needs more than one (e.g. ID front and back).</div></div>
    </div>
    <div class="field"><label>Purpose of Request</label><textarea id="req-purpose" maxlength="255" placeholder="e.g. For employment requirement"></textarea></div>
    <div class="field"><label>Additional Notes <span style="font-weight:400;color:var(--slate)">(optional)</span></label><textarea id="req-notes" maxlength="500" placeholder="Anything else the barangay staff should know"></textarea></div>
    <div class="action-row"><button class="abtn ready" data-submit onclick="submitDocRequest()">${icon('paper-plane')} Submit Request</button></div>
  </div>`;
}

function residentMyRequests(){
  const mine = state.cache.myRequests || [];
  return `
  <div class="topbar"><div><h2>My Requests</h2><div class="sub">All documents you've requested</div></div>${topbarRight('resident')}</div>
  <div class="panel">
    ${mine.length? `<div class="table-wrap"><table><thead><tr><th>Request ID</th><th>Document</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${mine.map(r=>`<tr class="rowhover"><td class="mono">${r.id}</td><td>${r.docType}</td><td>${r.date}</td><td>${badge(r.status)}</td><td><button class="btn-sm outline" onclick="navResident('requestView',{activeRequestId:'${r.id}'})">View</button></td></tr>`).join('')}
    </tbody></table></div>` : emptyState('list-check','No requests yet','You haven\'t submitted any document requests so far.',`<button class="btn-sm primary" onclick="navResident('requestDocuments')">${icon('file-circle-plus')} Request a Document</button>`)}
  </div>`;
}

/* supporting document area on a submitted request:
   view it, and while Pending / On Hold replace it (or remove it when optional) */
function attachmentBlock(r){
  const def = documentsData.find(d=>d.name===r.docType);
  const editable = ['Pending','On Hold'].includes(r.status);
  const required = !def || def.supportingDocument==='required';
  const atts = r.attachments || [];

  const list = atts.length ? atts.map(a=>{
    const viewBtn = (a.fileType||'').startsWith('image/')
      ? `<button class="btn-sm outline" onclick="openMedia('${esc(a.fileData)}','${escapeHtml(esc(a.fileName))}')">${icon('eye')} View</button>`
      : `<a class="btn-sm outline" href="${escapeHtml(a.fileData)}" target="_blank" rel="noopener" style="text-decoration:none">${icon('eye')} Open</a>`;
    return `<div class="file-chip" style="margin-top:8px"><span class="fc-name">${icon('paperclip')} ${escapeHtml(a.fileName)}</span>${viewBtn}</div>`;
  }).join('') : `<div class="file-chip" style="margin-top:14px"><span class="fc-name">${icon('paperclip')} No supporting document attached</span></div>`;

  return `${list}
    ${editable?`<div class="action-row" style="margin-top:10px">
      <button class="btn-sm outline" onclick="pickAttachment()">${icon('paperclip')} ${atts.length?'Replace All Files':'Attach Files'}</button>
      ${atts.length && !required?`<button class="btn-sm danger" onclick="removeAttachment('${r.id}')">${icon('trash')} Remove All</button>`:''}
    </div>
    <input id="att-file" type="file" multiple hidden accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" onchange="onAttachmentPicked(this,'${r.id}')">
    ${required?`<div style="font-size:12px;color:var(--slate);margin-top:6px">This document type requires a supporting document. Uploading new files replaces all current ones.</div>`:''}`:''}`;
}

function residentRequestView(){
  const r = state.cache.activeRequest;
  if(!r) return `<div class="panel"><div class="empty-state">Request not found.</div></div>`;
  let actions = '';
  if(r.status==='Pending'){
    actions = `<div class="action-row"><button class="abtn reject" onclick="cancelRequest('${r.id}')">${icon('ban')} Cancel Request</button></div>`;
  } else if(r.status==='On Hold'){
    actions = `<div class="info-box">This request is On Hold. Please review the admin comments above. You can replace your supporting document below; if requirements changed significantly, you may cancel and resubmit.</div>
      <div class="action-row"><button class="abtn reject" onclick="cancelRequest('${r.id}')">${icon('ban')} Cancel Request</button></div>`;
  } else if(r.status==='Rejected'){
    actions = `<div class="info-box rejection-info"><b>Admin/Staff has rejected this request.</b><br><b>Reason:</b> ${escapeHtml(r.rejectionReason||r.comments||'No reason provided.')}<br><span style="font-size:12px;color:var(--slate)">Rejected by ${escapeHtml(r.rejectedByName||'Admin Staff')} (${escapeHtml(r.rejectedByRole||'Admin/Staff')})</span></div>
      ${r.appealStatus==='Pending'?`<div class="info-box" style="margin-top:12px"><b>Appeal pending.</b> Your appeal is waiting for admin review.</div>`:`<div class="action-row"><button class="abtn ready" onclick="appealRequest('${r.id}')">${icon('rotate-left')} Appeal Rejection</button></div>`}`;
  } else if(r.status==='Ready for Pickup'){
    actions = `<div class="info-box">${icon('circle-check', ' style="color:var(--st-completed);margin-right:6px"')}Your document is ready for pickup. Please visit the Barangay Office with a valid ID.</div>
      <div class="action-row"><button class="abtn ready" onclick="openClaimStub('${r.id}')">${icon('id-card')} View / Print Claim Stub</button></div>`;
  } else if(r.status==='Completed'){
    actions = `<div class="info-box">${icon('file-circle-check', ' style="color:var(--blue-mid);margin-right:6px"')}Document successfully claimed on <b>${escapeHtml(r.releaseDate)}</b>, released by <b>${escapeHtml(r.releasedBy)}</b>.</div>
      <div class="action-row"><button class="btn-sm outline" onclick="openClaimStub('${r.id}')">${icon('id-card')} View Claim Stub</button></div>`;
  } else if(r.status==='Cancelled'){
    actions = `<div class="info-box">This request was cancelled.</div>`;
  }
  const historyHtml=(r.history||[]).map((h,i,arr)=>`<div class="v-step done"><div class="v-dot-wrap"><div class="v-dot"></div>${i<arr.length-1?'<div class="v-line"></div>':''}</div><div class="v-content"><div class="v-title">${escapeHtml(h.title)}</div><div class="v-desc">${escapeHtml(h.description)}${h.byName?` • ${escapeHtml(h.byName)}${h.byRole?` (${escapeHtml(h.byRole)})`:''}`:''} • ${escapeHtml(h.date)}</div></div></div>`).join('');
  const cancelModal = state.cancelRequestId===r.id ? `<div class="modal-overlay" onclick="closeCancelRequest()"><div class="modal-box reason-modal" onclick="event.stopPropagation()"><button class="modal-close" onclick="closeCancelRequest()">${icon('xmark')}</button><div class="reason-modal-body"><h3>Cancel Request</h3><p>Please provide a reason for cancelling this request.</p>${formErrorBox(state.requestErr)}<div class="field"><label>Cancellation Reason</label><textarea id="cancel-reason" maxlength="500" placeholder="e.g. I no longer need this document."></textarea></div><div class="action-row"><button class="abtn hold" onclick="closeCancelRequest()">${icon('xmark')} Keep Request</button><button class="abtn reject" onclick="confirmCancelRequest('${r.id}')">${icon('ban')} Confirm Cancellation</button></div></div></div></div>` : '';
  return `
  <span class="back-link" onclick="navResident('myRequests')">${icon('arrow-left')} Back to My Requests</span>
  <div class="panel">
    <div class="panel-head"><h3 class="mono">${escapeHtml(r.id)}</h3>${badge(r.status)}</div>
    <div class="kv">
      <div><div>Document Type</div><b>${escapeHtml(r.docType)}</b></div>
      <div><div>Purpose</div><b>${escapeHtml(r.purpose)}</b></div>
      <div><div>Date Requested</div><b>${escapeHtml(r.date)}</b></div>
      <div><div>Number of Copies</div><b>${escapeHtml(r.copies||'1')}</b></div>
      <div><div>Contact Number</div><b>${escapeHtml(r.contactNumber||'—')}</b></div>
      <div><div>Preferred Release Date</div><b>${escapeHtml(r.preferredDate||'Not specified')}</b></div>
      <div><div>Supporting Document</div><b>${escapeHtml(r.fileName||'None attached')}</b></div>
      <div><div>Admin Comments</div><b>${escapeHtml(r.comments||'—')}</b></div>
    </div>
    ${attachmentBlock(r)}
    ${r.notes?`<div class="info-box" style="margin-top:14px"><b>Additional Notes:</b> ${escapeHtml(r.notes)}</div>`:''}
    ${r.status==='Cancelled'&&r.cancellationReason?`<div class="info-box cancellation-info" style="margin-top:14px"><b>Request cancelled by ${escapeHtml(r.cancelledByName||r.residentName)}.</b><br><b>Reason:</b> ${escapeHtml(r.cancellationReason)}<br><span style="font-size:12px;color:var(--slate)">${escapeHtml(r.cancellationDate||'')}</span></div>`:''}
    <div class="panel" style="margin-top:18px"><div class="panel-head"><h3>Request History</h3></div><div class="v-timeline">${historyHtml}</div></div>
    ${actions}
  </div>${cancelModal}${appealModalHtml()}`;
}

function residentNotifications(){
  return `
  <div class="topbar"><div><h2>Notifications</h2><div class="sub">Updates about your requests — click one to see its details</div></div>${topbarRight('resident')}</div>
  ${notificationsPanelHtml('resident')}`;
}

function residentAccount(){
  const r = state.currentResident;
  return `
  <div class="topbar"><div><h2>Account Management</h2><div class="sub">Update your contact information</div></div>${topbarRight('resident')}</div>
  <div class="panel" data-form>
    ${formErrorBox('')}
    <div class="form-grid-2">
      <div class="field"><label>Full Name</label><input value="${escapeHtml(r.name)}" disabled></div>
      <div class="field"><label>Barangay ID</label><input value="${escapeHtml(r.id)}" disabled></div>
    </div>
    <div class="field"><label>Address</label><input value="${escapeHtml(r.address)}" disabled></div>
    <div class="form-grid-2">
      <div class="field"><label>Contact Number</label>${phoneField('acc-contact', r.contact)}</div>
      <div class="field"><label>Email</label><input id="acc-email" value="${escapeHtml(r.email)}" type="email" maxlength="150"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>New Password</label>${passwordField('acc-password','Leave blank to keep current',{rules:true,autocomplete:'new-password'})}</div>
      <div class="field"><label>Confirm New Password</label>${passwordField('acc-confirm','Confirm new password',{autocomplete:'new-password'})}</div>
    </div>
    <div class="field" style="margin-top:-6px">${pwRulesHtml('acc-password')}</div>
    <div class="action-row"><button class="abtn ready" data-submit onclick="saveResidentAccount()">${icon('floppy-disk')} Save Changes</button></div>
  </div>
  <div class="panel">
    <div class="panel-head"><h3 style="color:#B91C1C">Delete My Account</h3></div>
    <p style="font-size:13.5px;color:var(--slate);line-height:1.6;margin-bottom:14px">Permanently remove your resident account and your past request records. You can only do this when none of your requests are still in progress. This cannot be undone.</p>
    <button class="btn-sm danger" onclick="deleteMyAccount()">${icon('trash')} Delete My Account</button>
  </div>`;
}
