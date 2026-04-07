import { toDayKey } from './dates';

/**
 * Robustly identify if an appointment is a Follow-up or Checkup.
 * Checks multiple possible field names used by different app versions.
 */
export const getAppointmentTypeInfo = (appt, isAr) => {
  const typeStr = String(
    appt?.bookingType || 
    appt?.type || 
    appt?.appointmentType || 
    appt?.service || 
    ''
  ).toLowerCase().replace(/[^a-z]/g, '');
  
  const isFollowup = typeStr.includes('followup') || 
                     typeStr.includes('reexam') || 
                     typeStr.includes('return') || 
                     typeStr === 'follow';

  if (isFollowup) {
    return {
      label: isAr ? 'إعادة كشف' : 'Follow-up',
      color: 'secondary',
      bgcolor: 'rgba(156, 39, 176, 0.15)',
      textColor: 'secondary.main',
      border: 'secondary.main'
    };
  }
  
  return {
    label: isAr ? 'كشف' : 'Checkup',
    color: 'primary',
    bgcolor: 'rgba(25, 118, 210, 0.15)',
    textColor: 'primary.main',
    border: 'primary.main'
  };
};

/**
 * Get Today's date string in YYYY-MM-DD format specifically for the Egypt timezone.
 * Prevents "early morning" (12AM-3AM) date mismatch issues.
 */
export const getTodayEgyptDate = () => {
  return toDayKey(new Date(), "Africa/Cairo");
};
