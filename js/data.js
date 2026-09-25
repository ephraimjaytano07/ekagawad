/* ============================================================
   DATA.JS
   ------------------------------------------------------------
   In the original prototype this file held hand-typed sample
   residents, requests, and notifications. All of that is gone
   now — a real barangay system must not start with fake people
   or fake transactions in it.

   The only thing still declared here is `documentsData`, and
   it starts EMPTY. It gets filled in once, at startup, with the
   real document types (Barangay Clearance, Certificate of
   Residency, Certificate of Indigency, Certificate of Good
   Moral Character, Barangay Business Clearance, Barangay ID
   Application) fetched from api/documents.php, which reads them
   from the `document_types` table in the database. Those six
   document types themselves are real, permanent system
   configuration — not sample data — and are seeded once in
   database/schema.sql.
   ============================================================ */

let documentsData = [];

async function loadDocumentTypes() {
  try {
    const res = await api.get('documents.php');
    documentsData = res.documents;
  } catch (e) {
    documentsData = [];
    console.error('Unable to load document types:', e);
  }
}
