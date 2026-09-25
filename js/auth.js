/* ============================================================
   AUTH.JS
   ------------------------------------------------------------
   Real authentication now. Passwords are sent to the server
   over POST and hashed there with PHP's password_hash()
   (bcrypt) — see api/auth.php. Nothing about a password is
   ever computed or stored on the client.

   NEW in v3:
   - Resident registration sends First / Middle / Last / Suffix
     (see js/names.js) instead of one "Full Name".
   - Admin login sends the "Login as" choice (admin | moderator).
   ============================================================ */

async function submitResidentLogin(){
  return once('residentLogin', async ()=>{
    const idVal = document.getElementById('rl-id').value.trim();
    const pass = document.getElementById('rl-pass').value;
    clearFormError();
    if(!idVal || !pass){ showFormError('Please enter your Barangay ID and password.'); return; }
    try{
      const res = await api.post('auth.php?action=residentLogin', { id: idVal, password: pass });
      state.currentResident = res.user;
      state.currentAdmin = null;
      state.screen = 'resident';
      state.loginErr = '';
      await navResident('dashboard');
    }catch(e){
      showFormError(e.message);
    }
  });
}

async function submitResidentRegister(){
  return once('residentRegister', async ()=>{
    const n = readNameFields('rr');
    const dob = document.getElementById('rr-dob').value.trim();
    const street = stripBarangay(cleanText(document.getElementById('rr-street').value));
    const contactRaw = document.getElementById('rr-contact').value.trim();
    const email = document.getElementById('rr-email').value.trim().toLowerCase();
    const pass = document.getElementById('rr-pass').value;
    const confirm = document.getElementById('rr-confirm').value;
    clearFormError();

    const nameErr = nameFieldsError(n);
    if(nameErr){ showFormError(nameErr); return; }
    if(!dob||!street||!contactRaw||!email||!pass||!confirm){ showFormError('Please fill out all required fields.'); return; }
    const err = birthDateError(dob) || streetError(street) || contactError(contactRaw) || emailError(email) || passwordError(pass);
    if(err){ showFormError(err); return; }
    if(pass!==confirm){ showFormError('Passwords do not match.'); return; }

    try{
      const res = await api.post('auth.php?action=residentRegister', {
        firstName: n.firstName, middleName: n.middleName, lastName: n.lastName, suffix: n.suffix,
        dob, street, contact: normalizeContact(contactRaw), email, password: pass, confirm
      });
      state.currentResident = res.user;
      state.currentAdmin = null;
      state.screen = 'resident';
      state.loginErr = '';
      await navResident('dashboard');
      toast(`Welcome, ${n.firstName}!`);
      await showAlert({
        title:'Registration Successful',
        message:'Please keep your Barangay ID number — you will need it every time you log in.',
        details:[{label:'Your Barangay ID', value:res.user.id, mono:true}],
        confirmText:'Got it'
      });
    }catch(e){
      showFormError(e.message);
    }
  });
}

async function submitAdminLogin(){
  return once('adminLogin', async ()=>{
    const type = document.getElementById('al-type').value; // 'admin' | 'moderator'
    const idVal = document.getElementById('al-id').value.trim();
    const pass = document.getElementById('al-pass').value;
    clearFormError();
    if(!idVal || !pass){ showFormError(`Please enter your ${type==='moderator'?'Moderator':'Administrator'} ID and password.`); return; }
    try{
      const res = await api.post('auth.php?action=adminLogin', { id: idVal, password: pass, type });
      state.currentAdmin = res.user;
      state.currentResident = null;
      state.screen = 'admin';
      state.loginErr = '';
      await navAdmin('dashboard');
    }catch(e){
      showFormError(e.message);
    }
  });
}

/* clears everything about the logged-in person and shows the landing page */
function resetToLanding(){
  state.currentResident=null; state.currentAdmin=null;
  state.screen='landing'; state.residentPage='dashboard'; state.adminPage='dashboard';
  state.activeResidentId=null; state.activeRequestId=null; state.activeDocId=null;
  state.staffModal=null;
  state.cache.unreadCount = 0;
  recordHistory();
  render();
}

async function logout(){
  const ok = await showConfirm({
    icon:'right-from-bracket', tone:'primary',
    title:'Log out?',
    message:'Are you sure you want to log out of your account?',
    confirmText:'Log Out', cancelText:'Stay Logged In'
  });
  if(!ok) return;
  try{ await api.post('auth.php?action=logout', {}); }catch(e){ /* proceed to clear client state regardless */ }
  resetToLanding();
  toast('You have been logged out.');
}

/* ---------------------------------------------------------
   On first page load, ask the server if a session already
   exists (e.g. the user refreshed the page) and restore it.
   If the browser still remembers which page they were on,
   they are put back on that same page.
--------------------------------------------------------- */
async function restoreSession(){
  try{
    const res = await api.get('auth.php?action=session');
    const hs = history.state;
    if(res.role === 'resident'){
      state.currentResident = res.user;
      if(hs && hs.screen==='resident'){ await applyHistoryState(hs); }
      else { await navResident('dashboard'); }
      return;
    }
    if(res.role === 'admin'){
      state.currentAdmin = res.user;
      if(hs && hs.screen==='admin'){ await applyHistoryState(hs); }
      else { await navAdmin('dashboard'); }
      return;
    }
  }catch(e){ /* no session / server not reachable yet — stay on landing */ }
  history.replaceState(historySnapshot(), '');
  render();
}
