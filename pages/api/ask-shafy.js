// /pages/api/ask-shafy.js
// Shafy API — Chat + Translation (Fanar). STT & TTS are disabled.
// Secure: verifies Firebase ID token and fetches doctor-owned context from Firestore.
// Robust admin init with multiple credential strategies and dev fallback.
// Includes Firestore composite-index fallback (for reports: where(doctorUID)==uid + orderBy(date, desc)).
//
// ENV (required for prod):
//   FANAR_API_KEY=...               Fanar API key
// Optional:
//   FANAR_ORG=...
//   FIREBASE_SERVICE_ACCOUNT=...    // JSON string of service account (can be base64-encoded)
//   FIREBASE_PROJECT_ID=...
//   FIREBASE_CLIENT_EMAIL=...
//   FIREBASE_PRIVATE_KEY=...        // with \n escaped
//   ALLOW_UNAUTH_DEV=true           // (DEV ONLY) allow x-dev-uid header when admin auth unavailable

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const FANAR_BASE = "https://api.fanar.qa/v1";
const MODEL_CHAT = "Fanar";
const FANAR_ORG = (process.env.FANAR_ORG || "").trim();

/** ---------- Fanar helpers ---------- */
function getFanarKey() {
  const key = (process.env.FANAR_API_KEY || "").trim();
  if (!key) throw new Error("Missing FANAR_API_KEY in environment");
  return key;
}
function commonAuthHeaders(extra = {}) {
  const h = { Authorization: `Bearer ${getFanarKey()}`, ...extra };
  if (FANAR_ORG) h["X-Organization"] = FANAR_ORG;
  return h;
}
function trimTo(str, max = 8000) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max) + "\n...[truncated]...";
}
async function postJson(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: commonAuthHeaders({ "Content-Type": "application/json", ...headers }),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
async function fanarChat(messages, { max_tokens = 900, temperature = 0.2, response_format } = {}) {
  const body = { model: MODEL_CHAT, messages, max_tokens, temperature };
  if (response_format) body.response_format = response_format;
  return await postJson(`${FANAR_BASE}/chat/completions`, body);
}

/** ---------- Firebase Admin init (robust) ---------- */
let _adminBundle = undefined;

function parseServiceAccount(raw) {
  if (!raw) return null;
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s);
      if (obj?.private_key?.includes("\\n")) obj.private_key = obj.private_key.replace(/\\n/g, "\n");
      return obj;
    } catch {
      return null;
    }
  };
  return tryParse(raw) || tryParse(Buffer.from(raw, "base64").toString("utf8"));
}

function getAdminBundle() {
  if (_adminBundle !== undefined) return _adminBundle;
  try {
    const admin = require("firebase-admin");

    // Build a credential (several strategies)
    let credential = null;

    // Strategy A: full JSON (raw or base64) in FIREBASE_SERVICE_ACCOUNT
    const svcJson = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT || "");
    if (svcJson) {
      credential = admin.credential.cert(svcJson);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      // Strategy B: split vars
      const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: pk,
      });
    } else {
      // Strategy C: ADC
      try {
        credential = admin.credential.applicationDefault();
      } catch {
        // ignore; may still initialize without explicit credential (local dev)
      }
    }

    if (!admin.apps.length) {
      if (credential) admin.initializeApp({ credential });
      else admin.initializeApp(); // ADC or will fail when used if truly unavailable
    }

    _adminBundle = {
      admin,
      firestore: admin.firestore(),
    };
  } catch (e) {
    console.warn("[Shafy] firebase-admin init failed:", e?.message || e);
    _adminBundle = null; // signal unavailable
  }
  return _adminBundle;
}

const adminBundle = getAdminBundle();
const admin = adminBundle?.admin || null;
const firestore = adminBundle?.firestore || null;

