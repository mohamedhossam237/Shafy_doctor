// /pages/api/rg/reindex_from_firebase.js
// Node runtime but NO firebase-admin: uses Firestore REST + Qdrant HTTP
// Expects Authorization: Bearer <Firebase ID token>
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { embedPassages } from '@/lib/embeddings'; // keep your existing lean embeddings lib

/* ---------------- Env ---------------- */
const FIREBASE_PROJECT_ID =
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();
const QDRANT_URL = (process.env.QDRANT_URL || '').replace(/\/+$/, '');
const QDRANT_COLLECTION = (process.env.QDRANT_COLLECTION || '').trim();
const QDRANT_API_KEY = (process.env.QDRANT_API_KEY || '').trim();

if (!FIREBASE_PROJECT_ID) console.warn('[reindex] FIREBASE_PROJECT_ID missing');
if (!QDRANT_URL) console.warn('[reindex] QDRANT_URL missing');
if (!QDRANT_COLLECTION) console.warn('[reindex] QDRANT_COLLECTION missing');

/* ---------------- JWT verify (Firebase ID token) ---------------- */
const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

async function verifyIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const uid = payload.user_id || payload.sub;
  if (!uid) throw Object.assign(new Error('Invalid token (no uid)'), { status: 401 });
  return { uid, email: payload.email || '', name: payload.name || '' };
}
function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m?.[1] || null;
}

