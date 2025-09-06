// /components/reports/AddLabReportDialog.jsx
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
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  CircularProgress,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

import CloseIcon from '@mui/icons-material/Close';
import ScienceIcon from '@mui/icons-material/Science';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import EventIcon from '@mui/icons-material/Event';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AttachmentIcon from '@mui/icons-material/Attachment';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SmartToyIcon from '@mui/icons-material/SmartToy';

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

/* ---------------- helpers ---------------- */

function toLocalDatetimeInputString(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function parseDateLoose(s) {
  if (!s) return null;
  const tryDates = [
    () => new Date(s),
    () => {
      const m = String(s).match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
      if (!m) return null; return new Date(+m[1], +m[2]-1, +m[3]);
    },
    () => {
      const m = String(s).match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
      if (!m) return null;
      let y = +m[3]; if (y < 100) y += 2000;
      // assume D/M/Y
      return new Date(y, +m[2]-1, +m[1]);
    },
  ];
  for (const f of tryDates) {
    const dt = f();
    if (dt && !isNaN(dt.getTime())) return dt;
  }
  return null;
}

/* ---------- simple OCR parsing (fallback if AI fails) ---------- */
function parseOcrToTests(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    if (/^(patient|name|mrn|id|age|sex|lab|laboratory|report|specimen|sample|date|time|page|physician|doctor|reference|range|ref)/i.test(line)) {
      continue;
    }
    const m = line.match(/[-+]?\d+(?:[.,]\d+)?/);
    if (!m) continue;
    const resultVal = (m[0] || '').replace(',', '.');
    const before = line.slice(0, m.index).replace(/[.:]+$/, '').trim();
    let after = line.slice(m.index + m[0].length).trim();

    const unitMatch = after.match(/^([A-Za-zµμ%\/\.\*\^\-]+)\s*/);
    const unit = unitMatch ? unitMatch[1] : '';
    after = unitMatch ? after.slice(unitMatch[0].length).trim() : after;

    const refMatch = after.match(/(\d+(?:[.,]\d+)?)\s*[-–to]+\s*(\d+(?:[.,]\d+)?)/i);
    const refRange = refMatch ? `${refMatch[1]} - ${refMatch[2]}` : '';

    rows.push({
      test: before || '',
      result: resultVal || '',
      unit,
      refRange,
      flag: '',
      notes: '',
    });
  }
  return rows.filter((r) => r.test || r.result).slice(0, 60);
}

/* ---------------- component ---------------- */

