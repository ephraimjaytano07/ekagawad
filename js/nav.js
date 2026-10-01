/* ============================================================
   NAV.JS  (NEW FILE - loads after dialog.js, before state.js)
   ------------------------------------------------------------
   Lightweight, dependency-free logic for the hamburger menu.

   It drives TWO menus with the same code:
   - the public site's slide-out drawer (see pubNav in public.js)
   - the resident / admin portal sidebar, which becomes a
     slide-out drawer on tablet and mobile (see portalMobileBar below)

   Anything with  data-nav-drawer  is the drawer,
   data-nav-toggle  is a button that opens/closes it, and
   data-nav-backdrop is the dark overlay behind it.

   Accessibility handled here:
   - aria-expanded + aria-label on the toggle button stay in sync
   - Esc closes the drawer and focus returns to the toggle
   - Tab / Shift+Tab stay inside the open drawer (focus trap)
   - the page behind cannot scroll while the drawer is open
   - the drawer closes by itself if the window grows to desktop size
   ============================================================ */

(function(){
  const DESKTOP_QUERY = window.matchMedia('(min-width: 1025px)');
  const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastToggle = null;

  const drawer   = () => document.querySelector('[data-nav-drawer]');
  const backdrop = () => document.querySelector('[data-nav-backdrop]');
  const toggles  = () => Array.from(document.querySelectorAll('[data-nav-toggle]'));
  const isOpen   = () => { const d = drawer(); return !!d && d.classList.contains('is-open'); };

  function setToggleState(open){
    toggles().forEach(btn => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      btn.classList.toggle('is-open', open);
    });
  }

  function openNavDrawer(){
    const d = drawer(); if(!d || DESKTOP_QUERY.matches) return;
    lastToggle = document.activeElement;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    const b = backdrop(); if(b) b.classList.add('is-open');
    document.documentElement.classList.add('nav-open');
    setToggleState(true);
    document.addEventListener('keydown', onKeydown);
    // move focus into the drawer once it is visible
    const first = d.querySelector(FOCUSABLE);
    if(first) setTimeout(() => first.focus({preventScroll:true}), 30);
  }

  function closeNavDrawer(returnFocus){
    const d = drawer();
    document.removeEventListener('keydown', onKeydown);
    document.documentElement.classList.remove('nav-open');
    if(d){
      d.classList.remove('is-open');
      // the portal sidebar is a normal visible sidebar on desktop, so only hide it from
      // assistive tech while it is an off-screen drawer
      if(DESKTOP_QUERY.matches) d.removeAttribute('aria-hidden'); else d.setAttribute('aria-hidden', 'true');
    }
    const b = backdrop(); if(b) b.classList.remove('is-open');
    setToggleState(false);
    if(returnFocus !== false && lastToggle && document.contains(lastToggle) && typeof lastToggle.focus === 'function'){
      lastToggle.focus({preventScroll:true});
    }
    lastToggle = null;
  }

  function toggleNavDrawer(){ isOpen() ? closeNavDrawer() : openNavDrawer(); }

  // Called at the start of every render(): the whole screen is rebuilt, so start closed.
  function resetNavDrawer(){
    document.removeEventListener('keydown', onKeydown);
    document.documentElement.classList.remove('nav-open');
    lastToggle = null;
  }

  function onKeydown(e){
    if(e.key === 'Escape'){ e.preventDefault(); closeNavDrawer(); return; }
    if(e.key !== 'Tab') return;
    const d = drawer(); if(!d) return;
    const items = Array.from(d.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    else if(!d.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
  }

  // Sidebar items are <div role="button">, so Enter / Space must act like a click.
  document.addEventListener('keydown', function(e){
    const el = e.target;
    if(!el || !el.matches || !el.matches('.nav-item[role="button"]')) return;
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); el.click(); }
  });

  // Growing the window to desktop size while the drawer is open: close it cleanly.
  const onBreakpoint = () => { if(DESKTOP_QUERY.matches && isOpen()) closeNavDrawer(false); };
  if(DESKTOP_QUERY.addEventListener) DESKTOP_QUERY.addEventListener('change', onBreakpoint);
  else DESKTOP_QUERY.addListener(onBreakpoint);

  window.openNavDrawer = openNavDrawer;
  window.closeNavDrawer = closeNavDrawer;
  window.toggleNavDrawer = toggleNavDrawer;
  window.resetNavDrawer = resetNavDrawer;
})();

/* The slim top bar that shows above resident / admin pages on tablet and mobile
   (hidden on desktop, where the sidebar is always visible). */
function portalMobileBar(){
  return `<header class="portal-bar">
    <button type="button" class="nav-toggle" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="nav-drawer" onclick="toggleNavDrawer()">
      <span class="nav-toggle-ic nav-toggle-open" aria-hidden="true">${icon('bars')}</span>
      <span class="nav-toggle-ic nav-toggle-close" aria-hidden="true">${icon('xmark')}</span>
    </button>
    <span class="brand">${logoMark(26)} e-Kagawad</span>
  </header>`;
}
