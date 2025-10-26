'use client';
import * as React from 'react';
import {
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { alpha } from '@mui/material/styles';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import SectionWrapper from './SectionWrapper';

/**
 * PatientSection — allows selecting an existing patient and displays demographic data
 */
export default function PatientSection({
  t,
  user,
  open,
  form,
  setForm,
  errors,
  setErrors,
}) {
  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);
  const [demo, setDemo] = React.useState({ mrn: '', sex: '', dobStr: '', phone: '' });

  // load patients for current doctor
  React.useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
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
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, {
            sensitivity: 'base',
          })
        );
        setPatients(rows);
      } catch (e) {
        console.error('Failed loading patients', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user]);

  // fetch demographics
  const fetchPatientDemographics = async (patientId) => {
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
      const dobStr =
        dob && !isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : '';
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
  };

  return (
    <SectionWrapper
      icon={<PersonIcon fontSize="small" />}
      title={t('Patient & Demographics', 'المريض والبيانات الديموغرافية')}
    >
      <Grid container spacing={2}>
        {/* Patient Selector */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={patients}
            loading={loading}
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
                helperText={
                  errors.patientID
                    ? t('Select a patient for this report', 'يرجى اختيار المريض لهذا التقرير')
                    : ' '
                }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        {/* Demographics */}
        <Grid item xs={12} md={6}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t2) => alpha(t2.palette.primary.light, 0.06),
            }}
          >
            <Grid container spacing={1}>
              <Grid item xs={6} sm={3.5}>
                <Typography variant="caption" color="text.secondary">
                  {t('MRN', 'رقم الملف')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.mrn || '-'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={2.5}>
                <Typography variant="caption" color="text.secondary">
                  {t('Sex', 'النوع')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.sex || '-'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  {t('DOB', 'تاريخ الميلاد')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.dobStr || '-'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  {t('Phone', 'هاتف')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.phone || '-'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </SectionWrapper>
  );
}
