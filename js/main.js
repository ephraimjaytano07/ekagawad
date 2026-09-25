/* ============================================================
   MAIN.JS
   ------------------------------------------------------------
   The "engine" of the whole single-page app. MUST be the LAST
   <script> loaded in index.html.

   render():
     Looks at state.screen and decides which "view" function to
     call to build that screen's HTML, then puts that HTML into
     <div id="app">. Called again every time something changes.

   NEW: on first load, before anything is rendered, the app
   loads the real document types from the database and asks the
   server whether a session already exists (e.g. the browser was
   just refreshed) so the person doesn't get logged out just by
   reloading the page.
   ============================================================ */

function render(preserveScroll=false){
  const savedScrollY = window.scrollY;
  const root = document.getElementById('app');
  let html = '';
  if(state.screen==='resident' && !state.currentResident){ state.screen='loginChoice'; state.loginErr='Please log in as a resident to continue.'; }
  if(state.screen==='admin' && !state.currentAdmin){ state.screen='loginChoice'; state.loginErr='Please log in as Admin/Staff to continue.'; }
  if(state.screen==='landing') html = viewLanding();
  else if(state.screen==='loginChoice') html = viewLoginChoice();
  else if(state.screen==='residentLogin') html = viewResidentLogin();
  else if(state.screen==='residentRegister') html = viewResidentRegister();
  else if(state.screen==='adminLogin') html = viewAdminLogin();
  else if(state.screen==='resident') html = residentShell();
  else if(state.screen==='admin') html = adminShell();
  root.innerHTML = html + mediaModalHtml() + pdfModalHtml() + claimStubModalHtml();
  if(preserveScroll){
    requestAnimationFrame(()=>window.scrollTo({top:savedScrollY, behavior:'auto'}));
  }else{
    window.scrollTo({top:0, behavior:'smooth'});
  }
}



/* Boot the app: load the real document catalog, then check for
   an existing login session, then draw the first screen. */
(async function boot(){
  await loadDocumentTypes();
  await restoreSession();
})();
