// /lib/sources/rxnorm.js
export async function rxnormNormalize(drugName) {
  const r = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}&search=2`);
  if (!r.ok) return null;
  const j = await r.json();
  const rxcui = j?.idGroup?.rxnormId?.[0];
  if (!rxcui) return null;
  const ndcRes = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/ndcs.json`);
  const ndcs = (await ndcRes.json())?.ndcGroup?.ndcList?.ndc || [];
  return { rxcui, ndcs };
}
