/* ============================================================
   PUBLIC.JS
   ------------------------------------------------------------
   Builds the pages anyone can see WITHOUT logging in:
   - The public landing page (pubNav, viewLanding)
   - The "choose Resident or Admin" screen
   - The Resident Login / Register forms
   - The Admin Login form

   The landing page design is unchanged. The three forms now have:
   - an error box that does not erase what was typed
   - Enter key = submit (data-form / data-submit)
   - password boxes with a show / hide eye
   - registration: house no./street with a FIXED barangay (San Isidro),
     a +63 phone box, birthday limits (13+), live password rules
   ============================================================ */

function scrollPublicSection(id){
  const el = document.getElementById(id);
  if(!el) return;
  const nav = document.querySelector('.pubnav');
  const offset = (nav ? nav.offsetHeight : 70) + 18;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({top:Math.max(0, top), behavior:'smooth'});
}

function pubNav(){
  return `<div class="pubnav">
    <div class="brand">${logoMark(28)} e-Kagawad System</div>
    <div class="pubnav-links">
      <a onclick="nav('landing')">Home</a>
      <a onclick="scrollPublicSection('services')">Services</a>
      <a onclick="scrollPublicSection('about')">About Us</a>
      <a onclick="scrollPublicSection('faqs')">FAQs</a>
      <a onclick="scrollPublicSection('contact')">Contact</a>
      <button class="btn btn-primary" onclick="nav('loginChoice')">${icon('right-to-bracket')} Login / Register</button>
    </div>
  </div>`;
}

