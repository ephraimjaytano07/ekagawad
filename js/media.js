/* ============================================================
   MEDIA.JS
   ------------------------------------------------------------
   Handles the supporting-document file picker in the request
   form, plus the image viewer pop-up.

   The chosen file stays on the real <input type="file"> and is
   sent to the server by submitDocRequest() (see resident.js),
   which stores it under /uploads/requests and saves its path in
   the database.

   NEW: once a file is picked it is shown as a small "chip" with
   its name and size and a Remove button, so the resident can
   take the requirement back out (or pick a different one) before
   submitting.
   ============================================================ */

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILES = 10;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileError(file) {
  if (!file) return '';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Each file must not be larger than 5 MB.';
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return 'Files must be an image (JPG, PNG, GIF or WEBP) or a PDF.';
  return '';
}

/* Renders one chip per selected file inside chipWrap, each with its own Remove button. */
function renderFileChips(input, chipWrap) {
  if (!chipWrap) return;
  const files = Array.from(input.files || []);
  if (!files.length) { chipWrap.innerHTML = ''; chipWrap.hidden = true; return; }
  chipWrap.hidden = false;
  chipWrap.innerHTML = files.map((f, i) => `
    <div class="file-chip">
      <span class="fc-name">${escapeHtml(f.name)}</span>
      <span class="fc-size">${formatBytes(f.size)}</span>
      <button type="button" class="fc-remove" onclick="removeFileAt('${input.id}','${chipWrap.id}',${i})">${icon('trash')}</button>
    </div>`).join('');
}

function clearFileInput(input, chipWrap) {
  input.value = '';
  if (chipWrap) { chipWrap.innerHTML = ''; chipWrap.hidden = true; }
}

/* Called by <input type="file" multiple onchange="handleFilesSelect(this,{chipWrapId:'...',max:N})">. */
function handleFilesSelect(input, opts) {
  opts = opts || {};
  const chipWrap = document.getElementById(opts.chipWrapId || 'req-file-chip');
  const max = opts.max || MAX_UPLOAD_FILES;
  const files = Array.from(input.files || []);
  if (files.length > max) {
    showFormError(`You may upload up to ${max} file${max === 1 ? '' : 's'}.`);
    clearFileInput(input, chipWrap);
    return;
  }
  for (const f of files) {
    const err = fileError(f);
    if (err) { showFormError(err); clearFileInput(input, chipWrap); return; }
  }
  clearFormError();
  renderFileChips(input, chipWrap);
}

/* Removes one file from a multi-select <input> using the DataTransfer trick,
   then re-renders its chip list. */
function removeFileAt(inputId, chipWrapId, index) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const dt = new DataTransfer();
  Array.from(input.files).forEach((f, i) => { if (i !== index) dt.items.add(f); });
  input.files = dt.files;
  renderFileChips(input, document.getElementById(chipWrapId));
}

function openMedia(url, caption){ state.mediaModal = {url, caption}; render(true); }

function closeMedia(){ state.mediaModal = null; render(true); }

function mediaModalHtml(){
  if(!state.mediaModal) return '';
  return `<div class="modal-overlay" onclick="closeMedia()">
    <div class="modal-box" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeMedia()">${icon('xmark')}</button>
      <img src="${escapeHtml(state.mediaModal.url)}" alt="${escapeHtml(state.mediaModal.caption||'')}">
      <div class="modal-caption">${escapeHtml(state.mediaModal.caption||'')}</div>
    </div>
  </div>`;
}