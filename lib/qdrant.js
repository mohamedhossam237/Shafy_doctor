// lib/qdrant.js
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = (process.env.QDRANT_API_KEY || '').trim();
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'shafy_docs_dev';
const QDRANT_VECTOR_SIZE = parseInt(process.env.QDRANT_VECTOR_SIZE || '384', 10);

export const qdrant = new QdrantClient({
  url: QDRANT_URL,
  ...(QDRANT_API_KEY ? { apiKey: QDRANT_API_KEY } : {}),
});

export async function ensureCollection() {
  try {
    await qdrant.getCollection(QDRANT_COLLECTION);
    return;
  } catch (_) {
    // fall through to create
  }
  await qdrant.createCollection(QDRANT_COLLECTION, {
    vectors: { size: QDRANT_VECTOR_SIZE, distance: 'Cosine' },
  });
}

export async function upsertPoints(points /* [{id, vector, payload}] */) {
  await ensureCollection();
  await qdrant.upsert(QDRANT_COLLECTION, { points });
}

export async function searchVectors(vector, { limit = 8, filter } = {}) {
  await ensureCollection();
  const res = await qdrant.search(QDRANT_COLLECTION, {
    vector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });
  return res; // array of scored points
}
