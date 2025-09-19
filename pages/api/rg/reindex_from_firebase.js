// pages/api/rg/reindex_from_firebase.js
import { authAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import { upsertPoints } from '@/lib/qdrant';
import { embedPassages } from '@/lib/embeddings';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m?.[1] || null;
}

function chunk(text, size = 800) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'Missing Firebase ID token' });
    const decoded = await authAdmin.verifyIdToken(token);
    const doctorUID = decoded.uid;

    // Pull scoped data from Firestore
    const [patientsSnap, reportsSnap, labsSnap] = await Promise.all([
      dbAdmin.collection('patients').where('registeredBy', '==', doctorUID).get(),
      dbAdmin.collection('reports').where('doctorUID', '==', doctorUID).get(),
      dbAdmin.collection('labReports').where('doctorUID', '==', doctorUID).get().catch(() => ({ empty: true, docs: [] })),
    ]);

    const docs = [];

    for (const d of patientsSnap.docs) {
      const p = { id: d.id, ...d.data() };
      const text = [
        `Patient: ${p.name || p.id}`,
        p.gender ? `Gender: ${p.gender}` : '',
        p.age ? `Age: ${p.age}` : '',
        p.allergies ? `Allergies: ${Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies}` : '',
        p.conditions ? `Conditions: ${Array.isArray(p.conditions) ? p.conditions.join(', ') : p.conditions}` : '',
        p.notes ? `Notes: ${p.notes}` : '',
      ].filter(Boolean).join('\n');
      for (const c of chunk(text)) docs.push({ id: `${d.id}::p::${docs.length}`, content: c, payload: { doctorUID, type: 'patient', patientId: d.id } });
    }

    for (const d of reportsSnap.docs) {
      const r = { id: d.id, ...d.data() };
      const text = [
        `Report: ${r.title || r.type || 'Report'} on ${r.date?.toDate?.()?.toISOString?.()?.slice(0,10) || r.date || ''}`,
        r.patientName ? `Patient: ${r.patientName}` : '',
        r.diagnosis ? `Diagnosis: ${r.diagnosis}` : '',
        r.text || r.summary || r.content || '',
      ].filter(Boolean).join('\n');
      for (const c of chunk(text)) docs.push({ id: `${d.id}::r::${docs.length}`, content: c, payload: { doctorUID, type: 'report', reportId: d.id, patientName: r.patientName || null } });
    }

    for (const d of labsSnap.docs) {
      const L = { id: d.id, ...d.data() };
      const text = [
        `Lab Report on ${L.date?.toDate?.()?.toISOString?.()?.slice(0,10) || L.date || ''}`,
        L.patientName ? `Patient: ${L.patientName}` : '',
        L.tests ? `Tests: ${Array.isArray(L.tests) ? L.tests.map(t => `${t.name}: ${t.value} ${t.unit||''} (${t.normal||''})`).join('; ') : L.tests}` : '',
        L.notes || '',
      ].filter(Boolean).join('\n');
      for (const c of chunk(text)) docs.push({ id: `${d.id}::l::${docs.length}`, content: c, payload: { doctorUID, type: 'lab', labId: d.id, patientName: L.patientName || null } });
    }

    // Embed + upsert in batches
    const B = 100;
    for (let i = 0; i < docs.length; i += B) {
      const slice = docs.slice(i, i + B);
      const vectors = await embedPassages(slice.map(s => s.content.startsWith('passage:') ? s.content : `passage: ${s.content}`));
      const points = slice.map((s, k) => ({
        id: s.id,
        vector: vectors[k],
        payload: { ...s.payload, text: s.content },
      }));
      await upsertPoints(points);
    }

    return res.status(200).json({ ok: true, indexed: docs.length });
  } catch (e) {
    console.error('reindex_from_firebase error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
