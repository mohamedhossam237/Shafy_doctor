// سيرفر فقط: لا تستورده في مكوّنات عميل
import { QdrantClient } from '@qdrant/js-client-rest';

let _client;
export function getQdrant() {
  if (!_client) {
    _client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return _client;
}

export async function ensureCollection(
  name = process.env.QDRANT_COLLECTION,
  size = 384,                      // BGE-small-en-v1.5
  distance = 'Cosine'
) {
  const client = getQdrant();
  try {
    await client.getCollection(name);
  } catch {
    await client.createCollection(name, { vectors: { size, distance } });
  }
  return name;
}
