// /components/profile/EditHoursDialog.jsx
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Button,
  Stack,
  Grid,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tooltip,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

/* ------------------------------- constants -------------------------------- */

const DAY_ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABELS = {
  sat: { en: 'Saturday', ar: 'السبت' },
  sun: { en: 'Sunday', ar: 'الأحد' },
  mon: { en: 'Monday', ar: 'الاثنين' },
  tue: { en: 'Tuesday', ar: 'الثلاثاء' },
  wed: { en: 'Wednesday', ar: 'الأربعاء' },
  thu: { en: 'Thursday', ar: 'الخميس' },
  fri: { en: 'Friday', ar: 'الجمعة' },
};

const defaultDay = () => ({ open: false, start: '09:00', end: '17:00' });
const defaultHours = () =>
  DAY_ORDER.reduce((acc, d) => {
    acc[d] = defaultDay();
    return acc;
  }, {});

/* -------------------------------- helpers --------------------------------- */

const clamp2 = (n) => String(n).padStart(2, '0');

function toHHMM(v) {
  if (!v) return '09:00';
  if (v instanceof Date) return `${clamp2(v.getHours())}:${clamp2(v.getMinutes())}`;
  const s = String(v).trim();

  // Accept "9:0", "09:00", "0900", "9", "17"
  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10) || 0);
    return `${clamp2(Math.min(23, Math.max(0, h)))}:${clamp2(Math.min(59, Math.max(0, m)))}`;
  }
  if (/^\d{3,4}$/.test(s)) {
    const h = parseInt(s.slice(0, -2), 10) || 0;
    const m = parseInt(s.slice(-2), 10) || 0;
    return `${clamp2(Math.min(23, Math.max(0, h)))}:${clamp2(Math.min(59, Math.max(0, m)))}`;
  }
  if (/^\d{1,2}$/.test(s)) {
    const h = parseInt(s, 10) || 0;
    return `${clamp2(Math.min(23, Math.max(0, h)))}:00`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toHHMM(d);
  return '09:00';
}

const minutes = (hhmm) => {
  const [h = 0, m = 0] = String(hhmm || '')
    .split(':')
    .map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};

function normalizeInitial(initial) {
  // Returns { hoursObj, duration }
  const base = defaultHours();
  let duration = 15; // default slot minutes

  if (!initial || typeof initial !== 'object') {
    return { hoursObj: base, duration };
  }

  // try to pick up saved duration under multiple keys for compatibility
  duration =
    parseInt(
      initial.appointmentDuration ??
      initial.slotMinutes ??
      initial.slot_duration ??
      initial.duration ??
      initial.durationMinutes ??
      15,
      10
    ) || 15;

  const getDay = (id) =>
    initial[id] ||
    initial[id?.toUpperCase?.()] ||
    initial[DAY_LABELS[id]?.en?.toLowerCase?.()] ||
    null;

  DAY_ORDER.forEach((d) => {
    const v = getDay(d);
    if (!v) return;
    base[d] = {
      open: !!(v.open ?? v.isOpen ?? v.enabled ?? v.available),
      start: toHHMM(v.start ?? v.from ?? v.openAt ?? v.startTime),
      end: toHHMM(v.end ?? v.to ?? v.closeAt ?? v.endTime),
    };
  });

  return { hoursObj: base, duration };
}

