// /pages/api/ask-shafy.js
export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

// DeepSeek OpenAI-compatible REST API
const DS_API = "https://api.deepseek.com";
const TEXT_MODEL   = "deepseek-reasoner";   // text / reasoning
const VISION_MODEL = "deepseek-multimodal"; // images + text

function getDeepseekKey() {
  const key = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (!key) throw new Error("Missing DEEPSEEK_API_KEY in .env.local");
  return key;
}

/** Trim very long strings to keep token use under control */
function trimTo(str, max = 8000) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max) + "\n...[truncated]...";
}

/** Accept only data URLs for Vision (public URLs are fine too, but blob: URLs won't work server-side) */
function pickUsableImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter((u) => {
    if (typeof u !== "string") return false;
    if (u.startsWith("data:image/")) return true; // base64 data URL
    if (u.startsWith("http://") || u.startsWith("https://")) return true; // public URL
    return false; // blob:/filesystem: won't be fetchable by DeepSeek servers
  });
}

/** Simple helper: normalize to array of non-empty strings */
function toStrArray(x) {
  if (!x) return [];
  const arr = Array.isArray(x) ? x : [x];
  return arr.map((s) => String(s || "").trim()).filter(Boolean);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/ask-shafy" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = getDeepseekKey();

    // --------- INPUTS ---------
    const {
      // Existing/common fields
      mode,                         // "translate_ar_to_en" | undefined
      message,                      // user message
      images = [],
      ocrTexts = [],
      doctorContext = "",
      lang = "ar",                  // 'ar' | 'en'

      // NEW: per-call steering
      system,                       // full override for system
      system_extras,                // string | string[] appended to system
      instructions,                 // string | string[] injected as developer message
      messages,                     // OpenAI-style messages[] to inject before the user turn
      response_format,              // "json" | "text"
      temperature,                  // number override
      max_tokens,                   // number override
      tags,                         // string[] appended in system as routing hints

      // Translation payload (for mode=translate_ar_to_en)
      items,
    } = req.body || {};

    // --------- PRESETS / DEFAULTS ---------
    const BASE_SYSTEM_AR =
      "أنت شافي AI، مساعد متعدد اللغات للأطباء. كن موجزًا ودقيقًا وودودًا. احترم خصوصية المرضى وسرية البيانات. لا تقدم تشخيصًا نهائيًا أو وصفة دوائية؛ اعرض معلومات عامة وخيارات للنقاش بين الطبيب والمريض. تجنب نصائح طبية طارئة: في حالات الطوارئ اطلب الاتصال بالطوارئ.";
    const BASE_SYSTEM_EN =
      "You are Shafy AI, a multilingual assistant for doctors. Be concise, accurate, and friendly. Respect patient privacy and confidentiality. Do not provide definitive diagnoses or prescriptions; provide general information and options to discuss between clinician and patient. Avoid emergency advice; in emergencies, advise contacting local emergency services.";

    // If caller provided a system override, use it; else pick base by language:
    const baseSystem = String(system || (lang === "ar" ? BASE_SYSTEM_AR : BASE_SYSTEM_EN));

    // Optional add-ons (short, specific guardrails)
    const sysExtrasArr = toStrArray(system_extras);
    const tagsArr = toStrArray(tags);
    const tagLine = tagsArr.length ? `\n\nTags: ${tagsArr.join(", ")}` : "";

    const finalSystem =
      [baseSystem, ...sysExtrasArr].join("\n\n").trim() + tagLine;

    // Developer instructions (inserted as a message after system, before user)
    const devInstructionsArr = toStrArray(instructions);
    const devMessage =
      devInstructionsArr.length
        ? [{ role: "system", content: devInstructionsArr.join("\n\n") }]
        : [];

    // Optional extra messages (e.g., previous turns, summaries)
    const extraMessages = Array.isArray(messages)
      ? messages.filter(
          (m) => m && typeof m === "object" && typeof m.role === "string" && m.content != null
        )
      : [];

    // OCR bundle (helps even if Vision is not used)
    const ocrHeader = lang === "ar" ? "نصوص OCR المرفقة:" : "Attached OCR extracts:";
    const ocrCombined = trimTo(
      (Array.isArray(ocrTexts) ? ocrTexts : [])
        .filter(Boolean)
        .map((t, i) => `[#${i + 1}] ${String(t).trim()}`)
        .join("\n\n"),
      6000
    );

    // -------------- SPECIAL MODE: TRANSLATION --------------
    if (mode === "translate_ar_to_en") {
      // items: { bio_ar, qualifications_ar, university_ar, specialty_ar, subspecialties_ar:[] }
      if (!items || typeof items !== "object") {
        return res.status(400).json({ error: "items (object) is required for translate_ar_to_en mode" });
      }

      const prompt = `
You are a precise professional translator for medical profiles.
Translate the following Arabic fields into clear, natural English suitable for a doctor's profile UI.
Return ONLY strict JSON with this exact schema and keys:
{
  "bio_en": string,
  "qualifications_en": string,
  "university_en": string,
  "specialty_en": string,
  "subspecialties_en": string[]
}
- Keep it concise and professional.
- Preserve list order for subspecialties.
- If an input is empty, return an empty string.
Arabic input (JSON):
${JSON.stringify(items ?? {}, null, 2)}
`.trim();

      const body = {
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: finalSystem },
          ...devMessage,
          { role: "system", content: "You must return a single valid JSON object. No extra text." },
          ...extraMessages,
          { role: "user", content: prompt },
        ],
        temperature: typeof temperature === "number" ? temperature : 0.1,
        max_tokens: typeof max_tokens === "number" ? max_tokens : 800,
        ...(response_format === "json" ? { response_format: { type: "json_object" } } : {}),
      };

      const r = await fetch(`${DS_API}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getDeepseekKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(r.status).json({
          error:
            data?.error?.message || data?.message || r.statusText || "DeepSeek translation request failed",
          upstream: data,
        });
      }

      // Parse JSON result (works whether content is stringified JSON or object)
      let translations = {};
      try {
        const raw = data?.choices?.[0]?.message?.content ?? "{}";
        translations = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        translations = {};
      }

      const out = {
        bio_en: translations?.bio_en ?? "",
        qualifications_en: translations?.qualifications_en ?? "",
        university_en: translations?.university_en ?? "",
        specialty_en: translations?.specialty_en ?? "",
        subspecialties_en: Array.isArray(translations?.subspecialties_en) ? translations.subspecialties_en : [],
      };

      return res.status(200).json({ ok: true, model: TEXT_MODEL, translations: out });
    }

    // -------------- NORMAL CHAT / VISION --------------
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    // Private doctor context (from client Firebase listeners)
    const ctxHeader = lang === "ar"
      ? "سياق الطبيب (خاص - للاستخدام في الاستنتاج فقط):"
      : "Doctor Context (private — for reasoning only):";
    const ctx = trimTo(String(doctorContext || ""));

    const usableImages = pickUsableImages(images);
    const wantsVision = usableImages.length > 0;

    const baseMessages = [
      { role: "system", content: finalSystem },
      ...(ctx ? [{ role: "system", content: `${ctxHeader}\n${ctx}` }] : []),
      ...devMessage,
      ...extraMessages,
    ];

    const userTextCore = trimTo(String(message || ""), 6000);
    const userTextWithOcr = ocrCombined ? `${userTextCore}\n\n${ocrHeader}\n${ocrCombined}` : userTextCore;

    const userContent = wantsVision
      ? [
          { type: "text", text: userTextWithOcr },
          ...usableImages.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : userTextWithOcr;

    let model = wantsVision ? VISION_MODEL : TEXT_MODEL;
    let body = {
      model,
      messages: [...baseMessages, { role: "user", content: userContent }],
      temperature: typeof temperature === "number" ? temperature : (wantsVision ? 0.7 : 0.2),
      max_tokens: typeof max_tokens === "number" ? max_tokens : 1200,
      ...(response_format === "json" ? { response_format: { type: "json_object" } } : {}),
    };

    let r = await fetch(`${DS_API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // If Vision fails, fall back to text-only with OCR
    if (!r.ok && wantsVision) {
      try {
        const errPayload = await r.json().catch(() => ({}));
        model = TEXT_MODEL;
        body = {
          model,
          messages: [...baseMessages, { role: "user", content: userTextWithOcr }],
          temperature: typeof temperature === "number" ? temperature : 0.2,
          max_tokens: typeof max_tokens === "number" ? max_tokens : 1200,
          ...(response_format === "json" ? { response_format: { type: "json_object" } } : {}),
        };
        r = await fetch(`${DS_API}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!r.ok) {
          const fallbackPayload = await r.json().catch(() => ({}));
          return res.status(r.status).json({
            error:
              fallbackPayload?.error?.message ||
              fallbackPayload?.message ||
              "DeepSeek request failed (text fallback).",
            upstream: { vision: errPayload, text: fallbackPayload },
          });
        }
      } catch {
        return res.status(500).json({ error: "DeepSeek request failed and fallback errored." });
      }
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error:
          data?.error?.message || data?.message || r.statusText || "DeepSeek request failed",
        upstream: data,
      });
    }

    const text =
      data?.choices?.[0]?.message?.content ||
      (lang === "ar" ? "لم أستطع توليد رد." : "Could not generate a response.");

    return res.status(200).json({ ok: true, model, text });
  } catch (e) {
    console.error("ask-shafy error:", e);
    return res.status(e?.status || 500).json({ error: e?.message || "Server error" });
  }
}
