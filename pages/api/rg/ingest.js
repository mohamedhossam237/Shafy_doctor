// /pages/api/rg/ingest.js
import { embedPassages } from '@/lib/embeddings';
import { getQdrant, ensureCollection } from '@/lib/qdrant';
import { pubmedFetch } from '@/lib/sources/pubmed';
import { ctgovFetch } from '@/lib/sources/ctgov';
import { cdcFetch } from '@/lib/sources/cdc';
import { niceGuidanceFetch } from '@/lib/sources/nice';
import { openalexFetch } from '@/lib/sources/openalex';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
  const { topic } = req.body || {};
  if (!topic) return res.status(400).json({ ok:false, error:'Missing topic' });

  // 1) pull
  const batches = await Promise.allSettled([
    pubmedFetch({ q: topic, retmax: 30 }),
    ctgovFetch({ condition: topic, max: 20 }),
    cdcFetch({ query: topic, max: 20 }),
    niceGuidanceFetch({ topic, max: 20 }),
    openalexFetch({ query: topic, max: 20 }),
  ]);

  // 2) flatten + dedupe by URL
  const items = [...batches].flatMap(b => b.status === 'fulfilled' ? b.value : []);
  const byUrl = new Map();
  for (const it of items) if (it?.url && !byUrl.has(it.url)) byUrl.set(it.url, it);
  const docs = Array.from(byUrl.values());

  // 3) embed
  const texts = docs.map(d => [d.title, d.summary].filter(Boolean).join('\n\n'));
  const vectors = await embedPassages(texts);

  // 4) upsert
  const client = getQdrant();
  const collection = await ensureCollection(process.env.QDRANT_COLLECTION, vectors[0]?.length || 256, 'Cosine');
  const points = docs.map((d, i) => ({
    id: Buffer.from(d.id || d.url).toString('base64url'),
    vector: vectors[i],
    payload: {
      title: d.title,
      url: d.url,
      source: d.source,
      date: d.date,
      tags: d.tags || [],
      topic,
    }
  }));
  await client.upsert(collection, { points });
  return res.status(200).json({ ok:true, count: points.length });
}
