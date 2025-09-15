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
  LinearProgress,
  Link as MLink,
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
import ScienceIcon from '@mui/icons-material/Science';

import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
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

/** Section wrapper */
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

/* ---------- imgbb helpers (same behavior as /pages/reports/new.jsx) ---------- */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
async function uploadImageToImgbb(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Only image files are supported for attachments.');
  }
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
  if (!apiKey) throw new Error('Missing imgbb API key (NEXT_PUBLIC_IMGBB_KEY).');

  const dataUrl = await readFileAsDataURL(file);
  const base64 = String(dataUrl).split(',')[1];

  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image: base64 }),
  });
  const json = await resp.json();
  if (!resp.ok || !json?.data?.url) {
    throw new Error(json?.error?.message || 'imgbb upload failed');
  }
  return json.data.url;
}

export default function AddReportDialog({
  open,
  onClose,
  isArabic,
  onSaved,
  appointmentId, // optional
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  // --- form state ---
  const [form, setForm] = React.useState({
    titleEn: '',
    titleAr: '',
    dateStr: new Date().toISOString().slice(0, 16), // meta date (used if no image too)
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
    notes: '',
  });
  const [errors, setErrors] = React.useState({});

  // structured lists
  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);
  const [testsList, setTestsList] = React.useState([{ name: '', notes: '' }]);

  // --- image attach (now at the top; OR-details flow) ---
  const [fileName, setFileName] = React.useState('');
  const [previewURL, setPreviewURL] = React.useState('');
  const [imgbbURL, setImgbbURL] = React.useState('');   // hosted URL after upload
  const [attaching, setAttaching] = React.useState(false);

  // patients
  const [patients, setPatients] = React.useState([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);

  // demographics
  const [demo, setDemo] = React.useState({ mrn: '', sex: '', dobStr: '', phone: '' });

  // reset on close
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
        notes: '',
      });
      setMedicationsList([{ name: '', dose: '', frequency: '', duration: '', notes: '' }]);
      setTestsList([{ name: '', notes: '' }]);
      setSelectedPatient(null);
      setDemo({ mrn: '', sex: '', dobStr: '', phone: '' });

      if (previewURL) URL.revokeObjectURL(previewURL);
      setPreviewURL('');
      setFileName('');
      setImgbbURL('');
      setAttaching(false);
    }
  }, [open, previewURL]);

  // load patients registered by this user
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
        rows.sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' }));
        setPatients(rows);
      } catch (e) {
        console.error(e);
        setSnack({ open: true, severity: 'error', msg: t('Failed to load patients', 'فشل تحميل قائمة المرضى') });
      } finally {
        setPatientsLoading(false);
      }
    })();
  }, [open, user, t]);

  // prefill from appointment
  React.useEffect(() => {
    if (!open || !appointmentId) return;
    (async () => {
      try {
        const apptSnap = await getDoc(doc(db, 'appointments', String(appointmentId)));
        if (!apptSnap.exists()) return;
        const appt = apptSnap.data() || {};
        const pid = appt.patientUID || appt.patientId || appt.patientID || '';
        const pname = appt.patientName || '';
        if (pid) {
          setForm((f) => ({ ...f, patientID: pid, patientName: pname }));
          try {
            const pSnap = await getDoc(doc(db, 'patients', String(pid)));
            if (pSnap.exists()) {
              const data = pSnap.data() || {};
              const dob =
                data?.dob instanceof Date ? data.dob :
                data?.dob?.toDate ? data.dob.toDate() :
                data?.dob ? new Date(data.dob) : null;
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

  // select patient if form.patientID pre-set
  React.useEffect(() => {
    if (!open || !form.patientID || selectedPatient?.id === form.patientID) return;
    const found = patients.find((p) => p.id === form.patientID);
    if (found) setSelectedPatient(found);
  }, [open, form.patientID, selectedPatient, patients]);

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
        data?.dob instanceof Date ? data.dob :
        data?.dob?.toDate ? data.dob.toDate() :
        data?.dob ? new Date(data.dob) : null;
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

  const onChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // pick & upload image (imgbb)
  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      setSnack({ open: true, severity: 'error', msg: t('Only image files are supported.', 'الصور فقط مدعومة.') });
      return;
    }
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
    setFileName(f.name);

    setAttaching(true);
    try {
      const hosted = await uploadImageToImgbb(f);
      setImgbbURL(hosted);
      setSnack({ open: true, severity: 'success', msg: t('Image uploaded and will be attached to the report.', 'تم رفع الصورة وستُرفق بالتقرير.') });
    } catch (err) {
      console.error(err);
      setImgbbURL('');
      setSnack({ open: true, severity: 'error', msg: err?.message || t('Failed to upload image.', 'فشل رفع الصورة.') });
    } finally {
      setAttaching(false);
    }
  };
  const clearFile = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL('');
    setFileName('');
    setImgbbURL('');
  };

  // meds list
  const updateMedication = (idx, key, value) => {
    setMedicationsList((list) => {
      const next = [...list];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };
  const addMedication = () => setMedicationsList((list) => [...list, { name: '', dose: '', frequency: '', duration: '', notes: '' }]);
  const removeMedication = (idx) => {
    setMedicationsList((list) =>
      list.length <= 1 ? [{ name: '', dose: '', frequency: '', duration: '', notes: '' }] : list.filter((_, i) => i !== idx)
    );
  };

  // tests list
  const updateTest = (idx, key, value) => {
    setTestsList((list) => {
      const next = [...list];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };
  const addTest = () => setTestsList((list) => [...list, { name: '', notes: '' }]);
  const removeTest = (idx) => {
    setTestsList((list) =>
      list.length <= 1 ? [{ name: '', notes: '' }] : list.filter((_, i) => i !== idx)
    );
  };

  /**
   * VALIDATION:
   * - Patient is ALWAYS required.
   * - EITHER an attached image (imgbbURL) OR clinical details.
   *   If image exists -> all other fields optional (we'll default date on save).
   *   If NO image -> require minimal details: diagnosis (and date valid).
   */
  const validate = () => {
    const next = {};
    if (!form.patientID) next.patientID = true;

    if (!imgbbURL) {
      // no image → need minimal details
      if (!form.diagnosis.trim()) next.diagnosis = true;
      if (!form.dateStr || isNaN(new Date(form.dateStr).getTime())) next.dateStr = true;
      // optional: at least one of titleAr/titleEn
      if (!form.titleAr && !form.titleEn) {
        next.titleEn = true;
        next.titleAr = true;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!user) return;
    if (!validate()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please fix the highlighted fields', 'يرجى تصحيح الحقول المحددة') });
      return;
    }
    if (attaching) {
      setSnack({ open: true, severity: 'info', msg: t('Please wait for the image to finish uploading…', 'يرجى انتظار اكتمال رفع الصورة…') });
      return;
    }

    setSubmitting(true);
    try {
      const when = form.dateStr && !isNaN(new Date(form.dateStr).getTime())
        ? new Date(form.dateStr)
        : new Date(); // default if image-only

      const followUpDate = form.followUpStr ? new Date(form.followUpStr) : null;
      const attachments = imgbbURL ? [imgbbURL] : [];
      const nowTs = serverTimestamp();

      // legacy meds text
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

      // legacy tests text
      const testsText =
        testsList
          .filter((x) => Object.values(x).some((v) => String(v || '').trim()))
          .map((x) => `• ${[x.name, x.notes && `- ${x.notes}`].filter(Boolean).join(' ')}`)
          .join('\n') || '';

      const payload = {
        doctorUID: user.uid,
        // Titles
        titleEn: form.titleEn || '',
        titleAr: form.titleAr || '',
        title: form.titleEn || form.titleAr || '',
        // Meta
        type: 'clinic',
        date: Timestamp.fromDate(when),
        // Linkage
        appointmentId: appointmentId ? String(appointmentId) : null,
        patientName: form.patientName || '',
        patientID: form.patientID || '',
        // Clinical (all optional when image exists)
        chiefComplaint: form.chiefComplaint || '',
        findings: form.findings || '',
        diagnosis: form.diagnosis || '',
        procedures: form.procedures || '',
        medications: medsText,
        medicationsList,
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
        // Attachments (imgbb)
        attachments,
        hosting: attachments.length ? 'imgbb' : null,

        // Misc
        notes: form.notes || '',
        createdAt: nowTs,
        updatedAt: nowTs,
      };

      const docRef = await addDoc(collection(db, 'reports'), payload);

      onSaved?.({
        id: docRef.id,
        titleEn: payload.titleEn || payload.title || 'Medical Report',
        titleAr: payload.titleAr || payload.title || 'تقرير طبي',
        date: when,
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
              {t('Attach an image OR fill the details (patient is required).', 'أرفق صورة أو املأ التفاصيل (المريض مطلوب).')}
            </Typography>
          </Stack>
          <IconButton onClick={() => !submitting && onClose?.()} disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

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
            {/* 1) ATTACHMENT FIRST */}
            <Section icon={<NoteAltIcon fontSize="small" />} title={t('Attachment (optional but sufficient)', 'المرفق (اختياري لكنه كافٍ)')}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                    <Tooltip title={t('Attach report image', 'إرفاق صورة التقرير')}>
                      <Button variant="outlined" startIcon={<AddPhotoAlternateIcon />} component="label" sx={{ whiteSpace: 'nowrap' }}>
                        {t('Attach Image', 'إرفاق صورة')}
                        <input type="file" hidden accept="image/*" onChange={onPickFile} />
                      </Button>
                    </Tooltip>

                    {fileName ? (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                        {fileName}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('Optional. If attached, other fields become optional.', 'اختياري. عند الإرفاق تصبح الحقول الأخرى اختيارية.')}
                      </Typography>
                    )}

                    {!!previewURL && (
                      <Button color="error" size="small" onClick={clearFile}>
                        {t('Remove', 'إزالة')}
                      </Button>
                    )}

                    {!!imgbbURL && (
                      <Button
                        size="small"
                        component={MLink}
                        href={imgbbURL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('Open hosted image', 'فتح الصورة المستضافة')}
                      </Button>
                    )}
                  </Stack>

                  {(attaching) && (
                    <Stack sx={{ minWidth: 220, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('Uploading image…', 'جاري رفع الصورة…')}
                      </Typography>
                      <LinearProgress />
                    </Stack>
                  )}

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
              </Grid>
            </Section>

            {/* 2) PATIENT (ALWAYS REQUIRED) */}
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
                        label={t('Select Patient *', 'اختر المريض *')}
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

            {/* 3) OPTIONAL DETAILS (only enforced if no image) */}
            <Section icon={<AssignmentIcon fontSize="small" />} title={t('Report Meta (optional if image attached)', 'بيانات التقرير (اختياري عند إرفاق صورة)')}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Title (Arabic)', 'العنوان (عربي)')}
                    fullWidth
                    value={form.titleAr}
                    onChange={onChange('titleAr')}
                    error={!imgbbURL && Boolean(errors.titleAr)}
                    helperText={!imgbbURL && errors.titleAr ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
                    inputProps={{ maxLength: 80 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Title (English)', 'العنوان (إنجليزي)')}
                    fullWidth
                    value={form.titleEn}
                    onChange={onChange('titleEn')}
                    error={!imgbbURL && Boolean(errors.titleEn)}
                    helperText={!imgbbURL && errors.titleEn ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
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
                    error={!imgbbURL && Boolean(errors.dateStr)}
                    helperText={!imgbbURL && errors.dateStr ? t('Invalid', 'غير صالح') : ' '}
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

            <Section icon={<HealingIcon fontSize="small" />} title={t('Clinical Details (optional if image attached)', 'التفاصيل السريرية (اختياري عند إرفاق صورة)')}>
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
                    label={`${t('Diagnosis (ICD if available)', 'التشخيص (إن وُجد ICD)')}${!imgbbURL ? ' *' : ''}`}
                    fullWidth
                    required={!imgbbURL}
                    value={form.diagnosis}
                    onChange={onChange('diagnosis')}
                    error={!imgbbURL && Boolean(errors.diagnosis)}
                    helperText={!imgbbURL && errors.diagnosis ? t('Diagnosis is required (or attach an image)', 'التشخيص مطلوب (أو أرفق صورة)') : `${form.diagnosis.length}/200`}
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

            <Section icon={<MonitorHeartIcon fontSize="small" />} title={t('Vitals (optional if image attached)', 'العلامات الحيوية (اختياري عند إرفاق صورة)')}>
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

            <Section icon={<MedicationIcon fontSize="small" />} title={t('Medications / Prescriptions (optional if image attached)', 'الأدوية / الوصفات (اختياري عند إرفاق صورة)')}>
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

            <Section icon={<ScienceIcon fontSize="small" />} title={t('Required: Medical tests (optional if image attached)', 'مطلوب: فحوصات طبية (اختياري عند إرفاق صورة)')}>
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
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => !submitting && onClose?.()} disabled={submitting}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={submit} variant="contained" disabled={submitting || attaching} sx={{ minWidth: 140 }}>
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
