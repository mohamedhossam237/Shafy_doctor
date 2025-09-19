// /pages/api/ask-shafy.js
// Shafy API — Chat only (Fanar). STT & TTS are disabled.
// Secure: verifies Firebase ID token and fetches doctor-owned context from Firestore.
// Robust admin init with multiple credential strategies and dev fallback.
//
// ENV (required for prod):
//   FANAR_API_KEY=...               Fanar API key
// Optional:
//   FANAR_ORG=...
//   FIREBASE_SERVICE_ACCOUNT=...    // JSON string of service account
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
async function fanarChat(messages, { max_tokens = 900, temperature = 0.2 } = {}) {
  return await postJson(`${FANAR_BASE}/chat/completions`, {
    model: MODEL_CHAT,
    messages,
    max_tokens,
    temperature,
  });
}

/** ---------- Firebase Admin init (robust) ---------- */
let _adminBundle = undefined;
function getAdminBundle() {
  if (_adminBundle !== undefined) return _adminBundle;
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      let credential = null;

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Prefer full JSON string
        const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (json.private_key?.includes("\\n")) {
          json.private_key = json.private_key.replace(/\\n/g, "\n");
        }
        credential = admin.credential.cert(json);
      } else if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        // Or 3 separate env vars
        const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pk,
        });
      } else {
        // Fall back to ADC (gcloud / Cloud Run / local ADC)
        credential = admin.credential.applicationDefault();
      }

      admin.initializeApp({ credential });
    }

    _adminBundle = {
      admin: require("firebase-admin"),
      firestore: require("firebase-admin").firestore(),
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
    } catch (err) {
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
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch { return ""; }
}
function asDate(v) {
  if (!v) return null;
  if (v?.toDate) try { return v.toDate(); } catch {}
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function buildDoctorContextFromFirestore({ uid, lang = "ar" }) {
  if (!firestore) return ""; // no admin available (dev without DB access)

  const isAr = lang === "ar";
  const doctorSnap = await firestore.collection("doctors").doc(uid).get();
  const doctorDoc = doctorSnap.exists ? doctorSnap.data() : null;
  const dName =
    (isAr ? doctorDoc?.name_ar : doctorDoc?.name_en) ||
    doctorDoc?.name ||
    (isAr ? "الطبيب" : "Doctor");

  const [patientsSnap, reportsSnap, appt1Snap, appt2Snap] = await Promise.all([
    firestore.collection("patients").where("registeredBy", "==", uid).limit(500).get(),
    firestore.collection("reports").where("doctorUID", "==", uid).orderBy("date", "desc").limit(40).get(),
    firestore.collection("appointments").where("doctorUID", "==", uid).limit(200).get(),
    firestore.collection("appointments").where("doctorId", "==", uid).limit(200).get(),
  ]);

  const patients = patientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const reports = reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      message,
      images = [],
      ocrTexts = [],
      doctorContext = "",
      lang = "ar",
    } = req.body || {};

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

    // Single-pass chat
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

    console.log(`[REQ] total ${(Date.now() - TREQ)} ms`);
    return res.status(200).json({
      ok: true,
      model: MODEL_CHAT,
      text,
      tts_status: "disabled",
      stt_status: "disabled",
    });
  } catch (e) {
    const status = e?.status || 500;
    console.error("ask-shafy (chat-only) error:", e);
    return res.status(status).json({ error: e?.message || "Server error" });
  }
}
