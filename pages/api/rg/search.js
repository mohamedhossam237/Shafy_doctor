// /pages/api/rg/search.js
export default async function handler(req, res) {
  try {
    const q = String(req.query.q || req.body?.q || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Missing q' });

    const { embedQuery } = await import('@/lib/embeddings');

    const vector = await embedQuery(q);

    const QDRANT_URL = (process.env.QDRANT_URL || '').replace(/\/+$/, '');
    const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION;
    const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

    const r = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
      },
      body: JSON.stringify({ vector, limit: 10, with_payload: true }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok: false, error: `Qdrant search failed: ${t}` });
    }

    const data = await r.json();
    res.status(200).json({ ok: true, matches: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
