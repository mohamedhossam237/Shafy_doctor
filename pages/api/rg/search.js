// /pages/api/rg/search.js
// Local RAG search using Firestore data with in-memory cache per doctor
// No Qdrant dependency - each doctor has their own cached search index

export const config = { runtime: 'edge' };

// Simple in-memory cache per doctor (cleared on server restart)
const searchCache = new Map(); // uid -> { data: [...], timestamp: number }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Firebase ID token verification (Edge-safe)
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID =
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

async function verifyFirebaseIdToken(idToken) {
  if (!FIREBASE_PROJECT_ID) {
    throw Object.assign(new Error('Missing FIREBASE_PROJECT_ID'), { status: 500 });
  }
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const uid = payload.user_id || payload.sub;
  if (!uid) throw Object.assign(new Error('Invalid token (no uid/sub)'), { status: 401 });
  return { uid, email: payload.email || '', name: payload.name || '' };
}

// Firestore REST helpers
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)`;

async function runQuery(idToken, structuredQuery) {
  const r = await fetch(`${FS_BASE}/documents:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw Object.assign(new Error(`Firestore runQuery failed: ${err}`), { status: r.status });
  }
  return r.json();
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

function unwrap(rows) {
  return rows
    .map((x) => x.document?.fields || null)
    .filter(Boolean)
    .map((f) => {
      const o = {};
      for (const [k, v] of Object.entries(f)) {
        if (v.stringValue != null) o[k] = v.stringValue;
        else if (v.integerValue != null) o[k] = Number(v.integerValue);
        else if (v.doubleValue != null) o[k] = Number(v.doubleValue);
        else if (v.booleanValue != null) o[k] = Boolean(v.booleanValue);
        else if (v.timestampValue != null) o[k] = v.timestampValue;
        else if (v.arrayValue?.values) {
          o[k] = v.arrayValue.values.map((item) => {
            if (item.stringValue != null) return item.stringValue;
            if (item.mapValue?.fields) {
              const obj = {};
              for (const [key, val] of Object.entries(item.mapValue.fields)) {
                if (val.stringValue != null) obj[key] = val.stringValue;
                else if (val.integerValue != null) obj[key] = Number(val.integerValue);
              }
              return obj;
            }
            return item;
          });
        } else o[k] = v;
      }
      return o;
    });
}

// Build searchable index from doctor's data
async function buildSearchIndex(uid, idToken) {
  const cacheKey = uid;
  const cached = searchCache.get(cacheKey);
  const now = Date.now();
  
  // Return cached data if still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch reports
    let reportsRows;
    try {
      reportsRows = await runQuery(idToken, {
        from: [{ collectionId: 'reports' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
        limit: 200,
      });
    } catch {
      reportsRows = await runQuery(idToken, {
        from: [{ collectionId: 'reports' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        limit: 200,
      });
    }

    const reports = unwrap(reportsRows);
    
    // Build searchable documents
    const searchDocs = [];
    
    for (const r of reports) {
      const text = [
        r.titleAr || r.titleEn || r.title || '',
        r.diagnosis || '',
        r.chiefComplaint || '',
        r.findings || '',
        r.procedures || '',
        r.patientName || '',
        Array.isArray(r.medications) 
          ? r.medications.map(m => m.name || m).join(' ')
          : '',
        Array.isArray(r.tests)
          ? r.tests.map(t => t.name || t).join(' ')
          : '',
      ].filter(Boolean).join(' ').toLowerCase();

      if (text.trim()) {
        searchDocs.push({
          id: r.id || `report_${Date.now()}_${Math.random()}`,
          type: 'report',
          title: r.titleAr || r.titleEn || r.title || 'Report',
          url: `/patient-reports/${r.patientID || ''}`,
          source: 'Doctor Reports',
          date: r.date || '',
          text,
          score: 0,
          payload: {
            reportId: r.id,
            patientName: r.patientName,
            diagnosis: r.diagnosis,
            date: r.date,
          },
        });
      }
    }

    // Cache the results
    searchCache.set(cacheKey, {
      data: searchDocs,
      timestamp: now,
    });

    // Clean old cache entries (keep only last 10 doctors)
    if (searchCache.size > 10) {
      const entries = Array.from(searchCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      searchCache.clear();
      entries.slice(0, 10).forEach(([key, value]) => searchCache.set(key, value));
    }

    return searchDocs;
  } catch (e) {
    console.error('Build search index error:', e);
    return [];
  }
}

// Simple text search with keyword matching and scoring
function searchDocuments(docs, query) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);
  
  return docs
    .map((doc) => {
      let score = 0;
      const text = doc.text || '';
      
      // Exact phrase match (highest score)
      if (text.includes(queryLower)) {
        score += 10;
      }
      
      // Word matches
      for (const word of queryWords) {
        if (word.length < 2) continue;
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = (text.match(regex) || []).length;
        score += matches * 2;
        
        // Partial word match
        if (text.includes(word)) {
          score += 1;
        }
      }
      
      // Title match bonus
      const titleLower = (doc.title || '').toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 5;
      }
      
      // Diagnosis match bonus
      if (doc.payload?.diagnosis) {
        const diagLower = doc.payload.diagnosis.toLowerCase();
        if (diagLower.includes(queryLower)) {
          score += 3;
        }
      }
      
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 results
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req) {
  try {
    if (req.method === 'GET') {
      // Extract query parameter
      let q = '';
      try {
        const url = new URL(req.url || '', 'http://localhost');
        q = url.searchParams.get('q') || '';
      } catch {
        const match = (req.url || '').match(/[?&]q=([^&]+)/);
        if (match) q = decodeURIComponent(match[1]);
      }
      
      if (!q) {
        return json({ ok: false, error: 'Missing q parameter' }, 400);
      }

      // Auth: expect Firebase ID token in Authorization header
      const authz = req.headers.get('authorization') || '';
      const m = authz.match(/^Bearer\s+(.+)$/i);
      if (!m) {
        return json({ ok: false, error: 'Missing Authorization Bearer token' }, 401);
      }
      const idToken = m[1];

      // Verify token
      const user = await verifyFirebaseIdToken(idToken);

      // Build search index (cached)
      const searchDocs = await buildSearchIndex(user.uid, idToken);

      // Search documents
      const results = searchDocuments(searchDocs, q);

      // Format results to match expected shape
      const matches = results.map((doc) => ({
        score: doc.score,
        payload: {
          title: doc.title,
          url: doc.url,
          source: doc.source,
          date: doc.date,
          tags: [],
          ...doc.payload,
        },
      }));

      return json({ ok: true, matches: { result: matches } });
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('RAG search error:', e);
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
