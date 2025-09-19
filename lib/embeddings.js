// lib/embeddings.js
import { EmbeddingModel, FlagEmbedding } from 'fastembed';

// Singleton model (default = BAAI/bge-small-en-v1.5 => 384 dims)
let modelPromise;
function getModel() {
  if (!modelPromise) {
    modelPromise = FlagEmbedding.init(); // default model is bge-small-en-v1.5
  }
  return modelPromise;
}

// For chunk/doc passages
export async function embedPassages(passages /* string[] */) {
  const model = await getModel();
  const out = model.passageEmbed(passages, 128); // batch size
  const all = [];
  for await (const batch of out) all.push(...batch);
  return all; // number[][] Float32 converted
}

// For short user queries
export async function embedQuery(query /* string */) {
  const model = await getModel();
  return await model.queryEmbed(query);
}
