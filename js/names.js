/* ============================================================
   NAMES.JS  (NEW FILE — load it right AFTER js/state.js)
   ------------------------------------------------------------
   Everything for the split resident name:
   First Name, Middle Name (optional), Last Name, Suffix (optional).

   - nameFields(prefix, values)  -> the 4 form inputs (HTML)
   - readNameFields(prefix)      -> reads them back as an object
   - nameFieldsError(parts)      -> '' when fine, otherwise the message
   - composeFullName(parts)      -> "Juan Santos Dela Cruz Jr."

   The server (includes/functions.php -> read_name_parts) checks
   every rule again, so these checks only make the form friendlier.
   ============================================================ */

const SUFFIX_OPTIONS = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

const FIRST_NAME_MSG  = 'Please enter a valid first name (letters, spaces, periods, hyphens and apostrophes only, 2–50 characters).';
const MIDDLE_NAME_MSG = 'Middle name may only contain letters, spaces, periods, hyphens and apostrophes (up to 40 characters).';
const LAST_NAME_MSG   = 'Please enter a valid last name (letters, spaces, periods, hyphens and apostrophes only, 2–40 characters).';

/* true when a name part is NOT acceptable */
function namePartInvalid(value, minLetters, maxLen){
  const letters = (value.match(/\p{L}/gu) || []).length;
  return value.length < 1 || value.length > maxLen || !/^\p{L}[\p{L}\p{M}\s.'-]*$/u.test(value) || letters < minLetters;
}

/* parts = { firstName, middleName, lastName, suffix } */
function nameFieldsError(parts){
  if(!parts.firstName) return 'First name is required.';
  if(!parts.lastName) return 'Last name is required.';
  if(namePartInvalid(parts.firstName, 2, 50)) return FIRST_NAME_MSG;
  if(parts.middleName && namePartInvalid(parts.middleName, 1, 40)) return MIDDLE_NAME_MSG;
  if(namePartInvalid(parts.lastName, 2, 40)) return LAST_NAME_MSG;
  if(parts.suffix && !SUFFIX_OPTIONS.includes(parts.suffix)) return 'Please choose a valid suffix (Jr., Sr., II, III, IV or V).';
  return '';
}

function composeFullName(parts){
  return [parts.firstName, parts.middleName, parts.lastName, parts.suffix].filter(Boolean).join(' ');
}

/* Reads the four inputs made by nameFields(prefix). */
function readNameFields(prefix){
  const v = id => { const el = document.getElementById(`${prefix}-${id}`); return el ? cleanText(el.value) : ''; };
  return { firstName: v('first'), middleName: v('middle'), lastName: v('last'), suffix: v('suffix') };
}

/* The four name inputs, laid out in two rows.
   values = { firstName, middleName, lastName, suffix } (all optional; used when editing). */
function nameFields(prefix, values){
  const v = values || {};
  const optional = '<span style="font-weight:400;color:var(--slate)">(optional)</span>';
  return `<div class="form-grid-2">
      <div class="field"><label>First Name</label><input id="${prefix}-first" maxlength="50" autocomplete="given-name" placeholder="e.g. Juan" value="${escapeHtml(v.firstName || '')}"></div>
      <div class="field"><label>Middle Name ${optional}</label><input id="${prefix}-middle" maxlength="40" autocomplete="additional-name" placeholder="e.g. Santos" value="${escapeHtml(v.middleName || '')}"></div>
    </div>
    <div class="form-grid-2">
      <div class="field"><label>Last Name</label><input id="${prefix}-last" maxlength="40" autocomplete="family-name" placeholder="e.g. Dela Cruz" value="${escapeHtml(v.lastName || '')}"></div>
      <div class="field"><label>Suffix ${optional}</label>
        <select id="${prefix}-suffix">
          <option value="">None</option>
          ${SUFFIX_OPTIONS.map(s => `<option value="${escapeHtml(s)}" ${v.suffix === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
    </div>`;
}
