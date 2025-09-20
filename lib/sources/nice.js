// /lib/sources/nice.js
const NICE_API = 'https://api.nice.org.uk/syndication';
export async function niceGuidanceFetch({ topic, max = 25 }) {
  const key = process.env.NICE_API_KEY; // register and store
  const r = await fetch(`${NICE_API}/guidance?search=${encodeURIComponent(topic)}&pageSize=${max}`, {
    headers: { 'subscription-key': key }
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.value || []).map(g => ({
    id: g.id,
    title: g.title,
    summary: g.summary,
    url: g.linkTo || g.link || g.url,
    source: 'NICE',
    date: g.datePublished || g.lastMajorUpdate,
    tags: [g.type, ...(g.conditions || [])].filter(Boolean),
  }));
}
