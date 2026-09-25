/* ============================================================
   DIALOG.JS  (NEW FILE)
   ------------------------------------------------------------
   Replaces the browser's ugly alert() / confirm() / prompt()
   pop-ups with modal windows that use the same design as the
   rest of the system (same overlay, card, buttons, spacing).

   Usage (all of them return a Promise, so use `await`):

     if (await showConfirm({ title:'Log out?', message:'...', confirmText:'Log Out' })) { ... }
     await showAlert({ title:'Done', message:'...', details:[{label:'ID', value:'2026-00001', mono:true}] });
     const text = await showPrompt({ title:'Appeal', input:{ label:'Reason', type:'textarea', required:true } });

   showConfirm -> true / false
   showAlert   -> true
   showPrompt  -> the typed text, or null when cancelled

   The dialog lives in its own #dialog-root element (outside #app),
   so re-rendering a page never removes an open dialog.
   ============================================================ */

/* extra icon used by the show/hide password button */
ICON_PATHS['eye-slash'] = `<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.9"/><path d="M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 4-.9"/><path d="M9.9 9.9a2.5 2.5 0 0 0 3.5 3.5"/>`;

let _dlg = null; // the dialog that is currently open: { resolve, cancelValue, cfg, prevFocus }

function dialogRoot() {
  let root = document.getElementById('dialog-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dialog-root';
    document.body.appendChild(root);
  }
  return root;
}

function dialogHtml(cfg) {
  const tone = cfg.tone || 'primary';
  const confirmClass = { primary: 'ready', danger: 'danger-solid', success: 'approve', warning: 'ready' }[tone] || 'ready';
  const details = (cfg.details && cfg.details.length)
    ? `<div class="dialog-kv">${cfg.details.map(d => `<div><span>${escapeHtml(d.label)}</span><b class="${d.mono ? 'mono' : ''}">${escapeHtml(d.value)}</b></div>`).join('')}</div>`
    : '';

  let inputHtml = '';
  if (cfg.input) {
    const i = cfg.input;
    const ph = escapeHtml(i.placeholder || '');
    const max = i.maxLength ? ` maxlength="${i.maxLength}"` : '';
    let field;
    if (i.type === 'textarea') {
      field = `<textarea id="dialog-input" placeholder="${ph}"${max}></textarea>`;
    } else if (i.type === 'password') {
      field = `<div class="input-wrap pw-wrap no-lead"><input id="dialog-input" type="password" placeholder="${ph}"${max} autocomplete="current-password"><button type="button" class="pw-toggle" aria-label="Show password" onclick="togglePw('dialog-input',this)">${icon('eye')}</button></div>`;
    } else {
      field = `<input id="dialog-input" type="text" placeholder="${ph}"${max}>`;
    }
    inputHtml = `<div class="field dialog-field"><label for="dialog-input">${escapeHtml(i.label || '')}</label>${field}<div class="err-msg" id="dialog-error" hidden></div></div>`;
  }

  return `<div class="modal-overlay dialog-overlay" id="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onclick="dialogOverlayClick(event)">
    <div class="modal-box dialog-box" onclick="event.stopPropagation()">
      <button class="modal-close" type="button" aria-label="Close" onclick="dialogCancel()">${icon('xmark')}</button>
      <div class="dialog-body">
        <div class="dialog-icon tone-${tone}">${icon(cfg.icon || 'circle-exclamation')}</div>
        <h3 id="dialog-title">${escapeHtml(cfg.title || '')}</h3>
        ${cfg.message ? `<p class="dialog-msg">${escapeHtml(cfg.message)}</p>` : ''}
        ${cfg.html || ''}${details}${inputHtml}
        <div class="dialog-actions">
          ${cfg.cancelText !== null ? `<button type="button" class="abtn neutral" onclick="dialogCancel()">${escapeHtml(cfg.cancelText || 'Cancel')}</button>` : ''}
          <button type="button" class="abtn ${confirmClass}" id="dialog-confirm" onclick="dialogConfirm()">${cfg.confirmIcon ? icon(cfg.confirmIcon) + ' ' : ''}${escapeHtml(cfg.confirmText || 'Confirm')}</button>
        </div>
      </div>
    </div>
  </div>`;
}

function openDialog(cfg) {
  return new Promise(resolve => {
    if (_dlg) closeDialog(_dlg.cancelValue);
    const cancelValue = cfg.input ? null : (cfg.cancelText === null ? true : false);
    _dlg = { resolve, cancelValue, cfg, prevFocus: document.activeElement };
    dialogRoot().innerHTML = dialogHtml(cfg);
    document.addEventListener('keydown', dialogKey, true);
    setTimeout(() => {
      const target = document.getElementById(cfg.input ? 'dialog-input' : 'dialog-confirm');
      if (target) target.focus();
    }, 30);
  });
}

function closeDialog(value) {
  if (!_dlg) return;
  const d = _dlg;
  _dlg = null;
  document.removeEventListener('keydown', dialogKey, true);
  dialogRoot().innerHTML = '';
  if (d.prevFocus && d.prevFocus.focus && document.body.contains(d.prevFocus)) { try { d.prevFocus.focus(); } catch (e) { /* ignore */ } }
  d.resolve(value);
}

function dialogCancel() { if (_dlg) closeDialog(_dlg.cancelValue); }

/* clicking the dark area closes plain dialogs; dialogs with a text box
   stay open so typed text is not lost by an accidental click */
function dialogOverlayClick(e) {
  if (!_dlg || _dlg.cfg.input) return;
  if (e.target && e.target.id === 'dialog-overlay') dialogCancel();
}

function dialogInputError(inp, value) {
  if (inp.required && !value) return inp.requiredMessage || 'This field is required.';
  if (inp.minLength && value.length < inp.minLength) return inp.minMessage || `Please enter at least ${inp.minLength} characters.`;
  if (inp.maxLength && value.length > inp.maxLength) return `Please keep this within ${inp.maxLength} characters.`;
  if (typeof inp.validate === 'function') return inp.validate(value) || '';
  return '';
}

function dialogConfirm() {
  if (!_dlg) return;
  const cfg = _dlg.cfg;
  if (!cfg.input) { closeDialog(true); return; }
  const el = document.getElementById('dialog-input');
  let value = el.value;
  if (cfg.input.type !== 'password') value = value.replace(/\s+/g, ' ').trim();
  const err = dialogInputError(cfg.input, value);
  if (err) {
    const box = document.getElementById('dialog-error');
    box.textContent = err;
    box.hidden = false;
    el.focus();
    return;
  }
  closeDialog(value);
}

/* Esc = cancel, Enter = confirm (except inside a textarea or on a button), Tab stays inside the dialog */
function dialogKey(e) {
  if (!_dlg) return;
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    dialogCancel();
    return;
  }
  if (e.key === 'Enter') {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
    e.preventDefault(); e.stopPropagation();
    dialogConfirm();
    return;
  }
  if (e.key === 'Tab') {
    const box = document.querySelector('#dialog-overlay .dialog-box');
    if (!box) return;
    const items = Array.from(box.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

/* ---------- friendly wrappers ---------- */

function showConfirm(opts) {
  return openDialog(Object.assign({ icon: 'circle-exclamation', tone: 'primary', confirmText: 'Confirm', cancelText: 'Cancel' }, opts));
}

function showAlert(opts) {
  return openDialog(Object.assign({ icon: 'circle-check', tone: 'success', confirmText: 'OK', cancelText: null }, opts));
}

function showPrompt(opts) {
  return openDialog(Object.assign({ icon: 'pen', tone: 'primary', confirmText: 'Submit', cancelText: 'Cancel' }, opts));
}
