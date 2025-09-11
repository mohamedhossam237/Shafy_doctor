// npm i firebase-admin firebase-functions
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

/**
 * Creates a doctor notification when a new appointment is created.
 * Path: appointments/{appointmentId}
 */
export const onAppointmentCreated = onDocumentCreated(
  'appointments/{appointmentId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const appt = snap.data() || {};
    // Try both fields you’ve been using:
    const doctorUID = appt.doctorUID || appt.doctorId || null;
    if (!doctorUID) return; // nothing to notify

    // Build title (EN + AR) and optional deep link
    const dateStr = formatDateTime(appt); // helper below
    const patientName =
      appt.patientName_ar || appt.patientName_en || appt.patientName || appt.patientId || 'Patient';

    const title = `New appointment with ${patientName} on ${dateStr}`;
    const title_ar = `موعد جديد مع ${patientName} بتاريخ ${dateStr}`;

    // Stable, idempotent notification id to avoid duplicates if retried:
    const notifId = `appt_${snap.id}_${doctorUID}`;

    const notifDoc = {
      type: 'appointment',
      unread: true,
      doctorUID,                                 // used by your /notifications.js query
      title,
      title_ar,
      link: `/appointments/${snap.id}`,          // your page already appends ?lang=ar if needed
      ts: FieldValue.serverTimestamp(),
      // Optional metadata (handy for future features):
      appointmentId: snap.id,
      patientId: appt.patientId || appt.patientUID || null,
      patientName_en: appt.patientName_en || null,
      patientName_ar: appt.patientName_ar || null,
    };

    // upsert with a deterministic id (idempotent)
    await db.collection('notifications').doc(notifId).set(notifDoc, { merge: false });
  }
);

// ---------- helpers ----------
function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  try { return new Date(val); } catch { return null; }
}

function pad(n){ return String(n).padStart(2,'0'); }
function toYMD(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function apptDate(appt) {
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y,m,d] = String(appt.date).split('-').map((n)=>parseInt(n,10));
    const [hh=0,mm=0] = String(appt.time||'00:00').split(':').map((n)=>parseInt(n,10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m-1, d, Number.isFinite(hh)?hh:0, Number.isFinite(mm)?mm:0);
    }
  }
  return null;
}

function formatDateTime(appt){
  const d = apptDate(appt);
  if (!d) return '—';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
