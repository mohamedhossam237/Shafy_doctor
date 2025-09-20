// /lib/sources/cdc.js
const CDC_API = 'https://tools.cdc.gov/api/v2/resources/media';
export async function cdcFetch({ query, max = 25 }) {
  const url = `${CDC_API}?max=${max}&q=${encodeURIComponent(query)}&sort=Most%20Recent&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  const items = j?.results || j?.results?.results || [];
  return items.map(m => ({
    id: `CDC:${m.id}`,
    title: m.name,
    summary: m.description || '',
    url: m.link || m.url || m.sourceUrl,
    source: 'CDC',
    date: m.datePublished || m.dateModified,
    tags: [m.audience, m.topic]?.flat().filter(Boolean),
  }));
}
