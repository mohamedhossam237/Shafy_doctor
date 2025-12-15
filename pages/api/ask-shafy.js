// /pages/api/ask-shafy.js
// Edge Runtime: Chat + Translation (Fanar) — no firebase-admin.
// - Verifies Firebase ID tokens via JOSE against Google SecureToken JWKS
// - (Optional) pulls doctor-owned context from Firestore via REST using the user ID token
// - Keeps "translate_ar_to_en" mode and default chat mode
// - Optional RAG (citations) via /api/rg/search to bring trusted sources into answers
// - NEW: `use_server_context` flag to *disable* any global/doctor context (use only caller-provided data)

export const config = { runtime: 'edge' };

// ====== Fanar setup ======
const FANAR_BASE = 'https://api.fanar.qa/v1';
const MODEL_CHAT = 'Fanar-C-2-27B';
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
async function fanarChat(messages, { max_tokens = 450, temperature = 0.2, response_format } = {}) {
  // max_tokens ~450 = ~300 words (approximately 1.5 tokens per word)
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

    // Fetch doctor document with all details (including clinics)
    let doctorData = {};
    let doctorName = isAr ? 'الطبيب' : 'Doctor';
    let doctorSpecialty = '';
    let doctorClinics = [];
    try {
      const r = await fetch(`${FS_BASE}/documents/doctors/${uid}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (r.ok) {
        const d = await r.json();
        const f = d.fields || {};
        const unwrap = (v) => {
          if (v?.stringValue != null) return v.stringValue;
          if (v?.integerValue != null) return Number(v.integerValue);
          if (v?.doubleValue != null) return Number(v.doubleValue);
          if (v?.booleanValue != null) return Boolean(v.booleanValue);
          if (v?.timestampValue != null) return v.timestampValue;
          if (v?.arrayValue?.values) return v.arrayValue.values.map(unwrap);
          if (v?.mapValue?.fields) {
            const o = {};
            for (const [k, val] of Object.entries(v.mapValue.fields)) {
              o[k] = unwrap(val);
            }
            return o;
          }
          return v;
        };
        doctorData = {};
        for (const [k, v] of Object.entries(f)) {
          doctorData[k] = unwrap(v);
        }
        const name_ar = doctorData.name_ar || '';
        const name_en = doctorData.name_en || '';
        const name = doctorData.name || '';
        doctorName = (isAr ? name_ar : name_en) || name || doctorName;
        doctorSpecialty = (isAr ? doctorData.specialty_ar : doctorData.specialty_en) || doctorData.specialty || '';
        doctorClinics = Array.isArray(doctorData.clinics) ? doctorData.clinics.filter(c => c.active !== false) : [];
        
        // Debug: Log available doctor data fields
        console.log('[ask-shafy] Doctor data fields:', Object.keys(doctorData));
        console.log('[ask-shafy] Doctor specialty:', doctorSpecialty);
        console.log('[ask-shafy] Doctor qualifications_ar:', doctorData.qualifications_ar);
        console.log('[ask-shafy] Doctor qualifications_en:', doctorData.qualifications_en);
      } else {
        console.warn('[ask-shafy] Failed to fetch doctor document:', r.status, r.statusText);
      }
    } catch (e) {
      console.error('[ask-shafy] Error fetching doctor data:', e.message);
    }

    // Patients registeredBy == uid (limit 500)
    const patientsRows = await runQuery(idToken, {
      from: [{ collectionId: 'patients' }],
      where: fieldFilter('registeredBy', 'EQUAL', uid),
      limit: 500,
    });

    // Reports where doctorUID == uid, order by date desc (limit 100 for better RAG)
    let reportsRows;
    try {
      reportsRows = await runQuery(idToken, {
        from: [{ collectionId: 'reports' }],
        where: fieldFilter('doctorUID', 'EQUAL', uid),
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
        limit: 100,
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
      (a, b) => (asDate(b.date)?.getTime() || 0) - (asDate(a.date)?.getTime() || 0)
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
        const clinic = a.clinicName || a.clinic || '';
        return `- ${dt} — ${who} — ${isAr ? 'الحالة' : 'status'}: ${status}${clinic ? ` — ${isAr ? 'العيادة' : 'clinic'}: ${clinic}` : ''}`;
      });

    // Enhanced patient samples with key info
    const patientSamples = patients.slice(0, 10).map((p) => {
      const name = p.name || p.id || '—';
      const age = p.age || p.dateOfBirth ? (isAr ? ' (عمر محسوب)' : ' (age calculated)') : '';
      const phone = p.phone ? ` — ${p.phone}` : '';
      return `${name}${age}${phone}`;
    }).filter(Boolean);

    // Enhanced report lines with more clinical details for RAG
    const reportLines = reports.slice(0, 30).map((r) => {
      const dt = fmtDT(asDate(r.date));
      const who = r.patientName || r.patientID || '—';
      const title =
        r.titleAr || r.titleEn || r.title ||
        (r.type === 'lab' ? (isAr ? 'تقرير معملي' : 'Lab report') : (isAr ? 'تقرير سريري' : 'Clinical report'));
      const diagnosis = r.diagnosis ? ` • ${isAr ? 'التشخيص' : 'Dx'}: ${trimTo(String(r.diagnosis), 80)}` : '';
      const chiefComplaint = r.chiefComplaint ? ` • ${isAr ? 'الشكوى' : 'CC'}: ${trimTo(String(r.chiefComplaint), 60)}` : '';
      const findings = r.findings ? ` • ${isAr ? 'النتائج' : 'Findings'}: ${trimTo(String(r.findings), 60)}` : '';
      const meds = r.medications && Array.isArray(r.medications) && r.medications.length > 0
        ? ` • ${isAr ? 'أدوية' : 'Meds'}: ${r.medications.slice(0, 3).map(m => m.name || m).join(', ')}`
        : '';
      return `- ${dt} — ${who} — ${title}${diagnosis}${chiefComplaint}${findings}${meds}`;
    });

    // Clinic information
    const clinicInfo = doctorClinics.length > 0
      ? doctorClinics.map((c, i) => {
          const name = c.name_ar || c.name || `${isAr ? 'العيادة' : 'Clinic'} ${i + 1}`;
          const addr = c.address_ar || c.address || '';
          const phone = c.phone || '';
          return `- ${name}${addr ? ` — ${addr}` : ''}${phone ? ` — ${phone}` : ''}`;
        }).join('\n')
      : (isAr ? '—' : '—');

    const headerAr = `
أنت "شافي AI" — مساعد سريري ذكي يعمل مع الأطباء فقط في مصر.

السياق المصري:
• جميع العيادات والمرضى والأطباء في مصر
• استخدم المصطلحات الطبية الشائعة في مصر
• راعِ النظام الصحي المصري والممارسات الطبية المحلية
• الأدوية المتاحة في السوق المصري
• التكاليف والأسعار بالجنيه المصري (EGP)
• الإجراءات والبروتوكولات المتبعة في المستشفيات والعيادات المصرية

قواعد أساسية صارمة جداً (يجب الالتزام بها تماماً):
• السرية أولاً: لا تكشف أي بيانات مرضى خارج هذا السياق. البيانات المرفقة خاصة بهذا الطبيب فقط.
• يمكنك الإجابة على أسئلة حول معلومات الطبيب الشخصية: إذا سألك الطبيب عن تخصصه، مؤهلاته، جامعته، سيرته الذاتية، سنوات خبرته، أو أي معلومات شخصية أخرى، استخدم فقط المعلومات من "معلومات الطبيب الشخصية" في "سياق الطبيب" المرفق أدناه من Firebase. ممنوع تماماً الاستنتاج من مصادر أخرى مثل الدراسات البحثية أو التقارير.
• ممنوع تماماً - لا تخترع: لا تخترع أو تتخيل أو تضيف أي معلومات غير موجودة في البيانات المرفقة. لا تضيف تفاصيل، أرقام، حسابات، أو معلومات من أي نوع غير موجودة في السياق المرفق.
• ممنوع استخدام بيانات من مستخدمين آخرين: البيانات المرفقة خاصة بهذا الطبيب فقط. لا تستخدم معلومات من طبيب آخر أو عيادة أخرى. لا تخترع بيانات بناءً على أمثلة عامة.
• استخدم فقط البيانات المتاحة: استخدم فقط المعلومات الموجودة في "سياق الطبيب" المرفق أدناه. إذا لم تكن المعلومات متاحة في البيانات المرفقة، قل بوضوح "المعلومات غير متاحة في البيانات" أو "لا توجد بيانات متاحة" بدلاً من اختراعها.
• للأمور المالية: استخدم فقط الأرقام الموجودة في "البيانات المالية" المرفقة. لا تخترع أرقاماً أو تفاصيل عن فحوصات، حقن، أدوية، أو خدمات إضافية غير موجودة في البيانات المرفقة.
• الدقة والإيجاز: قدم إجابات عملية، مع خطوات واضحة وخيارات علاجية عامة وليست وصفات دوائية شخصية.
• الاستناد إلى الدليل: عند ذكر حقائق طبية، اذكر الدليل بإيجاز (إرشادات/دراسة واسم الجهة/السنة) إن توفر؛ واذكر رابطًا عامًا إن وجد.
• ليست بديلاً للتشخيص: القرار العلاجي النهائي للطبيب وبحسب حالة المريض.
• اللغة: جاوب بلغة المستخدم.
• مهم جداً: يجب أن تكون إجابتك موجزة - بحد أقصى 300 كلمة. كن مباشراً ومختصراً.
• تذكر: إذا لم تكن المعلومة موجودة في "سياق الطبيب" أو "البيانات المالية" المرفقة أدناه، قل "المعلومات غير متاحة" أو "لا توجد بيانات متاحة". لا تخمن، لا تخترع، لا تستخدم أمثلة عامة.`.trim();

    const headerEn = `
You are "Shafy AI" — an intelligent clinical assistant for physicians in Egypt.

Egyptian Context:
• All clinics, patients, and doctors are in Egypt
• Use medical terminology common in Egypt
• Consider the Egyptian healthcare system and local medical practices
• Medications available in the Egyptian market
• Costs and prices in Egyptian Pounds (EGP)
• Procedures and protocols followed in Egyptian hospitals and clinics

Core rules (VERY STRICT - MUST FOLLOW):
• Confidentiality first: never reveal patient data beyond this context. The attached data is specific to THIS doctor only.
• You can answer questions about the doctor's personal information: If the doctor asks about their specialty, qualifications, university, bio, years of experience, or any other personal information, use ONLY the information from "Doctor Profile Information" in the "Doctor context" attached below from Firebase. It is STRICTLY FORBIDDEN to infer from other sources such as research studies or reports.
• STRICTLY FORBIDDEN - NO INVENTION: Do not invent, fabricate, hallucinate, or add any information not present in the attached data. Do not add details, numbers, calculations, or any information of any kind not present in the attached context.
• FORBIDDEN - No data from other users: The attached data is specific to THIS doctor only. Do not use information from another doctor or clinic. Do not invent data based on general examples.
• Use only available data: Use ONLY information present in the "Doctor context" attached below. If information is not available in the attached data, clearly say "Information not available in the data" or "No data available" instead of making it up.
• For financial matters: Use ONLY numbers present in the attached "Financial Data". Do not invent numbers or details about tests, injections, medications, or additional services not present in the attached data.
• Precise & concise: provide practical, stepwise guidance and general treatment options (no personalized prescriptions).
• Evidence-based: when stating medical facts, briefly cite the source (guideline/study, org/year) and include a public link if available.
• Not a substitute for clinical judgment: final decisions rest with the treating physician and patient specifics.
• Language: respond in the user's language.
• Very important: Your response must be concise - maximum 300 words. Be direct and brief.
• Remember: If the information is not present in the "Doctor context" or "Financial Data" attached below, say "Information not available" or "No data available". Do not guess, do not invent, do not use general examples.`.trim();

    const header = isAr ? headerAr : headerEn;

    // Get doctor's financial data from doctorData
    const checkupPrice = Number(doctorData.checkupPrice || 0);
    const followUpPrice = Number(doctorData.followUpPrice || 0);
    const extraServices = Array.isArray(doctorData.extraServices) 
      ? doctorData.extraServices.filter(s => s.active !== false).map(s => ({
          name: s.name_ar || s.name_en || s.name || '',
          price: Number(s.price || 0),
        }))
      : [];
    
    // Financial analysis for financial agent
    let financialSummary = '';
    if (apptsRaw.length > 0) {
      try {
        const { analyzeFinancialData, formatFinancialSummary } = await import('@/lib/agents/financialAgent');
        const financialAnalysis = analyzeFinancialData(
          doctorClinics, 
          apptsRaw, 
          reports, 
          lang,
          { checkupPrice, followUpPrice, extraServices } // Pass all financial data
        );
        financialSummary = formatFinancialSummary(financialAnalysis, lang, { checkupPrice, followUpPrice, extraServices });
      } catch (e) {
        console.warn('Financial analysis failed:', e.message);
      }
    }
    
    // Build doctor profile information from Firebase data ONLY
    const qualifications = isAr ? (doctorData.qualifications_ar || doctorData.qualifications_en || '') : (doctorData.qualifications_en || doctorData.qualifications_ar || '');
    const university = isAr ? (doctorData.university_ar || doctorData.university_en || '') : (doctorData.university_en || doctorData.university_ar || '');
    const bio = isAr ? (doctorData.bio_ar || doctorData.bio_en || '') : (doctorData.bio_en || doctorData.bio_ar || '');
    const graduationYear = doctorData.graduationYear || '';
    const experienceYears = doctorData.experienceYears || '';
    const subspecialties = Array.isArray(doctorData.subspecialties_detail) ? doctorData.subspecialties_detail : [];
    const subspecialtiesList = subspecialties.map(s => isAr ? (s.name_ar || s.name_en || '') : (s.name_en || s.name_ar || '')).filter(Boolean);
    
    const doctorProfileInfo = [];
    // Always include specialty from Firebase (even if empty, to show it was checked)
    doctorProfileInfo.push(`• التخصص: ${doctorSpecialty || 'غير محدد'}`);
    if (subspecialtiesList.length > 0) doctorProfileInfo.push(`• التخصصات الفرعية: ${subspecialtiesList.join(', ')}`);
    if (qualifications) doctorProfileInfo.push(`• المؤهلات العلمية: ${qualifications}`);
    if (university) doctorProfileInfo.push(`• الجامعة: ${university}`);
    if (graduationYear) doctorProfileInfo.push(`• سنة التخرج: ${graduationYear}`);
    if (experienceYears) doctorProfileInfo.push(`• سنوات الخبرة: ${experienceYears}`);
    if (bio) doctorProfileInfo.push(`• السيرة الذاتية: ${trimTo(bio, 200)}`);
    
    // If no profile info available except specialty, add a note
    if (doctorProfileInfo.length === 1 && !doctorSpecialty) {
      doctorProfileInfo.push('• ملاحظة: لا توجد معلومات شخصية متاحة في قاعدة البيانات');
    }
    
    const bodyAr = `
سياق الطبيب (خاص وسري — للاستخدام في الاستنتاج والاستدلال فقط):
• اسم الطبيب: ${doctorName}

معلومات الطبيب الشخصية (من Firebase فقط - استخدم هذه البيانات فقط):
${doctorProfileInfo.length > 0 ? doctorProfileInfo.join('\n') : '• لا توجد معلومات متاحة في قاعدة البيانات'}
• عدد المرضى: ${patients.length}${patientSamples.length ? `\n  أمثلة على المرضى:\n  ${patientSamples.slice(0, 5).join('\n  ')}` : ''}
• عدد التقارير السريرية: ${reports.length}
• المواعيد القادمة (حتى ١٤ يوماً): ${apptsRaw.length}

العيادات النشطة:
${clinicInfo}

${financialSummary ? `البيانات المالية:\n${financialSummary}\n` : ''}

أحدث التقارير السريرية (للاستدلال على أنماط التشخيص والعلاج):
${reportLines.join('\n') || '—'}

المواعيد القادمة:
${appts.join('\n') || '—'}

ملاحظات مهمة جداً للذكاء الاصطناعي (يجب الالتزام بها تماماً):
- هذه البيانات خاصة بهذا الطبيب فقط - لا تستخدم بيانات من طبيب آخر أو عيادة أخرى
- ممنوع تماماً - لا تستنتج من مصادر خارجية: عند الإجابة على أسئلة حول معلومات الطبيب الشخصية (التخصص، المؤهلات، الجامعة، السيرة الذاتية، سنوات الخبرة)، استخدم فقط البيانات من "معلومات الطبيب الشخصية" المرفقة أعلاه من Firebase. ممنوع الاستنتاج من الدراسات البحثية أو التقارير أو أي مصادر أخرى.
- إذا سألك الطبيب عن تخصصه: استخدم فقط التخصص المذكور في "معلومات الطبيب الشخصية" أعلاه. لا تستنتج من التقارير أو الدراسات.
- إذا سألك الطبيب عن مؤهلاته: استخدم فقط المؤهلات المذكورة في "معلومات الطبيب الشخصية" أعلاه. لا تخترع أو تستنتج.
- استخدم هذه البيانات كمرجع لفهم سياق الطبيب وتخصصه وأنماط عمله - فقط من البيانات المرفقة من Firebase
- عند الاقتراح على تشخيص أو علاج، استند إلى التقارير السابقة المشابهة - فقط من التقارير المرفقة
- راعِ تخصص الطبيب من "معلومات الطبيب الشخصية" أعلاه عند تقديم الاقتراحات
- استخدم معلومات العيادات عند الإشارة إلى المواعيد أو الخدمات - فقط من العيادات المرفقة
- للأسئلة المالية: استخدم فقط البيانات المالية المرفقة لحساب الإيرادات والأرباح
- ممنوع تماماً: لا تخترع أرقاماً أو تفاصيل عن فحوصات، حقن، أدوية، أو خدمات إضافية غير موجودة في البيانات المرفقة
- إذا لم تكن المعلومات موجودة في "معلومات الطبيب الشخصية" المرفقة، قل "المعلومات غير متاحة" أو "لا توجد بيانات متاحة"
- لا تستخدم أمثلة عامة أو بيانات من مستخدمين آخرين أو مصادر خارجية`.trim();

    // Financial analysis for financial agent (English)
    let financialSummaryEn = '';
    if (apptsRaw.length > 0) {
      try {
        const { analyzeFinancialData, formatFinancialSummary } = await import('@/lib/agents/financialAgent');
        const financialAnalysis = analyzeFinancialData(
          doctorClinics, 
          apptsRaw, 
          reports, 
          'en',
          { checkupPrice, followUpPrice, extraServices } // Pass all financial data
        );
        financialSummaryEn = formatFinancialSummary(financialAnalysis, 'en', { checkupPrice, followUpPrice, extraServices });
      } catch (e) {
        console.warn('Financial analysis failed:', e.message);
      }
    }
    
    // Build doctor profile information (English) from Firebase data ONLY
    const qualificationsEn = doctorData.qualifications_en || doctorData.qualifications_ar || '';
    const universityEn = doctorData.university_en || doctorData.university_ar || '';
    const bioEn = doctorData.bio_en || doctorData.bio_ar || '';
    const subspecialtiesEn = subspecialties.map(s => {
      if (typeof s === 'string') return s;
      return s.name_en || s.name_ar || s.name || '';
    }).filter(Boolean);
    
    const doctorProfileInfoEn = [];
    // Always include specialty from Firebase (even if empty, to show it was checked)
    doctorProfileInfoEn.push(`• Specialty: ${doctorSpecialty || 'Not specified'}`);
    if (subspecialtiesEn.length > 0) doctorProfileInfoEn.push(`• Subspecialties: ${subspecialtiesEn.join(', ')}`);
    if (qualificationsEn) doctorProfileInfoEn.push(`• Qualifications: ${qualificationsEn}`);
    if (universityEn) doctorProfileInfoEn.push(`• University: ${universityEn}`);
    if (graduationYear) doctorProfileInfoEn.push(`• Graduation Year: ${graduationYear}`);
    if (experienceYears) doctorProfileInfoEn.push(`• Years of Experience: ${experienceYears}`);
    if (bioEn) doctorProfileInfoEn.push(`• Bio: ${trimTo(bioEn, 200)}`);
    
    // If no profile info available, add a note
    if (doctorProfileInfoEn.length === 1 && !doctorSpecialty) {
      doctorProfileInfoEn.push('• Note: No personal information available in database');
    }
    
    const bodyEn = `
Doctor context (private — for reasoning and inference only):
• Physician: ${doctorName}

Doctor Profile Information (from Firebase ONLY - use this data only):
${doctorProfileInfoEn.length > 0 ? doctorProfileInfoEn.join('\n') : '• No information available in database'}
• Total patients: ${patients.length}${patientSamples.length ? `\n  Patient samples:\n  ${patientSamples.slice(0, 5).join('\n  ')}` : ''}
• Clinical reports: ${reports.length}
• Upcoming appointments (next 14 days): ${apptsRaw.length}

Active clinics:
${clinicInfo}

${financialSummaryEn ? `Financial Data:\n${financialSummaryEn}\n` : ''}

Recent clinical reports (for inferring diagnostic and treatment patterns):
${reportLines.join('\n') || '—'}

Upcoming appointments:
${appts.join('\n') || '—'}

Very important notes for AI (MUST FOLLOW):
- This data is specific to THIS doctor only - Do not use data from another doctor or clinic
- STRICTLY FORBIDDEN - Do not infer from external sources: When answering questions about the doctor's personal information (specialty, qualifications, university, bio, years of experience), use ONLY data from "Doctor Profile Information" attached above from Firebase. It is FORBIDDEN to infer from research studies, reports, or any other sources.
- If the doctor asks about their specialty: Use ONLY the specialty mentioned in "Doctor Profile Information" above. Do not infer from reports or studies.
- If the doctor asks about their qualifications: Use ONLY the qualifications mentioned in "Doctor Profile Information" above. Do not invent or infer.
- Use this data as reference to understand the doctor's context, specialty, and work patterns - ONLY from attached data from Firebase
- When suggesting diagnosis or treatment, reference similar past reports - ONLY from attached reports
- Consider the doctor's specialty from "Doctor Profile Information" above when providing suggestions
- Use clinic information when referring to appointments or services - ONLY from attached clinics
- For financial questions: Use ONLY the attached financial data to calculate revenues and profits
- STRICTLY FORBIDDEN: Do not invent numbers or details about tests, injections, medications, or additional services not present in the attached data
- If information is not present in the attached data, say "Information not available" or "No data available"
- Do not use general examples or data from other users`.trim();

    return `${header}\n\n${isAr ? bodyAr : bodyEn}`;
  } catch {
    return ''; // fail soft: context is optional
  }
}

// ====== Lightweight RAG via your /api/rg/search (optional) ======
async function fetchCitations(req, query, idToken, { limit = 6, timeoutMs = 4000 } = {}) {
  try {
    if (!query) return [];
    const base = getBaseUrl(req);
    const url = `${base}/api/rg/search?q=${encodeURIComponent(query)}`;
    
    // Use absolute URL for internal API calls from Edge Runtime
    // Pass the ID token for authentication
    const r = await timeout(
      fetch(url, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
      }), 
      timeoutMs, 
      'RAG search timeout'
    );
    
    if (!r.ok) {
      // Log error but don't fail the entire request
      console.warn(`RAG search failed: ${r.status} ${r.statusText}`);
      return [];
    }
    
    const j = await r.json().catch((e) => {
      console.warn('RAG search JSON parse error:', e);
      return {};
    });
    
    // Normalize Qdrant search response shape
    // Qdrant returns: { result: [ { score, payload: {...} } ] }
    const raw = j?.result || j?.matches?.result || j?.matches || [];
    const items = (Array.isArray(raw) ? raw : []).map(it => {
      // Handle both { payload: {...} } and direct payload
      return it?.payload || it;
    });
    
    const dedup = [];
    const seen = new Set();
    for (const x of items) {
      const key = x?.url || x?.title || JSON.stringify(x).slice(0,128);
      if (!seen.has(key)) { 
        seen.add(key); 
        dedup.push(x); 
      }
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
  } catch (e) {
    // Fail silently - RAG is optional
    console.warn('RAG search error:', e?.message || e);
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

      // RAG controls
      enable_rag = true,            // turn on/off citation fetch
      rag_query,                    // optional override for search query
      rag_limit = 6,                // how many citations to include
      rag_timeout_ms = 4000,        // timeout for search

      system_extras = [],
      instructions = [],

      // NEW: if false, we won't include any server/doctor-wide context
      use_server_context = true,
    } = body || {};

    // ===== Translation branch =====
    if (mode === 'translate_ar_to_en') {
      const bio_ar = String(items?.bio_ar || '');
      const qualifications_ar = String(items?.qualifications_ar || '');
      const university_ar = String(items?.university_ar || '');
      const specialty_ar = String(items?.specialty_ar || '');
      const subs_ar = Array.isArray(items?.subspecialties_ar)
        ? items.subspecialties_ar.filter(Boolean).map(String)
        : [];

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
    const serverCtx = use_server_context
      ? await buildDoctorContextFromFirestore({ uid: user.uid, idToken, lang })
      : '';

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

    // ===== AI Agent Routing =====
    const { getAgentForQuery } = await import('@/lib/agents/agentRouter');
    const agent = getAgentForQuery(userTextCore, lang);
    
    // ===== Optional RAG (citations) =====
    // Enhance RAG query with doctor's specialty for better context
    let citations = [];
    let medicalSources = [];
    
    if (enable_rag) {
      let ragQuery = String(rag_query || userTextCore).slice(0, 500);
      
      // If we have doctor context, enhance the query with specialty
      if (serverCtx) {
        const specialtyMatch = serverCtx.match(/التخصص:\s*([^\n]+)|Specialty:\s*([^\n]+)/i);
        if (specialtyMatch) {
          const specialty = specialtyMatch[1] || specialtyMatch[2];
          if (specialty && specialty.trim()) {
            // Enhance query with specialty context
            ragQuery = `${ragQuery} ${specialty.trim()}`;
          }
        }
      }
      
      // Fetch local RAG citations (doctor's own data)
      citations = await fetchCitations(req, ragQuery, idToken, { limit: Math.max(1, Math.min(10, rag_limit)), timeoutMs: rag_timeout_ms });
      
      // If medical agent, ALWAYS fetch from trusted medical sources for better accuracy
      if (agent.type === 'medical') {
        try {
          const { fetchMedicalSources } = await import('@/lib/agents/medicalAgent');
          // Use longer timeout (8 seconds) and don't add extra race condition
          // The timeout is already handled inside fetchMedicalSources
          medicalSources = await Promise.race([
            fetchMedicalSources(ragQuery, { maxPerSource: 5, timeoutMs: 8000 }),
            new Promise((resolve) => setTimeout(() => resolve([]), 10000)), // 10 seconds total fallback
          ]);
        } catch (e) {
          console.warn('Medical sources fetch failed:', e.message);
        }
      }
    }

    // ===== Agent-specific system prompts =====
    let agentSystemPrompt = '';
    if (agent.type === 'medical') {
      const { getMedicalAgentSystemPrompt } = await import('@/lib/agents/medicalAgent');
      agentSystemPrompt = getMedicalAgentSystemPrompt(lang);
    } else if (agent.type === 'financial') {
      const { getFinancialAgentSystemPrompt } = await import('@/lib/agents/financialAgent');
      agentSystemPrompt = getFinancialAgentSystemPrompt(lang);
    }
    
    // Add focus instruction to all agents
    const focusInstruction = isArabic
      ? '\n\nمهم جداً: أجب مباشرة على السؤال المطروح. لا تخرج عن الموضوع. كن مباشراً ومختصراً. ركز على الإجابة على السؤال فقط.'
      : '\n\nVery important: Answer the question directly. Do not go off-topic. Be direct and brief. Focus only on answering the question.';
    
    if (agentSystemPrompt) {
      agentSystemPrompt += focusInstruction;
    }
    
    // Final system/context
    const baseSystem = agentSystemPrompt || serverCtx ||
      (isArabic
        ? 'أنت شافي AI، مساعد سريري للأطباء في مصر. جميع العيادات والمرضى والأطباء في مصر. استخدم المصطلحات الطبية الشائعة في مصر وراعِ النظام الصحي المصري. التزم بالسرية، لا تُنشئ معلومات، وقدّم إجابات عملية موجزة. ممنوع تماماً: لا تخترع أو تتخيل أي معلومات غير موجودة في البيانات المرفقة. استخدم فقط البيانات المتاحة. إذا لم تكن المعلومات متاحة، قل "المعلومات غير متاحة" بدلاً من اختراعها. مهم جداً: يجب أن تكون إجابتك بحد أقصى 300 كلمة. كن مباشراً ومختصراً.'
        : 'You are Shafy AI, a clinical assistant for physicians in Egypt. All clinics, patients, and doctors are in Egypt. Use medical terminology common in Egypt and consider the Egyptian healthcare system. Maintain confidentiality, do not fabricate facts, and provide concise, practical answers. STRICTLY FORBIDDEN: Do not invent, fabricate, or hallucinate any information not present in the attached data. Use only available data. If information is not available, say "Information not available" instead of making it up. Very important: Your response must be maximum 300 words. Be direct and brief.');

    const clientCtxLabel = isArabic ? 'سياق إضافي من الواجهة (خاص):' : 'Additional client context (private):';
    const citationsLabel = isArabic ? 'مصادر موثوقة من بياناتك (للاستدلال):' : 'Trusted sources from your data (for grounding):';
    const medicalSourcesLabel = isArabic ? 'مصادر طبية موثوقة من الإنترنت:' : 'Trusted medical sources from internet:';

    const citationsBlock = citations.length
      ? `${citationsLabel}\n` + citations.map((c, i) =>
          `- [${i + 1}] ${c.title || c.source || 'Source'} — ${c.url}${c.date ? ` (${c.date})` : ''}`
        ).join('\n')
      : '';

    const medicalSourcesBlock = medicalSources.length
      ? `${medicalSourcesLabel}\n` + medicalSources.map((s, i) => {
          const title = s.title || s.source || 'Source';
          const source = s.source || 'Medical Source';
          const url = s.url || '';
          const date = s.date ? ` (${s.date})` : '';
          const summary = s.summary ? `\n  ${isArabic ? 'ملخص' : 'Summary'}: ${trimTo(s.summary, 200)}` : '';
          return `[${i + 1}] ${title} (${source})${date}${url ? `\n  ${isArabic ? 'رابط' : 'Link'}: ${url}` : ''}${summary}`;
        }).join('\n\n') + `\n\n${isArabic ? 'استخدم هذه المصادر الموثوقة لدعم إجابتك. اذكر المصدر عند استخدام معلومات منه. ركز على المعلومات الأكثر صلة بالسؤال.' : 'Use these trusted sources to support your answer. Cite the source when using information from it. Focus on information most relevant to the question.'}`
      : '';

    // Enhanced instructions for using doctor's data
    const ragInstructions = isArabic
      ? `تعليمات استخدام البيانات (صارمة جداً):
- ممنوع تماماً - لا تستنتج من مصادر خارجية: عند الإجابة على أسئلة حول معلومات الطبيب الشخصية (التخصص، المؤهلات، الجامعة، إلخ)، استخدم فقط البيانات من "معلومات الطبيب الشخصية" المرفقة من Firebase. ممنوع الاستنتاج من الدراسات البحثية أو التقارير أو أي مصادر أخرى.
- استخدم فقط سياق الطبيب المرفق أدناه (التخصص من "معلومات الطبيب الشخصية"، التقارير السابقة، أنماط العلاج) - لا تستخدم بيانات من طبيب آخر
- عند الاقتراح على تشخيص أو علاج، قارن مع الحالات المشابهة في التقارير السابقة المرفقة فقط
- استخدم معلومات العيادات المرفقة فقط عند الإشارة إلى المواعيد أو الخدمات
- للأسئلة المالية: استخدم فقط "البيانات المالية" المرفقة. لا تخترع تفاصيل عن فحوصات، حقن، أدوية، أو خدمات إضافية غير موجودة في البيانات المرفقة
- للمعلومات الطبية العامة: يمكنك استخدام المصادر الخارجية (المراجع العلمية) لدعم إجاباتك الطبية العامة، لكن لا تستخدمها للإجابة على أسئلة حول معلومات الطبيب الشخصية
- استخدم المصادر الطبية الموثوقة المرفقة لدعم إجاباتك الطبية العامة فقط
- تذكر: إذا لم تكن المعلومات موجودة في "معلومات الطبيب الشخصية" أو "البيانات المالية" المرفقة، قل "المعلومات غير متاحة" بدلاً من اختراعها أو الاستنتاج`
      : `Data usage instructions (VERY STRICT):
- STRICTLY FORBIDDEN - Do not infer from external sources: When answering questions about the doctor's personal information (specialty, qualifications, university, etc.), use ONLY data from "Doctor Profile Information" attached from Firebase. It is FORBIDDEN to infer from research studies, reports, or any other sources.
- Use ONLY the doctor's context attached below (specialty from "Doctor Profile Information", past reports, treatment patterns) - Do not use data from another doctor
- When suggesting diagnosis or treatment, compare with similar cases in attached past reports ONLY
- Use attached clinic information ONLY when referring to appointments or services
- For financial questions: Use ONLY the attached "Financial Data". Do not invent details about tests, injections, medications, or additional services not present in the attached data
- For general medical information: You can use external sources (scientific references) to support your general medical answers, but do not use them to answer questions about the doctor's personal information
- Use the attached trusted medical sources to support your general medical answers only
- Remember: If information is not present in the attached "Doctor Profile Information" or "Financial Data", say "Information not available" instead of making it up or inferring`;

    // Add focus instruction at the end
    const finalFocusInstruction = isArabic
      ? 'تذكر: أجب مباشرة على السؤال المطروح. لا تخرج عن الموضوع. استخدم فقط البيانات المرفقة. إذا لم تكن المعلومات متاحة، قل "المعلومات غير متاحة".'
      : 'Remember: Answer the question directly. Do not go off-topic. Use only attached data. If information is not available, say "Information not available".';
    
    const systemParts = [baseSystem];
    if (serverCtx && !agentSystemPrompt) systemParts.push(serverCtx);
    if (doctorContext) systemParts.push(`${clientCtxLabel}\n${trimTo(String(doctorContext || ''))}`);
    if (citationsBlock) systemParts.push(citationsBlock);
    if (medicalSourcesBlock) systemParts.push(medicalSourcesBlock);
    if (serverCtx && enable_rag) systemParts.push(ragInstructions);
    if (Array.isArray(system_extras) && system_extras.length) {
      systemParts.push(system_extras.join('\n'));
    }
    systemParts.push(finalFocusInstruction);
    const system = systemParts.join('\n\n');

    const resp = await fanarChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userTextWithOcr },
      ],
      { max_tokens: 450, temperature: typeof temperature === 'number' ? temperature : 0.2 }
    );

    if (!resp.ok) {
      return json({
        error: resp.data?.error?.message || resp.data?.message || 'Fanar request failed',
        upstream: resp.data,
      }, resp.status || 502);
    }

    const output = resp.data?.choices?.[0]?.message?.content ?? '';
    const textOut = output || (isArabic ? 'لم أستطع توليد رد.' : 'Could not generate a response.');

    // Combine all citations (local + medical sources)
    const allCitations = [
      ...citations,
      ...medicalSources.map(s => ({
        title: s.title,
        url: s.url,
        source: s.source,
        date: s.date,
        tags: s.tags,
      })),
    ];

    return json({
      ok: true,
      model: MODEL_CHAT,
      text: textOut,
      tts_status: 'disabled',
      stt_status: 'disabled',
      citations: allCitations, // array of {title,url,source,date,tags}
      agent: agent.type, // 'medical' | 'financial' | 'general'
    });
  } catch (e) {
    const status = e?.status || 500;
    return json({ error: e?.message || 'Server error' }, status);
  }
}
