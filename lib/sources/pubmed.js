// /lib/sources/pubmed.js
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
export async function pubmedFetch({ q, retmax = 50 }) {
  // 1) search -> PMIDs
  const esearch = await fetch(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=date&term=${encodeURIComponent(q)}+AND+review[pt]&retmax=${retmax}`);
  const ids = (await esearch.json())?.esearchresult?.idlist || [];
  if (!ids.length) return [];
  // 2) fetch summaries
  const esum = await fetch(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  const data = await esum.json();
  return Object.values(data.result || {})
    .filter(v => v?.uid)
    .map(v => ({
      id: `PMID:${v.uid}`,
      title: v.title,
      summary: (v.elocationid || '') + ' ' + (v.source || ''),
      url: `https://pubmed.ncbi.nlm.nih.gov/${v.uid}/`,
      source: 'PubMed',
      date: v.pubdate,
      tags: (v.pubtype || []),
    }));
}
