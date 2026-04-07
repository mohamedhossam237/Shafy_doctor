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

export const formatPatientNameWithRelation = (name, relation) => {
  const label = getRelationLabel(relation);
  return label ? `${name} (${label})` : name;
};
