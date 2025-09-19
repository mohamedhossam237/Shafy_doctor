// /pages/api/ask-shafy.js
// EDGE-RUNTIME, SMALL BUNDLE — no firebase-admin (avoids 250MB serverless limit)
// Modes: chat | translate_ar_to_en
//
// Auth: verifies Firebase ID token using JOSE + Google Secure Token JWKS (Edge-compatible).
// Fallback: if ALLOW_UNAUTH_DEV=true, accepts requests without strict verification (DEV ONLY).
//
// ENV (required for prod):
//   FANAR_API_KEY=...                // Fanar API key
// Optional:
//   FANAR_ORG=...
//   FIREBASE_PROJECT_ID=...          // For JWT audience/issuer checks
//   ALLOW_UNAUTH_DEV=true            // DEV ONLY

export const config = { runtime: "edge" };

/* ---------------- Fanar helpers ---------------- */
const FANAR_BASE = "https://api.fanar.qa/v1";
const MODEL_CHAT = "Fanar";
const FANAR_ORG = (process.env.FANAR_ORG || "").trim();

function getFanarKey() {
  const key = (process.env.FANAR_API_KEY || "").trim();
  if (!key) throw new Error("Missing FANAR_API_KEY in environment");
  return key;
}
function fanarHeaders(extra = {}) {
  const h = {
    Authorization: `Bearer ${getFanarKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
  if (FANAR_ORG) h["X-Organization"] = FANAR_ORG;
  return h;
}
async function fanarChat(messages, { max_tokens = 900, temperature = 0.2, response_format } = {}) {
  const body = { model: MODEL_CHAT, messages, max_tokens, temperature };
  if (response_format) body.response_format = response_format;
  const r = await fetch(`${FANAR_BASE}/chat/completions`, {
    method: "POST",
    headers: fanarHeaders(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
function trimTo(str, max = 8000) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max) + "\n...[truncated]...";
}
function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ---------------- Auth (Edge-friendly) ---------------- */
const USE_STRICT_AUTH = (process.env.ALLOW_UNAUTH_DEV || "").toLowerCase() !== "true";

async function verifyFirebaseTokenEdge(req) {
  const authz = req.headers.get("authorization") || "";
  const m = authz.match(/^Bearer (.+)$/i);
  if (!m) {
    if (USE_STRICT_AUTH) throw Object.assign(new Error("Missing Authorization Bearer token"), { status: 401 });
    return { uid: "dev-uid", _dev: true };
  }

  const token = m[1].trim();
  const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();

  if (!projectId) {
    if (USE_STRICT_AUTH) throw Object.assign(new Error("FIREBASE_PROJECT_ID missing"), { status: 500 });
    return { uid: "dev-uid", _dev: true, _token: token };
  }

  try {
    // jose is ESM and Edge-compatible
    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    const jwks = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    );
    const issuer = `https://securetoken.google.com/${projectId}`;

    const { payload } = await jwtVerify(token, jwks, { issuer, audience: projectId });

    return {
      uid: payload.user_id || payload.sub,
      name: payload.name || "",
      email: payload.email || "",
      _claims: payload,
    };
  } catch (e) {
    if (USE_STRICT_AUTH) {
      const err = new Error(`Invalid Firebase token: ${e?.message || e}`);
      err.status = 401;
      throw err;
    }
    return { uid: "dev-uid", _dev: true, _token_invalid: true };
  }
}

/* ---------------- JSON extraction (for translate mode) ---------------- */
function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

