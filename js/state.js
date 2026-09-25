/* ============================================================
   STATE.JS
   ------------------------------------------------------------
   Same job as before: remembers "what screen are we on right
   now" and holds small shared helper functions used everywhere
   else (badges, status colors, empty-state messages, charts).

   state.cache holds whatever the CURRENT page fetched from the
   database through the PHP API (api/*.php). Nothing here is
   sample data — it is whatever is really in MySQL at the moment
   the page loaded.

   NEW in this version:
   - one shared set of input validators (name, street, contact,
     birthday 13+, email, password rules, reasons ...)
   - reusable form pieces (+63 phone box, house no./street with a
     fixed Barangay, password box with the show/hide eye)
   - browser Back/Forward support (History API)
   - the profile chip in the top bar (hover = details, click = account)
   - notification actions (open details, mark all, delete all)
   - Enter key submits forms
   ============================================================ */

let state = {
  screen:'landing', residentPage:'dashboard', adminPage:'dashboard',
  currentResident:null, currentAdmin:null,
  activeDocId:null, activeRequestId:null,
  editMode:false, requestErr:'', loginErr:'',
  requestTab:'All', requestDocFilter:'All', residentSearch:'',
  activeResidentId:null, reportFrom:'', reportTo:'', reportStatus:'All', reportDocFilter:'All',
  cancelRequestId:null, rejectRequestId:null,
  cancelRequestId:null, rejectRequestId:null, appealRequestId:null,
  claimStubId:null, 
  toast:null, mediaModal:null, pdfPreviewId:null,
  loading:false,
  nextResidentId:'',
  cache:{
    myStats:null, myRequests:null, activeRequest:null,
    residents:null, activeResident:null,
    adminRequests:null, adminStats:null,
    notifications:null, unreadCount:0,
    reportData:null,
  }
};

/* ================= HELPERS ================= */

/* The little profile circle in the top bar.
   Hover (or keyboard focus) = small card with the account name and number.
   Click = opens the Account page. */
function topbarRight(who){
  const count = state.cache.unreadCount || 0;
  const isRes = who==='resident';
  const navFn = isRes ? "navResident('notifications')" : "navAdmin('notifications')";
  const accFn = isRes ? "navResident('account')" : "navAdmin('account')";
  const u = (isRes ? state.currentResident : state.currentAdmin) || {};
  const idLabel = isRes ? 'Barangay ID' : 'Admin/Staff ID';
  return `<div style="display:flex;align-items:center;gap:12px">
    <div class="notif-bell" onclick="${navFn}" title="Notifications">
      ${icon('bell')}${count>0?`<span class="badge-count">${count>9?'9+':count}</span>`:''}
    </div>
    <div class="profile-chip" tabindex="0" role="button" aria-label="Open my account" onclick="${accFn}" onkeydown="if(event.target===this&&event.key==='Enter'){${accFn}}">
      <div class="avatar">${icon('user')}</div>
      <div class="profile-pop">
        <div class="pp-name">${escapeHtml(u.name||'')}</div>
        ${!isRes && u.role ? `<div class="pp-role">${escapeHtml(u.role)}</div>` : ''}
        <div class="pp-row"><span>${idLabel}</span><b class="mono">${escapeHtml(u.id||'')}</b></div>
      </div>
    </div>
  </div>`;
}

function statusClass(s){
  return {'Pending':'pending','On Hold':'hold','Approved':'approved','Ready for Pickup':'ready','Completed':'completed','Rejected':'rejected','Cancelled':'cancelled'}[s]||'pending';
}

function badge(s){ return `<span class="badge ${statusClass(s)}">${escapeHtml(s)}</span>`; }

