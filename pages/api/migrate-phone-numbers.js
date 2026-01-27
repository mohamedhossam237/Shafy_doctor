// /pages/api/migrate-phone-numbers.js
// Migration script to add +20 (Egypt country code) to all patient phone numbers
// Node Runtime: Updates all patient phone numbers to include +20 prefix

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID =
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();

if (!FIREBASE_PROJECT_ID) console.warn('[migrate-phone-numbers] FIREBASE_PROJECT_ID missing');

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)`;

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

function fieldFilter(fieldPath, op, stringValue) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op,
      value: { stringValue },
    },
  };
}

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

function unwrapRows(rows) {
  return rows
    .map((x) => {
      if (!x.document) return null;
      const f = x.document.fields || {};
      const o = {};
      for (const [k, v] of Object.entries(f)) {
        if ('stringValue' in v) o[k] = v.stringValue;
        else if ('integerValue' in v) o[k] = Number(v.integerValue);
        else if ('doubleValue' in v) o[k] = Number(v.doubleValue);
        else if ('booleanValue' in v) o[k] = Boolean(v.booleanValue);
        else if ('timestampValue' in v) o[k] = v.timestampValue;
        else if ('arrayValue' in v) {
          o[k] = (v.arrayValue?.values || []).map((av) => {
            if ('stringValue' in av) return av.stringValue;
            if ('integerValue' in av) return Number(av.integerValue);
            return av;
          });
        } else o[k] = v;
      }
      // Extract ID from document name
      if (x.document.name) {
        const parts = x.document.name.split('/');
        o.id = parts[parts.length - 1];
      }
      return o;
    })
    .filter(Boolean);
}

// Normalize phone number with +20 (Egypt country code)
function normalizePhone(raw = '') {
  const s = String(raw || '').trim();
  if (!s) return '';
  
  // If already starts with +20, return as is
  if (s.startsWith('+20') && s.length > 3) {
    return s;
  }
  
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  
  let phoneDigits = d.replace(/^0+/, '');
  
  if (phoneDigits.startsWith('20')) {
    // Already starts with 20
    return `+${phoneDigits}`;
  } else {
    // Add +20 (Egypt country code)
    return `+20${phoneDigits}`;
  }
}

async function updatePatientPhone(idToken, patientId, newPhone) {
  const docUrl = `${FS_BASE}/documents/patients/${patientId}`;
  const r = await fetch(docUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        phone: { stringValue: newPhone },
        phoneUpdatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const idToken = bearer(req);
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Firebase ID token' });
    }

    const { uid } = await verifyIdToken(idToken);

    // Get all patients registered by this doctor or associated with this doctor
    const [patientsByRegistered, patientsByAssociated] = await Promise.all([
      runQuery(idToken, {
        from: [{ collectionId: 'patients' }],
        where: fieldFilter('registeredBy', 'EQUAL', uid),
        limit: 1000,
      }),
      runQuery(idToken, {
        from: [{ collectionId: 'patients' }],
        where: fieldFilter('associatedDoctors', 'ARRAY_CONTAINS', uid),
        limit: 1000,
      }),
    ]);

    // Unwrap rows from query results
    const patients1 = unwrapRows(patientsByRegistered);
    const patients2 = unwrapRows(patientsByAssociated);
    const allPatients = [...patients1, ...patients2];
    
    // Deduplicate by ID
    const uniquePatients = Object.values(
      allPatients.reduce((acc, cur) => {
        if (cur.id) acc[cur.id] = cur;
        return acc;
      }, {})
    );

    const results = {
      total: uniquePatients.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // Process each patient
    for (const patient of uniquePatients) {
      const currentPhone = patient.phone || '';
      
      // Skip if no phone number
      if (!currentPhone || !currentPhone.trim()) {
        results.skipped++;
        results.details.push({
          patientId: patient.id,
          name: patient.name || 'Unknown',
          status: 'skipped',
          reason: 'No phone number',
        });
        continue;
      }

      // Check if already has +20
      if (currentPhone.startsWith('+20') && currentPhone.length > 3) {
        results.skipped++;
        results.details.push({
          patientId: patient.id,
          name: patient.name || 'Unknown',
          status: 'skipped',
          reason: 'Already has +20',
          phone: currentPhone,
        });
        continue;
      }

      // Normalize phone number
      const normalizedPhone = normalizePhone(currentPhone);
      
      if (!normalizedPhone || normalizedPhone === currentPhone) {
        results.skipped++;
        results.details.push({
          patientId: patient.id,
          name: patient.name || 'Unknown',
          status: 'skipped',
          reason: 'No change needed',
          phone: currentPhone,
        });
        continue;
      }

      // Update patient phone
      try {
        const success = await updatePatientPhone(idToken, patient.id, normalizedPhone);
        if (success) {
          results.updated++;
          results.details.push({
            patientId: patient.id,
            name: patient.name || 'Unknown',
            status: 'updated',
            oldPhone: currentPhone,
            newPhone: normalizedPhone,
          });
        } else {
          results.errors++;
          results.details.push({
            patientId: patient.id,
            name: patient.name || 'Unknown',
            status: 'error',
            reason: 'Update failed',
            phone: currentPhone,
          });
        }
      } catch (err) {
        results.errors++;
        results.details.push({
          patientId: patient.id,
          name: patient.name || 'Unknown',
          status: 'error',
          reason: err.message,
          phone: currentPhone,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      summary: {
        total: results.total,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
      },
      details: results.details.slice(0, 100), // Limit details to first 100
    });
  } catch (e) {
    console.error('Migration error:', e);
    return res.status(e?.status || 500).json({
      error: e.message || 'Migration failed',
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
    });
  }
}

