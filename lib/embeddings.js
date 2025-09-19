// /lib/embeddings.js
// Lightweight embeddings helper with optional OpenAI backend.
// Exports: embedPassages(texts: string[]) -> number[][]
//          embedQuery(text: string) -> number[]

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_EMBED_MODEL = (process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small').trim();

/** ---------- DEV fallback (tiny hash embedding, deterministic) ---------- */
function hash32(str) {
  // Simple DJB2-like hash
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return h >>> 0;
}
function miniHashEmbedOne(text, dim = 256) {
  const vec = new Float32Array(dim);
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    const h = hash32(tok);
    const i = h % dim;
    vec[i] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return Array.from(vec);
}
function miniHashEmbed(texts, dim = 256) {
  return texts.map((t) => miniHashEmbedOne(t, dim));
}

/** ---------- OpenAI backend ---------- */
async function openaiEmbed(texts) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: texts,
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`OpenAI embeddings failed (${r.status}): ${body}`);
  }
  const json = await r.json();
  return (json.data || []).map((d) => d.embedding);
}

/** ---------- Public API ---------- */
export async function embedPassages(texts) {
  const arr = Array.isArray(texts) ? texts : [String(texts || '')];
  if (OPENAI_API_KEY) {
    try { return await openaiEmbed(arr); } catch (e) { console.warn('[embeddings] OpenAI failed, using fallback:', e?.message || e); }
  }
  // Dev fallback
  return miniHashEmbed(arr);
}

export async function embedQuery(text) {
  const [vec] = await embedPassages([String(text || '')]);
  return vec;
}