/* ---------------- Firestore REST helpers ---------------- */
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)`;

async function runQuery(idToken, structuredQuery) {
  const r = await fetch(`${FS_BASE}/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Firestore runQuery failed (${r.status}): ${t}`);
  }
  return r.json();
}
function fieldFilter(fieldPath, op, stringValue) {
  return { fieldFilter: { field: { fieldPath }, op, value: { stringValue } } };
}
function unwrapRows(rows) {
  return rows
    .map((x) => x.document?.fields || null)
    .filter(Boolean)
    .map((f) => {
      const o = {};
      for (const [k, v] of Object.entries(f)) {
        if ('stringValue' in v) o[k] = v.stringValue;
        else if ('integerValue' in v) o[k] = Number(v.integerValue);
        else if ('doubleValue' in v) o[k] = Number(v.doubleValue);
        else if ('booleanValue' in v) o[k] = Boolean(v.booleanValue);
        else if ('timestampValue' in v) o[k] = v.timestampValue;
        else if ('arrayValue' in v) o[k] = v.arrayValue?.values || [];
        else o[k] = v;
      }
      return o;
    });
}
function maybeTS(v) {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

/* ---------------- Qdrant HTTP helpers ---------------- */
async function qdrantUpsert(points) {
  const r = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points?wait=true`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({ points }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Qdrant upsert failed (${r.status}): ${t}`);
  }
}

/* ---------------- utilities ---------------- */
function chunkText(text, size = 800) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return out;
}

/* ---------------- handler ---------------- */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const idToken = bearer(req);
    if (!idToken) return res.status(401).json({ error: 'Missing Firebase ID token' });

    if (!QDRANT_URL || !QDRANT_COLLECTION) {
      return res.status(500).json({ error: 'Qdrant env not configured' });
    }

    const { uid } = await verifyIdToken(idToken);

    // Pull scoped data via Firestore REST
    const [patientsRows, reportsRows, labsRows] = await Promise.all([
      runQuery(idToken, {
        from: [{ collectionId: 'patients' }],
        where: fieldFilter('registeredBy', 'EQUAL', uid),
        limit: 500,
      }),
      // try ordered; if index missing, fallback to unordered
      (async () => {
        try {
          return await runQuery(idToken, {
            from: [{ collectionId: 'reports' }],
            where: fieldFilter('doctorUID', 'EQUAL', uid),
            orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
            limit: 200,
          });
        } catch {
          return await runQuery(idToken, {
            from: [{ collectionId: 'reports' }],
            where: fieldFilter('doctorUID', 'EQUAL', uid),
            limit: 200,
          });
        }
      })(),
      (async () => {
        try {
          return await runQuery(idToken, {
            from: [{ collectionId: 'labReports' }],
            where: fieldFilter('doctorUID', 'EQUAL', uid),
            limit: 200,
          });
        } catch {
          return []; // collection may not exist
        }
      })(),
    ]);

    const patients = unwrapRows(patientsRows);
    let reports = unwrapRows(reportsRows).sort(
      (a, b) => (new Date(b.date || 0).getTime()) - (new Date(a.date || 0).getTime())
    );
    const labs = unwrapRows(labsRows);

    const docs = [];

    // Patients -> text chunks
    for (const p of patients) {
      const text = [
        `Patient: ${p.name || p.id || ''}`,
        p.gender ? `Gender: ${p.gender}` : '',
        p.age ? `Age: ${p.age}` : '',
        p.allergies
          ? `Allergies: ${
              Array.isArray(p.allergies) ? p.allergies.join(', ') : String(p.allergies)
            }`
          : '',
        p.conditions
          ? `Conditions: ${
              Array.isArray(p.conditions) ? p.conditions.join(', ') : String(p.conditions)
            }`
          : '',
        p.notes ? `Notes: ${p.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunkText(text))
        docs.push({
          id: `${p.id || Math.random().toString(36).slice(2)}::p::${docs.length}`,
          content: c,
          payload: { doctorUID: uid, type: 'patient', patientId: p.id || null },
        });
    }

    // Reports -> text chunks
    for (const r of reports) {
      const text = [
        `Report: ${r.title || r.type || 'Report'} on ${maybeTS(r.date)}`,
        r.patientName ? `Patient: ${r.patientName}` : '',
        r.diagnosis ? `Diagnosis: ${r.diagnosis}` : '',
        r.text || r.summary || r.content || '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunkText(text))
        docs.push({
          id: `${r.id || Math.random().toString(36).slice(2)}::r::${docs.length}`,
          content: c,
          payload: {
            doctorUID: uid,
            type: 'report',
            reportId: r.id || null,
            patientName: r.patientName || null,
          },
        });
    }

    // Lab reports -> text chunks
    for (const L of labs) {
      const text = [
        `Lab Report on ${maybeTS(L.date)}`,
        L.patientName ? `Patient: ${L.patientName}` : '',
        L.tests
          ? `Tests: ${
              Array.isArray(L.tests)
                ? L.tests
                    .map((t) => {
                      const name = t?.mapValue?.fields?.name?.stringValue || t?.name || '';
                      const value = t?.mapValue?.fields?.value?.stringValue || t?.value || '';
                      const unit = t?.mapValue?.fields?.unit?.stringValue || t?.unit || '';
                      const normal = t?.mapValue?.fields?.normal?.stringValue || t?.normal || '';
                      return `${name}: ${value} ${unit} (${normal})`;
                    })
                    .join('; ')
                : String(L.tests)
            }`
          : '',
        L.notes || '',
      ]
        .filter(Boolean)
        .join('\n');

      for (const c of chunkText(text))
        docs.push({
          id: `${L.id || Math.random().toString(36).slice(2)}::l::${docs.length}`,
          content: c,
          payload: {
            doctorUID: uid,
            type: 'lab',
            labId: L.id || null,
            patientName: L.patientName || null,
          },
        });
    }

    // Embed + upsert in batches
    const B = 100;
    for (let i = 0; i < docs.length; i += B) {
      const slice = docs.slice(i, i + B);
      const vectors = await embedPassages(
        slice.map((s) => (s.content.startsWith('passage:') ? s.content : `passage: ${s.content}`))
      );

      const points = slice.map((s, k) => ({
        id: s.id,
        vector: vectors[k],
        payload: { ...s.payload, text: s.content },
      }));

      await qdrantUpsert(points);
    }

    return res.status(200).json({ ok: true, indexed: docs.length });
  } catch (e) {
    const status = e?.status || 500;
    console.error('reindex_from_firebase error', e);
    return res.status(status).json({ error: e?.message || 'Server error' });
  }
}
