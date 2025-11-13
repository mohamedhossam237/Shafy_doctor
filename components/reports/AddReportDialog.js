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
} from '@mui/material';
import { useAuth } from '@/providers/AuthProvider';

import AttachmentSection from './reports/sections/AttachmentSection';
import PatientSection from './reports/sections/PatientSection';
import MetaSection from './reports/sections/MetaSection';
import ClinicalSection from './reports/sections/ClinicalSection';
import VitalsSection from './reports/sections/VitalsSection';
import MedicationsSection from './reports/sections/MedicationsSection';
import TestsSection from './reports/sections/TestsSection';



/**
 * AddReportDialog — main dialog for creating a new medical report
 * - Arabic is the main language by default
 * - English is used only if selected in LanguageContext
 * - Fetches patients linked to the logged-in doctor (registeredBy = doctor.uid)
 */
export default function AddReportDialog({ open, onClose }) {
  const { currentUser } = useAuth();
  const { isArabic } = React.useContext(LanguageContext);

  // ✅ Translation helper: Arabic as main, English if not Arabic
  const t = React.useCallback(
    (en, ar) => (isArabic ? ar : en),
    [isArabic]
  );

  // === States ===
  const [form, setForm] = React.useState({
    titleAr: '',
    titleEn: '',
    dateStr: '',
    diagnosis: '',
    findings: '',
    procedures: '',
    chiefComplaint: '',
    patientID: '',
    patientName: '',
    vitalsBP: '',
    vitalsHR: '',
    vitalsTemp: '',
    vitalsSpO2: '',
  });

  const [errors, setErrors] = React.useState({});
  const [previewURL, setPreviewURL] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [imgbbURL, setImgbbURL] = React.useState('');
  const [attaching, setAttaching] = React.useState(false);
  const [snack, setSnack] = React.useState({
    open: false,
    msg: '',
    severity: 'info',
  });

  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);
  const [testsList, setTestsList] = React.useState([{ name: '', notes: '' }]);

  // === Medications handlers ===
  const addMedication = () =>
    setMedicationsList((prev) => [
      ...prev,
      { name: '', dose: '', frequency: '', duration: '', notes: '' },
    ]);
  const removeMedication = (i) =>
    setMedicationsList((prev) => prev.filter((_, idx) => idx !== i));
  const updateMedication = (i, key, val) =>
    setMedicationsList((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [key]: val } : m))
    );

  // === Tests handlers ===
  const addTest = () =>
    setTestsList((prev) => [...prev, { name: '', notes: '' }]);
  const removeTest = (i) =>
    setTestsList((prev) => prev.filter((_, idx) => idx !== i));
  const updateTest = (i, key, val) =>
    setTestsList((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [key]: val } : m))
    );

  // === Submit handler ===
  const handleSubmit = async () => {
    if (!form.patientID) {
      setErrors((e) => ({ ...e, patientID: true }));
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please select a patient.', 'يرجى اختيار المريض.'),
      });
      return;
    }

    // ✅ Placeholder for actual save logic (Firestore or API)
    console.log('Submitting report:', {
      ...form,
      imgbbURL,
      medicationsList,
      testsList,
    });

    setSnack({
      open: true,
      severity: 'success',
      msg: t('Report saved successfully!', 'تم حفظ التقرير بنجاح!'),
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{t('Add Medical Report', 'إضافة تقرير طبي')}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ my: 1 }}>
            <AttachmentSection
              {...{
                t,
                previewURL,
                setPreviewURL,
                fileName,
                setFileName,
                setImgbbURL,
                attaching,
                setAttaching,
                setSnack,
              }}
            />

            {/* ✅ Patient section fetches patients linked to currentUser */}
            <PatientSection
              {...{
                t,
                user: currentUser,
                open,
                form,
                setForm,
                errors,
                setErrors,
              }}
            />

            <MetaSection {...{ t, form, setForm, errors, imgbbURL }} />

            <ClinicalSection
              {...{
                t,
                form,
                setForm,
                errors,
                imgbbURL,
                doctorSpecialty: 'General Medicine',
                lang: isArabic ? 'ar' : 'en',
              }}
            />

            <VitalsSection {...{ t, form, setForm }} />

            <MedicationsSection
              {...{
                t,
                medicationsList,
                updateMedication,
                addMedication,
                removeMedication,
              }}
            />

            <TestsSection
              {...{
                t,
                testsList,
                updateTest,
                addTest,
                removeTest,
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('Save', 'حفظ')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </>
  );
}
