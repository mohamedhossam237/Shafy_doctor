// /components/reports/AddReportDialog.jsx
'use client';
import * as React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import HealingIcon from '@mui/icons-material/Healing';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ScienceIcon from '@mui/icons-material/Science'; // NEW: icon for tests

import { useAuth } from '@/providers/AuthProvider';
import { db, storage } from '@/lib/firebase';
import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/** Reusable section wrapper */
function Section({ icon, title, children }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2 },
        borderRadius: 2,
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.9)}`,
        background:
          theme.palette.mode === 'light'
            ? alpha(theme.palette.background.paper, 0.6)
            : alpha(theme.palette.background.paper, 0.25),
      }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {icon}
          <Typography variant="subtitle2" fontWeight={800} letterSpacing={0.2}>
            {title}
          </Typography>
        </Stack>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

export default function AddReportDialog({
  open,
  onClose,
  isArabic,
  onSaved,
  /** NEW: link the report to an appointment */
  appointmentId,
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const [form, setForm] = React.useState({
    // Meta
    titleEn: '',
    titleAr: '',
    dateStr: new Date().toISOString().slice(0, 16),

    // Linkage
    patientName: '',
    patientID: '',

    // Clinical content
    chiefComplaint: '',
    findings: '',
    diagnosis: '',
    procedures: '',
    medications: '',

    // Vitals
    vitalsBP: '',
    vitalsHR: '',
    vitalsTemp: '',
    vitalsSpO2: '',

    // Follow-up
    followUpStr: '',
  });
  const [errors, setErrors] = React.useState({});

  // Structured medications list
  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);

  // NEW: Required tests list
  const [testsList, setTestsList] = React.useState([
    { name: '', notes: '' },
  ]);

  // Attachment
  const [file, setFile] = React.useState(null);
  const [previewURL, setPreviewURL] = React.useState('');

  // Patients
  const [patients, setPatients] = React.useState([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);

  // Patient demographics card
  const [demo, setDemo] = React.useState({ mrn: '', sex: '', dobStr: '', phone: '' });

  /** Reset on close */
  React.useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setErrors({});
      setForm({
        titleEn: '',
        titleAr: '',
        dateStr: new Date().toISOString().slice(0, 16),
        patientName: '',
        patientID: '',
        chiefComplaint: '',
        findings: '',
        diagnosis: '',
        procedures: '',
        medications: '',
        vitalsBP: '',
        vitalsHR: '',
        vitalsTemp: '',
        vitalsSpO2: '',
        followUpStr: '',
      });
      setMedicationsList([{ name: '', dose: '', frequency: '', duration: '', notes: '' }]);
      setTestsList([{ name: '', notes: '' }]); // reset tests
      setSelectedPatient(null);
      setDemo({ mrn: '', sex: '', dobStr: '', phone: '' });
      if (previewURL) URL.revokeObjectURL(previewURL);
      setFile(null);
      setPreviewURL('');
    }
  }, [open, previewURL]);

  /** Load patients (registeredBy == user.uid) */
  React.useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setPatientsLoading(true);
      try {
        const qRef = query(collection(db, 'patients'), where('registeredBy', '==', user.uid));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            name: String(data?.name ?? '').trim() || d.id,
            phone: data?.phone || data?.mobile || '',
          };
        });
        rows.sort((a, b) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' })
        );
        setPatients(rows);
      } catch (e) {
        console.error(e);
        setSnack({ open: true, severity: 'error', msg: t('Failed to load patients', 'فشل تحميل قائمة المرضى') });
      } finally {
        setPatientsLoading(false);
      }
    })();
  }, [open, user, t]);

  /** If opened from an appointment, prefill patient from that appointment */
  React.useEffect(() => {
    if (!open || !appointmentId) return;
    (async () => {
      try {
        const apptSnap = await getDoc(doc(db, 'appointments', String(appointmentId)));
        if (!apptSnap.exists()) return;
        const appt = apptSnap.data() || {};
        const pid =
          appt.patientUID || appt.patientId || appt.patientID || '';
        const pname = appt.patientName || '';

        if (pid) {
          setForm((f) => ({ ...f, patientID: pid, patientName: pname }));
          try {
            const pSnap = await getDoc(doc(db, 'patients', String(pid)));
            if (pSnap.exists()) {
              const data = pSnap.data() || {};
              const dob =
                data?.dob instanceof Date
                  ? data.dob
                  : data?.dob?.toDate
                  ? data.dob.toDate()
                  : data?.dob
                  ? new Date(data.dob)
                  : null;
              const dobStr = dob && !isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : '';
              setDemo({
                mrn: data?.mrn || data?.medicalRecordNumber || '',
                sex: data?.sex || data?.gender || '',
                dobStr,
                phone: data?.phone || data?.mobile || '',
              });
            }
          } catch {}
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open, appointmentId]);

  /** After patients are loaded, if form.patientID is set but nothing selected, select it */
  React.useEffect(() => {
    if (!open) return;
    if (!form.patientID) return;
    if (selectedPatient?.id === form.patientID) return;
    const found = patients.find((p) => p.id === form.patientID);
    if (found) setSelectedPatient(found);
  }, [open, form.patientID, selectedPatient, patients]);

  /** Fetch demographics for manual selection */
  const fetchPatientDemographics = React.useCallback(async (patientId) => {
    try {
      if (!patientId) {
        setDemo({ mrn: '', sex: '', dobStr: '', phone: '' });
        return;
      }
      const ref = doc(db, 'patients', patientId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const dob =
        data?.dob instanceof Date
          ? data.dob
          : data?.dob?.toDate
          ? data.dob.toDate()
          : data?.dob
          ? new Date(data.dob)
          : null;
      const dobStr = dob && !isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : '';
      setDemo({
        mrn: data?.mrn || data?.medicalRecordNumber || '',
        sex: data?.sex || data?.gender || '',
        dobStr,
        phone: data?.phone || data?.mobile || '',
      });
    } catch (e) {
      console.error(e);
      setDemo({ mrn: '', sex: '', dobStr: '', phone: '' });
    }
  }, []);

  /** Handlers */
  const onChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
  };
  const clearFile = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    setFile(null);
    setPreviewURL('');
  };

  // ---- Medications list helpers ----
  const updateMedication = (idx, key, value) => {
    setMedicationsList((list) => {
      const next = [...list];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };
  const addMedication = () => {
    setMedicationsList((list) => [...list, { name: '', dose: '', frequency: '', duration: '', notes: '' }]);
  };
  const removeMedication = (idx) => {
    setMedicationsList((list) =>
      list.length <= 1 ? [{ name: '', dose: '', frequency: '', duration: '', notes: '' }] : list.filter((_, i) => i !== idx)
    );
  };

  // ---- Tests list helpers (Required: Medical tests) ----
  const updateTest = (idx, key, value) => {
    setTestsList((list) => {
      const next = [...list];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };
  const addTest = () => {
    setTestsList((list) => [...list, { name: '', notes: '' }]);
  };
  const removeTest = (idx) => {
    setTestsList((list) =>
      list.length <= 1 ? [{ name: '', notes: '' }] : list.filter((_, i) => i !== idx)
    );
  };

  /** Validation (Diagnosis + Patient REQUIRED) */
  const validate = () => {
    const next = {};
    if (!form.titleAr && !form.titleEn) {
      next.titleEn = true;
      next.titleAr = true;
    }
    if (!form.diagnosis.trim()) next.diagnosis = true;
    if (!form.dateStr || isNaN(new Date(form.dateStr).getTime())) next.dateStr = true;
    if (form.followUpStr && isNaN(new Date(form.followUpStr).getTime())) next.followUpStr = true;
    if (!form.patientID) next.patientID = true;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Submit */
  const submit = async () => {
    if (!user) return;
    if (!validate()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please fix the highlighted fields', 'يرجى تصحيح الحقول المحددة') });
      return;
    }
    setSubmitting(true);
    try {
      const attachments = [];
      if (file) {
        const path = `reports/${user.uid}/${Date.now()}_${file.name}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        attachments.push(url);
      }

      const when = new Date(form.dateStr);
      const followUpDate = form.followUpStr ? new Date(form.followUpStr) : null;
      const nowTs = serverTimestamp();

      // Legacy meds text
      const medsText =
        medicationsList
          .filter((m) => Object.values(m).some((v) => String(v || '').trim()))
          .map((m) => {
            const parts = [
              m.name,
              m.dose && `(${m.dose})`,
              m.frequency,
              m.duration && `x ${m.duration}`,
              m.notes && `- ${m.notes}`,
            ].filter(Boolean).join(' ');
            return `• ${parts}`;
          })
          .join('\n') || '';

      // NEW: legacy tests text
      const testsText =
        testsList
          .filter((t) => Object.values(t).some((v) => String(v || '').trim()))
          .map((t) => {
            const parts = [t.name, t.notes && `- ${t.notes}`].filter(Boolean).join(' ');
            return `• ${parts}`;
          })
          .join('\n') || '';

      const payload = {
        doctorUID: user.uid,
        // Titles
        titleEn: form.titleEn || '',
        titleAr: form.titleAr || '',
        title: form.titleEn || form.titleAr || '',
        // Meta
        type: 'clinic', // always clinic
        date: Timestamp.fromDate(isNaN(when.getTime()) ? new Date() : when),
        // Linkage
        appointmentId: appointmentId ? String(appointmentId) : null,
        patientName: form.patientName || '',
        patientID: form.patientID || '',
        // Clinical
        chiefComplaint: form.chiefComplaint || '',
        findings: form.findings || '',
        diagnosis: form.diagnosis || '',
        procedures: form.procedures || '',
        medications: medsText,
        medicationsList,
        // NEW: tests required
        testsRequired: testsText,
        testsRequiredList: testsList,
        // Vitals
        vitals: {
          bp: form.vitalsBP || '',
          hr: form.vitalsHR || '',
          temp: form.vitalsTemp || '',
          spo2: form.vitalsSpO2 || '',
        },
        // Follow-up
        followUp:
          followUpDate && !isNaN(followUpDate.getTime())
            ? Timestamp.fromDate(followUpDate)
            : null,
        // Misc
        notes: form.notes || '',
        attachments,
        createdAt: nowTs,
        updatedAt: nowTs,
      };

      const docRef = await addDoc(collection(db, 'reports'), payload);

      onSaved?.({
        id: docRef.id,
        titleEn: payload.titleEn || payload.title || 'Medical Report',
        titleAr: payload.titleAr || payload.title || 'تقرير طبي',
        date: new Date(form.dateStr),
        patientID: payload.patientID,
        patientName: payload.patientName,
        type: payload.type,
      });

      onClose?.();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: e?.message || t('Failed to add report', 'فشل إضافة التقرير'), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const dir = isArabic ? 'rtl' : 'ltr';

  return (
    <>
      <Dialog
        open={open}
        onClose={() => !submitting && onClose?.()}
        fullWidth
        fullScreen={fullScreen}
        maxWidth="md"
        PaperProps={{
          sx: { direction: dir, textAlign: isArabic ? 'right' : 'left', borderRadius: fullScreen ? 0 : 3 },
        }}
      >
        {/* HEADER */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Chip
              icon={<LocalHospitalIcon />}
              label={t('Clinical Report', 'تقرير سريري')}
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 0.3 }}
            />
            <Typography variant="body2" color="text.secondary">
              {t('New entry', 'إدخال جديد')}
            </Typography>
          </Stack>
          <IconButton onClick={() => !submitting && onClose?.()} disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* CONTENT */}
        <DialogContent
          dividers
          sx={{
            background:
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.light, 0.04)
                : alpha(theme.palette.primary.dark, 0.12),
          }}
        >
          <Stack spacing={2.25}>
            {/* REPORT META */}
            <Section icon={<AssignmentIcon fontSize="small" />} title={t('Report Meta', 'بيانات التقرير')}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Title (Arabic)', 'العنوان (عربي)')}
                    fullWidth
                    value={form.titleAr}
                    onChange={onChange('titleAr')}
                    error={Boolean(errors.titleAr)}
                    helperText={errors.titleAr ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
                    inputProps={{ maxLength: 80 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Title (English)', 'العنوان (إنجليزي)')}
                    fullWidth
                    value={form.titleEn}
                    onChange={onChange('titleEn')}
                    error={Boolean(errors.titleEn)}
                    helperText={errors.titleEn ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
                    inputProps={{ maxLength: 80 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    type="datetime-local"
                    label={t('Date', 'التاريخ')}
                    value={form.dateStr}
                    onChange={onChange('dateStr')}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={Boolean(errors.dateStr)}
                    helperText={errors.dateStr ? t('Invalid', 'غير صالح') : ' '}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EventIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Section>

            {/* PATIENT & DEMOGRAPHICS */}
            <Section icon={<PersonIcon fontSize="small" />} title={t('Patient & Demographics', 'المريض والبيانات الديموغرافية')}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={patients}
                    loading={patientsLoading}
                    value={selectedPatient}
                    onChange={async (_, value) => {
                      setSelectedPatient(value);
                      const id = value?.id || '';
                      setForm((f) => ({ ...f, patientID: id, patientName: value?.name || '' }));
                      setErrors((prev) => ({ ...prev, patientID: undefined }));
                      await fetchPatientDemographics(id);
                    }}
                    getOptionLabel={(opt) => (opt?.name ? String(opt.name) : '')}
                    isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                    noOptionsText={t('No patients', 'لا يوجد مرضى')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('Select Patient', 'اختر المريض')}
                        placeholder={t('Search by name', 'ابحث بالاسم')}
                        error={Boolean(errors.patientID)}
                        helperText={errors.patientID ? t('Select a patient for this report', 'يرجى اختيار المريض لهذا التقرير') : ' '}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {patientsLoading ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* Demographics card */}
                <Grid item xs={12} md={6}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2, bgcolor: (t2) => alpha(t2.palette.primary.light, 0.06) }}
                  >
                    <Grid container spacing={1}>
                      <Grid item xs={6} sm={3.5}>
                        <Typography variant="caption" color="text.secondary">{t('MRN', 'رقم الملف')}</Typography>
                        <Typography variant="body2" fontWeight={700}>{demo.mrn || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={2.5}>
                        <Typography variant="caption" color="text.secondary">{t('Sex', 'النوع')}</Typography>
                        <Typography variant="body2" fontWeight={700}>{demo.sex || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">{t('DOB', 'تاريخ الميلاد')}</Typography>
                        <Typography variant="body2" fontWeight={700}>{demo.dobStr || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">{t('Phone', 'هاتف')}</Typography>
                        <Typography variant="body2" fontWeight={700}>{demo.phone || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            </Section>

            {/* CLINICAL DETAILS */}
            <Section icon={<HealingIcon fontSize="small" />} title={t('Clinical Details', 'التفاصيل السريرية')}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('Chief Complaint', 'الشكوى الرئيسية')}
                    fullWidth
                    value={form.chiefComplaint}
                    onChange={onChange('chiefComplaint')}
                    inputProps={{ maxLength: 160 }}
                    helperText={`${form.chiefComplaint.length}/160`}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={`${t('Diagnosis (ICD if available)', 'التشخيص (إن وُجد ICD)')} *`}
                    fullWidth
                    required
                    value={form.diagnosis}
                    onChange={onChange('diagnosis')}
                    error={Boolean(errors.diagnosis)}
                    helperText={errors.diagnosis ? t('Diagnosis is required', 'التشخيص مطلوب') : `${form.diagnosis.length}/200`}
                    inputProps={{ maxLength: 200 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('Findings / Examination', 'النتائج / الفحص')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.findings}
                    onChange={onChange('findings')}
                    inputProps={{ maxLength: 800 }}
                    helperText={`${form.findings.length}/800`}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('Procedures (CPT if available)', 'الإجراءات (إن وُجد CPT)')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.procedures}
                    onChange={onChange('procedures')}
                    inputProps={{ maxLength: 600 }}
                    helperText={`${form.procedures.length}/600`}
                  />
                </Grid>
              </Grid>
            </Section>

            {/* VITALS */}
            <Section icon={<MonitorHeartIcon fontSize="small" />} title={t('Vitals', 'العلامات الحيوية')}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField label={t('BP (mmHg)', 'ضغط الدم (ملم زئبق)')} fullWidth value={form.vitalsBP} onChange={onChange('vitalsBP')} placeholder="120/80" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label={t('HR (bpm)', 'النبض (نبضة/د)')} fullWidth value={form.vitalsHR} onChange={onChange('vitalsHR')} inputProps={{ inputMode: 'numeric' }} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label={t('Temp (°C)', 'الحرارة (°م)')} fullWidth value={form.vitalsTemp} onChange={onChange('vitalsTemp')} inputProps={{ inputMode: 'decimal' }} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label={t('SpO₂ (%)', 'الأكسجين (%)')} fullWidth value={form.vitalsSpO2} onChange={onChange('vitalsSpO2')} inputProps={{ inputMode: 'numeric' }} />
                </Grid>
              </Grid>
            </Section>

            {/* MEDICATIONS LIST */}
            <Section icon={<MedicationIcon fontSize="small" />} title={t('Medications / Prescriptions', 'الأدوية / الوصفات')}>
              <Stack spacing={1.5}>
                {medicationsList.map((m, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      borderStyle: 'dashed',
                      borderColor: (t2) => alpha(t2.palette.divider, 0.8),
                    }}
                  >
                    <Grid container spacing={1.25} alignItems="center">
                      <Grid item xs={12} md={3.5}>
                        <TextField
                          label={t('Medicine name', 'اسم الدواء')}
                          fullWidth
                          value={m.name}
                          onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField
                          label={t('Dose', 'الجرعة')}
                          fullWidth
                          value={m.dose}
                          onChange={(e) => updateMedication(idx, 'dose', e.target.value)}
                          placeholder="500 mg"
                        />
                      </Grid>
                      <Grid item xs={6} md={2.2}>
                        <TextField
                          label={t('Frequency', 'التكرار')}
                          fullWidth
                          value={m.frequency}
                          onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                          placeholder={t('e.g. BID', 'مثال: مرتين/يوم')}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField
                          label={t('Duration', 'المدة')}
                          fullWidth
                          value={m.duration}
                          onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                          placeholder={t('7 days', '7 أيام')}
                        />
                      </Grid>
                      <Grid item xs={12} md={2.8}>
                        <TextField
                          label={t('Notes', 'ملاحظات')}
                          fullWidth
                          value={m.notes}
                          onChange={(e) => updateMedication(idx, 'notes', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md="auto">
                        <IconButton color="error" onClick={() => removeMedication(idx)} aria-label={t('Remove medicine', 'إزالة الدواء')} sx={{ ml: { md: 0.5 } }}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}

                <Box>
                  <Button onClick={addMedication} startIcon={<AddCircleOutlineIcon />} variant="outlined">
                    {t('Add medicine', 'إضافة دواء')}
                  </Button>
                </Box>
              </Stack>
            </Section>

            {/* NEW: REQUIRED MEDICAL TESTS */}
            <Section icon={<ScienceIcon fontSize="small" />} title={t('Required: Medical tests', 'مطلوب: فحوصات طبية')}>
              <Stack spacing={1.5}>
                {testsList.map((x, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      borderStyle: 'dashed',
                      borderColor: (t2) => alpha(t2.palette.divider, 0.8),
                    }}
                  >
                    <Grid container spacing={1.25} alignItems="center">
                      <Grid item xs={12} md={6}>
                        <TextField
                          label={t('Test / Investigation', 'الفحص / التحليل')}
                          fullWidth
                          value={x.name}
                          onChange={(e) => updateTest(idx, 'name', e.target.value)}
                          placeholder={t('e.g. CBC, Chest X-ray', 'مثل: صورة دم كاملة، أشعة صدر')}
                        />
                      </Grid>
                      <Grid item xs={12} md={5.2}>
                        <TextField
                          label={t('Notes / Instructions', 'ملاحظات / تعليمات')}
                          fullWidth
                          value={x.notes}
                          onChange={(e) => updateTest(idx, 'notes', e.target.value)}
                          placeholder={t('Fasting 8 hours, etc.', 'صيام ٨ ساعات مثلاً')}
                        />
                      </Grid>
                      <Grid item xs={12} md="auto">
                        <IconButton color="error" onClick={() => removeTest(idx)} aria-label={t('Remove test', 'إزالة الفحص')} sx={{ ml: { md: 0.5 } }}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}

                <Box>
                  <Button onClick={addTest} startIcon={<AddCircleOutlineIcon />} variant="outlined">
                    {t('Add test', 'إضافة فحص')}
                  </Button>
                </Box>
              </Stack>
            </Section>

            {/* FOLLOW-UP ONLY */}
            <Section icon={<CalendarMonthIcon fontSize="small" />} title={t('Follow-up', 'المتابعة')}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    type="datetime-local"
                    label={t('Follow-up Date/Time', 'موعد المتابعة')}
                    value={form.followUpStr}
                    onChange={onChange('followUpStr')}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={Boolean(errors.followUpStr)}
                    helperText={errors.followUpStr ? t('Invalid date/time', 'تاريخ/وقت غير صالح') : ' '}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarMonthIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Section>

            {/* ATTACHMENT & SIGNATURE */}
            <Section icon={<NoteAltIcon fontSize="small" />} title={t('Attachment & Signature', 'المرفقات والتوقيع')}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                    <Tooltip title={t('Add image (optional)', 'إضافة صورة (اختياري)')}>
                      <Button variant="outlined" startIcon={<AddPhotoAlternateIcon />} component="label" sx={{ whiteSpace: 'nowrap' }}>
                        {t('Attach Image', 'إرفاق صورة')}
                        <input type="file" hidden accept="image/*" onChange={onPickFile} />
                      </Button>
                    </Tooltip>

                    {file ? (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                        {file.name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{t('Optional', 'اختياري')}</Typography>
                    )}

                    {!!previewURL && (
                      <Button color="error" size="small" onClick={clearFile}>
                        {t('Remove', 'إزالة')}
                      </Button>
                    )}
                  </Stack>

                  {!!previewURL && (
                    <Box
                      sx={{
                        mt: 1.5,
                        width: '100%',
                        borderRadius: 2,
                        border: (t2) => `1px solid ${t2.palette.divider}`,
                        overflow: 'hidden',
                        bgcolor: (t2) => alpha(t2.palette.background.default, 0.3),
                      }}
                    >
                      <Box
                        sx={{
                          aspectRatio: '16 / 9',
                          backgroundImage: `url(${previewURL})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
                  >
                    <Typography variant="body2" color="text.secondary">{t('Signed by', 'موقَّع بواسطة')}</Typography>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {user?.displayName || t('Attending Physician', 'الطبيب المعالج')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Section>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => !submitting && onClose?.()} disabled={submitting}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={submit} variant="contained" disabled={submitting} sx={{ minWidth: 140 }}>
            {submitting ? t('Saving...', 'جارٍ الحفظ...') : t('Save Report', 'حفظ التقرير')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
