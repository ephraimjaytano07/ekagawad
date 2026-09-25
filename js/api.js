/* ============================================================
   API.JS  (NEW FILE)
   ------------------------------------------------------------
   Every call to the PHP backend goes through here. This is the
   ONLY file that knows about fetch()/JSON/FormData plumbing -
   every other file just calls api.get(...) / api.post(...) and
   gets back a plain JS object, the same shape the old dummy
   data arrays used to be in.

   All requests include credentials so the PHP session cookie
   (which remembers who is logged in) is sent along.
   ============================================================ */

const API_BASE = 'api';

async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE}/${path}`, { credentials: 'same-origin', ...options });
  let data;
  try { data = await res.json(); }
  catch (e) { throw new Error('The server returned an unexpected response.'); }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}

const api = {
  get(path) {
    return apiCall(path, { method: 'GET' });
  },
  post(path, body) {
    return apiCall(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  },
  postForm(path, formData) {
    return apiCall(path, { method: 'POST', body: formData });
  },
};
