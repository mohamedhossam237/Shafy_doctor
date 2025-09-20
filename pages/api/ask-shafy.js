// /pages/api/ask-shafy.js
// Edge Runtime: Chat + Translation (Fanar) — no firebase-admin.
// - Verifies Firebase ID tokens via JOSE against Google SecureToken JWKS
// - (Optional) pulls doctor-owned context from Firestore via REST using the user ID token
// - Keeps "translate_ar_to_en" mode and default chat mode
// - NEW: Optional RAG (citations) via /api/rg/search to bring trusted sources into answers

export const config = { runtime: 'edge' };

// ====== Fanar setup ======
const FANAR_BASE = 'https://api.fanar.qa/v1';
const MODEL_CHAT = 'Fanar';
const FANAR_ORG = (process.env.FANAR_ORG || '').trim();

function getFanarKey() {
  const key = (process.env.FANAR_API_KEY || '').trim();
  if (!key) throw new Error('Missing FANAR_API_KEY in environment');
  return key;
}
function commonAuthHeaders(extra = {}) {
  const h = { Authorization: `Bearer ${getFanarKey()}`, ...extra };
  if (FANAR_ORG) h['X-Organization'] = FANAR_ORG;
  return h;
}
async function fanarChat(messages, { max_tokens = 900, temperature = 0.2, response_format } = {}) {
  const body = { model: MODEL_CHAT, messages, max_tokens, temperature };
  if (response_format) body.response_format = response_format;
  const r = await fetch(`${FANAR_BASE}/chat/completions`, {
    method: 'POST',
    headers: { ...commonAuthHeaders({ 'Content-Type': 'application/json' }) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// ====== Helpers ======
function trimTo(str, max = 8000) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max) + '\n...[truncated]...';
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
function fmtDT(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch { return ''; }
}
function asDate(v) {
  if (!v) return null;
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}
function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
function timeout(promise, ms, errorMessage = 'Timed out') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(errorMessage), { status: 504 })), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
// Build absolute base URL for calling sibling APIs in Edge
function getBaseUrl(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

// ====== Firebase ID token verification (Edge-safe) ======
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID =
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

/** Verifies the ID token. Returns { uid, email?, name? }. Throws on failure. */
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
  return {
    uid,
    email: payload.email || '',
    name: payload.name || '',
  };
}

// ====== Firestore REST (uses user ID token as Bearer) ======
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)`;

/** POST :runQuery with a StructuredQuery */
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

/** Build compact doctor context using REST (no admin). If anything fails, return ''. */
async function buildDoctorContextFromFirestore({ uid, idToken, lang = 'ar' }) {
  try {
    const isAr = lang === 'ar';

    // Patients registeredBy == uid (limit 500)
    const patientsRows = await runQuery(idToken, {
      from: [{ collectionId: 'patients' }],
      where: fieldFilter('registeredBy', 'EQUAL', uid),
      limit: 500,
    });

    // Reports where doctorUID == uid, order by date desc (limit 40)
    let reportsRows;
    try {
      reportsRows = await runQuery(idToken, {
        from: [{ collectionId: 'reports' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
        limit: 40,
      });
    } catch {
      const unOrdered = await runQuery(idToken, {
        from: [{ collectionId: 'reports' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        limit: 200,
      });
      reportsRows = unOrdered; // local sort later
    }

    // Appointments by either doctorUID or doctorId (limit 200 each)
    const [apptUID, apptId] = await Promise.all([
      runQuery(idToken, {
        from: [{ collectionId: 'appointments' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        limit: 200,
      }),
      runQuery(idToken, {
        from: [{ collectionId: 'appointments' }],
        where: fieldFilter('doctorId', 'EQUAL', uid),
        limit: 200,
      }),
    ]);

    // Pick doctor doc (optional)
    let doctorName = isAr ? 'الطبيب' : 'Doctor';
    try {
      const r = await fetch(`${FS_BASE}/documents/doctors/${uid}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (r.ok) {
        const d = await r.json();
        const f = d.fields || {};
        const name_ar = f.name_ar?.stringValue || '';
        const name_en = f.name_en?.stringValue || '';
        const name = f.name?.stringValue || '';
        doctorName = (isAr ? name_ar : name_en) || name || doctorName;
      }
    } catch {}

    // Unwrap Firestore REST rows
    const unwrap = (rows) =>
      rows
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
            else o[k] = v;
          }
          return o;
        });

    const patients = unwrap(patientsRows);
    let reports = unwrap(reportsRows);
    // local sort fallback by 'date' if exists
    reports = reports.sort(
      (a, b) => (asDate(a.date)?.getTime() || 0) * -1 - ((asDate(b.date)?.getTime() || 0) * -1)
    );

    const apptsRaw = [...unwrap(apptUID), ...unwrap(apptId)];

    const now = Date.now();
    const in14d = now + 14 * 24 * 60 * 60 * 1000;
    const appts = apptsRaw
      .map((a) => {
        const d = asDate(a.appointmentDate || a.date);
        return { ...a, _t: d ? d.getTime() : 0, _d: d };
      })
      .filter((a) => a._t >= now - 24 * 3600 * 1000 && a._t <= in14d)
      .sort((a, b) => a._t - b._t)
      .slice(0, 20)
      .map((a) => {
        const dt = fmtDT(a._d);
        const who = a.patientName || a.patientID || '—';
        const status = String(a.status || 'pending');
        return `- ${dt} — ${who} — ${isAr ? 'الحالة' : 'status'}: ${status}`;
      });

    const patientSamples = patients.slice(0, 8).map((p) => p.name || p.id).filter(Boolean);
    const reportLines = reports.slice(0, 20).map((r) => {
      const dt = fmtDT(asDate(r.date));
      const who = r.patientName || r.patientID || '—';
      const title =
        r.titleAr || r.titleEn || r.title ||
        (r.type === 'lab' ? (isAr ? 'تقرير معملي' : 'Lab report') : (isAr ? 'تقرير سريري' : 'Clinical report'));
      const extra = r.diagnosis ? ` • ${r.diagnosis}` : '';
      return `- ${dt} — ${who} — ${title}${extra}`;
    });

    const headerAr = `
أنت "شافي AI" — مساعد سريري ذكي يعمل مع الأطباء فقط.
قواعد أساسية:
• السرية أولاً: لا تكشف أي بيانات مرضى خارج هذا السياق. لا تتخيل معلومات.
• الدقة والإيجاز: قدم إجابات عملية، مع خطوات واضحة وخيارات علاجية عامة وليست وصفات دوائية شخصية.
• الاستناد إلى الدليل: عند ذكر حقائق طبية، اذكر الدليل بإيجاز (إرشادات/دراسة واسم الجهة/السنة) إن توفر؛ واذكر رابطًا عامًا إن وجد.
• ليست بديلاً للتشخيص: القرار العلاجي النهائي للطبيب وبحسب حالة المريض.
• اللغة: جاوب بلغة المستخدم.`.trim();

    const headerEn = `
You are "Shafy AI" — an intelligent clinical assistant for physicians.
Core rules:
• Confidentiality first: never reveal patient data beyond this context; do not fabricate facts.
• Precise & concise: provide practical, stepwise guidance and general treatment options (no personalized prescriptions).
• Evidence-based: when stating medical facts, briefly cite the source (guideline/study, org/year) and include a public link if available.
• Not a substitute for clinical judgment: final decisions rest with the treating physician and patient specifics.
• Language: respond in the user’s language.`.trim();

    const header = isAr ? headerAr : headerEn;

    const bodyAr = `
سياق الطبيب (خاص وسري — للاستخدام في الاستنتاج فقط):
• اسم الطبيب: ${doctorName}
• عدد المرضى: ${patients.length}${patientSamples.length ? ` — أمثلة: ${patientSamples.join(', ')}` : ''}
• عدد التقارير: ${reports.length}
• المواعيد القادمة (حتى ١٤ يوماً): ${apptsRaw.length}

أحدث التقارير:
${reportLines.join('\n') || '—'}

المواعيد القادمة:
${appts.join('\n') || '—'}`.trim();

    const bodyEn = `
Doctor context (private — for reasoning only):
• Physician: ${doctorName}
• Patients: ${patients.length}${patientSamples.length ? ` — samples: ${patientSamples.join(', ')}` : ''}
• Reports: ${reports.length}
• Upcoming appointments (next 14 days): ${apptsRaw.length}

Recent reports:
${reportLines.join('\n') || '—'}

Upcoming appointments:
${appts.join('\n') || '—'}`.trim();

    return `${header}\n\n${isAr ? bodyAr : bodyEn}`;
  } catch {
    return ''; // fail soft: context is optional
  }
}

