'use client';
import * as React from 'react';
import {
  Grid,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  CircularProgress,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Stack,
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { alpha } from '@mui/material/styles';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import SectionWrapper from './SectionWrapper';

export default function MedicationsSection({
  t,
  medicationsList,
  updateMedication,
  addMedication,
  removeMedication,
  drugOptions,
  drugLoading,
  debouncedSetQuery,
  isArabic,
}) {
  const [openAddDrug, setOpenAddDrug] = React.useState(false);
  const [newDrug, setNewDrug] = React.useState({
    displayName: '',
    genericName: '',
    brandName: '',
    strength: '',
    form: '',
    route: '',
  });

  const handleSaveNewDrug = async () => {
    if (!newDrug.displayName.trim()) return;

    await addDoc(collection(db, 'medicines_custom'), {
      ...newDrug,
      createdAt: serverTimestamp(),
    });

    setNewDrug({
      displayName: '',
      genericName: '',
      brandName: '',
      strength: '',
      form: '',
      route: '',
    });

    setOpenAddDrug(false);
  };

  // Filter list
  const filterDrugs = React.useCallback((q = '', list = []) => {
    const n = q.toLowerCase().trim();
    if (!n) return list.slice(0, 100);

    return list
      .filter(
        (d) =>
          d.displayName?.toLowerCase().includes(n) ||
          d.genericName?.toLowerCase().includes(n) ||
          d.brandName?.toLowerCase().includes(n)
      )
      .slice(0, 100);
  }, []);

  return (
    <SectionWrapper
      icon={<MedicationIcon fontSize="small" />}
      title={t(
        'Medications / Prescriptions (optional)',
        'الأدوية / الوصفات'
      )}
    >
      <Stack spacing={1.5}>
        {/* -------- Add New Medicine Button -------- */}
        <Button
          variant="outlined"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setOpenAddDrug(true)}
        >
          {t('Add New Medicine', 'إضافة دواء جديد')}
        </Button>

        {/* --------- Add New Drug Dialog --------- */}
        <Dialog open={openAddDrug} onClose={() => setOpenAddDrug(false)}>
          <DialogTitle>{t('Add Medicine', 'إضافة دواء')}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label={t('Display Name', 'الاسم الظاهر')}
                value={newDrug.displayName}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, displayName: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label={t('Generic Name', 'الاسم العلمي')}
                value={newDrug.genericName}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, genericName: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label={t('Brand Name', 'الاسم التجاري')}
                value={newDrug.brandName}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, brandName: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label={t('Strength', 'التركيز')}
                value={newDrug.strength}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, strength: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label={t('Form', 'التركيب')}
                value={newDrug.form}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, form: e.target.value }))
                }
                fullWidth
              />

              <TextField
                label={t('Route', 'طريقة الاستخدام')}
                value={newDrug.route}
                onChange={(e) =>
                  setNewDrug((d) => ({ ...d, route: e.target.value }))
                }
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDrug(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button variant="contained" onClick={handleSaveNewDrug}>
              {t('Save', 'حفظ')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* -------- Medicines List -------- */}
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
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  autoHighlight
                  loading={drugLoading}
                  options={filterDrugs('', drugOptions)}
                  value={m.name || ''}
                  onInputChange={(_, v) => {
                    updateMedication(idx, 'name', v || '');
                    debouncedSetQuery?.(v || '');
                  }}
                  getOptionLabel={(opt) => {
                    if (typeof opt === 'string') return opt;
                    return (
                      opt.displayName ||
                      opt.brandName ||
                      opt.genericName ||
                      ''
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Medicine name', 'اسم الدواء')}
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {drugLoading ? (
                              <CircularProgress size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={6} md={2}>
                <TextField
                  label={t('Dose', 'الجرعة')}
                  fullWidth
                  value={m.dose}
                  onChange={(e) =>
                    updateMedication(idx, 'dose', e.target.value)
                  }
                />
              </Grid>

              <Grid item xs={6} md={3}>
                <TextField
                  label={t('Frequency', 'التكرار')}
                  fullWidth
                  value={m.frequency}
                  onChange={(e) =>
                    updateMedication(idx, 'frequency', e.target.value)
                  }
                />
              </Grid>

              <Grid item xs={6} md={2}>
                <TextField
                  label={t('Duration', 'المدة')}
                  fullWidth
                  value={m.duration}
                  onChange={(e) =>
                    updateMedication(idx, 'duration', e.target.value)
                  }
                />
              </Grid>

              <Grid item xs={12} md="auto">
                <IconButton
                  color="error"
                  onClick={() => removeMedication(idx)}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Paper>
        ))}

        <Button
          onClick={addMedication}
          startIcon={<AddCircleOutlineIcon />}
          variant="outlined"
        >
          {t('Add medicine', 'إضافة دواء')}
        </Button>
      </Stack>
    </SectionWrapper>
  );
}
