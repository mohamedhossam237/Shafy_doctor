// /pages/api/rg/reindex_from_firebase.js
import { authAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import { upsertPoints } from '@/lib/qdrant';         // يعتمد على QDRANT_COLLECTION من env
import { embedPassages } from '@/lib/embeddings';    // يعيد مصفوفات أبعادها 384 (BGE-small)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

/** استخراج Bearer token من الهيدر */
function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m?.[1] || null;
}

/** تقسيم نص كبير لكتل ثابتة الطول مع تنظيف المسافات */
function chunk(text, size = 800) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return out;
}

/** تحويل أي قيمة تاريخ (Firestore Timestamp/Date/String) إلى YYYY-MM-DD */
function toISODate(v) {
  try {
    if (!v) return '';
    if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  } catch {
    return '';
  }
}

/** مولد ID آمن داخل اللوب يمنع التصادمات بين الأنواع */
function makeLocalId(base, kind, idx) {
  // مثال نهائي: <docId>::r::000123
  return `${base}::${kind}::${String(idx).padStart(6, '0')}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // التوثيق بـ Firebase ID Token
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'Missing Firebase ID token' });
    const decoded = await authAdmin.verifyIdToken(token).catch(() => null);
    if (!decoded?.uid) return res.status(401).json({ error: 'Invalid Firebase ID token' });
    const doctorUID = decoded.uid;

    // سحب الداتا المقيّدة بالدكتور
    const [patientsSnap, reportsSnap, labsSnap] = await Promise.all([
      dbAdmin.collection('patients').where('registeredBy', '==', doctorUID).get(),
      dbAdmin.collection('reports').where('doctorUID', '==', doctorUID).get(),
      dbAdmin
        .collection('labReports')
        .where('doctorUID', '==', doctorUID)
        .get()
        .catch(() => ({ empty: true, docs: [] })),
    ]);

    const docs = [];
    let seq = 0; // عدّاد داخلي للـ IDs المقطّعة

    // === المرضى ===
    for (const d of patientsSnap.docs) {
      const p = { id: d.id, ...d.data() };
      const text = [
        `Patient: ${p.name || p.id}`,
        p.gender ? `Gender: ${p.gender}` : '',
        (p.age || p.ageYears) ? `Age: ${p.age || p.ageYears}` : '',
        p.allergies
          ? `Allergies: ${Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies}`
          : '',
        p.conditions
          ? `Conditions: ${Array.isArray(p.conditions) ? p.conditions.join(', ') : p.conditions}`
          : '',
        p.notes ? `Notes: ${p.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunk(text)) {
        docs.push({
          id: makeLocalId(d.id, 'p', seq++),
          content: c,
          payload: { doctorUID, type: 'patient', patientId: d.id },
        });
      }
    }

    // === التقارير ===
    for (const d of reportsSnap.docs) {
      const r = { id: d.id, ...d.data() };
      const text = [
        `Report: ${r.title || r.type || 'Report'} on ${toISODate(r.date)}`,
        r.patientName ? `Patient: ${r.patientName}` : '',
        r.diagnosis ? `Diagnosis: ${r.diagnosis}` : '',
        r.text || r.summary || r.content || '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunk(text)) {
        docs.push({
          id: makeLocalId(d.id, 'r', seq++),
          content: c,
          payload: {
            doctorUID,
            type: 'report',
            reportId: d.id,
            patientName: r.patientName || null,
            date: toISODate(r.date) || null,
          },
        });
      }
    }

    // === تحاليل/لاب ===
    for (const d of labsSnap.docs) {
      const L = { id: d.id, ...d.data() };
      const testsLine = Array.isArray(L.tests)
        ? L.tests
            .map((t) => `${t.name}: ${t.value} ${t.unit || ''}${t.normal ? ` (normal: ${t.normal})` : ''}`)
            .join('; ')
        : (L.tests || '');

      const text = [
        `Lab Report on ${toISODate(L.date)}`,
        L.patientName ? `Patient: ${L.patientName}` : '',
        testsLine ? `Tests: ${testsLine}` : '',
        L.notes || '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunk(text)) {
        docs.push({
          id: makeLocalId(d.id, 'l', seq++),
          content: c,
          payload: {
            doctorUID,
            type: 'lab',
            labId: d.id,
            patientName: L.patientName || null,
            date: toISODate(L.date) || null,
          },
        });
      }
    }

    if (docs.length === 0) {
      return res.status(200).json({ ok: true, indexed: 0 });
    }

    // === تضمين + رفع لـ Qdrant على دفعات ===
    const BATCH = 100;
    for (let i = 0; i < docs.length; i += BATCH) {
      const slice = docs.slice(i, i + BATCH);

      // Prefixed for better passage embedding behaviour
      const texts = slice.map((s) =>
        s.content.startsWith('passage:') ? s.content : `passage: ${s.content}`
      );
      const vectors = await embedPassages(texts);

      const points = slice.map((s, k) => ({
        id: s.id,
        vector: vectors[k],
        payload: { ...s.payload, text: s.content },
      }));

      await upsertPoints(points); // يستخدم QDRANT_COLLECTION من env داخل lib/qdrant
    }

    return res.status(200).json({ ok: true, indexed: docs.length });
  } catch (e) {
    console.error('reindex_from_firebase error', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
