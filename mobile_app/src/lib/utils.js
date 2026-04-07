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
    const raw = String(hhmm).trim().toUpperCase();
    const hasPM = raw.includes('PM');
    const hasAM = raw.includes('AM');
    
    const cleanTime = raw.replace(/AM|PM/g, '').trim();
    const [hStr, mStr] = cleanTime.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    
    let isPM = h >= 12;
    if (hasPM) isPM = true;
    if (hasAM) isPM = false;

    const ampm = isPM ? (isAr ? 'مساءً' : 'PM') : (isAr ? 'صباحاً' : 'AM');
    h = h % 12;
    h = h ? h : 12; 
    return `${h}:${m} ${ampm}`;
  } catch (e) {
    return hhmm;
  }
};

export const normalizePhoneForWhatsApp = (raw) => {
  if (!raw) return '';
  let digits = String(raw).trim().replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) return digits.length >= 12 ? digits : '';
  if (digits.startsWith('0') && digits.length >= 10) digits = '20' + digits.slice(1);
  else if (digits.length >= 10) digits = '20' + digits;
  else return '';
  return digits.length >= 12 ? digits : '';
};

export const generateWhatsAppMessage = (doctorNameAr, doctorNameEn, dateStr, time, patientName) => {
  const arabicMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let formattedDate = dateStr;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const formattedTime = format12h(time, true);
    formattedDate = `${d} ${arabicMonths[m - 1]} ${y} الساعة ${formattedTime}`;
  } catch { }
  const doctorName = doctorNameAr || doctorNameEn || '';
  return `مرحباً ${patientName || 'عزيزي/عزيزتي'} 👋\n\n✅ تم حجز موعدك بنجاح من خلال تطبيق شافي\n\n📋 تفاصيل الحجز:\n- الطبيب: ${doctorName}\n- التاريخ والوقت: ${formattedDate}\n\n🔗 يمكنك حجز مواعيدك القادمة من خلال الرابط التالي:\napp.shafy.dev\n\n✨ عند الحجز من التطبيق ستحصل على:\n• أولوية الدخول للطبيب\n• موعد محدد مسبقاً\n• تجنب الانتظار في العيادة\n\nشكراً لاستخدامك تطبيق شافي 🏥`;
};

export const APPOINTMENT_TYPES = {
  checkup: { label: 'كشف', color: '#2e7d32', bg: '#e8f5e9' },
  followup: { label: 'إعادة كشف', color: '#1976d2', bg: '#e3f2fd' },
};

export const getAppointmentTypeInfo = (item = {}) => {
  const typeStr = String(item.bookingType || item.type || item.appointmentType || item.service || '').toLowerCase().replace(/[^a-z]/g, '');
  
  if (typeStr.includes('followup') || typeStr.includes('reexam') || typeStr.includes('return') || typeStr === 'follow') {
    return APPOINTMENT_TYPES.followup;
  }
  
  return APPOINTMENT_TYPES.checkup;
};

export const formatPatientNameWithRelation = (name, relation) => {
  const label = getRelationLabel(relation);
  return label ? `${name} (${label})` : name;
};
