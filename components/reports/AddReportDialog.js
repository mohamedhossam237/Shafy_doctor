'use client';

import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Snackbar,
  Alert,
  Chip,
  IconButton,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { useTheme, alpha } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

// --- Section Components ---
import AttachmentSection from './sections/AttachmentSection';
import PatientSection from './sections/PatientSection';
import MetaSection from './sections/MetaSection';
import ClinicalSection from './sections/ClinicalSection';
import VitalsSection from './sections/VitalsSection';
import MedicationsSection from './sections/MedicationsSection';
import TestsSection from './sections/TestsSection';

// --- Utils ---
import { uploadImageToImgbb } from './utils/imgbb';
import { printElement } from './utils/printUtils';

export default function AddReportDialog({ open, onClose, isArabic, onSaved, appointmentId }) {
  const { user } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  // ---------- State ----------
  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const [form, setForm] = React.useState({
    titleEn: '',
    titleAr: '',
    dateStr: new Date().toISOString().slice(0, 16),
    patientName: '',
    patientID: '',
    chiefComplaint: '',
    findings: '',
    diagnosis: '',
    procedures: '',
    vitalsBP: '',
    vitalsHR: '',
    vitalsTemp: '',
    vitalsSpO2: '',
  });

  const [errors, setErrors] = React.useState({});
  const [attaching, setAttaching] = React.useState(false);
  const [fileName, setFileName] = React.useState('');
  const [previewURL, setPreviewURL] = React.useState('');
  const [imgbbURL, setImgbbURL] = React.useState('');

  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);
  const [testsList, setTestsList] = React.useState([{ name: '', notes: '' }]);

  // ---------- Drug list (cached locally) ----------
  const [drugOptions, setDrugOptions] = React.useState([]);
  const [drugLoading, setDrugLoading] = React.useState(false);
  const [drugQuery, setDrugQuery] = React.useState('');

  // Filter utility for drug dictionary
  const filterDrugs = React.useMemo(() => {
    const norm = (s = '') => s.toLowerCase().trim();
    return (q, list) => {
      const n = norm(q);
      if (!n) return list.slice(0, 100);
      return list
        .filter(
          (d) =>
            d.displayName?.toLowerCase().includes(n) ||
            d.genericName?.toLowerCase().includes(n) ||
            d.brandName?.toLowerCase().includes(n)
        )
        .slice(0, 100);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setDrugLoading(true);
        const res = await fetch('/data/medicines.min.json', { cache: 'force-cache' });
        const all = await res.json();
        setDrugOptions(all || []);
      } catch (e) {
        console.error(e);
      } finally {
        setDrugLoading(false);
      }
    })();
  }, [open]);

  // ---------- Reset on close ----------
  React.useEffect(() => {
    if (!open) return;
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
    };
  }, [open, previewURL]);

  // ---------- File Upload ----------
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSnack({ open: true, msg: t('Only images are supported.', 'فقط الصور مدعومة.'), severity: 'error' });
      return;
    }

    setPreviewURL(URL.createObjectURL(file));
    setFileName(file.name);
    setAttaching(true);

    try {
      const url = await uploadImageToImgbb(file);
      setImgbbURL(url);
      setSnack({ open: true, msg: t('Image uploaded successfully.', 'تم رفع الصورة بنجاح.'), severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: err.message, severity: 'error' });
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

  // ---------- Form Logic ----------
  const updateMedication = (idx, key, value) => {
    setMedicationsList((list) => {
      const next = [...list];
      next[idx][key] = value;
      return next;
    });
  };
  const addMedication = () => setMedicationsList((list) => [...list, { name: '', dose: '', frequency: '', duration: '', notes: '' }]);
  const removeMedication = (idx) => setMedicationsList((list) => list.filter((_, i) => i !== idx));

  const updateTest = (idx, key, value) => {
    setTestsList((list) => {
      const next = [...list];
      next[idx][key] = value;
      return next;
    });
  };
  const addTest = () => setTestsList((list) => [...list, { name: '', notes: '' }]);
  const removeTest = (idx) => setTestsList((list) => list.filter((_, i) => i !== idx));

  // ---------- Validation ----------
  const validate = () => {
    const next = {};
    if (!form.patientID) next.patientID = true;
    if (!imgbbURL && !form.diagnosis) next.diagnosis = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ---------- Submit ----------
  const submit = async () => {
    if (!user) return;
    if (!validate()) {
      setSnack({ open: true, msg: t('Please complete required fields.', 'يرجى استكمال الحقول المطلوبة.'), severity: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctorUID: user.uid,
        patientID: form.patientID,
        patientName: form.patientName,
        titleEn: form.titleEn,
        titleAr: form.titleAr,
        diagnosis: form.diagnosis,
        chiefComplaint: form.chiefComplaint,
        findings: form.findings,
        procedures: form.procedures,
        vitals: {
          bp: form.vitalsBP,
          hr: form.vitalsHR,
          temp: form.vitalsTemp,
          spo2: form.vitalsSpO2,
        },
        medicationsList,
        testsList,
        attachment: imgbbURL || '',
        createdAt: serverTimestamp(),
        appointmentId: appointmentId || null,
      };

      const docRef = await addDoc(collection(db, 'reports'), payload);
      onSaved?.({ id: docRef.id, ...payload });

      setSnack({ open: true, msg: t('Report saved successfully.', 'تم حفظ التقرير بنجاح.'), severity: 'success' });
      onClose?.();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: err.message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Print ----------
  const handlePrint = () => printElement('reportPrintArea', { title: 'Medical Report' });

  // ---------- Render ----------
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
          sx: {
            direction: dir,
            textAlign: isArabic ? 'right' : 'left',
            borderRadius: fullScreen ? 0 : 3,
          },
        }}
      >
        {/* Header */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Chip
              icon={<LocalHospitalIcon />}
              label={t('Clinical Report', 'تقرير سريري')}
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 0.3 }}
            />
          </Stack>
          <IconButton onClick={() => !submitting && onClose?.()} disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Content */}
        <DialogContent
          dividers
          sx={{
            background:
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.light, 0.04)
                : alpha(theme.palette.primary.dark, 0.12),
          }}
        >
          <Stack spacing={2.5}>
            <AttachmentSection
              t={t}
              fileName={fileName}
              previewURL={previewURL}
              onPickFile={onPickFile}
              clearFile={clearFile}
              imgbbURL={imgbbURL}
              attaching={attaching}
            />

            <PatientSection
              t={t}
              user={user}
              open={open}
              form={form}
              setForm={setForm}
              errors={errors}
              setErrors={setErrors}
            />

            <MetaSection t={t} form={form} setForm={setForm} errors={errors} imgbbURL={imgbbURL} />
            <ClinicalSection t={t} form={form} setForm={setForm} errors={errors} imgbbURL={imgbbURL} />
            <VitalsSection t={t} form={form} setForm={setForm} />
            <MedicationsSection
              t={t}
              medicationsList={medicationsList}
              updateMedication={updateMedication}
              addMedication={addMedication}
              removeMedication={removeMedication}
              drugOptions={drugOptions}
              drugLoading={drugLoading}
              filterDrugs={filterDrugs}
              debouncedSetQuery={(v) => setDrugQuery(v)}
              isArabic={isArabic}
            />
            <TestsSection
              t={t}
              testsList={testsList}
              updateTest={updateTest}
              addTest={addTest}
              removeTest={removeTest}
            />
          </Stack>
        </DialogContent>

        {/* Actions */}
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button onClick={handlePrint} variant="outlined">
            {t('Print Report', 'طباعة التقرير')}
          </Button>
          <Box flex={1} />
          <Button onClick={() => !submitting && onClose?.()}>{t('Cancel', 'إلغاء')}</Button>
          <Button
            onClick={submit}
            variant="contained"
            disabled={submitting || attaching}
            sx={{
              minWidth: 140,
              bgcolor: theme.palette.primary.main,
              '&:hover': { bgcolor: theme.palette.primary.dark },
            }}
          >
            {submitting ? t('Saving...', 'جارٍ الحفظ...') : t('Save Report', 'حفظ التقرير')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
