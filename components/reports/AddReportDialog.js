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

import AttachmentSection from './sections/AttachmentSection';
import PatientSection from './sections/PatientSection';
import MetaSection from './sections/MetaSection';
import ClinicalSection from './sections/ClinicalSection';
import VitalsSection from './sections/VitalsSection';
import MedicationsSection from './sections/MedicationsSection';
import TestsSection from './sections/TestsSection';

/**
 * AddReportDialog — Arabic is default
 * fetches patients linked to doctor (same logic as PatientsIndex)
 */
export default function AddReportDialog({ open, onClose, isArabic = true }) {

  // ✅ IMPORTANT: Use "user" (NOT currentUser)
  const { user } = useAuth();

  // 🌐 Translation helper
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const direction = isArabic ? 'rtl' : 'ltr';
  const align = isArabic ? 'right' : 'left';

  // ------------------- FORM STATE -------------------
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

  // ------------------- LISTS -------------------
  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);

  const [testsList, setTestsList] = React.useState([{ name: '', notes: '' }]);

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

  const addTest = () => setTestsList((prev) => [...prev, { name: '', notes: '' }]);
  const removeTest = (i) => setTestsList((prev) => prev.filter((_, idx) => idx !== i));
  const updateTest = (i, key, val) =>
    setTestsList((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [key]: val } : m))
    );

  // ------------------- SUBMIT -------------------
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

    console.log('Submitting medical report:', {
      ...form,
      medicationsList,
      testsList,
      imgbbURL,
    });

    setSnack({
      open: true,
      severity: 'success',
      msg: t('Report saved successfully!', 'تم حفظ التقرير بنجاح!'),
    });

    onClose();
  };

  // ------------------- RENDER -------------------
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            direction,
            textAlign: align,
          },
        }}
      >
        <DialogTitle>{t('Add Medical Report', 'إضافة تقرير طبي')}</DialogTitle>

        <DialogContent dividers sx={{ direction }}>
          <Stack spacing={2.5} sx={{ my: 1 }}>
            
            {/* Attachments */}
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

            {/* Patient — uses FULL logic from PatientsIndex */}
            <PatientSection
              {...{
                t,
                user,
                open,
                form,
                setForm,
                errors,
                setErrors,
                isArabic,
              }}
            />

            {/* Meta */}
            <MetaSection {...{ t, form, setForm, errors, imgbbURL }} />

            {/* Clinical */}
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

            {/* Vitals */}
            <VitalsSection {...{ t, form, setForm }} />

            {/* Medications */}
            <MedicationsSection
              {...{
                t,
                medicationsList,
                updateMedication,
                addMedication,
                removeMedication,
                isArabic,
              }}
            />

            {/* Tests */}
            <TestsSection
              {...{
                t,
                testsList,
                updateTest,
                addTest,
                removeTest,
                isArabic,
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

      {/* Snackbar */}
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