function viewLanding(){
  return `${pubNav()}
  <div class="hero">${heroBuildingArt()}<div class="hero-inner"><div class="hero-single">
    <div>
      <div class="hero-eyebrow">Barangay Document Services</div>
      <h1>Request barangay documents<br><span>without the waiting line.</span></h1>
      <p>Submit your request online, track every status update in real time, and pick up your document only when it's actually ready.</p>
      <div class="hero-actions">
        <button class="btn btn-white" onclick="nav('loginChoice')">Request a Document ${icon('arrow-right')}</button>
        <button class="btn btn-ghost" onclick="scrollPublicSection('services')">View Services</button>
      </div>
    </div>
  </div></div></div>

  <div class="section" id="services">
    <div class="section-head"><div class="eyebrow">Services</div><h2>Documents you can request</h2><p>Every document lists what it's for and what you'll need. Click one to see full details.</p></div>
    <div class="cards-grid">
      ${documentsData.map((d,i)=>`
        <div class="svc-card" onclick="nav('loginChoice')">
          <div class="svc-icon">${icon(d.icon||'file-lines')}</div>
          <h4>${d.name}</h4><p>${d.desc}</p>
          <span class="svc-link">Request now <span class="arrow">${icon('arrow-right')}</span></span>
        </div>`).join('')}
    </div>
  </div>

  <div class="section" id="about">
    <div class="section-head"><div class="eyebrow">About Us</div><h2>Serving our community</h2><p>Barangay San Isidro is committed to providing accessible, responsive, and community-centered public services.</p></div>

    <div class="mission-vision-grid">
      <div class="mission-vision-card">
        <div class="mv-icon">${icon('bullseye')}</div>
        <div>
          <div class="mv-label">Our Mission</div>
          <h3>Serving with integrity and care</h3>
          <p>To provide efficient, transparent, and accessible barangay services while responding to the needs of every resident with fairness, respect, and accountability.</p>
        </div>
      </div>
      <div class="mission-vision-card">
        <div class="mv-icon">${icon('eye')}</div>
        <div>
          <div class="mv-label">Our Vision</div>
          <h3>A connected and progressive community</h3>
          <p>To build a safe, inclusive, and progressive barangay where residents can access reliable public services and actively participate in the development of the community.</p>
        </div>
      </div>
      <div class="mission-vision-card">
        <div class="mv-icon">${icon('list-check')}</div>
        <div>
          <div class="mv-label">Our Goals</div>
          <h3>Improving service for every resident</h3>
          <ul class="mv-list">
            <li>Make barangay services easier and more accessible.</li>
            <li>Provide timely and responsive assistance to residents.</li>
            <li>Promote transparency and accountability in public service.</li>
            <li>Encourage community participation and cooperation.</li>
          </ul>
        </div>
      </div>
      <div class="mission-vision-card">
        <div class="mv-icon">${icon('heart')}</div>
        <div>
          <div class="mv-label">Our Values</div>
          <h3>What guides our service</h3>
          <div class="mv-values">
            <span>Integrity</span>
            <span>Respect</span>
            <span>Accountability</span>
            <span>Service</span>
            <span>Community</span>
            <span>Transparency</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section-subhead"><div class="eyebrow">Gallery</div><h2>Around the barangay</h2><p>A quick look at the hall, our facilities, and the community we serve. Click any photo to view it larger.</p></div>
    <div class="gallery-strip">
      <div class="g-tile" onclick="openMedia('assets/hall.jpg','Barangay Hall')">
        <img src="https://placehold.co/500x400/2452C4/FFFFFF?text=Barangay+Hall" alt="Barangay Hall" loading="lazy">
        <div class="g-caption">${icon('building-columns')} Barangay Hall</div>
      </div>
      <div class="g-tile" onclick="openMedia('assets/events.jpeg','Community Events')">
        <img src="https://placehold.co/500x400/3E8EF7/FFFFFF?text=Community+Events" alt="Community Events" loading="lazy">
        <div class="g-caption">${icon('users')} Community Events</div>
      </div>
      <div class="g-tile" onclick="openMedia('assets/facilities.jpg','Facilities')">
        <img src="https://placehold.co/500x400/17A2B8/FFFFFF?text=Facilities" alt="Facilities" loading="lazy">
        <div class="g-caption">${icon('home')} Facilities</div>
      </div>
      <div class="g-tile" onclick="openMedia('https://placehold.co/900x600/0B1E3D/FFFFFF?text=Barangay+Officials','Barangay Officials')">
        <img src="https://placehold.co/500x400/0B1E3D/FFFFFF?text=Barangay+Officials" alt="Barangay Officials — replace this placeholder image" loading="lazy">
        <div class="g-caption">${icon('user-shield')} Barangay Officials</div>
      </div>
    </div>
  </div>

  <div class="section" id="faqs">
    <div class="section-head"><div class="eyebrow">FAQs</div><h2>Common questions</h2></div>
    <div class="faq-list">
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="q">How do I request a document? <span class="plus">+</span></div><div class="a">Register for an account, log in, choose a document, and fill out the request form.</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="q">How will I know my request status? <span class="plus">+</span></div><div class="a">You'll get a notification every time your request status changes, and you can check it anytime under My Requests.</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="q">How do I claim my document? <span class="plus">+</span></div><div class="a">Once your request is Ready for Pickup, visit the barangay office with a valid ID.</div></div>
    </div>
  </div>

  <div class="section" id="contact">
    <div class="section-head"><div class="eyebrow">Contact Us</div><h2>Get in touch with the barangay office</h2><p>Have questions about your request? Reach out through any of these channels.</p></div>
    <div class="contact-grid">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="contact-card"><div class="contact-ic">${icon('location-dot')}</div><div><h4>Office Address</h4><p>Barangay San Isidro Hall, National Road, San Isidro, Cabuyao, Laguna</p></div></div>
        <div class="contact-card"><div class="contact-ic">${icon('phone')}</div><div><h4>Contact Number</h4><p>(049) 123-4567 · 0917 000 1234</p></div></div>
        <div class="contact-card"><div class="contact-ic">${icon('envelope')}</div><div><h4>Email</h4><p>info@ekagawad-sanisidro.gov.ph</p></div></div>
      </div>
      <div class="contact-panel">
        <h4>Office Hours</h4>
        <div class="row"><span>Monday - Friday</span><span>8:00 AM - 5:00 PM</span></div>
        <div class="row"><span>Saturday</span><span>8:00 AM - 12:00 PM</span></div>
        <div class="row"><span>Sunday &amp; Holidays</span><span>Closed</span></div>
        <div class="row"><span>Document Release</span><span>1:00 PM - 4:30 PM</span></div>
        <div class="action-row" style="margin-top:18px"><button class="btn btn-white" onclick="nav('loginChoice')">Request a Document ${icon('arrow-right')}</button></div>
      </div>
    </div>
  </div>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="brand" style="color:#fff">${logoMark(30)} e-Kagawad</div>
          <p>Automated Document Request and Tracking System for Barangay San Isidro, Cabuyao, Laguna.</p>
        </div>
        <div class="footer-col">
          <h5>Quick Links</h5>
          <a onclick="nav('landing')">Home</a>
          <a onclick="scrollPublicSection('services')">Services</a>
          <a onclick="scrollPublicSection('faqs')">FAQs</a>
          <a onclick="scrollPublicSection('contact')">Contact</a>
        </div>
        <div class="footer-col">
          <h5>Get Started</h5>
          <a onclick="nav('residentLogin')">Resident Login</a>
          <a onclick="goToResidentRegister()">Create an Account</a>
          <a onclick="nav('adminLogin')">Admin / Staff Login</a>
        </div>
        <div class="footer-col">
          <h5>Contact</h5>
          <span>${icon('location-dot')} San Isidro, Cabuyao, Laguna</span>
          <span>${icon('phone')} (049) 123-4567</span>
          <span>${icon('envelope')} info@ekagawad-sanisidro.gov.ph</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Barangay San Isidro · e-Kagawad. All rights reserved.</span>
        <span>Built for faster, transparent barangay service.</span>
      </div>
    </div>
  </footer>
  ${toastHtml()}`;
}

