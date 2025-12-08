'use client';
import * as React from 'react';
import {
  Grid,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { alpha } from '@mui/material/styles';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import SectionWrapper from './SectionWrapper';

export default function PatientSection({
  t,
  user,
  open,
  form,
  setForm,
  errors = {},
  setErrors,
  isArabic = true,
}) {
  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);
  const [demo, setDemo] = React.useState({
    mrn: '',
    sex: '',
    dobStr: '',
    phone: '',
  });

  const direction = isArabic ? 'rtl' : 'ltr';
  const align = isArabic ? 'right' : 'left';

  /* ------------------------------------ */
  /* 🔥 Load Patients (same logic as list) */
  /* ------------------------------------ */
  React.useEffect(() => {
    if (!open || !user?.uid) return;

    setLoading(true);

    try {
      const col = collection(db, 'patients');

      const q1 = query(col, where('associatedDoctors', 'array-contains', user.uid));
      const q2 = query(col, where('registeredBy', '==', user.uid));

      const unsub1 = onSnapshot(q1, (snap1) => {
        const data1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

        const unsub2 = onSnapshot(q2, (snap2) => {
          const data2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

          // merge + dedupe
          const combined = [...data1, ...data2];
          const unique = Object.values(
            combined.reduce((acc, cur) => {
              acc[cur.id] = cur;
              return acc;
            }, {})
          );

          // Filter: must have phone
          const withPhone = unique.filter(
            (p) => typeof p.phone === 'string' && p.phone.trim() !== ''
          );

          // Sort A-Z
          withPhone.sort((a, b) =>
            (a?.name ?? '').localeCompare(b?.name ?? '', undefined, { sensitivity: 'base' })
          );

          setPatients(withPhone);
          setLoading(false);
        });

        return () => {
          unsub1();
          unsub2();
        };
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [open, user?.uid]);

  /* ------------------------------------ */
  /* Load demographics                    */
  /* ------------------------------------ */
  const fetchPatientDemographics = async (patientId) => {
    try {
      if (!patientId) {
        setDemo({ mrn: '', sex: '', dobStr: '', phone: '' });
        return;
      }

      const snap = await getDoc(doc(db, 'patients', patientId));
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
    } catch (err) {
      console.error(err);
    }
  };

  /* ------------------------------------ */
  /* Filter search                        */
  /* ------------------------------------ */
  const filterOptions = (options, { inputValue }) => {
    if (!inputValue) return options;

    const q = inputValue.toLowerCase();
    return options.filter((opt) => {
      const name = (opt.name || '').toLowerCase();
      const phone = (opt.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  };

  return (
    <SectionWrapper
      icon={<PersonIcon fontSize="small" />}
      title={t('Patient & Demographics', 'المريض والبيانات الديموغرافية')}
    >
      <Grid container spacing={2} sx={{ direction }}>
        {/* Selector */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={patients}
            loading={loading}
            filterOptions={filterOptions}
            value={selectedPatient}
            onChange={async (_, value) => {
              setSelectedPatient(value);

              const id = value?.id || '';

              setForm((f) => ({ ...f, patientID: id, patientName: value?.name || '' }));

              if (setErrors) setErrors((prev) => ({ ...prev, patientID: undefined }));

              await fetchPatientDemographics(id);
            }}
            getOptionLabel={(opt) => opt?.name || ''}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            noOptionsText={t('No patients found', 'لا يوجد مرضى')}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('Select Patient *', 'اختر المريض *')}
                placeholder={t('Search by name or phone', 'ابحث بالاسم أو الهاتف')}
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
                      {loading && <CircularProgress size={18} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{ textAlign: align }}
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
              bgcolor: (theme) => alpha(theme.palette.primary.light, 0.06),
              direction,
              textAlign: align,
            }}
          >
            <Grid container spacing={1}>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption">{t('MRN', 'رقم الملف')}</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.mrn || '-'}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={2.5}>
                <Typography variant="caption">{t('Sex', 'النوع')}</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.sex || '-'}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Typography variant="caption">{t('DOB', 'تاريخ الميلاد')}</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {demo.dobStr || '-'}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Typography variant="caption">{t('Phone', 'هاتف')}</Typography>
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