function lineChartSVG(items){
  const W=560, H=190, padL=18, padR=18, padT=18, padB=34;
  const plotW = W-padL-padR, plotH = H-padT-padB;
  const maxV = Math.max(...items.map(i=>i.value), 1);
  const n = items.length;
  if(n===0) return `<div class="empty-state">No chart data for the selected filters.</div>`;
  const xStep = n>1 ? plotW/(n-1) : 0;
  const pts = items.map((it,i)=>({
    x: padL + (n>1 ? i*xStep : plotW/2),
    y: padT + plotH - (it.value/maxV)*plotH,
    label: it.label, value: it.value
  }));
  const gridLines = [0,1,2,3].map(i=>{
    const y = padT + (plotH/3)*i;
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
  }).join('');
  const polyPoints = pts.map(p=>`${p.x},${p.y}`).join(' ');
  const areaPoints = `${pts[0].x},${padT+plotH} ` + polyPoints + ` ${pts[pts.length-1].x},${padT+plotH}`;
  const dots = pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#fff" stroke="var(--blue-mid)" stroke-width="2.5"/>`).join('');
  const valueLabels = pts.map(p=>`<text x="${p.x}" y="${p.y-12}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--navy)" font-family="Plus Jakarta Sans, sans-serif">${p.value}</text>`).join('');
  const axisLabels = pts.map(p=>`<text x="${p.x}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--slate)" font-family="Inter, sans-serif">${p.label}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="line-chart-svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--blue-bright)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--blue-bright)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <polygon points="${areaPoints}" fill="url(#lineAreaGrad)"/>
    <polyline points="${polyPoints}" fill="none" stroke="var(--blue-mid)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${valueLabels}
    ${axisLabels}
  </svg>`;
}

function emptyState(iconName, title, subtitle, actionHtml){
  return `<div class="empty-state-rich">
    <div class="es-icon">${icon(iconName)}</div>
    <h4>${title}</h4>
    ${subtitle?`<p>${subtitle}</p>`:''}
    ${actionHtml||''}
  </div>`;
}

function loadingPanel(){
  return `<div class="panel"><div class="empty-state">Loading...</div></div>`;
}

/* Toast is added straight to the page (not through render()), so showing a
   message never wipes what the person has typed into a form. */
function toast(msg){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role','status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2600);
}

