// /pages/patients/[id].jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Container, Stack, Typography, Paper, Grid, Chip, Button, Divider, Skeleton,
  Snackbar, Alert, Box, Avatar, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, IconButton, LinearProgress, Tabs, Tab, Fade, Drawer, Switch, FormControlLabel, MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TagIcon from '@mui/icons-material/Tag';
import HealthInfoSection from '@/components/patients/HealthInfoSection';
import MedicalFileIntake from '@/components/patients/MedicalFileIntake';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import AddLabReportDialog from '@/components/reports/AddLabReportDialog';
import { getAppointmentTypeInfo } from '@/lib/appointmentUtils';

/* ---------------- utils ---------------- */
function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') { const d = new Date(val); return Number.isNaN(d.getTime()) ? null : d; }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  try { return new Date(val); } catch { return null; }
}
const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalDateTimeInput = (val) => {
  const dt = toDate(val);
  if (!dt) return '';
  return `${toYMD(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

function apptDate(appt) {
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  return null;
}
function fmtApptFull(appt) {
  const d = apptDate(appt);
  if (!d) return '—';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtNiceDateTime(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(dt);
}
function fmtNiceDate(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(dt);
}
function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'cancelled') return 'default';
  return 'warning';
}
const splitCsv = (v) =>
  Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

/* -------- inline report viewer (read-only) -------- */
function ReportInlineView({ report, isArabic, onClose }) {
  if (!report) return null;
  const t = (en, ar) => (isArabic ? ar : en);
  const isLab = String(report?.type || '').toLowerCase() === 'lab';
  const meds =
    !isLab &&
      Array.isArray(report?.medicationsList) &&
      report.medicationsList.some(m => Object.values(m || {}).some(v => String(v || '').trim()))
      ? report.medicationsList
      : null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        inset: { xs: '8% 3% auto 3%', sm: '10% 10% auto 10%' },
        zIndex: (th) => th.zIndex.modal + 2,
        p: { xs: 1.75, sm: 2.25 },
        borderRadius: 3,
        overflowY: 'auto',
        maxHeight: '80vh',
        direction: isArabic ? 'rtl' : 'ltr',
        bgcolor: (th) => th.palette.background.paper,
        border: (th) => `1px solid ${th.palette.divider}`,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={isLab ? <ScienceIcon /> : <DescriptionIcon />}
              color={isLab ? 'secondary' : 'primary'}
              variant="filled"
              label={isLab ? t('Lab Report', 'تقرير معملي') : t('Clinical Report', 'تقرير سريري')}
              sx={{ fontWeight: 800, borderRadius: 2 }}
            />
            <Typography variant="subtitle2" color="text.secondary">
              {fmtNiceDateTime(report?.date)}
            </Typography>
          </Stack>
          <Button onClick={onClose} variant="outlined">{t('Close', 'إغلاق')}</Button>
        </Stack>

        <Divider />

        <Typography variant="h6" fontWeight={900} color="text.primary">
          {report?.titleAr || report?.titleEn || report?.title || (isLab ? t('Lab Report', 'تقرير معملي') : t('Medical Report', 'تقرير طبي'))}
        </Typography>

        {isLab ? (
          <>
            {(report?.labName || report?.specimen) && (
              <Typography color="text.primary">
                {report.labName ? `${t('Lab', 'المعمل')}: ${report.labName}` : ''}{report.labName && report.specimen ? ' • ' : ''}
                {report.specimen ? `${t('Specimen', 'العينة')}: ${report.specimen}` : ''}
              </Typography>
            )}

            {Array.isArray(report?.tests) && report.tests.length > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Test', 'الاختبار')}</TableCell>
                      <TableCell>{t('Result', 'النتيجة')}</TableCell>
                      <TableCell>{t('Unit', 'الوحدة')}</TableCell>
                      <TableCell>{t('Reference Range', 'المعدل المرجعي')}</TableCell>
                      <TableCell>{t('Flag', 'دلالة')}</TableCell>
                      <TableCell>{t('Notes', 'ملاحظات')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.tests.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r?.test || '—'}</TableCell>
                        <TableCell>{r?.result || '—'}</TableCell>
                        <TableCell>{r?.unit || '—'}</TableCell>
                        <TableCell>{r?.refRange || '—'}</TableCell>
                        <TableCell>{r?.flag || '—'}</TableCell>
                        <TableCell>{r?.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {report?.interpretation && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ mt: 1 }}>
                  {t('Interpretation', 'الاستنتاج')}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.interpretation}</Typography>
              </>
            )}
          </>
        ) : (
          <>
            <Typography color="text.primary">
              <strong>{t('Diagnosis', 'التشخيص')}:</strong> {report?.diagnosis || '—'}
            </Typography>
            {report?.chiefComplaint && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Chief Complaint', 'الشكوى الرئيسية')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.chiefComplaint}</Typography>
              </>
            )}
            {report?.findings && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Findings / Examination', 'النتائج / الفحص')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.findings}</Typography>
              </>
            )}
            {report?.procedures && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Procedures', 'الإجراءات')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.procedures}</Typography>
              </>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

/* ---------------- tidy subcomponents ---------------- */
const StatChip = ({ icon, label }) => (
  <Chip icon={icon} label={label} variant="outlined" sx={{ borderRadius: 1, fontWeight: 700 }} size="small" />
);

const Labeled = ({ title, children }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>{title}</Typography>
    <Box>{children}</Box>
  </Box>
);

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in>
          <Box sx={{ py: 3 }}>{children}</Box>
        </Fade>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */
export default function PatientDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [okMsg, setOkMsg] = React.useState('');
  const [patient, setPatient] = React.useState(null);

  // history
  const [repLoading, setRepLoading] = React.useState(true);
  const [reports, setReports] = React.useState([]);
  const [viewReport, setViewReport] = React.useState(null);
  const [labOpen, setLabOpen] = React.useState(false);

  const [apptLoading, setApptLoading] = React.useState(true);
  const [appts, setAppts] = React.useState([]);

  // AI
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiText, setAiText] = React.useState('');
  const [aiErr, setAiErr] = React.useState('');

  // external lab results
  const [xLabLoading, setXLabLoading] = React.useState(true);
  const [xLabResults, setXLabResults] = React.useState([]);

  // unified profile editor
  const [editAllOpen, setEditAllOpen] = React.useState(false);
  const [editAllValues, setEditAllValues] = React.useState(null);
  const [savingAll, setSavingAll] = React.useState(false);

  // inline editing states
  const [editMode, setEditMode] = React.useState({
    contact: false,
    clinical: false,
    vitals: false
  });
  const [tempValues, setTempValues] = React.useState({
    phone: '',
    email: '',
    address: '',
    maritalStatus: '',
    allergies: [],
    conditions: [],
    medications: [],
    weight: '',
    height: '',
    bloodPressure: '',
    temperature: ''
  });
  const [savingSection, setSavingSection] = React.useState('');

  const [tabValue, setTabValue] = React.useState(0);
  const [drawerTab, setDrawerTab] = React.useState('basics');
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const label = (e, a) => (isArabic ? a : e);

  const profileCompleteness = React.useMemo(() => {
    if (!patient) return 0;
    const checks = [
      Boolean(patient.name),
      Boolean(patient.phone),
      Number.isFinite(patient.age) || Boolean(patient.age),
      Boolean(patient.gender),
      Boolean(patient.bloodType),
      Boolean(patient.address || patient.email),
      Boolean(patient.weight || patient.height || patient.bloodPressure),
      Boolean(patient.allergies || patient.conditions || patient.medications),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [patient]);

  const bmiInfo = React.useMemo(() => {
    const w = parseFloat(patient?.weight);
    const h = parseFloat(patient?.height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    const hMeters = h > 3 ? h / 100 : h;
    const bmi = w / (hMeters * hMeters);
    if (!Number.isFinite(bmi) || bmi < 5 || bmi > 90) return null;
    const val = Number(bmi.toFixed(1));
    if (val < 18.5) return { val, tag: isArabic ? 'نحافة' : 'Underweight', color: '#0284c7', bg: '#e0f2fe' };
    if (val < 25) return { val, tag: isArabic ? 'وزن مثالي' : 'Normal', color: '#059669', bg: '#ecfdf5' };
    if (val < 30) return { val, tag: isArabic ? 'زيادة وزن' : 'Overweight', color: '#d97706', bg: '#fef3c7' };
    return { val, tag: isArabic ? 'سمنة' : 'Obese', color: '#dc2626', bg: '#fee2e2' };
  }, [patient?.weight, patient?.height, isArabic]);

  const canEditNotes =
    (user?.role && String(user.role).toLowerCase() === 'doctor') ||
    user?.isDoctor === true ||
    user?.claims?.role === 'doctor' ||
    true;

  const totalAppointments = React.useMemo(() => appts.length, [appts]);
  const totalReports = React.useMemo(() => reports.length, [reports]);
  const nextAppointment = React.useMemo(() => {
    const upcoming = appts
      .map((a) => ({ ...a, _d: apptDate(a) }))
      .filter((a) => a._d && a._d.getTime() >= Date.now())
      .sort((a, b) => a._d - b._d);
    return upcoming[0] || null;
  }, [appts]);
  const latestReport = React.useMemo(() => {
    const sorted = [...reports].sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
    return sorted[0] || null;
  }, [reports]);

  const buildEditAllValues = React.useCallback(() => ({
    name: patient?.name || '',
    age: Number.isFinite(patient?.age) ? patient.age : (patient?.age || ''),
    gender: patient?.gender || '',
    bloodType: patient?.bloodType || '',
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
    allergies: patient?.allergies || '',
    conditions: patient?.conditions || '',
    medications: patient?.medications || '',
    maritalStatus: patient?.maritalStatus || '',
    lastVisit: toLocalDateTimeInput(patient?.lastVisit),
    weight: patient?.weight || '',
    height: patient?.height || '',
    bloodPressure: patient?.bloodPressure || '',
    temperature: patient?.temperature || '',
    notes: patient?.notes || '',
    financialNotes: patient?.financialNotes || '',
    isDiabetic: !!patient?.isDiabetic,
    hadSurgeries: !!patient?.hadSurgeries,
    isSmoker: !!patient?.isSmoker,
    drinksAlcohol: !!patient?.drinksAlcohol,
    familyHistory: !!patient?.familyHistory,
    isPregnant: !!patient?.isPregnant,
  }), [patient]);

  const openEditAll = React.useCallback((initialTab = 'basics') => {
    if (!patient) return;
    setEditAllValues(buildEditAllValues());
    setDrawerTab(typeof initialTab === 'string' ? initialTab : 'basics');
    setEditAllOpen(true);
  }, [patient, buildEditAllValues]);

  const handleSaveProfile = async () => {
    if (!patient?.id || !editAllValues) return;
    setSavingAll(true);
    try {
      const ref = doc(db, 'patients', patient.id);
      const ageVal = editAllValues.age !== '' ? Number(editAllValues.age) : null;
      const updateData = {
        name: editAllValues.name.trim(),
        age: ageVal !== null && Number.isFinite(ageVal) ? ageVal : null,
        gender: editAllValues.gender || null,
        bloodType: editAllValues.bloodType || null,
        phone: editAllValues.phone || null,
        email: editAllValues.email || null,
        address: editAllValues.address || null,
        allergies: editAllValues.allergies || null,
        conditions: editAllValues.conditions || null,
        medications: editAllValues.medications || null,
        maritalStatus: editAllValues.maritalStatus || null,
        lastVisit: editAllValues.lastVisit || null,
        weight: editAllValues.weight || '',
        height: editAllValues.height || '',
        bloodPressure: editAllValues.bloodPressure || '',
        temperature: editAllValues.temperature || '',
        notes: editAllValues.notes || '',
        financialNotes: editAllValues.financialNotes || '',
        isDiabetic: !!editAllValues.isDiabetic,
        hadSurgeries: !!editAllValues.hadSurgeries,
        isSmoker: !!editAllValues.isSmoker,
        drinksAlcohol: !!editAllValues.drinksAlcohol,
        familyHistory: !!editAllValues.familyHistory,
        isPregnant: !!editAllValues.isPregnant,
        updatedAt: new Date(),
        updatedBy: user?.uid || user?.email || 'doctor',
      };

      await updateDoc(ref, updateData);
      setPatient((prev) => ({ ...prev, ...updateData }));
      setOkMsg(label('Profile updated', 'تم تحديث الملف بنجاح'));
      setEditAllOpen(false);
    } catch (e) {
      console.error(e);
      setError(label('Failed to update profile', 'تعذر تحديث الملف'));
    } finally {
      setSavingAll(false);
    }
  };

  const handleEditInput = (field) => (e) => {
    setEditAllValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleEditToggle = (field) => (e) => {
    setEditAllValues((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  // Inline editing handlers
  const handleEditModeToggle = (section) => {
    if (editMode[section]) {
      // Cancel edit
      setEditMode((prev) => ({ ...prev, [section]: false }));
    } else {
      // Start edit - populate temp values
      setTempValues((prev) => ({
        ...prev,
        phone: patient?.phone || '',
        email: patient?.email || '',
        address: patient?.address || '',
        maritalStatus: patient?.maritalStatus || '',
        allergies: splitCsv(patient?.allergies),
        conditions: splitCsv(patient?.conditions),
        medications: splitCsv(patient?.medications),
        weight: patient?.weight || '',
        height: patient?.height || '',
        bloodPressure: patient?.bloodPressure || '',
        temperature: patient?.temperature || ''
      }));
      setEditMode((prev) => ({ ...prev, [section]: true }));
    }
  };

  const handleTempChange = (field) => (e) => {
    setTempValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddChip = (field, value) => {
    if (!value) return;
    setTempValues((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), value]
    }));
  };

  const handleRemoveChip = (field, index) => {
    setTempValues((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  const handleSaveSection = async (section) => {
    if (!patient?.id) return;
    setSavingSection(section);
    try {
      const ref = doc(db, 'patients', patient.id);
      let updateData = {};

      if (section === 'contact') {
        // Normalize phone number with +20 (Egypt country code)
        const normalizePhone = (raw = '') => {
          const s = String(raw || '').trim();
          if (!s) return '';
          const d = s.replace(/\D/g, '');
          if (!d) return '';
          let phoneDigits = d.replace(/^0+/, '');
          if (phoneDigits.startsWith('20')) {
            return `+${phoneDigits}`;
          } else {
            return `+20${phoneDigits}`;
          }
        };
        
        updateData = {
          phone: normalizePhone(tempValues.phone),
          email: tempValues.email,
          address: tempValues.address
        };
      } else if (section === 'clinical') {
        updateData = {
          maritalStatus: tempValues.maritalStatus,
          allergies: tempValues.allergies.join(','),
          conditions: tempValues.conditions.join(','),
          medications: tempValues.medications.join(',')
        };
      } else if (section === 'vitals') {
        updateData = {
          weight: tempValues.weight,
          height: tempValues.height,
          bloodPressure: tempValues.bloodPressure,
          temperature: tempValues.temperature
        };
      }

      updateData.updatedAt = new Date();
      updateData.updatedBy = user?.uid || user?.email || 'doctor';

      await updateDoc(ref, updateData);
      setPatient((prev) => ({ ...prev, ...updateData }));
      setEditMode((prev) => ({ ...prev, [section]: false }));
      setOkMsg(label('Section updated', 'تم تحديث القسم بنجاح'));
    } catch (e) {
      console.error(e);
      setError(label('Failed to update', 'تعذر التحديث'));
    } finally {
      setSavingSection('');
    }
  };

  const handleHealthInfoUpdate = async (field, value) => {
    if (!patient?.id) return;
    try {
      const ref = doc(db, 'patients', patient.id);
      const updateData = {
        [field]: value,
        updatedAt: new Date(),
        updatedBy: user?.uid || user?.email || 'doctor'
      };
      await updateDoc(ref, updateData);
      setPatient((prev) => ({ ...prev, ...updateData }));
      setOkMsg(label('Health info updated', 'تم تحديث المعلومات الصحية'));
    } catch (e) {
      console.error(e);
      setError(label('Failed to update', 'تعذر التحديث'));
    }
  };

  const handleCancelEdit = (section) => {
    setEditMode((prev) => ({ ...prev, [section]: false }));
  };

  React.useEffect(() => {
    let active = true;
    const fetchPatient = async () => {
      try {
        const snap = await getDoc(doc(db, 'patients', String(id)));
        if (!snap.exists()) throw new Error('not-found');
        if (active) setPatient({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error(e);
        if (active) setError(isArabic ? 'تعذر تحميل المريض' : 'Failed to load patient');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPatient();
    return () => { active = false; };
  }, [id, isArabic]);
  // doctor reports for this patient
  const fetchReports = React.useCallback(async () => {
    if (!user || !id) return;
    setRepLoading(true);
    try {
      const col = collection(db, 'reports');
      const [snapA, snapB] = await Promise.all([
        getDocs(query(col, where('doctorUID', '==', user.uid), where('patientID', '==', String(id)))),
        getDocs(query(col, where('doctorUID', '==', user.uid), where('patientId', '==', String(id)))),
      ]);
      const map = new Map();
      [...snapA.docs, ...snapB.docs].forEach((d) => { map.set(d.id, { id: d.id, ...d.data() }); });
      const rows = Array.from(map.values());
      rows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
      setReports(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setRepLoading(false);
    }
  }, [user, id]);

  React.useEffect(() => { fetchReports(); }, [fetchReports]);

  // appointments between this doctor and patient
  React.useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setApptLoading(true);
      try {
        const col = collection(db, 'appointments');
        const pid = String(id);
        const queries = [
          query(col, where('doctorId', '==', user.uid), where('patientId', '==', pid)),
          query(col, where('doctorId', '==', user.uid), where('patientUID', '==', pid)),
          query(col, where('doctorId', '==', user.uid), where('patientID', '==', pid)),
          query(col, where('doctorId', '==', user.uid), where('patientUid', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientId', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientUID', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientID', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientUid', '==', pid)),
        ];
        const snaps = await Promise.all(queries.map((q) => getDocs(q)));
        const map = new Map();
        snaps.forEach((snap) => snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() })));
        const rows = Array.from(map.values());
        rows.sort((a, b) => (apptDate(b)?.getTime() || 0) - (apptDate(a)?.getTime() || 0));
        setAppts(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setApptLoading(false);
      }
    })();
  }, [user, id]);

  // -------- external lab_results: by patientId or patientPhone ----------
  const fetchExternalLabs = React.useCallback(async (p) => {
    if (!p) return;
    setXLabLoading(true);
    try {
      const col = collection(db, 'lab_results');

      // Normalize phone to digits to increase match robustness
      const rawPhone = String(p.phone || '').trim();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const qrs = [];

      // match by patientId (if some writers filled it)
      qrs.push(getDocs(query(col, where('patientId', '==', String(p.id)), orderBy('createdAt', 'desc'))).catch(() => getDocs(query(col, where('patientId', '==', String(p.id))))));

      // match by patientPhone exactly as stored
      if (rawPhone) {
        qrs.push(getDocs(query(col, where('patientPhone', '==', rawPhone), orderBy('createdAt', 'desc'))).catch(() => getDocs(query(col, where('patientPhone', '==', rawPhone)))));
        // sometimes phone may be saved without formatting
        if (phoneDigits && phoneDigits !== rawPhone) {
          qrs.push(getDocs(query(col, where('patientPhone', '==', phoneDigits), orderBy('createdAt', 'desc'))).catch(() => getDocs(query(col, where('patientPhone', '==', phoneDigits)))));
        }
      }

      const snaps = await Promise.all(qrs);
      const map = new Map();
      snaps.forEach(s => s.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() })));

      const rows = Array.from(map.values()).sort((a, b) =>
        (toDate(b?.resultDate || b?.createdAt)?.getTime() || 0) - (toDate(a?.resultDate || a?.createdAt)?.getTime() || 0)
      );

      setXLabResults(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setXLabLoading(false);
    }
  }, []);

  React.useEffect(() => { if (patient) fetchExternalLabs(patient); }, [patient, fetchExternalLabs]);

  // helpers
  const initials = React.useMemo(() => {
    const n = String(patient?.name || '?').trim();
    return n.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  }, [patient?.name]);

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(String(txt || '')); setOkMsg(label('Copied', 'تم النسخ')); } catch { }
  };

  // ---- AI summary ----
  const generateAISummary = async () => {
    if (!user?.getIdToken) throw new Error('Not authenticated');
    const idToken = await user.getIdToken();

    const core = {
      id: patient?.id,
      name: patient?.name || null,
      age: Number.isFinite(patient?.age) ? patient.age : null,
      gender: patient?.gender || null,
      bloodType: patient?.bloodType || null,
      allergies: patient?.allergies || null,
      conditions: patient?.conditions || null,
      medications: patient?.medications || null,
      lastVisit: patient?.lastVisit || null,
      contact: {
        phone: patient?.phone || null,
        email: patient?.email || null,
        address: patient?.address || null,
      },
      recentReports: reports.slice(0, 8).map(r => ({
        type: r?.type || 'clinical',
        date: r?.date || null,
        title: r?.titleAr || r?.titleEn || r?.title || '',
        diagnosis: r?.diagnosis || null,
        followUp: r?.followUp || null,
      })),
      // include external lab results (condensed)
      externalLabs: xLabResults.slice(0, 8).map(l => ({
        date: l?.resultDate || l?.createdAt || null,
        labId: l?.labId || null,
        status: l?.status || null,
        value: l?.resultValue || null,
        ref: l?.referenceRange || null,
        tests: Number.isFinite(l?.testCount) ? l.testCount : null,
        notes: l?.notes || null,
      })),
      recentAppointments: appts.slice(0, 8).map(a => ({
        date: apptDate(a),
        status: a?.status || 'pending',
      })),
    };

    const res = await fetch('/api/ask-shafy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        use_server_context: false,
        doctorContext: '',
        message: JSON.stringify(core),
        lang: isArabic ? 'ar' : 'en',
        temperature: 0.1,
        enable_rag: false,
        system_extras: [
          'Use ONLY the JSON object provided by the user. Do NOT use any other context.',
          'Do NOT mention or infer any other doctors or patients. Focus solely on this patient.',
          'Write a concise 5–7 line clinical summary with bullets: history, key findings, current meds/conditions/allergies, last visit, external lab highlights, and next steps. Avoid generic disclaimers.',
          'Do not include provider names or clinic names. No speculation beyond the provided data.'
        ],
      }),
    });

    const j = await res.json();
    if (!res.ok || !j?.ok) throw new Error(j?.error || 'AI failed');
    return String(j.text || '').trim();
  };

  const summarizeWithAI = async () => {
    try {
      setAiBusy(true); setAiErr(''); setAiText('');
      const text = await generateAISummary();
      setAiText(text);
    } catch (e) {
      console.error(e);
      setAiErr(label('Failed to generate AI summary.', 'تعذر توليد الملخص الذكي.'));
    } finally {
      setAiBusy(false);
    }
  };

  // ---- Printing ----
  const buildPrintableHtml = (ai, lang) => {
    const t = (en, ar) => (lang === 'ar' ? ar : en);
    const today = new Date();
    const docName = user?.displayName || user?.email || '';
    const css = `
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        body { margin: 24px; color: #111; }
        h1,h2,h3 { margin: 0 0 6px; }
        h1 { font-size: 20px; }
        h2 { font-size: 16px; margin-top: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .muted{ color:#666; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
        .box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e6e6e6; padding: 8px; font-size: 12px; vertical-align: top; }
        th { background: #fafafa; text-align: left; }
        ul { margin: 6px 0 0 18px; }
        .header { display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .chip { display:inline-block; padding:2px 8px; border:1px solid #ccc; border-radius: 999px; font-size:11px; margin-right:6px;}
        .rtl { direction: rtl; text-align: right; }
      </style>
    `;
    const header = `
      <div class="header">
        <div>
          <h1>${t('Patient Summary Report', 'تقرير موجز للمريض')}</h1>
          <div class="muted">${t('Generated on', 'تم الإنشاء في')} ${today.toLocaleString()} ${docName ? `• ${t('by', 'بواسطة')} ${docName}` : ''}</div>
        </div>
        <div>
          <span class="chip">ID: ${patient?.id || '-'}</span>
          ${Number.isFinite(patient?.age) ? `<span class="chip">${t('Age', 'العمر')}: ${patient.age}</span>` : ''}
          ${patient?.gender ? `<span class="chip">${patient.gender}</span>` : ''}
          ${patient?.bloodType ? `<span class="chip">${patient.bloodType}</span>` : ''}
        </div>
      </div>
    `;
    const demographics = `
      <h2>${t('Patient', 'المريض')}</h2>
      <div class="grid">
        <div><strong>${t('Name', 'الاسم')}:</strong> ${patient?.name || t('Unnamed', 'بدون اسم')}</div>
        <div><strong>${t('Last visit', 'آخر زيارة')}:</strong> ${fmtNiceDate(patient?.lastVisit)}</div>
        <div><strong>${t('Phone', 'الهاتف')}:</strong> ${patient?.phone || '—'}</div>
        <div><strong>${t('Email', 'البريد')}:</strong> ${patient?.email || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Address', 'العنوان')}:</strong> ${patient?.address || '—'}</div>
      </div>
    `;
    const clinical = `
      <h2>${t('Clinical profile', 'الملف السريري')}</h2>
      <div class="grid">
        <div><strong>${t('Marital status', 'الحالة الاجتماعية')}:</strong> ${patient?.maritalStatus || t('Unspecified', 'غير محدد')}</div>
        <div><strong>${t('Blood type', 'فصيلة الدم')}:</strong> ${patient?.bloodType || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Allergies', 'الحساسيات')}:</strong> ${splitCsv(patient?.allergies).join(', ') || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Chronic conditions', 'الأمراض المزمنة')}:</strong> ${splitCsv(patient?.conditions).join(', ') || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Current medications', 'الأدوية الحالية')}:</strong> ${splitCsv(patient?.medications).join(', ') || '—'}</div>
      </div>
    `;
    const aiBlock = `
      <h2>${t('AI short report', 'ملخص ذكي مختصر')}</h2>
      <div class="box" style="white-space: pre-wrap;">${ai || t('No AI summary generated yet.', 'لا يوجد ملخص ذكي بعد.')}</div>
    `;

    const xlabRows = (xLabResults || []).map(l => `
      <tr>
        <td>${fmtNiceDateTime(l?.resultDate || l?.createdAt)}</td>
        <td>${l?.labId || '—'}</td>
        <td>${l?.resultValue || '—'}</td>
        <td>${l?.referenceRange || '—'}</td>
        <td>${l?.status || '—'}</td>
        <td>${Number.isFinite(l?.testCount) ? l.testCount : '—'}</td>
      </tr>
    `).join('');

    const reportsRows = (reports || []).map(r => {
      const isLab = String(r?.type || '').toLowerCase() === 'lab';
      return `
        <tr>
          <td>${fmtNiceDateTime(r?.date)}</td>
          <td>${isLab ? t('Lab', 'معملي') : t('Clinic', 'عيادة')}</td>
          <td>${r?.titleAr || r?.titleEn || r?.title || (isLab ? t('Lab Report', 'تقرير معملي') : t('Medical Report', 'تقرير طبي'))}</td>
          <td>${r?.diagnosis || '—'}</td>
          <td>${fmtNiceDateTime(r?.followUp) || '—'}</td>
        </tr>
      `;
    }).join('');

    const apptRows = (appts || []).map(a => `
      <tr>
        <td>${fmtApptFull(a)}</td>
        <td>${String(a?.status || 'pending')}</td>
      </tr>
    `).join('');

    const history = `
      <h2>${t('History', 'السجل')}</h2>
      <h3 style="margin-top:8px;">${t('External lab results', 'نتائج معامل خارجية')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date', 'التاريخ')}</th>
            <th>${t('Lab ID', 'معرف المعمل')}</th>
            <th>${t('Result value', 'النتيجة')}</th>
            <th>${t('Reference range', 'المعدل المرجعي')}</th>
            <th>${t('Status', 'الحالة')}</th>
            <th>${t('Tests', 'الاختبارات')}</th>
          </tr>
        </thead>
        <tbody>${xlabRows || `<tr><td colspan="6" class="muted">${t('No lab results', 'لا توجد نتائج معمل')}</td></tr>`}</tbody>
      </table>

      <h3 style="margin-top:12px;">${t('Reports', 'التقارير')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date', 'التاريخ')}</th>
            <th>${t('Type', 'النوع')}</th>
            <th>${t('Title', 'العنوان')}</th>
            <th>${t('Diagnosis', 'التشخيص')}</th>
            <th>${t('Follow-up', 'المتابعة')}</th>
          </tr>
        </thead>
        <tbody>${reportsRows || `<tr><td colspan="5" class="muted">${t('No reports', 'لا توجد تقارير')}</td></tr>`}</tbody>
      </table>

      <h3 style="margin-top:12px;">${t('Appointments', 'المواعيد')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date/Time', 'الوقت/التاريخ')}</th>
            <th>${t('Status', 'الحالة')}</th>
          </tr>
        </thead>
        <tbody>${apptRows || `<tr><td colspan="2" class="muted">${t('No appointments', 'لا توجد مواعيد')}</td></tr>`}</tbody>
      </table>
    `;
    const dirClass = lang === 'ar' ? 'rtl' : '';
    return `<!doctype html><html lang="${lang}">
      <head><meta charset="utf-8" /><title>${t('Patient Report', 'تقرير المريض')}</title>${css}</head>
      <body class="${dirClass}">
        ${header}
        ${demographics}
        ${clinical}
        ${aiBlock}
        ${history}
        <script>window.onload = () => { window.print(); }</script>
      </body>
    </html>`;
  };

  const printReport = async () => {
    try {
      let text = aiText;
      if (!text) {
        setAiBusy(true);
        try { text = await generateAISummary(); setAiText(text); }
        catch (e) { console.error(e); }
        finally { setAiBusy(false); }
      }
      const html = buildPrintableHtml(text || '', isArabic ? 'ar' : 'en');
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      console.error(e);
      setError(label('Could not open print dialog.', 'تعذر فتح نافذة الطباعة.'));
    }
  };

  /* ---------- UI ---------- */
  const allergyList = splitCsv(patient?.allergies).filter((x) => !['none', 'لا يوجد'].includes(x.toLowerCase()));
  const conditionList = splitCsv(patient?.conditions);
  const hasClinicalAlerts =
    allergyList.length > 0 || conditionList.length > 0 || patient?.isDiabetic || patient?.isPregnant;

  return (
    <Protected>
      <AppLayout
        title={patient?.name ? `${label('Patient Profile', 'ملف المريض')} • ${patient.name}` : label('Patient Profile', 'ملف المريض')}
        subtitle={label('Clinical record, vitals, reports & appointment history', 'السجل السريري، المؤشرات الحيوية، التقارير وسجل الزيارات')}
      >
        <Container maxWidth={false} disableGutters>
          {loading ? (
            <Stack spacing={2.5}>
              <Skeleton variant="rounded" height={220} sx={{ borderRadius: '24px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: '20px' }} />
                ))}
              </div>
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: '22px' }} />
            </Stack>
          ) : !patient ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={900} color="error" gutterBottom>
                {label('Patient not found', 'المريض غير موجود')}
              </Typography>
              <Button sx={{ mt: 2 }} variant="contained" component={Link} href={`/patients${isArabic ? '?lang=ar' : ''}`}>
                {label('Back to list', 'العودة إلى القائمة')}
              </Button>
            </div>
          ) : (
            <Stack spacing={3}>
              {/* Royal Sapphire Executive Patient Hero */}
              <div className="shafy-hero-shell" style={{ padding: '26px 28px' }}>
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: '22px',
                          background: '#ffffff',
                          color: '#1d4ed8',
                          border: '3px solid rgba(255,255,255,0.42)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.9rem',
                          fontWeight: 900,
                          boxShadow: '0 14px 32px rgba(0,0,0,0.22)',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <Typography variant="h4" fontWeight={900} sx={{ color: '#ffffff', lineHeight: 1.15, fontSize: { xs: '1.45rem', md: '1.85rem' } }}>
                            {patient.name || label('Unnamed', 'بدون اسم')}
                          </Typography>
                          <Chip
                            label={`ID: ${String(patient.id).slice(0, 8)}`}
                            size="small"
                            onClick={() => copy(patient.id)}
                            icon={<ContentCopyIcon style={{ color: '#ffffff', fontSize: 13 }} />}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.16)',
                              color: '#ffffff',
                              fontWeight: 800,
                              border: '1px solid rgba(255,255,255,0.26)',
                              cursor: 'pointer',
                            }}
                          />
                        </div>

                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                          {(Number.isFinite(patient?.age) || patient?.age) && (
                            <Chip
                              size="small"
                              icon={<EventIcon style={{ color: '#ffffff', fontSize: 15 }} />}
                              label={`${label('Age', 'العمر')}: ${patient.age}`}
                              sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#ffffff', fontWeight: 700 }}
                            />
                          )}
                          {patient?.gender && (
                            <Chip
                              size="small"
                              icon={<PersonIcon style={{ color: '#ffffff', fontSize: 15 }} />}
                              label={
                                String(patient.gender).toLowerCase() === 'male'
                                  ? label('Male', 'ذكر')
                                  : String(patient.gender).toLowerCase() === 'female'
                                  ? label('Female', 'أنثى')
                                  : patient.gender
                              }
                              sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#ffffff', fontWeight: 700 }}
                            />
                          )}
                          {patient?.bloodType && (
                            <Chip
                              size="small"
                              icon={<BloodtypeIcon style={{ color: '#fecaca', fontSize: 15 }} />}
                              label={patient.bloodType}
                              sx={{ bgcolor: 'rgba(239, 68, 68, 0.28)', color: '#fee2e2', border: '1px solid rgba(254,202,202,0.45)', fontWeight: 900 }}
                            />
                          )}
                          {patient?.phone && (
                            <Chip
                              size="small"
                              icon={<PhoneIcon style={{ color: '#bae6fd', fontSize: 14 }} />}
                              label={patient.phone}
                              onClick={() => copy(patient.phone)}
                              sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                            />
                          )}
                        </Stack>
                      </div>
                    </div>

                    {/* Profile Completeness Meter */}
                    <div
                      onClick={() => openEditAll('basics')}
                      role="button"
                      tabIndex={0}
                      style={{
                        background: 'rgba(255,255,255,0.14)',
                        border: '1px solid rgba(255,255,255,0.26)',
                        borderRadius: '15px',
                        padding: '10px 16px',
                        minWidth: '185px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#dbeafe' }}>
                          {label('Profile Completeness', 'اكتمال ملف المريض')}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#ffffff' }}>
                          {profileCompleteness}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${profileCompleteness}%`,
                            height: '100%',
                            background: profileCompleteness >= 80 ? '#34d399' : '#fbbf24',
                            borderRadius: '999px',
                            transition: 'width 0.35s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Safety Alert Strip (Allergies / Chronic Conditions / Flags) */}
                  {hasClinicalAlerts && (
                    <div
                      style={{
                        background: 'rgba(254, 226, 226, 0.16)',
                        border: '1px solid rgba(254, 202, 202, 0.4)',
                        borderRadius: '14px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#fecaca' }}>
                        {label('⚠ Clinical Alerts:', '⚠ تنبيهات إكلينيكية هامة:')}
                      </span>
                      {allergyList.map((al, i) => (
                        <span key={`al-${i}`} style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: '#ef4444', color: '#ffffff' }}>
                          {label('Allergy:', 'حساسية:')} {al}
                        </span>
                      ))}
                      {conditionList.map((cd, i) => (
                        <span key={`cd-${i}`} style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: '#f59e0b', color: '#ffffff' }}>
                          {cd}
                        </span>
                      ))}
                      {patient?.isDiabetic && (
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: '#f59e0b', color: '#ffffff' }}>
                          {label('Diabetic', 'مريض سكري')}
                        </span>
                      )}
                      {patient?.isPregnant && (
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: '#ec4899', color: '#ffffff' }}>
                          {label('Pregnant', 'حامل')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick Executive Action Toolbar */}
                  <div className="shafy-telemetry-bar" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                      <Button
                        variant="contained"
                        startIcon={<DescriptionIcon />}
                        onClick={() => router.push(`/prescription/new?patientId=${patient.id}${isArabic ? '&lang=ar' : '&lang=en'}`)}
                        sx={{
                          bgcolor: '#ffffff !important',
                          background: '#ffffff !important',
                          color: '#1d4ed8 !important',
                          borderRadius: '13px',
                          fontWeight: 900,
                          px: 2.5,
                          py: 1,
                          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                        }}
                      >
                        {label('New Prescription / Report', 'إضافة وصفة / تقرير')}
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<ScienceIcon />}
                        onClick={() => setLabOpen(true)}
                        sx={{
                          borderRadius: '13px',
                          fontWeight: 800,
                          px: 2.2,
                          py: 1,
                          color: '#ffffff',
                          borderColor: 'rgba(255,255,255,0.36)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)', borderColor: '#ffffff' },
                        }}
                      >
                        {label('Add Lab Report', 'إضافة تحليل معملي')}
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : '&lang=en'}`)}
                        sx={{
                          borderRadius: '13px',
                          fontWeight: 800,
                          px: 2.2,
                          py: 1,
                          color: '#ffffff',
                          borderColor: 'rgba(255,255,255,0.36)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)', borderColor: '#ffffff' },
                        }}
                      >
                        {label('Book Visit', 'حجز موعد')}
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => openEditAll('basics')}
                        sx={{
                          borderRadius: '13px',
                          fontWeight: 800,
                          px: 2.2,
                          py: 1,
                          color: '#fef08a',
                          borderColor: 'rgba(254,240,138,0.45)',
                          bgcolor: 'rgba(254,240,138,0.14)',
                          '&:hover': { bgcolor: 'rgba(254,240,138,0.24)', borderColor: '#fef08a' },
                        }}
                      >
                        {label('Edit Profile', 'تعديل الملف')}
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={printReport}
                        disabled={aiBusy}
                        sx={{
                          borderRadius: '13px',
                          fontWeight: 800,
                          px: 2,
                          py: 1,
                          color: '#ffffff',
                          borderColor: 'rgba(255,255,255,0.3)',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', borderColor: '#ffffff' },
                        }}
                      >
                        {label('Print Summary', 'طباعة الملخص')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Top-Accented Glass KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {[
                  {
                    icon: <LocalHospitalIcon sx={{ fontSize: 22 }} />,
                    count: totalAppointments,
                    label: label('Total Visits', 'إجمالي الزيارات'),
                    sub: label('Recorded appointments', 'مواعيد مسجلة'),
                    color: '#2563eb',
                    softBg: '#eff6ff',
                  },
                  {
                    icon: <DescriptionIcon sx={{ fontSize: 22 }} />,
                    count: totalReports,
                    label: label('Medical Reports', 'التقارير الطبية'),
                    sub: label('Clinical & Lab', 'سريرية ومعملية'),
                    color: '#4f46e5',
                    softBg: '#eef2ff',
                  },
                  {
                    icon: <EventIcon sx={{ fontSize: 22 }} />,
                    count: nextAppointment ? fmtNiceDate(nextAppointment._d || nextAppointment.date) : label('None', 'لا يوجد'),
                    label: label('Next Visit', 'الزيارة القادمة'),
                    sub: nextAppointment?.time || label('No upcoming visit', 'لا يوجد موعد قادم'),
                    color: '#059669',
                    softBg: '#ecfdf5',
                  },
                  {
                    icon: <ScienceIcon sx={{ fontSize: 22 }} />,
                    count: latestReport ? (latestReport?.diagnosis || latestReport?.titleAr || latestReport?.titleEn || label('Report', 'تقرير')) : '—',
                    label: label('Latest Diagnosis / Report', 'أحدث تشخيص / تقرير'),
                    sub: latestReport?.date ? fmtNiceDate(latestReport.date) : label('No reports yet', 'لا توجد تقارير بعد'),
                    color: '#d97706',
                    softBg: '#fef3c7',
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="glass-panel glass-panel-lift"
                    style={{ padding: '20px', borderTop: `4px solid ${stat.color}` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>{stat.label}</span>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: stat.softBg,
                          color: stat.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {stat.icon}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: String(stat.count).length > 8 ? '1.25rem' : '1.9rem',
                        fontWeight: 900,
                        color: '#0f172a',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {stat.count}
                    </div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: stat.color, marginTop: '6px' }}>
                      {stat.sub}
                    </div>
                  </div>
                ))}
              </div>


              {/* Glass Segmented Pill Tabs Bar with Live Counts */}
              <Box sx={{ width: '100%' }}>
                <div
                  className="glass-panel"
                  style={{
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                  }}
                >
                  {[
                    { idx: 0, text: label('Overview', 'نظرة عامة'), icon: <PersonIcon sx={{ fontSize: 18 }} /> },
                    { idx: 1, text: `${label('Appointments', 'المواعيد')} (${appts.length})`, icon: <LocalHospitalIcon sx={{ fontSize: 18 }} /> },
                    { idx: 2, text: `${label('Reports', 'التقارير')} (${reports.length})`, icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
                    { idx: 3, text: label('Notes', 'الملاحظات'), icon: <EditOutlinedIcon sx={{ fontSize: 18 }} /> },
                    { idx: 4, text: `${label('External Labs', 'معامل خارجية')} (${xLabResults.length})`, icon: <ScienceIcon sx={{ fontSize: 18 }} /> },
                  ].map((tb) => {
                    const active = tabValue === tb.idx;
                    return (
                      <button
                        key={tb.idx}
                        type="button"
                        onClick={() => setTabValue(tb.idx)}
                        className="shafy-tab-pill"
                        style={{
                          padding: '9px 16px',
                          fontSize: '0.84rem',
                          background: active ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                          color: active ? '#ffffff' : '#475569',
                          boxShadow: active ? '0 8px 18px -6px rgba(37, 99, 235, 0.48)' : 'none',
                        }}
                      >
                        {tb.icon}
                        <span>{tb.text}</span>
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: BALANCED 2-COLUMN CLINICAL WORKSPACE OVERVIEW */}
                <CustomTabPanel value={tabValue} index={0}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.38fr) minmax(0, 0.88fr)' },
                      gap: '22px',
                      alignItems: 'start',
                    }}
                  >
                    {/* PRIMARY COLUMN: Clinical Profile + AI Summary + Medical Intake */}
                    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                      {/* Clinical Profile & Health Flags */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #2563eb' }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 42, height: 42, bgcolor: '#eff6ff', color: '#2563eb', borderRadius: '12px' }}>
                              <LocalHospitalIcon />
                            </Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                                {label('Clinical Profile', 'الملف السريري والخلفية الطبية')}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                {label('Allergies, chronic conditions, medications & risk flags', 'الحساسيات، الأمراض المزمنة، الأدوية والمؤشرات')}
                              </Typography>
                            </Box>
                          </Stack>
                          {!editMode.clinical ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                              onClick={() => handleEditModeToggle('clinical')}
                              sx={{ borderRadius: '10px' }}
                            >
                              {label('Edit', 'تعديل')}
                            </Button>
                          ) : (
                            <Stack direction="row" spacing={1}>
                              <Button size="small" onClick={() => handleCancelEdit('clinical')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                              <Button size="small" variant="contained" onClick={() => handleSaveSection('clinical')} disabled={savingSection === 'clinical'}>
                                {label('Save', 'حفظ')}
                              </Button>
                            </Stack>
                          )}
                        </Stack>

                        {/* Marital Status & Last Visit */}
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: '12px',
                            mb: 2.5,
                          }}
                        >
                          <div style={{ padding: '12px 14px', borderRadius: '13px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <Labeled title={label('Marital Status', 'الحالة الاجتماعية')}>
                              {editMode.clinical ? (
                                <TextField
                                  select
                                  fullWidth
                                  size="small"
                                  value={tempValues.maritalStatus}
                                  onChange={handleTempChange('maritalStatus')}
                                  SelectProps={{ native: true }}
                                >
                                  <option value="">{label('Select...', 'اختر...')}</option>
                                  <option value="Single">{label('Single', 'أعزب/عزباء')}</option>
                                  <option value="Married">{label('Married', 'متزوج/ة')}</option>
                                  <option value="Divorced">{label('Divorced', 'مطلق/ة')}</option>
                                  <option value="Widowed">{label('Widowed', 'أرمل/ة')}</option>
                                </TextField>
                              ) : (
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }}>
                                  {patient?.maritalStatus || label('Unspecified', 'غير محدد')}
                                </Typography>
                              )}
                            </Labeled>
                          </div>

                          <div style={{ padding: '12px 14px', borderRadius: '13px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <Labeled title={label('Last Visit', 'آخر زيارة')}>
                              <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }}>
                                {fmtNiceDate(patient.lastVisit)}
                              </Typography>
                            </Labeled>
                          </div>
                        </Box>

                        {/* Allergies / Chronic Conditions / Medications */}
                        <Stack spacing={2}>
                          {[
                            { key: 'allergies', label: label('Allergies', 'الحساسيات'), color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                            { key: 'conditions', label: label('Chronic Conditions', 'الأمراض المزمنة'), color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
                            { key: 'medications', label: label('Current Medications', 'الأدوية الحالية'), color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
                          ].map((section) => (
                            <div
                              key={section.key}
                              style={{
                                padding: '12px 14px',
                                borderRadius: '14px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <Typography variant="caption" fontWeight={800} sx={{ color: '#64748b', display: 'block', mb: 1 }}>
                                {section.label}
                              </Typography>
                              <Stack direction="row" spacing={0.85} useFlexGap flexWrap="wrap" alignItems="center">
                                {(editMode.clinical ? tempValues[section.key] : splitCsv(patient?.[section.key])).map((item, i) => (
                                  <Chip
                                    key={i}
                                    label={item}
                                    size="small"
                                    onDelete={editMode.clinical ? () => handleRemoveChip(section.key, i) : undefined}
                                    sx={{
                                      bgcolor: section.bg,
                                      color: section.color,
                                      border: `1px solid ${section.border}`,
                                      fontWeight: 800,
                                      borderRadius: '9px',
                                    }}
                                  />
                                ))}
                                {editMode.clinical && (
                                  <Box
                                    component="form"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const val = e.target.elements.newChip.value;
                                      handleAddChip(section.key, val);
                                      e.target.reset();
                                    }}
                                    sx={{ display: 'inline-flex' }}
                                  >
                                    <TextField
                                      name="newChip"
                                      placeholder={label('+ Add & Enter', '+ أضف واضغط Enter')}
                                      size="small"
                                      sx={{
                                        width: 150,
                                        '& .MuiInputBase-root': { borderRadius: '10px', fontSize: '0.78rem', height: 28 },
                                      }}
                                    />
                                  </Box>
                                )}
                                {!editMode.clinical && !splitCsv(patient?.[section.key]).length && (
                                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                                    {label('None recorded', 'لا يوجد مسجل')}
                                  </Typography>
                                )}
                              </Stack>
                            </div>
                          ))}
                        </Stack>

                        {/* Clinical Flags */}
                        <HealthInfoSection
                          patient={patient}
                          isArabic={isArabic}
                          t={label}
                          onUpdate={handleHealthInfoUpdate}
                        />
                      </Paper>

                      {/* AI Clinical Summary Card */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #4f46e5' }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          justifyContent="space-between"
                          sx={{ mb: 2 }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '13px',
                                background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
                                boxShadow: '0 8px 18px -4px rgba(79, 70, 229, 0.4)',
                              }}
                            >
                              <AutoAwesomeIcon sx={{ fontSize: 24, color: '#ffffff' }} />
                            </Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                                {label('AI Clinical Summary', 'الملخص السريري الذكي')}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                {label('Powered by Shafy AI • Synthesizes visits, labs & history', 'مدعوم بواسطة شافي AI • يلخص الزيارات والتحاليل والتاريخ الطبي')}
                              </Typography>
                            </Box>
                          </Stack>
                          <Button
                            variant="contained"
                            startIcon={aiBusy ? null : <AutoAwesomeIcon />}
                            onClick={summarizeWithAI}
                            disabled={aiBusy}
                            sx={{ borderRadius: '12px', px: 2.5, whiteSpace: 'nowrap' }}
                          >
                            {aiBusy ? label('Generating...', 'جارٍ التوليد...') : label('Generate Summary', 'توليد الملخص')}
                          </Button>
                        </Stack>

                        {!aiBusy && aiErr && <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{aiErr}</Alert>}

                        <div
                          style={{
                            padding: '16px 18px',
                            borderRadius: '15px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            minHeight: '88px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: aiText ? 'flex-start' : 'center',
                          }}
                        >
                          {aiBusy ? (
                            <Stack spacing={1.25} width="100%">
                              <Skeleton variant="text" width="90%" height={24} />
                              <Skeleton variant="text" width="78%" height={24} />
                              <Skeleton variant="text" width="84%" height={24} />
                            </Stack>
                          ) : aiText ? (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#1e293b', fontWeight: 600 }}>
                              {aiText}
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', fontWeight: 600 }}>
                              {label('Click "Generate Summary" for an instant AI overview of this patient.', 'اضغط على "توليد الملخص" للحصول على ملخص سريري فوري بالذكاء الاصطناعي.')}
                            </Typography>
                          )}
                        </div>
                      </Paper>

                      {/* Dedicated Medical File Intake Card */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #0ea5e9' }}
                      >
                        <MedicalFileIntake
                          patientId={patient?.id}
                          patient={patient}
                          isArabic={isArabic}
                          onExtract={async (extractedData) => {
                            if (!patient?.id) return;
                            try {
                              const ref = doc(db, 'patients', patient.id);
                              const updateData = {
                                ...extractedData,
                                updatedAt: new Date(),
                                updatedBy: user?.uid || user?.email || 'doctor',
                              };
                              await updateDoc(ref, updateData);
                              setPatient((prev) => ({ ...prev, ...updateData }));
                              setOkMsg(label('Medical information extracted and saved.', 'تم استخراج وحفظ المعلومات الطبية.'));
                            } catch (e) {
                              console.error(e);
                              setError(label('Failed to save extracted data.', 'فشل حفظ البيانات المستخرجة.'));
                            }
                          }}
                        />
                      </Paper>
                    </Stack>

                    {/* SECONDARY SIDEBAR COLUMN: Vitals (2x2) + Contact + Activity Timeline */}
                    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                      {/* Vitals & Metrics (Strict 2x2 CSS Grid) */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #ef4444' }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.25 }}>
                          <Stack direction="row" alignItems="center" spacing={1.25}>
                            <Avatar sx={{ width: 42, height: 42, bgcolor: '#fef2f2', color: '#dc2626', borderRadius: '12px' }}>
                              <BloodtypeIcon />
                            </Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                                {label('Vitals & Metrics', 'المؤشرات الحيوية')}
                              </Typography>
                              {bmiInfo && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    marginTop: '3px',
                                    padding: '2px 9px',
                                    borderRadius: '999px',
                                    background: bmiInfo.bg,
                                    color: bmiInfo.color,
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                  }}
                                >
                                  BMI: {bmiInfo.val} ({bmiInfo.tag})
                                </span>
                              )}
                            </Box>
                          </Stack>
                          {!editMode.vitals ? (
                            <IconButton size="small" onClick={() => handleEditModeToggle('vitals')} sx={{ bgcolor: '#f1f5f9' }}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <Stack direction="row" spacing={0.75}>
                              <Button size="small" onClick={() => handleCancelEdit('vitals')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                              <Button size="small" variant="contained" onClick={() => handleSaveSection('vitals')} disabled={savingSection === 'vitals'}>
                                {label('Save', 'حفظ')}
                              </Button>
                            </Stack>
                          )}
                        </Stack>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                          {[
                            { key: 'weight', label: label('Weight', 'الوزن'), unit: 'kg', icon: '⚖️', color: '#2563eb', bg: '#eff6ff' },
                            { key: 'height', label: label('Height', 'الطول'), unit: 'cm', icon: '📏', color: '#059669', bg: '#ecfdf5' },
                            { key: 'bloodPressure', label: label('Blood Pressure', 'ضغط الدم'), unit: '', icon: '❤️', color: '#dc2626', bg: '#fef2f2' },
                            { key: 'temperature', label: label('Temperature', 'الحرارة'), unit: '°C', icon: '🌡️', color: '#d97706', bg: '#fffbeb' },
                          ].map((item) => (
                            <div
                              key={item.key}
                              style={{
                                padding: '14px',
                                borderRadius: '14px',
                                background: item.bg,
                                border: `1px solid ${item.color}22`,
                              }}
                            >
                              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </div>
                              {editMode.vitals ? (
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={tempValues[item.key]}
                                  onChange={handleTempChange(item.key)}
                                  placeholder="—"
                                  InputProps={{
                                    disableUnderline: true,
                                    sx: { fontSize: '1.15rem', fontWeight: 900, color: item.color },
                                  }}
                                />
                              ) : (
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: item.color, lineHeight: 1.15 }}>
                                  {patient[item.key] || '—'}
                                  {patient[item.key] && item.unit && (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.75, marginInlineStart: '4px' }}>
                                      {item.unit}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </Box>
                      </Paper>

                      {/* Contact Information Card */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #0ea5e9' }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.25 }}>
                          <Typography variant="h6" fontWeight={900}>
                            {label('Contact Information', 'معلومات الاتصال')}
                          </Typography>
                          {!editMode.contact ? (
                            <IconButton size="small" onClick={() => handleEditModeToggle('contact')} sx={{ bgcolor: '#f1f5f9' }}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <Stack direction="row" spacing={0.75}>
                              <Button size="small" onClick={() => handleCancelEdit('contact')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                              <Button size="small" variant="contained" onClick={() => handleSaveSection('contact')} disabled={savingSection === 'contact'}>
                                {label('Save', 'حفظ')}
                              </Button>
                            </Stack>
                          )}
                        </Stack>

                        <Stack spacing={1.75}>
                          {[
                            { key: 'phone', label: label('Phone', 'الهاتف'), icon: <PhoneIcon fontSize="small" /> },
                            { key: 'email', label: label('Email', 'البريد'), icon: <EmailIcon fontSize="small" /> },
                            { key: 'address', label: label('Address', 'العنوان'), icon: <PlaceIcon fontSize="small" /> },
                          ].map((item) => (
                            <div
                              key={item.key}
                              style={{
                                padding: '11px 13px',
                                borderRadius: '13px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '11px',
                              }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {item.icon}
                              </div>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block' }}>
                                  {item.label}
                                </Typography>
                                {editMode.contact ? (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={tempValues[item.key]}
                                    onChange={handleTempChange(item.key)}
                                    placeholder={item.label}
                                    sx={{ mt: 0.5 }}
                                  />
                                ) : (
                                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                                    <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a', wordBreak: 'break-word' }}>
                                      {patient[item.key] || '—'}
                                    </Typography>
                                    {patient[item.key] && (
                                      <IconButton size="small" onClick={() => copy(patient[item.key])} sx={{ opacity: 0.6, p: 0.35 }}>
                                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                                      </IconButton>
                                    )}
                                  </Stack>
                                )}

                                {!editMode.contact && patient[item.key] && item.key === 'phone' && (
                                  <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                                    <Button size="small" variant="outlined" component={Link} href={`tel:${patient.phone}`} sx={{ borderRadius: '9px', py: 0.2, fontSize: '0.73rem' }}>
                                      {label('Call', 'اتصال')}
                                    </Button>
                                    <Button size="small" variant="outlined" component={Link} href={`sms:${patient.phone}`} sx={{ borderRadius: '9px', py: 0.2, fontSize: '0.73rem' }}>
                                      SMS
                                    </Button>
                                  </Stack>
                                )}
                              </Box>
                            </div>
                          ))}
                        </Stack>
                      </Paper>

                      {/* Recent Activity Timeline */}
                      <Paper
                        elevation={0}
                        className="glass-panel"
                        sx={{ p: { xs: 2.5, sm: 3 }, borderTop: '4px solid #10b981' }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
                          <Avatar sx={{ width: 40, height: 40, bgcolor: '#ecfdf5', color: '#059669', borderRadius: '11px' }}>
                            <AssignmentIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="h6" fontWeight={900}>
                            {label('Recent Activity', 'النشاط الأخير')}
                          </Typography>
                        </Stack>

                        <Stack spacing={1.25}>
                          {appts.length > 0 && (
                            <div className="shafy-list-row" style={{ padding: '11px 13px' }}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <EventIcon fontSize="small" />
                                </div>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>{label('Latest Visit', 'آخر موعد')}</Typography>
                                  <Typography variant="caption" color="text.secondary">{fmtNiceDateTime(appts[0]?.date)} • {appts[0]?.status}</Typography>
                                </Box>
                              </Stack>
                            </div>
                          )}

                          {reports.length > 0 && (
                            <div className="shafy-list-row" style={{ padding: '11px 13px' }}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <DescriptionIcon fontSize="small" />
                                </div>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>{label('Latest Report', 'آخر تقرير')}</Typography>
                                  <Typography variant="caption" color="text.secondary">{fmtNiceDateTime(reports[0]?.date)} • {reports[0]?.titleAr || reports[0]?.titleEn || reports[0]?.title || 'Report'}</Typography>
                                </Box>
                              </Stack>
                            </div>
                          )}

                          {patient.notesUpdatedAt && (
                            <div className="shafy-list-row" style={{ padding: '11px 13px' }}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <EditOutlinedIcon fontSize="small" />
                                </div>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800}>{label('Notes Updated', 'تحديث الملاحظات')}</Typography>
                                  <Typography variant="caption" color="text.secondary">{fmtNiceDateTime(patient.notesUpdatedAt)}</Typography>
                                </Box>
                              </Stack>
                            </div>
                          )}

                          {!appts.length && !reports.length && !patient.notesUpdatedAt && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                              <Typography variant="body2" color="text.secondary">
                                {label('No recent activity recorded', 'لا يوجد نشاط حديث مسجل')}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Box>
                </CustomTabPanel>

                {/* TAB 2: APPOINTMENTS (Clean 2-Column CSS Grid) */}
                <CustomTabPanel value={tabValue} index={1}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
                      <Typography variant="h6" fontWeight={900}>
                        {label('Appointment History', 'سجل المواعيد')}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}
                        size="small"
                      >
                        {label('New Appointment', 'موعد جديد')}
                      </Button>
                    </Stack>

                    {apptLoading ? (
                      <Stack spacing={1.5}>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '14px' }} />)}</Stack>
                    ) : appts.length === 0 ? (
                      <Box sx={{ p: 5, textAlign: 'center', borderRadius: '16px', bgcolor: '#f8fafc', border: '1.5px dashed #cbd5e1' }}>
                        <LocalHospitalIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                        <Typography color="text.secondary" fontWeight={700}>
                          {label('No appointments found for this patient.', 'لا توجد مواعيد لهذا المريض.')}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: '14px' }}>
                        {appts.map((a) => {
                          const typeInfo = getAppointmentTypeInfo(a, isArabic);
                          return (
                            <div key={a.id} className="shafy-list-row" style={{ padding: '15px 16px' }}>
                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                                <Avatar
                                  variant="rounded"
                                  sx={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: '12px',
                                    bgcolor: statusColor(a?.status) === 'success' ? '#ecfdf5' : '#eff6ff',
                                    color: statusColor(a?.status) === 'success' ? '#059669' : '#2563eb',
                                    flexShrink: 0,
                                  }}
                                >
                                  <EventIcon />
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="subtitle2" fontWeight={900} noWrap>
                                    {fmtApptFull(a)}
                                  </Typography>
                                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                    <Chip
                                      size="small"
                                      label={typeInfo.label}
                                      sx={{ height: 20, fontSize: '0.67rem', bgcolor: typeInfo.bgcolor, color: typeInfo.textColor, fontWeight: 800 }}
                                    />
                                    <Chip
                                      label={String(a?.status || 'pending')}
                                      color={statusColor(a?.status)}
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.67rem', fontWeight: 800 }}
                                    />
                                  </Stack>
                                </Box>
                              </Stack>
                              <Button
                                size="small"
                                variant="outlined"
                                component={Link}
                                href={`/appointments/${a.id}${isArabic ? '?lang=ar' : ''}`}
                                sx={{ borderRadius: '10px', flexShrink: 0 }}
                              >
                                {label('Details', 'التفاصيل')}
                              </Button>
                            </div>
                          );
                        })}
                      </Box>
                    )}
                  </div>
                </CustomTabPanel>

                {/* TAB 3: REPORTS */}
                <CustomTabPanel value={tabValue} index={2}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
                      <Typography variant="h6" fontWeight={900}>
                        {label('Medical & Lab Reports', 'التقارير الطبية والمعملية')}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DescriptionIcon />}
                          onClick={() => router.push(`/prescription/new?patientId=${patient.id}${isArabic ? '&lang=ar' : '&lang=en'}`)}
                        >
                          {label('New Prescription', 'وصفة جديدة')}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ScienceIcon />}
                          onClick={() => setLabOpen(true)}
                        >
                          {label('Add Lab Report', 'إضافة تحليل')}
                        </Button>
                      </Stack>
                    </Stack>

                    {repLoading ? (
                      <Stack spacing={1.5}>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '14px' }} />)}</Stack>
                    ) : reports.length === 0 ? (
                      <Box sx={{ p: 5, textAlign: 'center', borderRadius: '16px', bgcolor: '#f8fafc', border: '1.5px dashed #cbd5e1' }}>
                        <DescriptionIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                        <Typography color="text.secondary" fontWeight={700}>
                          {label('No reports recorded yet.', 'لا توجد تقارير مسجلة بعد.')}
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        {reports.map((r) => {
                          const isLab = String(r?.type || '').toLowerCase() === 'lab';
                          return (
                            <div key={r.id} className="shafy-list-row">
                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                                <Avatar
                                  variant="rounded"
                                  sx={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: '12px',
                                    bgcolor: isLab ? '#eef2ff' : '#eff6ff',
                                    color: isLab ? '#4f46e5' : '#2563eb',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isLab ? <ScienceIcon /> : <DescriptionIcon />}
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Typography variant="subtitle1" fontWeight={900} noWrap>
                                      {r?.titleAr || r?.titleEn || r?.title || (isLab ? label('Lab Report', 'تقرير معملي') : label('Medical Report', 'تقرير طبي'))}
                                    </Typography>
                                    <Chip
                                      label={isLab ? label('Lab', 'معمل') : label('Clinic', 'عيادة')}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        bgcolor: isLab ? '#eef2ff' : '#eff6ff',
                                        color: isLab ? '#4f46e5' : '#2563eb',
                                      }}
                                    />
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    {fmtNiceDateTime(r?.date)} • {isLab ? (r?.labName || label('External Lab', 'معمل خارجي')) : (r?.diagnosis || label('Clinical report', 'تقرير سريري'))}
                                  </Typography>
                                </Box>
                              </Stack>

                              <Stack direction="row" spacing={1} alignItems="center">
                                {r?.followUp && (
                                  <Chip icon={<EventIcon fontSize="small" />} label={fmtNiceDate(r.followUp)} size="small" color="warning" />
                                )}
                                <Button variant="outlined" size="small" onClick={() => setViewReport(r)} sx={{ borderRadius: '10px' }}>
                                  {label('View', 'عرض')}
                                </Button>
                                {r?.appointmentId && (
                                  <IconButton
                                    size="small"
                                    component={Link}
                                    href={`/appointments/${r.appointmentId}${isArabic ? '?lang=ar' : ''}`}
                                    title={label('Go to appointment', 'الذهاب للموعد')}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Stack>
                            </div>
                          );
                        })}
                      </Stack>
                    )}
                  </div>
                </CustomTabPanel>

                {/* TAB 4: NOTES (Equal-Width 2-Column CSS Grid) */}
                <CustomTabPanel value={tabValue} index={3}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: '20px' }}>
                    <Paper elevation={0} className="glass-panel" sx={{ p: 3, borderTop: '4px solid #2563eb', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar sx={{ width: 38, height: 38, bgcolor: '#eff6ff', color: '#2563eb', borderRadius: '11px' }}>
                            <AssignmentIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="h6" fontWeight={900}>
                            {label('Medical Notes', 'ملاحظات طبية')}
                          </Typography>
                        </Stack>
                        {canEditNotes && (
                          <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => openEditAll('flags')}>
                            {label('Edit', 'تعديل')}
                          </Button>
                        )}
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ flex: 1, minHeight: 110 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: patient?.notes ? '#0f172a' : '#94a3b8', fontWeight: 600 }}>
                          {patient?.notes || label('No medical notes added.', 'لا توجد ملاحظات طبية مسجلة.')}
                        </Typography>
                      </Box>
                      {patient?.notesUpdatedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                          {label('Updated:', 'آخر تحديث:')} {fmtNiceDateTime(patient.notesUpdatedAt)}
                        </Typography>
                      )}
                    </Paper>

                    <Paper elevation={0} className="glass-panel" sx={{ p: 3, borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar sx={{ width: 38, height: 38, bgcolor: '#ecfdf5', color: '#059669', borderRadius: '11px' }}>
                            <AttachMoneyIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="h6" fontWeight={900}>
                            {label('Financial Notes', 'ملاحظات مالية')}
                          </Typography>
                        </Stack>
                        <Button size="small" variant="outlined" color="success" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => openEditAll('flags')}>
                          {label('Edit', 'تعديل')}
                        </Button>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ flex: 1, minHeight: 110 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: patient?.financialNotes ? '#0f172a' : '#94a3b8', fontWeight: 600 }}>
                          {patient?.financialNotes || label('No financial notes added.', 'لا توجد ملاحظات مالية مسجلة.')}
                        </Typography>
                      </Box>
                      {patient?.financialNotesUpdatedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                          {label('Updated:', 'آخر تحديث:')} {fmtNiceDateTime(patient.financialNotesUpdatedAt)}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                </CustomTabPanel>

                {/* TAB 5: EXTERNAL LABS */}
                <CustomTabPanel value={tabValue} index={4}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <Typography variant="h6" fontWeight={900} sx={{ mb: 2.5 }}>
                      {label('External Lab Integration', 'نتائج المعامل الخارجية')}
                    </Typography>

                    <Box sx={{ borderRadius: '16px', overflowX: 'auto', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                      {xLabLoading ? (
                        <Box sx={{ p: 3 }}><LinearProgress /></Box>
                      ) : xLabResults.length === 0 ? (
                        <Box sx={{ p: 5, textAlign: 'center' }}>
                          <ScienceIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                          <Typography color="text.secondary" fontWeight={700}>
                            {label('No external lab results found linked to this patient.', 'لا توجد نتائج معامل خارجية مرتبطة بهذا المريض.')}
                          </Typography>
                        </Box>
                      ) : (
                        <Table size="medium" sx={{ minWidth: 640 }}>
                          <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                              <TableCell><strong>{label('Date', 'التاريخ')}</strong></TableCell>
                              <TableCell><strong>{label('Lab', 'المعمل')}</strong></TableCell>
                              <TableCell><strong>{label('Status', 'الحالة')}</strong></TableCell>
                              <TableCell><strong>{label('Result', 'النتيجة')}</strong></TableCell>
                              <TableCell><strong>{label('Tests', 'الاختبارات')}</strong></TableCell>
                              <TableCell><strong>{label('Notes', 'ملاحظات')}</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {xLabResults.map((l) => (
                              <TableRow key={l.id} hover>
                                <TableCell>{fmtNiceDateTime(l?.resultDate || l?.createdAt)}</TableCell>
                                <TableCell>{l?.labId || '—'}</TableCell>
                                <TableCell><Chip label={l?.status || '—'} size="small" variant="outlined" /></TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>{l?.resultValue || '—'}</TableCell>
                                <TableCell>{Number.isFinite(l?.testCount) ? l.testCount : '—'}</TableCell>
                                <TableCell sx={{ color: 'text.secondary', maxWidth: 220 }} noWrap title={l?.notes}>{l?.notes || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </div>
                </CustomTabPanel>
              </Box>
            </Stack>
          )}

          {/* Add Lab Report dialog */}
          <AddLabReportDialog
            open={labOpen}
            onClose={() => setLabOpen(false)}
            isArabic={isArabic}
            onSaved={() => { setLabOpen(false); fetchReports(); }}
          />

          {/* Unified 3-Tab Royal Sapphire Profile Editor Drawer */}
          <Drawer
            anchor={isArabic ? 'left' : 'right'}
            open={editAllOpen}
            onClose={() => !savingAll && setEditAllOpen(false)}
            PaperProps={{
              sx: {
                width: { xs: '100%', sm: 480, md: 560 },
                borderRadius: { xs: 0, sm: isArabic ? '0 24px 24px 0' : '24px 0 0 24px' },
                bgcolor: '#f8fafc',
                direction: isArabic ? 'rtl' : 'ltr',
                textAlign: isArabic ? 'right' : 'left',
                overflow: 'hidden',
              },
            }}
          >
            <Stack sx={{ height: '100%' }}>
              {/* Gradient Drawer Header */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0b1936 0%, #15347a 52%, #2563eb 100%)',
                  color: '#ffffff',
                  padding: '20px 24px 16px',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" fontWeight={900}>
                      {label('Update Patient Profile', 'إعداد وتحديث ملف المريض')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#dbeafe', fontWeight: 600 }}>
                      {editAllValues?.name || patient?.name} • {label(`Completeness ${profileCompleteness}%`, `اكتمال الملف ${profileCompleteness}%`)}
                    </Typography>
                  </Box>
                  <Button
                    onClick={() => setEditAllOpen(false)}
                    size="small"
                    disabled={savingAll}
                    sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.14)', borderRadius: '10px', px: 1.5 }}
                  >
                    {label('Close', 'إغلاق')}
                  </Button>
                </Stack>

                {/* 3 Pill Sub-Tabs */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '14px',
                    background: 'rgba(255,255,255,0.12)',
                    padding: '4px',
                    borderRadius: '13px',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {[
                    { id: 'basics', txt: label('1. Basics', '١. الأساسيات') },
                    { id: 'medical', txt: label('2. Medical & Vitals', '٢. الطبي والمؤشرات') },
                    { id: 'flags', txt: label('3. Flags & Notes', '٣. الأعلام والملاحظات') },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setDrawerTab(tb.id)}
                      className="shafy-tab-pill"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        padding: '7px 10px',
                        fontSize: '0.78rem',
                        background: drawerTab === tb.id ? '#ffffff' : 'transparent',
                        color: drawerTab === tb.id ? '#1d4ed8' : '#e2e8f0',
                      }}
                    >
                      {tb.txt}
                    </button>
                  ))}
                </div>
              </div>

              {editAllValues ? (
                <Box sx={{ overflowY: 'auto', p: 2.5, flex: 1 }}>
                  {drawerTab === 'basics' && (
                    <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                      <Stack spacing={2}>
                        <TextField fullWidth label={label('Full Name *', 'الاسم الكامل *')} value={editAllValues.name} onChange={handleEditInput('name')} required />
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.85fr 1.15fr' }, gap: '12px', alignItems: 'end' }}>
                          <TextField fullWidth label={label('Age', 'العمر')} type="number" value={editAllValues.age} onChange={handleEditInput('age')} />
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block', mb: 0.75 }}>
                              {label('Gender', 'النوع')}
                            </Typography>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              {[
                                { val: 'male', txt: label('Male', 'ذكر'), color: '#2563eb', bg: '#eff6ff' },
                                { val: 'female', txt: label('Female', 'أنثى'), color: '#db2777', bg: '#fdf2f8' },
                              ].map((g) => {
                                const sel = String(editAllValues.gender || '').toLowerCase() === g.val;
                                return (
                                  <button
                                    key={g.val}
                                    type="button"
                                    onClick={() => setEditAllValues((p) => ({ ...p, gender: g.val }))}
                                    style={{
                                      padding: '10px',
                                      borderRadius: '12px',
                                      border: `1.5px solid ${sel ? g.color : '#e2e8f0'}`,
                                      background: sel ? g.bg : '#ffffff',
                                      color: sel ? g.color : '#475569',
                                      fontWeight: 800,
                                      fontSize: '0.84rem',
                                      cursor: 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    {g.txt}
                                  </button>
                                );
                              })}
                            </div>
                          </Box>
                        </Box>

                        <Box>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block', mb: 0.75 }}>
                            {label('Blood Type (Quick Select)', 'فصيلة الدم')}
                          </Typography>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => {
                              const sel = editAllValues.bloodType === b;
                              return (
                                <button
                                  key={b}
                                  type="button"
                                  onClick={() => setEditAllValues((p) => ({ ...p, bloodType: sel ? '' : b }))}
                                  style={{
                                    minWidth: '48px',
                                    padding: '6px 10px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${sel ? '#dc2626' : '#e2e8f0'}`,
                                    background: sel ? '#fef2f2' : '#ffffff',
                                    color: sel ? '#b91c1c' : '#334155',
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  {b}
                                </button>
                              );
                            })}
                          </div>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '12px' }}>
                          <TextField fullWidth label={label('Phone', 'الهاتف')} value={editAllValues.phone} onChange={handleEditInput('phone')} />
                          <TextField fullWidth select label={label('Marital Status', 'الحالة الاجتماعية')} value={editAllValues.maritalStatus} onChange={handleEditInput('maritalStatus')}>
                            <MenuItem value="">{label('Unspecified', 'غير محدد')}</MenuItem>
                            <MenuItem value="single">{label('Single', 'أعزب')}</MenuItem>
                            <MenuItem value="married">{label('Married', 'متزوج')}</MenuItem>
                            <MenuItem value="divorced">{label('Divorced', 'مطلق')}</MenuItem>
                            <MenuItem value="widowed">{label('Widowed', 'أرمل')}</MenuItem>
                          </TextField>
                        </Box>

                        <TextField fullWidth label={label('Email', 'البريد الإلكتروني')} type="email" value={editAllValues.email} onChange={handleEditInput('email')} />
                        <TextField fullWidth label={label('Address', 'العنوان')} multiline minRows={2} value={editAllValues.address} onChange={handleEditInput('address')} />
                        <TextField fullWidth type="datetime-local" label={label('Last Visit', 'آخر زيارة')} value={editAllValues.lastVisit} onChange={handleEditInput('lastVisit')} InputLabelProps={{ shrink: true }} />
                      </Stack>
                    </div>
                  )}

                  {drawerTab === 'medical' && (
                    <Stack spacing={2}>
                      <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1.5, color: '#0f172a' }}>
                          {label('Vital Measurements', 'المؤشرات الحيوية الأساسية')}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                          <TextField fullWidth size="small" label={label('Weight (kg)', 'الوزن (كجم)')} value={editAllValues.weight} onChange={handleEditInput('weight')} />
                          <TextField fullWidth size="small" label={label('Height (cm)', 'الطول (سم)')} value={editAllValues.height} onChange={handleEditInput('height')} />
                          <TextField fullWidth size="small" label={label('Blood Pressure', 'ضغط الدم')} placeholder="120/80" value={editAllValues.bloodPressure} onChange={handleEditInput('bloodPressure')} />
                          <TextField fullWidth size="small" label={label('Temperature (°C)', 'الحرارة (°C)')} placeholder="37.0" value={editAllValues.temperature} onChange={handleEditInput('temperature')} />
                        </Box>
                      </div>

                      <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1.5, color: '#0f172a' }}>
                          {label('Allergies, Chronic Conditions & Meds', 'الحساسيات والأمراض المزمنة والأدوية')}
                        </Typography>
                        <Stack spacing={2}>
                          <Box>
                            <TextField fullWidth multiline minRows={2} label={label('Allergies', 'الحساسية')} value={editAllValues.allergies} onChange={handleEditInput('allergies')} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                              {(isArabic ? ['بنسلين', 'أسبرين', 'سلفا', 'لا يوجد'] : ['Penicillin', 'Aspirin', 'Sulfa', 'None']).map((tok) => (
                                <button
                                  key={tok}
                                  type="button"
                                  onClick={() => {
                                    const cur = splitCsv(editAllValues.allergies);
                                    const next = cur.includes(tok) ? cur.filter((x) => x !== tok) : [...cur, tok];
                                    setEditAllValues((p) => ({ ...p, allergies: next.join(', ') }));
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    fontSize: '0.73rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  + {tok}
                                </button>
                              ))}
                            </div>
                          </Box>

                          <Box>
                            <TextField fullWidth multiline minRows={2} label={label('Chronic Conditions', 'الأمراض المزمنة')} value={editAllValues.conditions} onChange={handleEditInput('conditions')} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                              {(isArabic ? ['سكري', 'ضغط دم', 'ربو', 'قلب', 'غدة درقية'] : ['Diabetes', 'Hypertension', 'Asthma', 'Heart', 'Thyroid']).map((tok) => (
                                <button
                                  key={tok}
                                  type="button"
                                  onClick={() => {
                                    const cur = splitCsv(editAllValues.conditions);
                                    const next = cur.includes(tok) ? cur.filter((x) => x !== tok) : [...cur, tok];
                                    setEditAllValues((p) => ({ ...p, conditions: next.join(', ') }));
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    border: '1px solid #fde68a',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontSize: '0.73rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  + {tok}
                                </button>
                              ))}
                            </div>
                          </Box>

                          <TextField fullWidth multiline minRows={2} label={label('Current Medications', 'الأدوية الحالية')} value={editAllValues.medications} onChange={handleEditInput('medications')} />
                        </Stack>
                      </div>
                    </Stack>
                  )}

                  {drawerTab === 'flags' && (
                    <Stack spacing={2}>
                      <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1.5, color: '#0f172a' }}>
                          {label('Clinical Health Flags', 'الأعلام والمؤشرات الصحية')}
                        </Typography>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {[
                            { key: 'isDiabetic', txt: label('Diabetic', 'مريض سكري') },
                            { key: 'hadSurgeries', txt: label('Past Surgeries', 'عمليات سابقة') },
                            { key: 'isSmoker', txt: label('Smoker', 'مدخن') },
                            { key: 'drinksAlcohol', txt: label('Alcohol', 'كحول') },
                            { key: 'familyHistory', txt: label('Family History', 'تاريخ عائلي') },
                            { key: 'isPregnant', txt: label('Pregnant', 'حامل') },
                          ].map((fl) => {
                            const on = !!editAllValues[fl.key];
                            return (
                              <div
                                key={fl.key}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '12px',
                                  background: on ? '#eff6ff' : '#f8fafc',
                                  border: `1px solid ${on ? '#93c5fd' : '#e2e8f0'}`,
                                }}
                              >
                                <FormControlLabel
                                  sx={{ m: 0, width: '100%', justifyContent: 'space-between' }}
                                  labelPlacement="start"
                                  control={<Switch size="small" checked={on} onChange={handleEditToggle(fl.key)} />}
                                  label={<Typography variant="body2" fontWeight={800}>{fl.txt}</Typography>}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1.5, color: '#0f172a' }}>
                          {label('Medical & Financial Notes', 'الملاحظات الطبية والمالية')}
                        </Typography>
                        <Stack spacing={2}>
                          <TextField fullWidth multiline minRows={3} label={label('Medical Notes', 'ملاحظات طبية')} value={editAllValues.notes} onChange={handleEditInput('notes')} />
                          <TextField fullWidth multiline minRows={3} label={label('Financial Notes', 'ملاحظات مالية')} value={editAllValues.financialNotes} onChange={handleEditInput('financialNotes')} />
                        </Stack>
                      </div>
                    </Stack>
                  )}
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  <Typography color="text.secondary">{label('Loading profile…', 'جاري تحميل الملف…')}</Typography>
                </Box>
              )}

              {/* Sticky Drawer Footer */}
              <Stack
                direction="row"
                spacing={1.5}
                justifyContent="flex-end"
                sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}
              >
                <Button variant="outlined" onClick={() => setEditAllOpen(false)} disabled={savingAll} sx={{ borderRadius: '12px', px: 2.5 }}>
                  {label('Cancel', 'إلغاء')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={savingAll}
                  sx={{ borderRadius: '12px', px: 3.5 }}
                >
                  {savingAll ? label('Saving…', 'جارٍ الحفظ…') : label('Save Profile', 'حفظ التغييرات')}
                </Button>
              </Stack>
            </Stack>
          </Drawer>

          {/* View report (read-only) */}
          <ReportInlineView report={viewReport} isArabic={isArabic} onClose={() => setViewReport(null)} />


          <Snackbar
            open={Boolean(error)}
            autoHideDuration={4000}
            onClose={() => setError('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Snackbar>

          <Snackbar
            open={Boolean(okMsg)}
            autoHideDuration={2500}
            onClose={() => setOkMsg('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setOkMsg('')}>{okMsg}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected >
  );
}
