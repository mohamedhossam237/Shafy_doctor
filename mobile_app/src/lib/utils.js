export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getRelationLabel = (relation) => {
  if (!relation || relation === 'himself') return '';
  const map = {
    son: 'ابن',
    wife: 'زوجة',
    mom: 'أم',
    dad: 'أب',
  };
  return map[relation] || relation;
};

export const format12h = (hhmm, isAr) => {
  if (!hhmm) return '';
  try {
    const [hStr, mStr] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? (isAr ? 'مساءً' : 'PM') : (isAr ? 'صباحاً' : 'AM');
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  } catch (e) {
    return hhmm;
  }
};

export const APPOINTMENT_TYPES = {
  checkup: { label: 'كشف', color: '#2e7d32', bg: '#e8f5e9' },
  followup: { label: 'إعادة كشف', color: '#1976d2', bg: '#e3f2fd' },
};

export const formatPatientNameWithRelation = (name, relation) => {
  const label = getRelationLabel(relation);
  return label ? `${name} (${label})` : name;
};