function viewLoginChoice(){
  return `<div class="choice-wrap">${authDecor()}
    <div class="choice-card fadein">
      <span class="back-link" onclick="nav('landing')">${icon('arrow-left')} Back to site</span>
      <div class="choice-icon choice-icon-logo">${logoMark(40)}</div>
      <h2>Welcome to e-Kagawad</h2>
      <div class="sub">Choose how you'd like to continue</div>
      <div class="role-row">
        <div class="role-card" onclick="nav('residentLogin')">
          <div class="ric">${icon('user')}</div>
          <h4>Resident</h4>
          <p>Request &amp; track your barangay documents</p>
          <span class="role-arrow">Continue ${icon('arrow-right')}</span>
        </div>
        <div class="role-card" onclick="nav('adminLogin')">
          <div class="ric">${icon('user-shield')}</div>
          <h4>Admin / Staff</h4>
          <p>Process &amp; manage resident requests</p>
          <span class="role-arrow">Continue ${icon('arrow-right')}</span>
        </div>
      </div>
      <div class="choice-trust">
        <div class="trust-item">${icon('circle-check')} Real-time tracking</div>
        <div class="trust-item">${icon('circle-check')} Instant notifications</div>
        <div class="trust-item">${icon('circle-check')} Secure &amp; verified</div>
      </div>
    </div>
  </div>${toastHtml()}`;
}

/* the error box used by every form. Showing a message here never redraws the page,
   so nothing the person typed is lost. */
function formErrorBox(msg){
  return `<div class="err-msg" id="form-error" ${msg?'':'hidden'}>${escapeHtml(msg||'')}</div>`;
}

function viewResidentLogin(){
  return `<div class="choice-wrap">${authDecor()}
    <div class="choice-card form-mode fadein" data-form>
      <span class="back-link" onclick="nav('loginChoice')">${icon('arrow-left')} Back</span>
      <div class="choice-icon" style="margin:6px 0 22px">${icon('user', ' style="color:#fff;font-size:22px"')}</div>
      <h2>Resident Login</h2><div class="sub">Enter your Barangay ID and password</div>
      ${formErrorBox(state.loginErr)}
      <div class="field"><label>Barangay ID Number</label><div class="input-wrap">${icon('id-card')}<input id="rl-id" type="text" maxlength="20" autocomplete="username" placeholder="e.g. 2026-00145"></div></div>
      <div class="field"><label>Password</label>${passwordField('rl-pass','Enter your password',{lead:true,max:128,autocomplete:'current-password'})}</div>
      <button class="btn btn-primary" data-submit style="width:100%;justify-content:center;padding:15px;font-size:14.5px" onclick="submitResidentLogin()">${icon('right-to-bracket')} Log In</button>
      <div class="auth-foot">Don't have an account? <a onclick="goToResidentRegister()">Register here</a></div>
    </div>
  </div>${toastHtml()}`;
}