// ====== Lightweight RAG via your /api/rg/search (optional) ======
async function fetchCitations(req, query, { limit = 6, timeoutMs = 4000 } = {}) {
  try {
    if (!query) return [];
    const base = getBaseUrl(req);
    const url = `${base}/api/rg/search?q=${encodeURIComponent(query)}`;
    const r = await timeout(fetch(url, { method: 'GET' }), timeoutMs, 'RAG search timeout');
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({}));
    // Normalize Qdrant search response shape { matches: { result: [ { payload } ] } } or similar
    const raw = j?.matches?.result || j?.matches || [];
    const items = (Array.isArray(raw) ? raw : []).map(it => it?.payload || it);
    const dedup = [];
    const seen = new Set();
    for (const x of items) {
      const key = x?.url || x?.title || JSON.stringify(x).slice(0,128);
      if (!seen.has(key)) { seen.add(key); dedup.push(x); }
      if (dedup.length >= limit) break;
    }
    // Return normalized citations we can both show and pass to the model
    return dedup.map(x => ({
      title: String(x?.title || '').trim(),
      url: String(x?.url || '').trim(),
      source: String(x?.source || '').trim(),
      date: String(x?.date || '').trim(),
      tags: Array.isArray(x?.tags) ? x.tags : [],
    })).filter(c => c.url || c.title);
  } catch {
    return [];
  }
}

