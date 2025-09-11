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
    // blob: and filesystem: will not be fetchable by DeepSeek servers
    return false;
  });
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

    const {
      message,               // string - user's message
      images = [],           // array of image urls (prefer data: URLs)
      ocrTexts = [],         // array of OCR text extracted on the client
      doctorContext = "",    // client-built private context from Firestore
      lang = "ar",           // 'ar' | 'en'
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    // Base system prompt
    const system =
      lang === "ar"
        ? "أنت شافي AI، مساعد متعدد اللغات للأطباء. كن موجزًا ودقيقًا وودودًا. احترم خصوصية المرضى وسرية البيانات."
        : "You are Shafy AI, a multilingual assistant for doctors. Be concise, accurate, and friendly. Respect patient privacy and confidentiality.";

    // Private doctor context (from client Firebase listeners)
    const ctxHeader =
      lang === "ar"
        ? "سياق الطبيب (خاص - للاستخدام في الاستنتاج فقط):"
        : "Doctor Context (private — for reasoning only):";
    const ctx = trimTo(String(doctorContext || ""));

    // OCR bundle (helps even if Vision is not used)
    const ocrHeader =
      lang === "ar" ? "نصوص OCR المرفقة:" : "Attached OCR extracts:";
    const ocrCombined = trimTo(
      (Array.isArray(ocrTexts) ? ocrTexts : [])
        .filter(Boolean)
        .map((t, i) => `[#${i + 1}] ${String(t).trim()}`)
        .join("\n\n"),
      6000
    );

    // Choose model: only use Vision if images are usable (data: or http/https)
    const usableImages = pickUsableImages(images);
    const wantsVision = usableImages.length > 0;

    const baseMessages = [
      { role: "system", content: system },
      // Provide the private context as another system message so it's always in scope
      ...(ctx
        ? [{ role: "system", content: `${ctxHeader}\n${ctx}` }]
        : []),
    ];

    // Build user content (text or multimodal)
    const userTextCore = trimTo(String(message || ""), 6000);
    const userTextWithOcr =
      ocrCombined
        ? `${userTextCore}\n\n${ocrHeader}\n${ocrCombined}`
        : userTextCore;

    const userContent = wantsVision
      ? [
          { type: "text", text: userTextWithOcr },
          ...usableImages.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : userTextWithOcr;

    // Primary request (Vision if we can)
    let model = wantsVision ? VISION_MODEL : TEXT_MODEL;
    let body = {
      model,
      messages: [...baseMessages, { role: "user", content: userContent }],
      temperature: wantsVision ? 0.7 : 0.2,
      max_tokens: 1200,
    };

    // Send to DeepSeek
    let r = await fetch(`${DS_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // If Vision fails, fall back to text-only with OCR
    if (!r.ok && wantsVision) {
      try {
        const errPayload = await r.json().catch(() => ({}));
        // Fallback to text model using the OCR-augmented prompt
        model = TEXT_MODEL;
        body = {
          model,
          messages: [
            ...baseMessages,
            { role: "user", content: userTextWithOcr },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        };
        r = await fetch(`${DS_API}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
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
        // Hard fail if we can't recover
        return res.status(r.status).json({
          error: "DeepSeek request failed and fallback errored.",
        });
      }
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          r.statusText ||
          "DeepSeek request failed",
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