/** ---------- Auth & Firestore helpers ---------- */
async function verifyIdToken(req) {
  if (admin && admin.app) {
    // Normal path (prod)
    const authz = req.headers.authorization || "";
    const m = authz.match(/^Bearer (.+)$/i);
    if (!m) {
      const e = new Error("Missing Authorization Bearer token");
      e.status = 401;
      throw e;
    }
    try {
      const decoded = await admin.auth().verifyIdToken(m[1]);
      return {
        uid: decoded.uid,
        name: decoded.name || "",
        email: decoded.email || "",
      };
    } catch {
      const e = new Error("Invalid or expired token");
      e.status = 401;
      throw e;
    }
  }

  // Dev fallback when admin isn’t available
  if (String(process.env.ALLOW_UNAUTH_DEV || "").toLowerCase() === "true") {
    const devUid = (req.headers["x-dev-uid"] || "dev-uid").toString();
    console.warn("[Shafy] DEV MODE auth fallback — DO NOT USE IN PROD. uid:", devUid);
    return { uid: devUid, name: "Dev Doctor", email: "dev@example.com", _dev: true };
  }

  const e = new Error("Auth not available on server");
  e.status = 500;
  throw e;
}

function fmtDT(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}
function asDate(v) {
  if (!v) return null;
  if (v?.toDate) try { return v.toDate(); } catch {}
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Build a compact, private doctor context from Firestore (with index fallback) */
async function buildDoctorContextFromFirestore({ uid, lang = "ar" }) {
  if (!firestore) return ""; // no admin available (dev without DB access)

  const isAr = lang === "ar";
  const doctorSnap = await firestore.collection("doctors").doc(uid).get();
  const doctorDoc = doctorSnap.exists ? doctorSnap.data() : null;
  const dName =
    (isAr ? doctorDoc?.name_ar : doctorDoc?.name_en) ||
    doctorDoc?.name ||
    (isAr ? "الطبيب" : "Doctor");

  // Patients + Appointments can fetch in parallel
  const [patientsSnap, appt1Snap, appt2Snap] = await Promise.all([
    firestore.collection("patients").where("registeredBy", "==", uid).limit(500).get(),
    firestore.collection("appointments").where("doctorUID", "==", uid).limit(200).get(),
    firestore.collection("appointments").where("doctorId", "==", uid).limit(200).get(),
  ]);

  // Reports: try indexed query first; fallback if composite index is missing
  let reportsDocs;
  try {
    const snap = await firestore
      .collection("reports")
      .where("doctorUID", "==", uid)
      .orderBy("date", "desc")
      .limit(40)
      .get();
    reportsDocs = snap.docs;
  } catch (err) {
    const msg = String(err?.message || "");
    if (err?.code === 9 || /requires an index/i.test(msg)) {
      // Fallback: fetch more, sort locally, slice
      const snap = await firestore
        .collection("reports")
        .where("doctorUID", "==", uid)
        .limit(200)
        .get();
      reportsDocs = snap.docs
        .sort((a, b) => (asDate(b.data().date)?.getTime() || 0) - (asDate(a.data().date)?.getTime() || 0))
        .slice(0, 40);
    } else {
      throw err;
    }
  }

  const patients = patientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const reports = reportsDocs.map((d) => ({ id: d.id, ...d.data() }));
  const apptsRaw = [
    ...appt1Snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...appt2Snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  ];

  const now = Date.now();
  const in14d = now + 14 * 24 * 60 * 60 * 1000;
  const appts = apptsRaw
    .map((a) => ({ ...a, _dt: asDate(a.appointmentDate || a.date) }))
    .filter((a) => {
      const t = a._dt?.getTime?.() || 0;
      return t >= now - 24 * 60 * 60 * 1000 && t <= in14d;
    })
    .sort((a, b) => (a._dt?.getTime() || 0) - (b._dt?.getTime() || 0))
    .slice(0, 20)
    .map((a) => {
      const dt = fmtDT(a._dt);
      const who = a.patientName || a.patientID || "—";
      const status = String(a.status || "pending");
      return `- ${dt} — ${who} — ${isAr ? "الحالة" : "status"}: ${status}`;
    });

  const patientSamples = patients.slice(0, 8).map((p) => p.name || p.id).filter(Boolean);
  const reportLines = reports.slice(0, 20).map((r) => {
    const dt = fmtDT(asDate(r.date));
    const who = r.patientName || r.patientID || "—";
    const title =
      r.titleAr || r.titleEn || r.title ||
      (r.type === "lab" ? (isAr ? "تقرير معملي" : "Lab report") : (isAr ? "تقرير سريري" : "Clinical report"));
    const extra = r.diagnosis ? ` • ${r.diagnosis}` : "";
    return `- ${dt} — ${who} — ${title}${extra}`;
  });

  const headerAr = `
أنت "شافي AI" — مساعد سريري ذكي يعمل مع الأطباء فقط.
قواعد أساسية:
• السرية أولاً: لا تكشف أي بيانات مرضى خارج هذا السياق. لا تتخيل معلومات.
• الدقة والإيجاز: قدم إجابات عملية، مع خطوات واضحة وخيارات علاجية عامة وليست وصفات دوائية شخصية.
• الاستناد إلى الدليل: عند ذكر حقائق طبية، اذكر الدليل بإيجاز (إرشادات/دراسة واسم الجهة/السنة) إن توفر؛ واذكر رابطًا عامًا إن وجد.
• ليست بديلاً للتشخيص: القرار العلاجي النهائي للطبيب وبحسب حالة المريض.
• اللغة: جاوب بلغة المستخدم.
`.trim();

  const headerEn = `
You are "Shafy AI" — an intelligent clinical assistant for physicians.
Core rules:
• Confidentiality first: never reveal patient data beyond this context; do not fabricate facts.
• Precise & concise: provide practical, stepwise guidance and general treatment options (no personalized prescriptions).
• Evidence-based: when stating medical facts, briefly cite the source (guideline/study, org/year) and include a public link if available.
• Not a substitute for clinical judgment: final decisions rest with the treating physician and patient specifics.
• Language: respond in the user’s language.
`.trim();

  const header = isAr ? headerAr : headerEn;

  const bodyAr = `
سياق الطبيب (خاص وسري — للاستخدام في الاستنتاج فقط):
• اسم الطبيب: ${dName}
• عدد المرضى: ${patients.length}${patientSamples.length ? ` — أمثلة: ${patientSamples.join(", ")}` : ""}
• عدد التقارير: ${reports.length}
• المواعيد القادمة (حتى ١٤ يوماً): ${apptsRaw.length}

أحدث التقارير:
${reportLines.join("\n") || "—"}

المواعيد القادمة:
${appts.join("\n") || "—"}
`.trim();

  const bodyEn = `
Doctor context (private — for reasoning only):
• Physician: ${dName}
• Patients: ${patients.length}${patientSamples.length ? ` — samples: ${patientSamples.join(", ")}` : ""}
• Reports: ${reports.length}
• Upcoming appointments (next 14 days): ${apptsRaw.length}

Recent reports:
${reportLines.join("\n") || "—"}

Upcoming appointments:
${appts.join("\n") || "—"}
`.trim();

  return `${header}\n\n${isAr ? bodyAr : bodyEn}`;
}

/** ---------- JSON parsing helper for LLM outputs ---------- */
function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}

