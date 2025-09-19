// lib/embeddings.js
import { FlagEmbedding } from "fastembed";

let _modelPromise;
export async function getModel() {
  if (!_modelPromise) {
    // الافتراضي: BGE-small-en-v1.5
    _modelPromise = FlagEmbedding.init();
  }
  return _modelPromise;
}

export async function embedTexts(texts, batchSize = 256) {
  const model = await getModel();
  const gen = model.passageEmbed(texts, batchSize);
  const out = [];
  for await (const batch of gen) out.push(...batch);
  return out; // number[][]
}