// ====== Handler (Edge) ======
export default async function handler(req) {
  try {
    if (req.method === 'GET') {
      return json({ ok: true, route: '/api/ask-shafy', runtime: 'edge' });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth: expect Firebase ID token in Authorization: Bearer <ID_TOKEN>
    const authz = req.headers.get('authorization') || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (!m) return json({ error: 'Missing Authorization Bearer token' }, 401);
    const idToken = m[1];

    // Verify token (Edge-safe)
    const user = await verifyFirebaseIdToken(idToken);

    // Parse body
    const body = await req.json();
    const {
      mode, // "translate_ar_to_en" | undefined
      message,
      ocrTexts = [],
      doctorContext = '',
      lang = 'ar',

      // translation mode extras
      items,
      response_format,
      temperature,

      // NEW: RAG controls
      enable_rag = true,            // turn on/off citation fetch
      rag_query,                    // optional override for search query
      rag_limit = 6,                // how many citations to include
      rag_timeout_ms = 4000,        // timeout for search

      system_extras = [],
      instructions = [],
    } = body || {};

    // ===== Translation branch =====
    if (mode === 'translate_ar_to_en') {
      const bio_ar = String(items?.bio_ar || '');
      const qualifications_ar = String(items?.qualifications_ar || '');
      const university_ar = String(items?.university_ar || '');
      const specialty_ar = String(items?.specialty_ar || '');
      const subs_ar = Array.isArray(items?.subspecialties_ar) ? items.subspecialties_ar.filter(Boolean).map(String) : [];

      const sys = [
        'You are a professional bilingual (Arabic→English) medical translator.',
        'Translate the following Arabic profile fields into concise, professional English suitable for a physician profile in Egypt.',
        'Output ONLY valid JSON with this exact schema and keys:',
        '{"bio_en": string, "qualifications_en": string, "university_en": string, "specialty_en": string, "subspecialties_en": string[]}',
        'Preserve the original order of subspecialties. Avoid transliteration unless medically standard (e.g., "GERD", "ECG"). Do not add commentary or code fences.',
        ...system_extras,
        ...(Array.isArray(instructions) ? instructions : []),
      ].join('\n');

      const usr = [
        'FIELDS (Arabic):',
        `bio_ar: ${bio_ar || '-'}`,
        `qualifications_ar: ${qualifications_ar || '-'}`,
        `university_ar: ${university_ar || '-'}`,
        `specialty_ar: ${specialty_ar || '-'}`,
        'subspecialties_ar:',
        ...(subs_ar.length ? subs_ar.map((s, i) => `- ${i + 1}. ${s}`) : ['- (none)']),
      ].join('\n');

      const resp = await fanarChat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
        { max_tokens: 500, temperature: typeof temperature === 'number' ? temperature : 0.1, response_format }
      );

      if (!resp.ok) {
        return json({
          error: resp.data?.error?.message || resp.data?.message || 'Fanar request failed',
          upstream: resp.data,
        }, resp.status || 502);
      }

      const raw = resp.data?.choices?.[0]?.message?.content ?? '';
      const parsed = extractJson(raw);
      if (!parsed || typeof parsed !== 'object') {
        return json({ error: 'Translator returned non-JSON or invalid JSON.', output: raw }, 502);
        }

      const translations = {
        bio_en: String(parsed.bio_en || '').trim(),
        qualifications_en: String(parsed.qualifications_en || '').trim(),
        university_en: String(parsed.university_en || '').trim(),
        specialty_en: String(parsed.specialty_en || '').trim(),
        subspecialties_en: Array.isArray(parsed.subspecialties_en)
          ? parsed.subspecialties_en.map((s) => String(s || '').trim())
          : [],
      };

      return json({ ok: true, translations });
    }

    // ===== Chat branch =====
    if (!message || typeof message !== 'string') {
      return json({ error: 'message is required' }, 400);
    }

    // Build PRIVATE context via Firestore REST (optional; fail-soft)
    const serverCtx = await buildDoctorContextFromFirestore({ uid: user.uid, idToken, lang });
    const isArabic = lang === 'ar';

    // OCR hints (optional)
    const ocrHeader = isArabic ? 'نصوص OCR المرفقة:' : 'Attached OCR extracts:';
    const ocrCombined = trimTo(
      (Array.isArray(ocrTexts) ? ocrTexts : [])
        .filter(Boolean)
        .map((t, i) => `[#${i + 1}] ${String(t).trim()}`)
        .join('\n\n'),
      6000
    );

    const userTextCore = trimTo(String(message || ''), 6000);
    const userTextWithOcr = ocrCombined ? `${userTextCore}\n\n${ocrHeader}\n${ocrCombined}` : userTextCore;

    // ===== Optional RAG (citations) =====
    let citations = [];
    if (enable_rag) {
      const q = String(rag_query || userTextCore).slice(0, 500);
      citations = await fetchCitations(req, q, { limit: Math.max(1, Math.min(10, rag_limit)), timeoutMs: rag_timeout_ms });
    }

    // Final system/context
    const baseSystem =
      serverCtx ||
      (isArabic
        ? 'أنت شافي AI، مساعد سريري للأطباء. التزم بالسرية، لا تتخيل معلومات، واذكر الدليل بإيجاز عند ذكر حقائق طبية.'
        : 'You are Shafy AI, a clinical assistant for physicians. Maintain confidentiality, do not fabricate facts, and provide brief evidence when stating medical facts.');

    const clientCtxLabel = isArabic ? 'سياق إضافي من الواجهة (خاص):' : 'Additional client context (private):';
    const citationsLabel = isArabic ? 'مصادر موثوقة (للاستدلال وإظهار الروابط):' : 'Trusted sources (for grounding & links):';

    const citationsBlock = citations.length
      ? `${citationsLabel}\n` + citations.map((c, i) =>
          `- [${i + 1}] ${c.title || c.source || 'Source'} — ${c.url}${c.date ? ` (${c.date})` : ''}`
        ).join('\n')
      : '';

    const systemParts = [baseSystem];
    if (doctorContext) systemParts.push(`${clientCtxLabel}\n${trimTo(String(doctorContext || ''))}`);
    if (citationsBlock) systemParts.push(citationsBlock);
    const system = systemParts.join('\n\n');

    const resp = await fanarChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userTextWithOcr },
      ],
      { max_tokens: 900, temperature: typeof temperature === 'number' ? temperature : 0.2 }
    );

    if (!resp.ok) {
      return json({
        error: resp.data?.error?.message || resp.data?.message || 'Fanar request failed',
        upstream: resp.data,
      }, resp.status || 502);
    }

    const output = resp.data?.choices?.[0]?.message?.content ?? '';
    const textOut = output || (isArabic ? 'لم أستطع توليد رد.' : 'Could not generate a response.');

    return json({
      ok: true,
      model: MODEL_CHAT,
      text: textOut,
      tts_status: 'disabled',
      stt_status: 'disabled',
      citations, // array of {title,url,source,date,tags}
    });
  } catch (e) {
    const status = e?.status || 500;
    return json({ error: e?.message || 'Server error' }, status);
  }
}
