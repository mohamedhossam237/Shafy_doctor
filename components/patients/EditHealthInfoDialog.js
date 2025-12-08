'use client';

import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Box,
  Typography,
  Stack,
  Divider,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function EditHealthInfoDialog({ open, onClose, patient, t, onSave, isArabic }) {
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const translate = React.useCallback(
    (en, ar) => (typeof t === 'function' ? t(en, ar) : isArabic ? ar : en),
    [t, isArabic]
  );

  React.useEffect(() => {
    if (patient) {
      setForm({
        isDiabetic: !!patient.isDiabetic,
        hadSurgeries: !!patient.hadSurgeries,
        isSmoker: !!patient.isSmoker,
        drinksAlcohol: !!patient.drinksAlcohol,
        familyHistory: !!patient.familyHistory,
        isPregnant: !!patient.isPregnant,
        gender: patient.gender || '',
      });
    }
  }, [patient]);

  const handleBool = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value === 'true' }));

  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      const ref = doc(db, 'patients', patient.id);
      await updateDoc(ref, {
        isDiabetic: !!form.isDiabetic,
        hadSurgeries: !!form.hadSurgeries,
        isSmoker: !!form.isSmoker,
        drinksAlcohol: !!form.drinksAlcohol,
        familyHistory: !!form.familyHistory,
        isPregnant: !!form.isPregnant,
        updatedAt: new Date(),
      });

      onSave?.(form);
      setSnack({
        open: true,
        msg: translate('Health information updated successfully', 'تم تحديث المعلومات الصحية بنجاح'),
        severity: 'success',
      });
      onClose?.();
    } catch (err) {
      console.error('❌ Error updating health info:', err);
      setSnack({
        open: true,
        msg: translate('Failed to update health information', 'فشل في تحديث المعلومات الصحية'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const questions = [
    { key: 'isDiabetic', label: translate('Is the patient diabetic?', 'هل المريض مصاب بالسكري؟') },
    { key: 'hadSurgeries', label: translate('Has the patient had surgeries?', 'هل خضع المريض لعمليات؟') },
    { key: 'isSmoker', label: translate('Does the patient smoke?', 'هل المريض مدخن؟') },
    { key: 'drinksAlcohol', label: translate('Does the patient drink alcohol?', 'هل يشرب المريض الكحول؟') },
    { key: 'familyHistory', label: translate('Family history of similar diseases?', 'هل يوجد تاريخ عائلي لأمراض مشابهة؟') },
  ];

  if (form.gender?.toLowerCase() === 'female') {
    questions.push({ key: 'isPregnant', label: translate('Is the patient pregnant?', 'هل المريضة حامل؟') });
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={!saving ? onClose : undefined}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: (t) => t.palette.background.default,
            p: 0,
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 900,
            textAlign: isArabic ? 'right' : 'left',
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            bgcolor: (t) => t.palette.grey[50],
            py: 2,
          }}
        >
          {translate('Edit Health Information', 'تعديل المعلومات الصحية')}
        </DialogTitle>

        <DialogContent dividers sx={{ py: 3, px: 2.5 }}>
          {patient ? (
            <Stack spacing={2.5}>
              {questions.map((q, i) => (
                <Paper
                  key={q.key}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: (t) => t.palette.background.paper,
                    boxShadow: 1,
                    '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
                    direction: isArabic ? 'rtl' : 'ltr',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={2}
                    flexWrap="wrap"
                  >
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      {`${i + 1}. ${q.label}`}
                    </Typography>
                    <RadioGroup
                      row
                      value={String(form[q.key] ?? false)}
                      onChange={handleBool(q.key)}
                      sx={{
                        gap: 1,
                        justifyContent: isArabic ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <FormControlLabel
                        value="true"
                        control={<Radio color="primary" />}
                        label={translate('Yes', 'نعم')}
                      />
                      <FormControlLabel
                        value="false"
                        control={<Radio color="primary" />}
                        label={translate('No', 'لا')}
                      />
                    </RadioGroup>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>

        <Divider />

        <DialogActions
          sx={{
            flexDirection: isArabic ? 'row-reverse' : 'row',
            gap: 1.5,
            p: 2,
          }}
        >
          <Button onClick={onClose} disabled={saving} variant="outlined">
            {translate('Cancel', 'إلغاء')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              px: 3,
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            {saving ? translate('Saving...', 'جارٍ الحفظ...') : translate('Save', 'حفظ')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </>
  );
}