function viewResidentRegister(){
  const dob = birthDateBounds();
  return `<div class="choice-wrap">${authDecor()}
    <div class="choice-card form-mode fadein" style="max-width:600px" data-form>
      <span class="back-link" onclick="nav('loginChoice')">${icon('arrow-left')} Back</span>
      <div class="choice-icon" style="margin:6px 0 22px">${icon('user-plus', ' style="color:#fff;font-size:22px"')}</div>
      <h2>Resident Registration</h2><div class="sub">Create your account to request documents online</div>
      ${formErrorBox(state.loginErr)}
      <div class="field"><label>Your Barangay ID Number <span style="font-weight:400;color:var(--slate)">(auto-generated, assigned on submit)</span></label><input value="${escapeHtml(state.nextResidentId||'...')}" disabled class="mono"></div>
      ${nameFields('rr')}
      <div class="form-grid-2">
        <div class="field"><label>Date of Birth <span style="font-weight:400;color:var(--slate)">(13 years old or above)</span></label><input id="rr-dob" type="date" min="${dob.min}" max="${dob.max}"></div>
        <div class="field"><label>Contact Number</label>${phoneField('rr-contact','')}</div>
      </div>
      ${addressFields('rr','')}
      <div class="field"><label>Email</label><input id="rr-email" type="email" maxlength="150" autocomplete="email" placeholder="e.g. juan@email.com"></div>
      <div class="form-grid-2">
        <div class="field"><label>Password</label>${passwordField('rr-pass','Create a strong password',{rules:true,autocomplete:'new-password'})}</div>
        <div class="field"><label>Confirm Password</label>${passwordField('rr-confirm','Re-enter your password',{autocomplete:'new-password'})}</div>
      </div>
      <div class="field" style="margin-top:-6px">${pwRulesHtml('rr-pass')}</div>
      <button class="btn btn-primary" data-submit style="width:100%;justify-content:center;padding:15px;font-size:14.5px" onclick="submitResidentRegister()">${icon('user-plus')} Register</button>
      <div class="auth-foot">Already have an account? <a onclick="nav('residentLogin')">Log in</a></div>
    </div>
  </div>${toastHtml()}`;
}

function viewAdminLogin(){
  return `<div class="choice-wrap">${authDecor()}
    <div class="choice-card form-mode fadein" data-form>
      <span class="back-link" onclick="nav('loginChoice')">${icon('arrow-left')} Back</span>
      <div class="choice-icon" style="margin:6px 0 22px">${icon('user-shield', ' style="color:#fff;font-size:22px"')}</div>
      <h2>Admin / Staff Login</h2><div class="sub">Authorized barangay personnel only</div>
      ${formErrorBox(state.loginErr)}
      <div class="field"><label>Login As</label>
        <select id="al-type" onchange="onAdminTypeChange(this.value)">
          <option value="admin">Administrator</option>
          <option value="moderator">Moderator (Staff)</option>
        </select>
      </div>
      <div class="field"><label id="al-id-label">Administrator ID</label><div class="input-wrap">${icon('id-card')}<input id="al-id" maxlength="20" autocomplete="username" placeholder="e.g. ADM-001"></div></div>
      <div class="field"><label>Password</label>${passwordField('al-pass','Enter your password',{lead:true,max:128,autocomplete:'current-password'})}</div>
      <button class="btn btn-primary" data-submit style="width:100%;justify-content:center;padding:15px;font-size:14.5px" onclick="submitAdminLogin()">${icon('right-to-bracket')} Log In</button>
    </div>
  </div>${toastHtml()}`;
}

/* the "Login as" dropdown changes the ID label and the example ID */
function onAdminTypeChange(type){
  const isMod = type === 'moderator';
  const id = document.getElementById('al-id');
  const label = document.getElementById('al-id-label');
  if(id) id.placeholder = isMod ? 'e.g. MOD-001' : 'e.g. ADM-001';
  if(label) label.textContent = isMod ? 'Moderator ID' : 'Administrator ID';
  clearFormError();
}