/* ---------------- Handler (Edge API) ---------------- */
export default async function handler(req) {
  const t0 = Date.now();
  try {
    if (req.method === "GET") {
      return json({ ok: true, route: "/api/ask-shafy", runtime: "edge" });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Auth (Edge)
    const user = await verifyFirebaseTokenEdge(req);

    // Parse body
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const {
      mode,                 // "translate_ar_to_en" | undefined (default: chat)
      message,
      // images = [],       // reserved for future use
      ocrTexts = [],
      doctorContext = "",   // client-provided context (since we keep this route tiny)
      lang = "ar",

      // translation mode:
      items,
      response_format,
      temperature,
      system_extras = [],
      instructions = [],
    } = body || {};

    /* ===== Translation branch (Arabic -> English) ===== */
    if (mode === "translate_ar_to_en") {
      const bio_ar = String(items?.bio_ar || "");
      const qualifications_ar = String(items?.qualifications_ar || "");
      const university_ar = String(items?.university_ar || "");
      const specialty_ar = String(items?.specialty_ar || "");
      const subs_ar = Array.isArray(items?.subspecialties_ar)
        ? items.subspecialties_ar.filter(Boolean).map(String)
        : [];

      const sys = [
        "You are a professional bilingual (Arabic→English) medical translator.",
        "Translate the following Arabic profile fields into concise, professional English suitable for a physician profile in Egypt.",
        "Output ONLY valid JSON with this exact schema and keys:",
        `{"bio_en": string, "qualifications_en": string, "university_en": string, "specialty_en": string, "subspecialties_en": string[]}`,
        "Preserve the original order of subspecialties. Avoid transliteration unless medically standard (e.g., 'GERD', 'ECG'). No extra text or code fences.",
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

      const resp = await fanarChat(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        { max_tokens: 500, temperature: typeof temperature === "number" ? temperature : 0.1, response_format }
      );

      if (!resp.ok) {
        return json({
          error: resp.data?.error?.message || resp.data?.message || "Fanar request failed",
          upstream: resp.data,
        }, resp.status || 502);
      }

      const raw = resp.data?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(raw);
      if (!parsed || typeof parsed !== "object") {
        return json({ error: "Translator returned non-JSON or invalid JSON.", output: raw }, 502);
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

      return json({ ok: true, translations, took_ms: Date.now() - t0 });
    }

    /* ===== Chat branch ===== */
    if (!message || typeof message !== "string") {
      return json({ error: "message is required" }, 400);
    }

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
    const userTextWithOcr = ocrCombined ? `${userTextCore}\n\n${ocrHeader}\n${ocrCombined}` : userTextCore;

    // Final system/context — Firestore context is NOT fetched here (keeps bundle tiny).
    const baseSystem = isArabic
      ? `أنت شافي AI، مساعد سريري للأطباء. التزم بالسرية، لا تتخيل معلومات، واذكر الدليل بإيجاز عند ذكر حقائق طبية.`
      : `You are Shafy AI, a clinical assistant for physicians. Maintain confidentiality, do not fabricate facts, and provide brief evidence when stating medical facts.`;

    const clientCtxLabel = isArabic ? "سياق إضافي من الواجهة (خاص):" : "Additional client context (private):";
    const system = [
      baseSystem,
      ...(doctorContext ? [`${clientCtxLabel}\n${trimTo(String(doctorContext || ""))}`] : []),
    ].join("\n\n");

    const resp = await fanarChat(
      [{ role: "system", content: system }, { role: "user", content: userTextWithOcr }],
      { max_tokens: 900, temperature: typeof temperature === "number" ? temperature : 0.2 }
    );

    if (!resp.ok) {
      return json({
        error: resp.data?.error?.message || resp.data?.message || "Fanar request failed",
        upstream: resp.data,
      }, resp.status || 502);
    }

    const output = resp.data?.choices?.[0]?.message?.content ?? "";
    const text = output || (isArabic ? "لم أستطع توليد رد." : "Could not generate a response.");

    return json({
      ok: true,
      model: MODEL_CHAT,
      text,
      tts_status: "disabled",
      stt_status: "disabled",
      took_ms: Date.now() - t0,
      user_uid: user?.uid || null,
      dev_mode: !!user?._dev,
    });
  } catch (e) {
    const status = e?.status || 500;
    return json({ error: e?.message || "Server error" }, status);
  }
}