export default function AddLabReportDialog({
  open,
  onClose,
  isArabic,
  onSaved,
  appointmentId, // optional: link to specific appointment if provided
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  // Base fields
  const [form, setForm] = React.useState({
    title: '',
    resultDateStr: toLocalDatetimeInputString(new Date()),
    labName: '',
    specimen: '',
    interpretation: '',
    notes: '',
    followUpStr: '',
    patientID: '',
    patientName: '',
  });
  const [errors, setErrors] = React.useState({});

  // Patients
  const [patients, setPatients] = React.useState([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);

  // Tests (dynamic rows)
  const [tests, setTests] = React.useState([
    { test: '', result: '', unit: '', refRange: '', flag: '', notes: '' },
  ]);

  // Attachment(s)
  const [file, setFile] = React.useState(null);
  const [fileName, setFileName] = React.useState('');

  // OCR state
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);
  const [ocrText, setOcrText] = React.useState('');
  const [ocrPreviewURL, setOcrPreviewURL] = React.useState('');

  // AI fill state
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiLastJSON, setAiLastJSON] = React.useState(null);

  const onChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const updateTest = (idx, key, value) =>
    setTests((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });

  const addTestRow = () => setTests((prev) => [...prev, { test: '', result: '', unit: '', refRange: '', flag: '', notes: '' }]);
  const removeTestRow = (idx) =>
    setTests((prev) => (prev.length <= 1 ? [{ test: '', result: '', unit: '', refRange: '', flag: '', notes: '' }] : prev.filter((_, i) => i !== idx)));

  const pickFileForAttachment = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
  };
  const clearFile = () => {
    setFile(null);
    setFileName('');
  };

  const readFileAsDataURL = (f) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(f);
    });

  // ---- OCR handlers ----
  const startOcrFromFile = async (f) => {
    if (!f) return;
    if (ocrPreviewURL) URL.revokeObjectURL(ocrPreviewURL);
    setOcrPreviewURL(URL.createObjectURL(f));

    setOcrBusy(true);
    setOcrProgress(5);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(f, 'eng+ara', {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      setOcrText(data?.text || '');
      setSnack({ open: true, severity: 'success', msg: t('OCR complete. You can use AI to fill the form.', 'اكتمل OCR. يمكنك استخدام الذكاء الاصطناعي لملء النموذج.') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('OCR failed. Try a clearer photo.', 'فشل التعرف الضوئي. جرّب صورة أوضح.') });
    } finally {
      setOcrBusy(false);
    }
  };

  // ---- AI fill from OCR via /api/ask-shafy ----
  const runAIFill = async () => {
    if (!ocrText && !ocrPreviewURL) {
      setSnack({ open: true, severity: 'warning', msg: t('Scan or upload a paper first.', 'قم بمسح/رفع الورقة أولاً.') });
      return;
    }
    setAiBusy(true);
    setAiLastJSON(null);
    try {
      let imageDataURL = '';
      // if we still have the original file in preview blob, try to fetch it from the <input> capture,
      // otherwise skip image and rely on text only.
      if (ocrPreviewURL) {
        // We don't have direct File here; if you want best results, also pass the file chosen for OCR.
        // For safety we skip converting objectURL to blob here and rely on text; DeepSeek works great with text.
      }
      // If you prefer passing the actual capture file to AI, hook into startOcrFromFile and store it.

      const schema = `{
  "title": "string (optional, short)",
  "resultDate": "ISO8601 or any common date format",
  "labName": "string",
  "specimen": "string",
  "tests": [
    {
      "test": "e.g. Hemoglobin",
      "result": "numeric or string",
      "unit": "string",
      "refRange": "string (min - max or textual)",
      "flag": "H/L/N or empty",
      "notes": "string"
    }
  ],
  "interpretation": "string",
  "notes": "string"
}`;

      const prompt = (isArabic ? `
أنت مساعد طبي يحول نص تقرير معمل (OCR) إلى JSON منظم فقط.
أعد كائن JSON صالحاً **فقط** وبدون أي شرح بغير JSON، وبالبنية التالية:
${schema}

احترم القيم الموجودة في النص قدر الإمكان، واترك أي حقل غير معروف كسلسلة فارغة.
النص (OCR):
"""${ocrText || ''}"""` : `
You are a medical assistant that converts a lab report (OCR text) into a structured JSON.
Return **only** a valid JSON object (no commentary) with this shape:
${schema}

Keep values faithful to the source; if unknown, use empty string.
OCR text:
"""${ocrText || ''}"""`);

      const r = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          // If you want to also send the photo, you can include a dataURL here:
          // images: imageDataURL ? [imageDataURL] : [],
          images: [],
          lang: isArabic ? 'ar' : 'en',
        }),
      });

      const data = await r.json();
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || 'AI request failed');
      }

      const text = String(data.text || '');
      // extract JSON from potential code fences
      const jsonMatch = text.match(/\{[\s\S]*\}$/m);
      let parsed = null;
      try {
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch {
        // fallback: try to salvage numbers table from OCR
        parsed = { tests: parseOcrToTests(ocrText || '') };
      }

      // Fill the form
      const dt = parseDateLoose(parsed?.resultDate);
      setForm((f) => ({
        ...f,
        title: parsed?.title || f.title,
        labName: parsed?.labName || f.labName,
        specimen: parsed?.specimen || f.specimen,
        interpretation: parsed?.interpretation || f.interpretation,
        notes: parsed?.notes || f.notes,
        resultDateStr: dt ? toLocalDatetimeInputString(dt) : f.resultDateStr,
      }));

      if (Array.isArray(parsed?.tests) && parsed.tests.length) {
        const norm = parsed.tests.map((row) => ({
          test: String(row?.test || '').trim(),
          result: String(row?.result || '').trim(),
          unit: String(row?.unit || '').trim(),
          refRange: String(row?.refRange || '').trim(),
          flag: String(row?.flag || '').trim(),
          notes: String(row?.notes || '').trim(),
        }));
        setTests(norm.length ? norm : parseOcrToTests(ocrText || ''));
      } else {
        setTests(parseOcrToTests(ocrText || ''));
      }

      setAiLastJSON(parsed || null);
      setSnack({ open: true, severity: 'success', msg: t('Form filled by AI. Review before saving.', 'تم ملء النموذج بالذكاء الاصطناعي. راجع قبل الحفظ.') });
    } catch (e) {
      console.error(e);
      setTests(parseOcrToTests(ocrText || ''));
      setSnack({ open: true, severity: 'error', msg: t('AI could not parse reliably. Used basic OCR instead.', 'تعذر على الذكاء الاصطناعي التحليل بدقة، تم استخدام OCR الأساسي.') });
    } finally {
      setAiBusy(false);
    }
  };

  // Load patients for this doctor
  React.useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setPatientsLoading(true);
      try {
        const qRef = query(collection(db, 'patients'), where('registeredBy', '==', user.uid));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return { id: d.id, name: String(data?.name ?? '').trim() || d.id, phone: data?.phone || data?.mobile || '' };
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

  // If opened from appointment, prefill patient
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
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open, appointmentId]);

  // Select the patient visually once options load
  React.useEffect(() => {
    if (!open) return;
    if (!form.patientID) return;
    if (selectedPatient?.id === form.patientID) return;
    const found = patients.find((p) => p.id === form.patientID);
    if (found) setSelectedPatient(found);
  }, [open, form.patientID, selectedPatient, patients]);

  const validate = () => {
    const next = {};
    if (!form.patientID) next.patientID = true;
    if (!form.resultDateStr || isNaN(new Date(form.resultDateStr).getTime())) next.resultDateStr = true;
    const anyTest = tests.some((t) => String(t.test || t.result || '').trim());
    if (!anyTest) next.tests = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

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
        const path = `reports_lab/${user.uid}/${Date.now()}_${file.name}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        attachments.push(url);
      }

      const resultAt = new Date(form.resultDateStr);
      const followUpDate = form.followUpStr ? new Date(form.followUpStr) : null;

      const payload = {
        type: 'lab',
        doctorUID: user.uid,
        title: form.title || (isArabic ? 'تقرير معملي' : 'Lab Report'),
        date: Timestamp.fromDate(isNaN(resultAt.getTime()) ? new Date() : resultAt),

        appointmentId: appointmentId ? String(appointmentId) : null,

        // patient link
        patientID: form.patientID,
        patientName: form.patientName || '',

        labName: form.labName || '',
        specimen: form.specimen || '',

        tests: tests
          .filter((t) => Object.values(t).some((v) => String(v || '').trim()))
          .map((t) => ({
            test: t.test || '',
            result: t.result || '',
            unit: t.unit || '',
            refRange: t.refRange || '',
            flag: t.flag || '',
            notes: t.notes || '',
          })),

        interpretation: form.interpretation || '',
        notes: form.notes || '',

        followUp:
          followUpDate && !isNaN(followUpDate.getTime())
            ? Timestamp.fromDate(followUpDate)
            : null,

        attachments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reports'), payload);

      onSaved?.({
        id: docRef.id,
        title: payload.title,
        type: 'lab',
        date: resultAt,
        patientID: payload.patientID,
        patientName: payload.patientName,
      });

      onClose?.();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: e?.message || t('Failed to add report', 'فشل إضافة التقرير') });
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Chip
              icon={<ScienceIcon />}
              label={t('Lab Report', 'تقرير معملي')}
              color="secondary"
              sx={{ fontWeight: 800, letterSpacing: 0.3 }}
            />
            <Typography variant="body2" color="text.secondary">{t('New entry', 'إدخال جديد')}</Typography>
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
                ? alpha(theme.palette.secondary.light, 0.05)
                : alpha(theme.palette.secondary.dark, 0.12),
          }}
        >
          <Stack spacing={2.25}>
            {/* OCR + AI row */}
            <Section icon={<PhotoCameraIcon fontSize="small" />} title={t('Scan from paper (OCR) & AI Fill', 'مسح من ورقة (OCR) وملء بالذكاء الاصطناعي')}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" flexWrap="wrap">
                <Button variant="outlined" startIcon={<PhotoCameraIcon />} component="label">
                  {t('Take Photo (OCR)', 'التقاط صورة (OCR)')}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && startOcrFromFile(e.target.files[0])}
                  />
                </Button>

                <Button variant="text" component="label" startIcon={<AttachmentIcon />}>
                  {t('Upload Image (OCR)', 'رفع صورة (OCR)')}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && startOcrFromFile(e.target.files[0])}
                  />
                </Button>

                <Button
                  variant="contained"
                  startIcon={<SmartToyIcon />}
                  onClick={runAIFill}
                  disabled={aiBusy || ocrBusy || (!ocrText && !ocrPreviewURL)}
                >
                  {aiBusy ? t('Filling…', 'جارٍ الملء…') : t('Use AI to fill', 'استخدم الذكاء الاصطناعي للملء')}
                </Button>

                {(ocrBusy || aiBusy) && (
                  <Stack sx={{ minWidth: 220 }}>
                    <Typography variant="caption" color="text.secondary">
                      {ocrBusy ? t('Reading…', 'جاري القراءة…') : t('Parsing with AI…', 'جاري التحليل بالذكاء الاصطناعي…')}
                    </Typography>
                    <LinearProgress variant={ocrBusy ? 'determinate' : 'indeterminate'} value={ocrProgress} />
                  </Stack>
                )}
              </Stack>

              {ocrPreviewURL && !ocrBusy && (
                <Box sx={{ mt: 1.25, borderRadius: 2, overflow: 'hidden', border: (t2) => `1px solid ${t2.palette.divider}` }}>
                  <Box sx={{ aspectRatio: '16 / 9', backgroundImage: `url(${ocrPreviewURL})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('Tip: Good lighting and a flat page improve accuracy.', 'نصيحة: الإضاءة الجيدة وورقة مسطحة تحسّنان الدقة.')}
              </Typography>
            </Section>

            {/* Meta */}
            <Section icon={<LocalHospitalIcon fontSize="small" />} title={t('Report Meta', 'بيانات التقرير')}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Title (optional)', 'العنوان (اختياري)')}
                    fullWidth
                    value={form.title}
                    onChange={onChange('title')}
                    inputProps={{ maxLength: 100 }}
                    helperText=" "
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="datetime-local"
                    label={t('Result date/time', 'تاريخ/وقت النتيجة')}
                    value={form.resultDateStr}
                    onChange={onChange('resultDateStr')}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={Boolean(errors.resultDateStr)}
                    helperText={errors.resultDateStr ? t('Invalid', 'غير صالح') : ' '}
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

            {/* Patient */}
            <Section icon={<LocalHospitalIcon fontSize="small" />} title={t('Patient', 'المريض')}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Autocomplete
                    options={patients}
                    loading={patientsLoading}
                    value={selectedPatient}
                    onChange={(_, value) => {
                      setSelectedPatient(value);
                      const id = value?.id || '';
                      setForm((f) => ({ ...f, patientID: id, patientName: value?.name || '' }));
                      setErrors((prev) => ({ ...prev, patientID: undefined }));
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
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('Specimen', 'العينة')}
                    fullWidth
                    value={form.specimen}
                    onChange={onChange('specimen')}
                    helperText=" "
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('Lab name', 'اسم المعمل')}
                    fullWidth
                    value={form.labName}
                    onChange={onChange('labName')}
                    helperText=" "
                  />
                </Grid>
              </Grid>
            </Section>

            {/* Tests */}
            <Section icon={<ScienceIcon fontSize="small" />} title={t('Tests', 'التحاليل')}>
              <Stack spacing={1.5}>
                {Boolean(errors.tests) && (
                  <Alert severity="warning">{t('Add at least one test', 'أضف فحصًا واحدًا على الأقل')}</Alert>
                )}

                {tests.map((row, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{ p: 1.25, borderRadius: 2, borderStyle: 'dashed', borderColor: (t2) => alpha(t2.palette.divider, 0.8) }}
                  >
                    <Grid container spacing={1.25} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <TextField
                          label={t('Test', 'الاختبار')}
                          fullWidth
                          value={row.test}
                          onChange={(e) => updateTest(idx, 'test', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField
                          label={t('Result', 'النتيجة')}
                          fullWidth
                          value={row.result}
                          onChange={(e) => updateTest(idx, 'result', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={1.5}>
                        <TextField
                          label={t('Unit', 'الوحدة')}
                          fullWidth
                          value={row.unit}
                          onChange={(e) => updateTest(idx, 'unit', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={2.5}>
                        <TextField
                          label={t('Reference range', 'المعدل المرجعي')}
                          fullWidth
                          value={row.refRange}
                          onChange={(e) => updateTest(idx, 'refRange', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} md={1.5}>
                        <TextField
                          label={t('Flag', 'دلالة')}
                          placeholder={t('H / L / N', 'مرتفع/منخفض/طبيعي')}
                          fullWidth
                          value={row.flag}
                          onChange={(e) => updateTest(idx, 'flag', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label={t('Notes', 'ملاحظات')}
                          fullWidth
                          value={row.notes}
                          onChange={(e) => updateTest(idx, 'notes', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md="auto">
                        <IconButton color="error" onClick={() => removeTestRow(idx)} aria-label={t('Remove', 'إزالة')}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}

                <Box>
                  <Button onClick={addTestRow} startIcon={<AddCircleOutlineIcon />} variant="outlined">
                    {t('Add test', 'إضافة تحليل')}
                  </Button>
                </Box>
              </Stack>

              {/* Optional: show last AI JSON for transparency */}
              {aiLastJSON && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('AI parsed JSON (for review)', 'JSON الذي استخرجه الذكاء الاصطناعي (للمراجعة)')}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, maxHeight: 160, overflow: 'auto', borderRadius: 2 }}>
                    <pre style={{ margin: 0, fontSize: 12, direction: 'ltr' }}>
                      {JSON.stringify(aiLastJSON, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Section>

            {/* Interpretation, follow-up, attachments */}
            <Section icon={<AttachmentIcon fontSize="small" />} title={t('Extras', 'مرفقات وخلاصة')}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label={t('Interpretation / Summary', 'الاستنتاج / الخلاصة')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.interpretation}
                    onChange={onChange('interpretation')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={t('Notes (optional)', 'ملاحظات (اختياري)')}
                    fullWidth
                    multiline
                    minRows={2}
                    value={form.notes}
                    onChange={onChange('notes')}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    type="datetime-local"
                    label={t('Follow-up (optional)', 'موعد المتابعة (اختياري)')}
                    value={form.followUpStr}
                    onChange={onChange('followUpStr')}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                    <Tooltip title={t('Attach image or PDF (optional)', 'إرفاق صورة أو ملف PDF (اختياري)')}>
                      <Button variant="outlined" startIcon={<AttachmentIcon />} component="label" sx={{ whiteSpace: 'nowrap' }}>
                        {t('Attach File', 'إرفاق ملف')}
                        <input type="file" hidden accept="image/*,application/pdf" onChange={pickFileForAttachment} />
                      </Button>
                    </Tooltip>
                    {fileName ? (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                        {fileName}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{t('Optional', 'اختياري')}</Typography>
                    )}
                    {!!fileName && (
                      <Button color="error" size="small" onClick={clearFile}>
                        {t('Remove', 'إزالة')}
                      </Button>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Section>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => !submitting && onClose?.()} disabled={submitting}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={submit} variant="contained" disabled={submitting} sx={{ minWidth: 160 }}>
            {submitting ? t('Saving...', 'جارٍ الحفظ...') : t('Save Lab Report', 'حفظ التقرير المعملي')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false })) }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false })) } variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
