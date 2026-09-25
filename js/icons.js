/* ============================================================
   ICONS.JS
   ------------------------------------------------------------
   This file holds the icon system used across the whole site.

   - ICON_PATHS: the raw SVG line-drawing for each icon name
   - icon(name): builds a ready-to-use <svg> tag for that icon
   - logoMark(size): builds the e-Kagawad logo <img> tag

   Using inline SVG (instead of an icon font/CDN like Font
   Awesome) means the icons always work, even without internet
   access, and they can be recolored easily using CSS.

   The actual logo picture file lives at: assets/logo.png
   You can replace that image file directly if you want to
   change the logo later - no code changes needed.
   ============================================================ */

const ICON_PATHS = {
  'arrow-left': `<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>`,
  'arrow-right': `<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>`,
  'ban': `<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>`,
  'bell': `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>`,
  'box': `<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13V22"/>`,
  'bullseye': `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>`,
  'box-open': `<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 9v7l9 5 9-5V9"/><path d="M12 14V9"/>`,
  'building-columns': `<path d="M2 10l10-6 10 6"/><path d="M5 21V10M9 21V10M15 21V10M19 21V10"/><path d="M3 21h18"/>`,
  'chart-pie': `<path d="M12 2v10l7 5"/><path d="M21 12A9 9 0 1 1 12 3"/>`,
  'check': `<path d="M5 13l4 4L19 7"/>`,
  'circle': `<circle cx="12" cy="12" r="9"/>`,
  'circle-check': `<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>`,
  'circle-exclamation': `<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.3v.2"/>`,
  'eye': `<path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5z"/><circle cx="12" cy="12" r="2.5"/>`,
  'envelope': `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/>`,
  'file-circle-check': `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9.5 15.3l1.7 1.7 3.3-3.7"/>`,
  'file-circle-plus': `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 13v6"/><path d="M9 16h6"/>`,
  'file-lines': `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 16.5h6"/>`,
  'file-pdf': `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8.5 17v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M12.3 17v-4h1a1.4 1.4 0 0 1 0 4h-1zM16 17v-4h2M16 15h1.6"/>`,
  'flag-checkered': `<path d="M5 3v18"/><path d="M5 4h14l-3 4 3 4H5"/>`,
  'floppy-disk': `<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><rect x="7" y="13" width="10" height="7"/>`,
  'folder-open': `<path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1"/><path d="M3 8h17l-2 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>`,
  'gauge-high': `<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l3-4"/><circle cx="12" cy="15" r="1"/>`,
  'hourglass-half': `<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9"/><path d="M17 3c0 5-5 6-5 9s5 4 5 9"/>`,
  'id-card': `<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M14.5 10h4M14.5 14h4M5.5 16.5c.5-1.5 1.8-2.5 3-2.5s2.5 1 3 2.5"/>`,
  'list-check': `<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>`,
  'location-dot': `<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  'lock': `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  'magnifying-glass': `<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`,
  'paper-plane': `<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>`,
  'pause': `<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>`,
  'pen': `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
  'phone': `<path d="M6.6 2.5h3.4l1.2 4.6-2.3 1.6a12.5 12.5 0 0 0 6.4 6.4l1.6-2.3 4.6 1.2v3.4a2 2 0 0 1-2.2 2C10.7 18.8 5.2 13.3 4.6 4.7a2 2 0 0 1 2-2.2z"/>`,
  'print': `<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 17v4h12v-4"/>`,
  'rotate-left': `<path d="M9 7H4V2"/><path d="M4 7a8 8 0 1 1-1 7"/>`,
  'right-from-bracket': `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`,
  'right-to-bracket': `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M8 7l-5 5 5 5"/><path d="M3 12h12"/>`,
  'trash': `<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/>`,
  'user': `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>`,
  'user-check': `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 13l2 2 4-4"/>`,
  'user-gear': `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="18" cy="16" r="2.3"/><path d="M18 12.2v1.3M18 18.5v1.3M14.2 16h1.3M20.5 16h1.3M15.4 13.4l.9.9M19.7 17.7l.9.9M20.6 13.4l-.9.9M16.3 17.7l-.9.9"/>`,
  'user-plus': `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M19 8v6M16 11h6"/>`,
  'user-shield': `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M18 11l3.2 1.1v2.9c0 2.5-1.5 4.2-3.2 4.8-1.7-.6-3.2-2.3-3.2-4.8v-2.9z"/>`,
  'user-slash': `<circle cx="10" cy="8" r="3"/><path d="M4 20c0-3 2-5.3 4.7-6"/><path d="M15 15l6 6M21 15l-6 6"/>`,
  'users': `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.7 14.1c2.5.5 4.3 2.7 4.3 5.4"/>`,
  'xmark': `<path d="M6 6l12 12M18 6L6 18"/>`,
  'home': `<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>`,
  'briefcase': `<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>`,
  'heart': `<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>`,
  'paperclip': `<path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>`,
  'image': `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-6 6"/>`,
};

function icon(name, extra){ return `<svg class="icon-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra||''}>${ICON_PATHS[name]||''}</svg>`; }

// This points at the actual image file in the assets folder.
// To change the logo, just replace assets/logo.png with a new picture -
// no code changes needed here.
function logoMark(size){ const s = size||26; return `<img src="assets/logo.png" alt="e-Kagawad logo" class="brand-logo" style="width:${s}px;height:${s*0.735}px">`; }