/* ------------------------------ main component ----------------------------- */
/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - doctorUID: string (required to save)
 *  - isArabic: boolean
 *  - initialHours?: object (shape like { sat: {open, start, end}, ... , appointmentDuration?: number })
 *  - onSaved?: (hoursObjWithDuration) => void
 *  - skipDirectSave?: boolean (if true, only calls onSaved callback without writing to Firestore)
 *
 * NOTE:
 *   We now persist `appointmentDuration` (minutes) alongside working hours.
 *   This value is clinic-specific (the parent passes/receives it inside the clinic's `working_hours` object).
 *   When skipDirectSave is true, the parent is responsible for persisting to Firestore.
 */
export default function EditHoursDialog({
  open,
  onClose,
  doctorUID,
  isArabic = false,
  initialHours = null,
  onSaved,
  skipDirectSave = false,
}) {
  const dir = isArabic ? 'rtl' : 'ltr';

  const [hours, setHours] = React.useState(defaultHours());
  const [duration, setDuration] = React.useState(15); // minutes per appointment for this clinic
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    // Be flexible if parent passed a full doctor doc or hours object
    const seed =
      initialHours?.clinic?.workingHours ||
      initialHours?.clinic?.working_hours ||
      initialHours;

    const { hoursObj, duration: seedDuration } = normalizeInitial(seed);
    setHours(hoursObj);
    setDuration(seedDuration);
    setError('');
  }, [open, initialHours]);

  const setDay = (day, patch) =>
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyDown = (dayIndex) => {
    setHours((prev) => {
      const next = { ...prev };
      const srcKey = DAY_ORDER[dayIndex];
      for (let i = dayIndex + 1; i < DAY_ORDER.length; i++) {
        const t = DAY_ORDER[i];
        next[t] = { ...next[srcKey] };
      }
      return next;
    });
  };

  const setAll = (template) => {
    setHours((prev) => {
      const next = { ...prev };
      DAY_ORDER.forEach((d) => (next[d] = { ...template }));
      return next;
    });
  };

  const validate = () => {
    // validate daily ranges
    for (const d of DAY_ORDER) {
      const v = hours[d];
      if (v.open && minutes(v.end) <= minutes(v.start)) {
        const name = isArabic ? DAY_LABELS[d].ar : DAY_LABELS[d].en;
        return isArabic
          ? `توقيت غير صحيح لليوم: ${name} — وقت النهاية يجب أن يكون بعد البداية.`
          : `Invalid time for ${name}: end must be after start.`;
      }
    }
    // validate duration
    if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      return isArabic
        ? 'مدة الكشف يجب أن تكون رقمًا موجبًا بالدقائق.'
        : 'Appointment duration must be a positive number of minutes.';
    }
    if (Number(duration) > 240) {
      return isArabic
        ? 'مدة الكشف كبيرة جدًا. الرجاء اختيار مدة أقل من 240 دقيقة.'
        : 'Appointment duration is too large. Please choose less than 240 minutes.';
    }
    return '';
  };

  const handleSave = async () => {
    const vErr = validate();
    if (vErr) {
      setError(vErr);
      return;
    }
    if (!doctorUID && !skipDirectSave) {
      setError(isArabic ? 'لا يمكن الحفظ: معرّف الطبيب غير موجود.' : 'Cannot save: doctor UID missing.');
      return;
    }

    setSaving(true);
    setError('');

    // Combine hours with duration into one object to store under working_hours
    const workingObj = { ...hours, appointmentDuration: Number(duration) };

    // If skipDirectSave is true, just call the parent callback and let them handle persistence
    if (skipDirectSave) {
      onSaved && onSaved(workingObj);
      setSaving(false);
      onClose && onClose();
      return;
    }

    // Otherwise, write to Firestore directly (legacy/single-clinic mode)
    const ref = doc(db, 'doctors', doctorUID);
    const ts = new Date().toISOString();

    try {
      // Write to both top-level and nested clinic.* without overwriting other clinic fields
      await updateDoc(ref, {
        // top-level (aliases for older reads)
        working_hours: workingObj,
        workingHours: workingObj,
        updatedAt: ts,
        // nested under clinic (back-compat paths)
        'clinic.working_hours': workingObj,
        'clinic.workingHours': workingObj,
        'clinic.updatedAt': ts,
      });
    } catch (e) {
      // If doc doesn't exist yet, create/merge it
      try {
        await setDoc(
          ref,
          {
            working_hours: workingObj,
            workingHours: workingObj,
            updatedAt: ts,
            clinic: {
              working_hours: workingObj,
              workingHours: workingObj,
              updatedAt: ts,
            },
          },
          { merge: true }
        );
      } catch (e2) {
        setError(e2?.message || (isArabic ? 'تعذّر الحفظ' : 'Failed to save'));
        setSaving(false);
        return;
      }
    }

    onSaved && onSaved(workingObj); // parent will put it into clinic.working_hours
    setSaving(false);
    onClose && onClose();
  };

  const toolbar = (
    <Stack
      direction={isArabic ? 'row-reverse' : 'row'}
      spacing={1}
      sx={{ mb: 1 }}
      justifyContent="flex-start"
    >
      <Button
        size="small"
        variant="outlined"
        onClick={() => setAll({ open: true, start: '09:00', end: '17:00' })}
      >
        {isArabic ? '٩–٥ لكل الأيام' : '9–5 for all'}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => setAll({ open: false, start: '09:00', end: '17:00' })}
      >
        {isArabic ? 'إغلاق الجميع' : 'Close all'}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() =>
          setHours((prev) => {
            const base = prev['sat'];
            const next = { ...prev };
            DAY_ORDER.forEach((d) => (next[d] = { ...base }));
            return next;
          })
        }
      >
        {isArabic ? 'نسخ من السبت للجميع' : 'Copy Saturday to all'}
      </Button>
    </Stack>
  );

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="md"
      dir={dir}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'تعديل مواعيد العمل' : 'Edit Clinic Hours'}
        </Typography>
        <IconButton onClick={onClose} disabled={saving} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {isArabic
            ? 'فعّل اليوم وحدد وقت البداية والنهاية. يمكنك نسخ إعدادات يوم لليوم التالي أو تطبيقها على كل الأيام من الشريط العلوي. كما يمكنك تحديد مدة الكشف (بالدقائق) لهذه العيادة.'
            : 'Enable a day and choose start/end. Use the toolbar to copy or apply to all days. You can also set the appointment duration (minutes) for this clinic.'}
        </Typography>

        {/* Clinic-level appointment duration */}
        <Box sx={{ mb: 2 }}>
          <TextField
            type="number"
            label={isArabic ? 'مدة الكشف (بالدقائق)' : 'Appointment Duration (minutes)'}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputProps={{ min: 5, max: 240, step: 5 }}
            sx={{ width: 260 }}
          />
        </Box>

        {toolbar}

        <Grid container spacing={1.25}>
          {DAY_ORDER.map((d, idx) => {
            const v = hours[d];
            const label = isArabic ? DAY_LABELS[d].ar : DAY_LABELS[d].en;
            return (
              <Grid item xs={12} key={d}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 140, flexShrink: 0 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!v.open}
                          onChange={(e) => setDay(d, { open: e.target.checked })}
                          inputProps={{ 'aria-label': `${label} open switch` }}
                        />
                      }
                      label={label}
                    />
                  </Box>

                  <Stack
                    direction={isArabic ? 'row-reverse' : 'row'}
                    spacing={1}
                    sx={{ flex: 1, alignItems: 'center' }}
                  >
                    <TextField
                      type="time"
                      size="small"
                      label={isArabic ? 'من' : 'From'}
                      value={v.start}
                      onChange={(e) => setDay(d, { start: toHHMM(e.target.value) })}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      disabled={!v.open}
                      sx={{ width: 140 }}
                    />
                    <TextField
                      type="time"
                      size="small"
                      label={isArabic ? 'إلى' : 'To'}
                      value={v.end}
                      onChange={(e) => setDay(d, { end: toHHMM(e.target.value) })}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      disabled={!v.open}
                      sx={{ width: 140 }}
                    />

                    {v.open && minutes(v.end) <= minutes(v.start) && (
                      <Typography color="error" variant="caption">
                        {isArabic ? 'وقت النهاية قبل/يساوي البداية' : 'End is before/equal to start'}
                      </Typography>
                    )}
                  </Stack>

                  {idx < DAY_ORDER.length - 1 && (
                    <Tooltip title={isArabic ? 'نسخ لليوم التالي وما بعده' : 'Copy to the rest'}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => copyDown(idx)}
                          aria-label="copy-down"
                        >
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          justifyContent: isArabic ? 'space-between' : 'flex-end',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={saving}>
          {isArabic ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {isArabic ? 'حفظ' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