/** ---------- API handler ---------- */
export default async function handler(req, res) {
  const TREQ = Date.now();
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/ask-shafy" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Verify user (Firebase ID token or dev fallback)
    const user = await verifyIdToken(req);

    // Ensure Fanar key exists
    getFanarKey();

    const {
      mode,                 // "translate_ar_to_en" | undefined
      message,
      // eslint-disable-next-line no-unused-vars
      images = [],          // reserved for future use
      ocrTexts = [],
      doctorContext = "",
      lang = "ar",

      // For translation mode:
      items,
      response_format,      // optional passthrough if upstream supports structured output
      temperature,
      system_extras = [],
      instructions = [],
    } = req.body || {};

    /** ===== Branch: Translation (Arabic -> English) ===== */
    if (mode === "translate_ar_to_en") {
      // Expect: items = { bio_ar, qualifications_ar, university_ar, specialty_ar, subspecialties_ar: string[] }
      const bio_ar = String(items?.bio_ar || "");
      const qualifications_ar = String(items?.qualifications_ar || "");
      const university_ar = String(items?.university_ar || "");
      const specialty_ar = String(items?.specialty_ar || "");
      const subs_ar = Array.isArray(items?.subspecialties_ar) ? items.subspecialties_ar.filter(Boolean).map(String) : [];

      const sys = [
        "You are a professional bilingual (Arabic→English) medical translator.",
        "Translate the following Arabic profile fields into concise, professional English suitable for a physician profile in Egypt.",
        "Output ONLY valid JSON with this exact schema and keys:",
        `{"bio_en": string, "qualifications_en": string, "university_en": string, "specialty_en": string, "subspecialties_en": string[]}`,
        "Preserve the original order of subspecialties. Avoid transliteration unless medically standard (e.g., 'GERD', 'ECG'). Do not add commentary or code fences.",
        ...system_extras,
        ...(Array.isArray(instructions) ? instructions : []),
      ].join("\n");

      const usr = [
        "FIELDS (Arabic):",
        `bio_ar: ${bio_ar || "-"}`,
        `qualifications_ar: ${qualifications_ar || "-"}`,
        `university_ar: ${university_ar || "-"}`,
        `specialty_ar: ${specialty_ar || "-"}`,
        "subspecialties_ar:",
        ...(subs_ar.length ? subs_ar.map((s, i) => `- ${i + 1}. ${s}`) : ["- (none)"]),
      ].join("\n");

      const messages = [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ];

      const resp = await fanarChat(messages, {
        max_tokens: 500,
        temperature: typeof temperature === "number" ? temperature : 0.1,
        response_format,
      });

      if (!resp.ok) {
        return res.status(resp.status || 502).json({
          error: resp.data?.error?.message || resp.data?.message || "Fanar request failed",
          upstream: resp.data,
        });
      }

      const raw = resp.data?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(raw);

      if (!parsed || typeof parsed !== "object") {
        return res.status(502).json({
          error: "Translator returned non-JSON or invalid JSON.",
          output: raw,
        });
      }

      const translations = {
        bio_en: String(parsed.bio_en || "").trim(),
        qualifications_en: String(parsed.qualifications_en || "").trim(),
        university_en: String(parsed.university_en || "").trim(),
        specialty_en: String(parsed.specialty_en || "").trim(),
        subspecialties_en: Array.isArray(parsed.subspecialties_en)
          ? parsed.subspecialties_en.map((s) => String(s || "").trim())
          : [],
      };

      return res.status(200).json({ ok: true, translations });
    }

    /** ===== Default branch: Chat ===== */
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    // Build PRIVATE context from Firestore for this uid (may be empty in dev fallback)
    const serverCtx = await buildDoctorContextFromFirestore({ uid: user.uid, lang });
    const isArabic = lang === "ar";

    // OCR hints (optional)
    const ocrHeader = isArabic ? "نصوص OCR المرفقة:" : "Attached OCR extracts:";
    const ocrCombined = trimTo(
      (Array.isArray(ocrTexts) ? ocrTexts : [])
        .filter(Boolean)
        .map((t, i) => `[#${i + 1}] ${String(t).trim()}`)
        .join("\n\n"),
      6000
    );

    const userTextCore = trimTo(String(message || ""), 6000);
    const userTextWithOcr = ocrCombined
      ? `${userTextCore}\n\n${ocrHeader}\n${ocrCombined}`
      : userTextCore;

    // Final system/context
    const baseSystem = serverCtx || (
      isArabic
        ? `أنت شافي AI، مساعد سريري للأطباء. التزم بالسرية، لا تتخيل معلومات، واذكر الدليل بإيجاز عند ذكر حقائق طبية.`
        : `You are Shafy AI, a clinical assistant for physicians. Maintain confidentiality, do not fabricate facts, and provide brief evidence when stating medical facts.`
    );

    const clientCtxLabel = isArabic
      ? "سياق إضافي من الواجهة (خاص):"
      : "Additional client context (private):";
    const system = [
      baseSystem,
      ...(doctorContext ? [`${clientCtxLabel}\n${trimTo(String(doctorContext || ""))}`] : []),
    ].join("\n\n");

    const baseMessages = [
      { role: "system", content: system },
      { role: "user", content: userTextWithOcr },
    ];

    const tChat0 = Date.now();
    const resp = await fanarChat(baseMessages, { max_tokens: 900, temperature: 0.2 });
    if (!resp.ok) {
      return res.status(resp.status || 502).json({
        error: resp.data?.error?.message || resp.data?.message || "Fanar request failed",
        upstream: resp.data,
      });
    }
    console.log(`[CHAT] completed in ${Date.now() - tChat0} ms`);

    const output = resp.data?.choices?.[0]?.message?.content ?? "";
    const text = output || (isArabic ? "لم أستطع توليد رد." : "Could not generate a response.");

    console.log(`[REQ] total ${Date.now() - TREQ} ms`);
    return res.status(200).json({
      ok: true,
      model: MODEL_CHAT,
      text,
      tts_status: "disabled",
      stt_status: "disabled",
    });
  } catch (e) {
    const status = e?.status || 500;
    console.error("ask-shafy (chat/translate) error:", e);
    return res.status(status).json({ error: e?.message || "Server error" });
  }
}
