// useNormalizedClinics.js
export default function useNormalizedClinics(doctor) {
  if (!doctor) return [];
  const clinics = doctor.clinics || doctor.clinic || [];
  return Array.isArray(clinics)
    ? clinics.map((c, i) => ({
        id: c.id || i,
        name_en: c.name_en || c.name || '',
        name_ar: c.name_ar || c.name || '',
        address_en: c.address_en || '',
        address_ar: c.address_ar || '',
        phone: c.phone || '',
        active: c.active !== false,
        working_hours: c.workingHours || c.working_hours || null,
      }))
    : [];
}
