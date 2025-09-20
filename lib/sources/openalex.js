// /lib/sources/openalex.js
export async function openalexFetch({ query, max = 25 }) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=type:journal-article,is_oa:true&per-page=${max}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Shafy/1.0 ([email protected])' } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.results || []).map(w => ({
    id: w.id,
    title: w.title,
    summary: (w?.abstract_inverted_index ? Object.keys(w.abstract_inverted_index).join(' ') : ''),
    url: w?.open_access?.oa_url || w?.primary_location?.source?.homepage_url || w?.doi,
    source: 'OpenAlex',
    date: w?.publication_date || w?.from_publication_date,
    tags: w?.concepts?.slice(0,5).map(c=>c.display_name) || [],
  }));
}