function esc(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

/* Ignore a second click/Enter while the first one is still being processed. */
const _busy = {};
async function once(key, fn){
  if(_busy[key]) return;
  _busy[key] = true;
  try{ return await fn(); }
  finally{ _busy[key] = false; }
}

/* ---------- inline form error box ----------
   Every form has <div class="err-msg" id="form-error" hidden></div>.
   Showing an error here does NOT re-draw the page, so nothing the
   person typed is lost. */
function showFormError(msg){
  const el = document.getElementById('form-error');
  if(!el){ toast(msg); return; }
  el.textContent = msg;
  el.hidden = false;
  el.scrollIntoView({behavior:'smooth', block:'center'});
}

function clearFormError(){
  const el = document.getElementById('form-error');
  if(el){ el.hidden = true; el.textContent = ''; }
}

/* ================= VALIDATION (the server always re-checks everything) ================= */

const NAME_MSG = 'Please enter a valid full name (letters, spaces, periods, hyphens and apostrophes only, 2–100 characters).';
const STREET_MSG = "Please enter a valid house number / street (5–100 characters; letters, numbers, spaces and . , # - / ' only).";
const CONTACT_MSG = 'Please enter a valid Philippine mobile number (+63 9XX XXX XXXX).';
const PASSWORD_MSG = 'Password must be 8–64 characters and include an uppercase letter, a lowercase letter, a number and a special character, with no spaces.';

function cleanText(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }

function nameError(name){
  const letters = (name.match(/\p{L}/gu) || []).length;
  if(name.length<2 || name.length>100 || !/^\p{L}[\p{L}\p{M}\s.'-]*$/u.test(name) || letters<2) return NAME_MSG;
  return '';
}

/* removes a "Barangay San Isidro, Cabuyao, Laguna" ending so it is never stored twice */
function stripBarangay(address){
  return String(address||'').replace(/,\s*Barangay San Isidro(,\s*Cabuyao)?(,\s*Laguna)?\s*$/i,'').replace(/^[\s,]+|[\s,]+$/g,'');
}

function streetError(street){
  if(street.length<5 || street.length>100 || !/^[\p{L}\p{M}\p{N}\s.,#\-\/']+$/u.test(street) || !/\p{L}/u.test(street)) return STREET_MSG;
  return '';
}

/* +63 phone numbers. Accepts 9XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX.
   Returns the canonical "+639XXXXXXXXX" or null. */
function normalizeContact(value){
  const d = String(value||'').replace(/\D/g,'');
  let m;
  if((m = d.match(/^63(9\d{9})$/))) return '+63'+m[1];
  if((m = d.match(/^0(9\d{9})$/))) return '+63'+m[1];
  if((m = d.match(/^(9\d{9})$/))) return '+63'+m[1];
  return null;
}

/* the 10 digits shown after the fixed "+63" in the phone box */
function contactLocal(value){
  const n = normalizeContact(value);
  return n ? n.slice(3) : String(value||'').replace(/\D/g,'');
}

function contactError(value){ return normalizeContact(value) ? '' : CONTACT_MSG; }

function emailError(email){
  if(email.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Please enter a valid email address.';
  return '';
}

const PW_RULES = [
  ['len',     '8–64 characters',                       p => p.length>=8 && p.length<=64],
  ['upper',   'One uppercase letter (A–Z)',            p => /[A-Z]/.test(p)],
  ['lower',   'One lowercase letter (a–z)',            p => /[a-z]/.test(p)],
  ['num',     'One number (0–9)',                      p => /\d/.test(p)],
  ['special', 'One special character (! @ # $ % ...)', p => /[^A-Za-z0-9\s]/.test(p)],
  ['space',   'No spaces',                             p => !/\s/.test(p)],
];
function isValidPassword(p){ return PW_RULES.every(r=>r[2](p)); }
function passwordError(p){ return isValidPassword(p) ? '' : PASSWORD_MSG; }

function pad2(n){ return String(n).padStart(2,'0'); }
function isoDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

/* min / max for the date-of-birth box: 13 to 120 years old */
function birthDateBounds(){
  const t = new Date();
  return { min: isoDate(new Date(t.getFullYear()-120, t.getMonth(), t.getDate())), max: isoDate(new Date(t.getFullYear()-13, t.getMonth(), t.getDate())) };
}

function birthDateError(value){
  if(!value) return 'Please enter your date of birth.';
  const d = new Date(value+'T00:00:00');
  if(Number.isNaN(d.getTime())) return 'Please enter a valid date of birth.';
  const today = new Date(); today.setHours(0,0,0,0);
  if(d>today) return 'Date of birth cannot be in the future.';
  let age = today.getFullYear()-d.getFullYear();
  const m = today.getMonth()-d.getMonth();
  if(m<0 || (m===0 && today.getDate()<d.getDate())) age--;
  if(age<13) return 'You must be at least 13 years old.';
  if(age>120) return 'Please enter a valid date of birth.';
  return '';
}

/* preferred release date: optional, from today up to one year ahead */
function releaseDateBounds(){
  const t = new Date();
  return { min: isoDate(t), max: isoDate(new Date(t.getFullYear()+1, t.getMonth(), t.getDate())) };
}

function releaseDateError(value){
  if(!value) return '';
  const d = new Date(value+'T00:00:00');
  if(Number.isNaN(d.getTime())) return 'Please enter a valid preferred release date.';
  const b = releaseDateBounds();
  if(value < b.min) return 'Preferred release date cannot be in the past.';
  if(value > b.max) return 'Preferred release date must be within one year from today.';
  return '';
}

function lengthError(text, label, min, max){
  if(text.length<min) return `${label} must be at least ${min} characters.`;
  if(text.length>max) return `${label} must not exceed ${max} characters.`;
  return '';
}

/* kept so older code that still calls these names keeps working */
function isValidEmail(email){ return !emailError(email); }
function isValidContact(contact){ return normalizeContact(contact)!==null; }
function isValidBirthDate(value){ return !birthDateError(value); }
function isValidFutureOrTodayDate(value){ return !releaseDateError(value); }

function friendlyError(code, fallback){
  const messages={
    required:'Please complete all required fields.',
    contact:CONTACT_MSG,
    date:'Please enter a valid date.',
    copies:'Number of copies must be a whole number from 1 to 20.',
    attachmentRequired:'A supporting document is required for this document type.',
    attachmentType:'Supporting document must be an image (JPG, PNG, GIF or WEBP) or a PDF file.',
    attachmentSize:'Supporting document must not be larger than 5 MB.',
    rejectionReason:'Please select a rejection reason.',
    cancellationReason:'Please provide a reason for cancelling the request.'
  };
  return messages[code] || fallback || 'Something went wrong. Please try again.';
}

/* ================= REUSABLE FORM PIECES ================= */

/* Phone box with a fixed +63 in front. The person only types the 10 digits (9XX XXX XXXX). */
function phoneField(id, value){
  return `<div class="phone-wrap"><span class="phone-prefix">+63</span><input id="${id}" type="tel" inputmode="numeric" maxlength="12" autocomplete="tel-national" placeholder="9XX XXX XXXX" value="${escapeHtml(contactLocal(value||''))}" oninput="this.value=this.value.replace(/\\D/g,'')"></div>`;
}

/* House number / street is typed; the Barangay (and city) are fixed and can't be edited. */
function addressFields(prefix, addressValue){
  return `<div class="field"><label>House No. / Street / Village / Subdivision</label><input id="${prefix}-street" maxlength="100" autocomplete="address-line1" placeholder="e.g. 123 Mabini Street, Purok 4" value="${escapeHtml(stripBarangay(addressValue||''))}"></div>
    <div class="form-grid-2">
      <div class="field"><label>Barangay</label><input value="San Isidro" disabled></div>
      <div class="field"><label>City / Province</label><input value="Cabuyao, Laguna" disabled></div>
    </div>`;
}

/* Password box with the show / hide eye button. */
function passwordField(id, placeholder, opts){
  opts = opts || {};
  return `<div class="input-wrap pw-wrap${opts.lead?'':' no-lead'}">${opts.lead?icon('lock'):''}<input id="${id}" type="password" placeholder="${escapeHtml(placeholder||'')}" maxlength="${opts.max||64}" autocomplete="${opts.autocomplete||'off'}"${opts.rules?` oninput="updatePwRules('${id}')"`:''}><button type="button" class="pw-toggle" aria-label="Show password" onclick="togglePw('${id}',this)">${icon('eye')}</button></div>`;
}

function togglePw(id, btn){
  const el = document.getElementById(id);
  if(!el) return;
  const show = el.type==='password';
  el.type = show ? 'text' : 'password';
  btn.innerHTML = icon(show ? 'eye-slash' : 'eye');
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  el.focus();
}

/* live checklist under a "new password" box */
function pwRulesHtml(inputId){
  return `<ul class="pw-rules" id="${inputId}-rules">${PW_RULES.map(([k,label])=>`<li data-rule="${k}">${label}</li>`).join('')}</ul>`;
}

function updatePwRules(inputId){
  const el = document.getElementById(inputId), list = document.getElementById(inputId+'-rules');
  if(!el || !list) return;
  const v = el.value;
  PW_RULES.forEach(([k,,test])=>{
    const li = list.querySelector(`[data-rule="${k}"]`);
    if(li) li.classList.toggle('ok', v.length>0 && test(v));
  });
}

/* ================= ENTER KEY = SUBMIT =================
   Any page/modal section marked data-form submits when Enter is pressed inside
   one of its text boxes. It just "clicks" the button marked data-submit. */
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  if(document.getElementById('dialog-overlay')) return; // dialogs handle Enter themselves
  const t = e.target;
  if(!t || t.tagName!=='INPUT') return;
  if(['button','submit','checkbox','radio','file','reset','range','color'].includes((t.type||'').toLowerCase())) return;
  const form = t.closest('[data-form]');
  if(!form) return;
  const btn = form.querySelector('[data-submit]');
  if(!btn || btn.disabled) return;
  e.preventDefault();
  btn.click();
});

/* ================= AUTH GUARD ================= */

function requireRole(role){
  if(role==='resident' && !state.currentResident){ nav('loginChoice'); toast('Please log in as a resident first.'); return false; }
  if(role==='admin' && !state.currentAdmin){ nav('loginChoice'); toast('Please log in as Admin/Staff first.'); return false; }
  return true;
}

/* ================= PAGE DATA LOADERS =================
   Each nav function fetches whatever the target page needs
   from the real database (via the PHP API) BEFORE switching
   the screen, so the UI never flashes an empty/loading page.
========================================================= */

async function loadResidentPageData(page, opts){
  opts = opts || {};
  if(page==='dashboard'){
    if(!documentsData.length) await loadDocumentTypes();
    const r = await api.get('requests.php?action=myStats');
    state.cache.myStats = r;
  } else if(page==='requestDocuments' || page==='docDetail' || page==='requestForm'){
    if(!documentsData.length) await loadDocumentTypes();
  } else if(page==='myRequests'){
    const r = await api.get('requests.php?action=myList');
    state.cache.myRequests = r.requests;
  } else if(page==='requestView'){
    if(!documentsData.length) await loadDocumentTypes();
    const id = opts.activeRequestId || state.activeRequestId;
    const r = await api.get(`requests.php?action=get&id=${encodeURIComponent(id)}`);
    state.cache.activeRequest = r.request;
  } else if(page==='notifications'){
    const r = await api.get('notifications.php?action=list');
    state.cache.notifications = r.notifications;
  }
  const u = await api.get('notifications.php?action=unreadCount');
  state.cache.unreadCount = u.count;
}

async function loadAdminPageData(page, opts){
  opts = opts || {};
  if(page==='dashboard'){
    const r = await api.get('requests.php?action=adminStats');
    state.cache.adminStats = r;
  } else if(page==='residents'){
    const q = encodeURIComponent(state.residentSearch||'');
    const r = await api.get(`residents.php?action=list&q=${q}`);
    state.cache.residents = r.residents;
  } else if(page==='editResident'){
    const id = opts.activeResidentId || state.activeResidentId;
    const r = await api.get(`residents.php?action=get&id=${encodeURIComponent(id)}`);
    state.cache.activeResident = r.resident;
  } else if(page==='documentRequests'){
    if(!documentsData.length) await loadDocumentTypes();
    const status = encodeURIComponent(state.requestTab||'All');
    const doc = encodeURIComponent(state.requestDocFilter||'All');
    const r = await api.get(`requests.php?action=adminList&status=${status}&doc=${doc}`);
    state.cache.adminRequests = r.requests;
  } else if(page==='reviewRequest'){
    const id = opts.activeRequestId || state.activeRequestId;
    const r = await api.get(`requests.php?action=get&id=${encodeURIComponent(id)}`);
    state.cache.activeRequest = r.request;
  } else if(page==='notifications'){
    const r = await api.get('notifications.php?action=list');
    state.cache.notifications = r.notifications;
  } else if(page==='reports'){
    if(!documentsData.length) await loadDocumentTypes();
    await refreshReportData();
  } else if(page==='staff'){
    // Administrator only — the server answers 403 for a Moderator
    const r = await api.get('staff.php?action=list');
    state.cache.staff = r.staff;
    state.staffModal = null;
  }
  const u = await api.get('notifications.php?action=unreadCount');
  state.cache.unreadCount = u.count;
}

async function refreshReportData(){
  const params = new URLSearchParams({
    from: state.reportFrom || '', to: state.reportTo || '',
    status: state.reportStatus || 'All', doc: state.reportDocFilter || 'All',
  });
  const r = await api.get(`reports.php?${params.toString()}`);
  state.cache.reportData = r;
}

/* ================= BROWSER BACK / FORWARD =================
   Every screen change adds an entry to the browser history, so the Back
   button walks back through the pages you visited inside the system
   instead of leaving the website. */

function historySnapshot(){
  const cur = history.state;
  return {
    idx: cur && typeof cur.idx==='number' ? cur.idx : 0,
    screen: state.screen, residentPage: state.residentPage, adminPage: state.adminPage,
    activeDocId: state.activeDocId, activeRequestId: state.activeRequestId, activeResidentId: state.activeResidentId,
    requestTab: state.requestTab, requestDocFilter: state.requestDocFilter,
  };
}

function historyKey(s){
  return [s.screen, s.screen==='resident'?s.residentPage:'', s.screen==='admin'?s.adminPage:'', s.activeDocId||'', s.activeRequestId||'', s.activeResidentId||''].join('|');
}

/* Called after every navigation. Re-visiting the SAME page (e.g. after saving
   something, or switching a tab filter) replaces the entry instead of piling up new ones. */
function recordHistory(){
  const snap = historySnapshot();
  const cur = history.state;
  if(cur && historyKey(cur)===historyKey(snap)){
    history.replaceState(snap, '');
    return;
  }
  snap.idx = (cur && typeof cur.idx==='number' ? cur.idx : 0) + 1;
  history.pushState(snap, '');
}

const AUTH_SCREENS = ['loginChoice','residentLogin','adminLogin','residentRegister'];

async function applyHistoryState(s){
  const role = state.currentResident ? 'resident' : (state.currentAdmin ? 'admin' : null);
  let screen = s.screen;
  if((screen==='resident' || screen==='admin') && screen!==role) screen = 'landing';
  if(role && AUTH_SCREENS.includes(screen)) screen = 'landing';

  state.mediaModal = null; state.pdfPreviewId = null; state.claimStubId = null;
  state.cancelRequestId = null; state.rejectRequestId = null;
  state.loginErr = ''; state.requestErr = ''; state.editMode = false;
  Object.assign(state, {
    activeDocId: s.activeDocId||null, activeRequestId: s.activeRequestId||null, activeResidentId: s.activeResidentId||null,
    requestTab: s.requestTab||'All', requestDocFilter: s.requestDocFilter||'All',
  });

  if(screen==='resident' || screen==='admin'){
    const key = screen==='resident' ? 'residentPage' : 'adminPage';
    const loader = screen==='resident' ? loadResidentPageData : loadAdminPageData;
    const page = s[key] || 'dashboard';
    try{
      await loader(page, s);
      state[key] = page;
    }catch(e){
      toast(e.message || 'Unable to load this page right now.');
      state[key] = 'dashboard';
      try{ await loader('dashboard', {}); }catch(_){ /* ignore */ }
    }
  }
  state.screen = screen;
  history.replaceState(Object.assign(historySnapshot(), {idx: typeof s.idx==='number' ? s.idx : 0}), '');
  render();
}

window.addEventListener('popstate', e=>{
  if(typeof dialogCancel==='function') dialogCancel();
  if(e.state) applyHistoryState(e.state);
});

/* make sure the very first page has a history entry of its own */
if(!history.state) history.replaceState(historySnapshot(), '');

/* ================= NAV ================= */

function nav(screen){
  if(AUTH_SCREENS.includes(screen) && (state.currentResident || state.currentAdmin)){
    return state.currentResident ? navResident('dashboard') : navAdmin('dashboard');
  }
  state.screen=screen; state.loginErr='';
  recordHistory();
  render();
}

async function goToResidentRegister(){
  if(state.currentResident || state.currentAdmin) return nav('residentRegister');
  state.loginErr='';
  state.nextResidentId = '...'; // shown briefly while we fetch the real preview
  state.screen = 'residentRegister';
  recordHistory();
  render();
  try{
    const res = await api.get('auth.php?action=nextResidentId');
    state.nextResidentId = res.nextId;
  }catch(e){
    state.nextResidentId = '';
  }
  render();
}

async function navResident(page, opts){
  if(!requireRole('resident')) return;
  const merged = opts || {};
  try{
    await loadResidentPageData(page, merged);
  }catch(e){ toast(e.message || 'Unable to load this page right now.'); return; }
  state.screen='resident';
  state.residentPage=page; state.editMode=false; state.requestErr='';
  Object.assign(state, merged);
  recordHistory();
  render();
}

async function navAdmin(page, opts){
  if(!requireRole('admin')) return;
  const merged = opts || {};
  try{
    await loadAdminPageData(page, merged);
  }catch(e){ toast(e.message || 'Unable to load this page right now.'); return; }
  state.screen='admin';
  state.adminPage=page; state.requestErr='';
  Object.assign(state, merged);
  recordHistory();
  render();
}

/* ================= DECORATIVE SVGs (unchanged) ================= */

function heroBuildingArt(){
  return `<svg class="hero-building-art" viewBox="0 0 1400 500" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="820,300 950,230 1080,300" opacity="0.5"/>
      <line x1="805" y1="300" x2="1095" y2="300" opacity="0.5"/>
      <line x1="805" y1="300" x2="805" y2="470" opacity="0.35"/>
      <line x1="1095" y1="300" x2="1095" y2="470" opacity="0.35"/>
      <line x1="830" y1="315" x2="830" y2="470" opacity="0.28"/>
      <line x1="875" y1="315" x2="875" y2="470" opacity="0.28"/>
      <line x1="920" y1="315" x2="920" y2="470" opacity="0.28"/>
      <line x1="965" y1="315" x2="965" y2="470" opacity="0.28"/>
      <line x1="1010" y1="315" x2="1010" y2="470" opacity="0.28"/>
      <line x1="1055" y1="315" x2="1055" y2="470" opacity="0.28"/>
      <rect x="925" y="390" width="50" height="80" opacity="0.4"/>
      <line x1="630" y1="350" x2="630" y2="470" opacity="0.22"/>
      <line x1="630" y1="350" x2="800" y2="350" opacity="0.22"/>
      <line x1="800" y1="350" x2="800" y2="470" opacity="0.22"/>
      <rect x="655" y="375" width="30" height="30" opacity="0.2"/>
      <rect x="710" y="375" width="30" height="30" opacity="0.2"/>
      <rect x="765" y="375" width="30" height="30" opacity="0.2"/>
      <line x1="1100" y1="260" x2="1100" y2="470" opacity="0.22"/>
      <line x1="1100" y1="260" x2="1220" y2="260" opacity="0.22"/>
      <line x1="1220" y1="260" x2="1220" y2="470" opacity="0.22"/>
      <rect x="1118" y="285" width="24" height="24" opacity="0.2"/>
      <rect x="1160" y="285" width="24" height="24" opacity="0.2"/>
      <rect x="1118" y="330" width="24" height="24" opacity="0.2"/>
      <rect x="1160" y="330" width="24" height="24" opacity="0.2"/>
      <rect x="1118" y="375" width="24" height="24" opacity="0.2"/>
      <rect x="1160" y="375" width="24" height="24" opacity="0.2"/>
      <line x1="950" y1="230" x2="950" y2="175" opacity="0.4"/>
      <path d="M950,180 L985,190 L950,200" opacity="0.4"/>
      <line x1="560" y1="470" x2="1280" y2="470" opacity="0.25"/>
    </g>
  </svg>`;
}

function authDecor(){
  return `
  <svg class="decor decor-1" width="280" height="280" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg"><circle cx="140" cy="140" r="128" stroke="rgba(255,255,255,0.16)" stroke-width="1.5" fill="none"/></svg>
  <svg class="decor decor-2" width="190" height="190" viewBox="0 0 190 190" xmlns="http://www.w3.org/2000/svg"><circle cx="95" cy="95" r="82" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" fill="none" stroke-dasharray="7 9"/></svg>
  <svg class="decor decor-3" width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg"><path d="M10 75 L140 75 M75 10 L75 140" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/></svg>
  <svg class="decor decor-4" width="110" height="110" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="18" width="74" height="74" rx="18" stroke="rgba(255,255,255,0.17)" stroke-width="1.4" fill="none" transform="rotate(18 55 55)"/></svg>
  <svg class="decor decor-5" width="70" height="70" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg"><circle cx="35" cy="35" r="30" stroke="rgba(255,255,255,0.2)" stroke-width="1.3" fill="none"/></svg>
  `;
}

/* toasts are now added directly by toast(); this stays so existing templates keep working */
function toastHtml(){ return ''; }

/* ================= NOTIFICATIONS =================
   Shared by the resident and admin notification pages. */

function notificationsPanelHtml(who){
  const rows = state.cache.notifications || [];
  if(!rows.length){
    const msg = who==='admin'
      ? ['No notifications','Activity across the system will show up here.']
      : ['You\'re all caught up','No notifications right now — updates about your requests will show up here.'];
    return `<div class="panel">${emptyState('bell', msg[0], msg[1])}</div>`;
  }
  const unread = rows.filter(n=>!n.read).length;
  return `<div class="panel">
    <div class="panel-head">
      <h3>${unread ? `${unread} unread` : 'All caught up'} <span class="notif-total">· ${rows.length} total</span></h3>
      <div class="notif-bulk">
        <button class="btn-sm outline" ${unread?'':'disabled'} onclick="markAllNotifRead('${who}')">${icon('list-check')} Mark all as read</button>
        <button class="btn-sm danger" onclick="deleteAllNotifs('${who}')">${icon('trash')} Delete all</button>
      </div>
    </div>
    ${rows.map(n=>`
      <div class="notif-item clickable ${n.read?'':'unread'}" tabindex="0" role="button" onclick="openNotification(${Number(n.id)},'${who}')" onkeydown="if(event.target===this&&event.key==='Enter'){openNotification(${Number(n.id)},'${who}')}">
        <div class="notif-main"><p>${escapeHtml(n.text)}</p><span class="notif-time">${escapeHtml(n.date||'')}${n.requestId?` · ${escapeHtml(n.requestId)}`:''}</span></div>
        <div class="acts">${!n.read?`<button class="btn-sm outline" onclick="event.stopPropagation();markNotifRead(${Number(n.id)},'${who}')">${icon('check')} Mark read</button>`:''}<button class="btn-sm danger" onclick="event.stopPropagation();deleteNotif(${Number(n.id)},'${who}')">${icon('trash')} Delete</button></div>
      </div>`).join('')}
  </div>`;
}

function findNotif(id){ return (state.cache.notifications||[]).find(x=>String(x.id)===String(id)); }

/* Clicking a notification opens its details. If it belongs to a request, the key
   request details are shown with a shortcut to open that request. */
async function openNotification(id, who){
  const n = findNotif(id);
  if(!n) return;

  const details = [];
  if(n.requestId){
    details.push({label:'Request Reference', value:n.requestId, mono:true});
    if(n.docType) details.push({label:'Document', value:n.docType});
    if(who==='admin' && n.residentName) details.push({label:'Resident', value:n.residentName});
    if(n.purpose) details.push({label:'Purpose', value:n.purpose});
    if(n.requestDate) details.push({label:'Date Requested', value:n.requestDate});
  }
  details.push({label:'Received', value:n.date||'—'});
  const canOpen = !!(n.requestId && n.docType);

  if(!n.read){
    n.read = true;
    state.cache.unreadCount = Math.max(0, (state.cache.unreadCount||0)-1);
    render(true);
    api.post('notifications.php?action=markRead', { id: Number(id) }).catch(()=>{});
  }

  const go = await openDialog({
    icon:'bell', tone:'primary', title:'Notification Details', message:n.text,
    html: n.requestStatus ? `<div class="dialog-status"><span>Current status</span>${badge(n.requestStatus)}</div>` : '',
    details,
    confirmText: canOpen ? 'View Request' : 'Close',
    confirmIcon: canOpen ? 'arrow-right' : null,
    cancelText: canOpen ? 'Close' : null,
  });
  if(go && canOpen){
    if(who==='resident') await navResident('requestView', {activeRequestId:n.requestId});
    else await navAdmin('reviewRequest', {activeRequestId:n.requestId});
  }
}

async function markNotifRead(id, who){
  try{
    await api.post('notifications.php?action=markRead', { id });
    const n = findNotif(id);
    if(n && !n.read){ n.read = true; state.cache.unreadCount = Math.max(0, (state.cache.unreadCount||0)-1); }
    render(true);
  }catch(e){ toast(e.message || 'Unable to update notification.'); }
}

async function deleteNotif(id, who){
  try{
    await api.post('notifications.php?action=delete', { id });
    const list = state.cache.notifications || [];
    const i = list.findIndex(x=>String(x.id)===String(id));
    if(i>=0){
      if(!list[i].read) state.cache.unreadCount = Math.max(0, (state.cache.unreadCount||0)-1);
      list.splice(i,1);
    }
    render(true);
  }catch(e){ toast(e.message || 'Unable to delete notification.'); }
}

async function markAllNotifRead(who){
  try{
    await api.post('notifications.php?action=markAllRead', {});
    (state.cache.notifications||[]).forEach(n=>{ n.read = true; });
    state.cache.unreadCount = 0;
    render(true);
    toast('All notifications marked as read.');
  }catch(e){ toast(e.message || 'Unable to update notifications.'); }
}

async function deleteAllNotifs(who){
  const total = (state.cache.notifications||[]).length;
  if(!total) return;
  const ok = await showConfirm({
    icon:'trash', tone:'danger', title:'Delete all notifications?',
    message:`All ${total} notification${total===1?'':'s'} will be permanently removed. This cannot be undone.`,
    confirmText:'Delete All', cancelText:'Keep Them'
  });
  if(!ok) return;
  try{
    await api.post('notifications.php?action=deleteAll', {});
    state.cache.notifications = [];
    state.cache.unreadCount = 0;
    render(true);
    toast('All notifications deleted.');
  }catch(e){ toast(e.message || 'Unable to delete notifications.'); }
}
