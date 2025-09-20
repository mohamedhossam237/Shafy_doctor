// /lib/sources/ctgov.js
export async function ctgovFetch({ condition, max = 30 }) {
  const q = new URLSearchParams({
    query: `cond=${condition}`,
    pageSize: String(max),
    fields: 'NCTId,BriefTitle,Condition,StudyType,OverallStatus,StartDate,LastUpdatePostDate,ResultsFirstPostDate,OrgStudyId',
  });
  const r = await fetch(`https://clinicaltrials.gov/api/v2/studies?${q}`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.studies || []).map(s => ({
    id: s.protocolSection?.identificationModule?.nctId || crypto.randomUUID(),
    title: s.protocolSection?.identificationModule?.briefTitle,
    summary: (s.protocolSection?.conditionsModule?.conditions || []).join(', '),
    url: `https://clinicaltrials.gov/study/${s.protocolSection?.identificationModule?.nctId}`,
    source: 'ClinicalTrials.gov',
    date: s.lastUpdatePostDate || s.startDate,
    tags: [s.protocolSection?.statusModule?.overallStatus, s.protocolSection?.designModule?.studyType].filter(Boolean),
  }));
}
