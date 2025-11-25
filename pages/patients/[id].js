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
import HealthInfoSection from '@/components/patients/HealthInfoSection';
import MedicalFileIntake from '@/components/patients/MedicalFileIntake';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import AddLabReportDialog from '@/components/reports/AddLabReportDialog';

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
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const label = (e, a) => (isArabic ? a : e);

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
    age: Number.isFinite(patient?.age) ? patient.age : '',
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
    notes: patient?.notes || '',
    financialNotes: patient?.financialNotes || '',
    isDiabetic: !!patient?.isDiabetic,
    hadSurgeries: !!patient?.hadSurgeries,
    isSmoker: !!patient?.isSmoker,
    drinksAlcohol: !!patient?.drinksAlcohol,
    familyHistory: !!patient?.familyHistory,
    isPregnant: !!patient?.isPregnant,
  }), [patient]);

  const openEditAll = React.useCallback(() => {
    if (!patient) return;
    setEditAllValues(buildEditAllValues());
    setEditAllOpen(true);
  }, [patient, buildEditAllValues]);

  const handleSaveProfile = async () => {
    if (!patient?.id || !editAllValues) return;
    setSavingAll(true);
    try {
      const ref = doc(db, 'patients', patient.id);
      const ageVal = Number(editAllValues.age);
      const updateData = {
        name: editAllValues.name.trim(),
        age: Number.isFinite(ageVal) ? ageVal : null,
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
        updateData = {
          phone: tempValues.phone,
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
          query(col, where('doctorUID', '==', user.uid), where('patientId', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientUID', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientID', '==', pid)),
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
  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md">
          {loading ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Skeleton height={32} />
              <Skeleton variant="rounded" height={200} />
              <Skeleton variant="rounded" height={180} />
              <Skeleton height={24} />
              <Skeleton variant="rounded" height={140} />
            </Stack>
          ) : !patient ? (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography color="error">{label('Patient not found', 'المريض غير موجود')}</Typography>
              <Button sx={{ mt: 2 }} component={Link} href={`/patients${isArabic ? '?lang=ar' : ''}`}>
                {label('Back to list', 'العودة إلى القائمة')}
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>

              {/* Modern Header */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.05)} 0%, ${alpha(t.palette.background.paper, 1)} 100%)`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decorative circle */}
                <Box sx={{
                  position: 'absolute', top: -40, right: isArabic ? 'auto' : -40, left: isArabic ? -40 : 'auto',
                  width: 200, height: 200, borderRadius: '50%',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
                  zIndex: 0
                }} />

                <Grid container spacing={3} alignItems="center" position="relative" zIndex={1}>
                  <Grid item>
                    <Avatar
                      sx={{
                        width: 100, height: 100,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                      }}
                    >
                      {initials}
                    </Avatar>
                  </Grid>
                  <Grid item xs>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="h4" fontWeight={900} color="text.primary" sx={{ lineHeight: 1.1 }}>
                          {patient.name || label('Unnamed', 'بدون اسم')}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, opacity: 0.8 }}>
                          <AssignmentIcon fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight={600} color="text.secondary">
                            ID: {patient.id}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => copy(patient.id)}
                            sx={{ minWidth: 0, p: 0.5, color: 'text.secondary' }}
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </Button>
                        </Stack>
                      </Box>

                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {Number.isFinite(patient?.age) && (
                          <Chip
                            icon={<EventIcon fontSize="small" />}
                            label={`${label('Age', 'العمر')}: ${patient.age}`}
                            size="small"
                            sx={{ fontWeight: 600, bgcolor: 'background.paper' }}
                          />
                        )}
                        {patient?.gender && (
                          <Chip
                            icon={<PersonIcon fontSize="small" />}
                            label={patient.gender}
                            size="small"
                            sx={{ fontWeight: 600, bgcolor: 'background.paper' }}
                          />
                        )}
                        {patient?.bloodType && (
                          <Chip
                            icon={<BloodtypeIcon fontSize="small" />}
                            label={patient.bloodType}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md="auto">
                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
                      <Button
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={openEditAll}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                      >
                        {label('Edit Profile', 'تعديل الملف')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={printReport}
                        disabled={aiBusy}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                      >
                        {label('Print Report', 'طباعة التقرير')}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)'
                        }}
                      >
                        {label('New Appointment', 'حجز موعد')}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  background: (t) => `linear-gradient(115deg, ${alpha(t.palette.primary.light, 0.12)} 0%, ${t.palette.background.paper} 70%)`,
                  border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="overline" color="text.secondary">{label('Appointments', 'المواعيد')}</Typography>
                      <Typography variant="h5" fontWeight={900}>{totalAppointments}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {label('Total visits recorded', 'إجمالي الزيارات المسجلة')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="overline" color="text.secondary">{label('Reports', 'التقارير')}</Typography>
                      <Typography variant="h5" fontWeight={900}>{totalReports}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {label('Clinical & lab reports', 'التقارير الطبية والمعملية')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="overline" color="text.secondary">{label('Next Appointment', 'الموعد القادم')}</Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {nextAppointment ? fmtNiceDateTime(nextAppointment._d || nextAppointment.date) : label('No upcoming', 'لا يوجد موعد قادم')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {nextAppointment?.time || ''}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="overline" color="text.secondary">{label('Latest Report', 'أحدث تقرير')}</Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {latestReport?.diagnosis || latestReport?.titleEn || latestReport?.titleAr || label('Not yet added', 'لم يُضف بعد')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {latestReport?.date ? fmtNiceDateTime(latestReport.date) : ''}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Paper>

              {/* Tabs Navigation */}
              <Paper sx={{ borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, overflow: 'hidden' }}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    bgcolor: 'background.paper',
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      minHeight: 56,
                      px: 3
                    }
                  }}
                >
                  <Tab label={label('Overview', 'نظرة عامة')} />
                  <Tab label={label('Appointments', 'المواعيد')} icon={<LocalHospitalIcon fontSize="small" />} iconPosition="start" />
                  <Tab label={label('Reports', 'التقارير')} icon={<DescriptionIcon fontSize="small" />} iconPosition="start" />
                  <Tab label={label('Notes', 'الملاحظات')} icon={<EditOutlinedIcon fontSize="small" />} iconPosition="start" />
                  <Tab label={label('External Labs', 'معامل خارجية')} icon={<ScienceIcon fontSize="small" />} iconPosition="start" />
                </Tabs>
                <Divider />

                {/* TAB 1: OVERVIEW */}
                <CustomTabPanel value={tabValue} index={0}>
                  <Stack spacing={3}>
                    {/* AI Summary */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        borderRadius: 4,
                        border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
                        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)} 0%, ${alpha(t.palette.background.paper, 1)} 100%)`,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: (t) => `0 12px 32px -4px ${alpha(t.palette.primary.main, 0.15)}`,
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      <Box sx={{
                        position: 'absolute', top: -40, right: -40, width: 150, height: 150,
                        borderRadius: '50%', bgcolor: (t) => alpha(t.palette.primary.main, 0.05), zIndex: 0
                      }} />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 2, position: 'relative', zIndex: 1 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar sx={{ bgcolor: 'primary.main', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)' }}>
                            <AutoAwesomeIcon color="inherit" />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight={800} color="text.primary">
                              {label('AI Clinical Summary', 'الملخص السريري الذكي')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                              {label('Powered by Shafy AI', 'مدعوم بواسطة شافي AI')}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          variant="contained"
                          size="medium"
                          startIcon={aiBusy ? <Box sx={{ width: 20, height: 20 }} /> : <AutoAwesomeIcon />}
                          onClick={summarizeWithAI}
                          disabled={aiBusy}
                          sx={{
                            borderRadius: 2.5,
                            textTransform: 'none',
                            fontWeight: 700,
                            px: 3,
                            background: (t) => `linear-gradient(45deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
                            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                          }}
                        >
                          {aiBusy ? <LinearProgress sx={{ width: 100, height: 6, borderRadius: 1 }} color="inherit" /> : label('Generate Summary', 'توليد الملخص')}
                        </Button>
                      </Stack>

                      {!aiBusy && aiErr && <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{aiErr}</Alert>}

                      <Paper
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.6)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.5)',
                          minHeight: 100,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: !aiText ? 'center' : 'flex-start'
                        }}
                      >
                        {aiBusy ? (
                          <Stack spacing={1.5} width="100%">
                            <Skeleton variant="text" width="90%" height={24} />
                            <Skeleton variant="text" width="80%" height={24} />
                            <Skeleton variant="text" width="95%" height={24} />
                          </Stack>
                        ) : aiText ? (
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }} color="text.primary">
                            {aiText}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                            {label('Click "Generate Summary" to get a concise AI-powered overview of this patient\'s history and status.', 'اضغط على "توليد الملخص" للحصول على نظرة عامة موجزة مدعومة بالذكاء الاصطناعي.')}
                          </Typography>
                        )}
                      </Paper>
                    </Paper>

                    {/* Quick Stats Cards */}
                    <Grid container spacing={2}>
                      {[
                        {
                          icon: <LocalHospitalIcon sx={{ fontSize: 28, color: 'white' }} />,
                          count: appts.filter(a => a.status === 'completed').length,
                          label: label('Total Visits', 'إجمالي الزيارات'),
                          color: '#2196f3',
                          gradient: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
                        },
                        {
                          icon: <EventIcon sx={{ fontSize: 28, color: 'white' }} />,
                          count: patient.lastVisit ? Math.floor((new Date() - new Date(patient.lastVisit)) / (1000 * 60 * 60 * 24)) : '—',
                          label: label('Days Since Last', 'أيام منذ آخر زيارة'),
                          color: '#4caf50',
                          gradient: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)'
                        },
                        {
                          icon: <DescriptionIcon sx={{ fontSize: 28, color: 'white' }} />,
                          count: reports.length,
                          label: label('Reports', 'التقارير'),
                          color: '#ff9800',
                          gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                        },
                        {
                          icon: <ScienceIcon sx={{ fontSize: 28, color: 'white' }} />,
                          count: appts.filter(a => a.status === 'scheduled' || a.status === 'pending').length,
                          label: label('Upcoming', 'القادمة'),
                          color: '#9c27b0',
                          gradient: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)'
                        }
                      ].map((stat, i) => (
                        <Grid item xs={6} sm={3} key={i}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 2.5,
                              borderRadius: 3,
                              position: 'relative',
                              overflow: 'hidden',
                              border: '1px solid rgba(0,0,0,0.08)',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: `0 12px 24px -4px ${alpha(stat.color, 0.25)}`,
                                borderColor: alpha(stat.color, 0.3)
                              }
                            }}
                          >
                            <Stack spacing={2} alignItems="center">
                              <Avatar
                                variant="rounded"
                                sx={{
                                  width: 56, height: 56,
                                  background: stat.gradient,
                                  boxShadow: `0 8px 16px -4px ${alpha(stat.color, 0.4)}`,
                                  borderRadius: 2.5
                                }}
                              >
                                {stat.icon}
                              </Avatar>
                              <Box textAlign="center">
                                <Typography variant="h4" fontWeight={900} sx={{ color: stat.color, lineHeight: 1 }}>
                                  {stat.count}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 0.5, display: 'block', opacity: 0.8 }}>
                                  {stat.label}
                                </Typography>
                              </Box>
                            </Stack>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    {/* Vitals & Activity Row */}
                    <Grid container spacing={3}>
                      {/* Vitals Section */}
                      <Grid item xs={12} md={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 3,
                            height: '100%',
                            background: (t) => `linear-gradient(135deg, ${alpha(t.palette.background.paper, 1)} 0%, ${alpha(t.palette.primary.main, 0.02)} 100%)`,
                            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Avatar sx={{ width: 40, height: 40, bgcolor: 'error.light', color: 'error.dark', boxShadow: '0 4px 12px rgba(211, 47, 47, 0.2)' }}>
                                <BloodtypeIcon />
                              </Avatar>
                              <Typography variant="h6" fontWeight={800}>
                                {label('Vitals & Metrics', 'المؤشرات الحيوية')}
                              </Typography>
                            </Stack>
                            {!editMode.vitals ? (
                              <IconButton onClick={() => handleEditModeToggle('vitals')} size="small" sx={{ bgcolor: 'action.hover' }}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={() => handleCancelEdit('vitals')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                                <Button size="small" variant="contained" onClick={() => handleSaveSection('vitals')} disabled={savingSection === 'vitals'}>
                                  {label('Save', 'حفظ')}
                                </Button>
                              </Stack>
                            )}
                          </Stack>

                          <Grid container spacing={2}>
                            {[
                              { key: 'weight', label: label('Weight', 'الوزن'), unit: 'kg', icon: '⚖️', color: '#1976d2' },
                              { key: 'height', label: label('Height', 'الطول'), unit: 'cm', icon: '📏', color: '#2e7d32' },
                              { key: 'bloodPressure', label: label('Blood Pressure', 'ضغط الدم'), unit: '', icon: '❤️', color: '#d32f2f' },
                              { key: 'temperature', label: label('Temperature', 'درجة الحرارة'), unit: '°C', icon: '🌡️', color: '#ed6c02' }
                            ].map((item) => (
                              <Grid item xs={6} key={item.key}>
                                <Box
                                  sx={{
                                    p: 2,
                                    borderRadius: 2.5,
                                    bgcolor: (t) => alpha(item.color, 0.08),
                                    border: (t) => `1px solid ${alpha(item.color, 0.1)}`,
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      bgcolor: (t) => alpha(item.color, 0.12),
                                      transform: 'translateY(-2px)'
                                    }
                                  }}
                                >
                                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    <span>{item.icon}</span> {item.label}
                                  </Typography>

                                  {editMode.vitals ? (
                                    <TextField
                                      fullWidth
                                      variant="standard"
                                      value={tempValues[item.key]}
                                      onChange={handleTempChange(item.key)}
                                      placeholder="—"
                                      InputProps={{
                                        disableUnderline: true,
                                        sx: { fontSize: '1.1rem', fontWeight: 700, color: item.color }
                                      }}
                                    />
                                  ) : (
                                    <Typography variant="h6" fontWeight={800} sx={{ color: item.color }}>
                                      {patient[item.key] || '—'}
                                      {patient[item.key] && item.unit && <Typography component="span" variant="caption" sx={{ opacity: 0.7, ml: 0.5 }}>{item.unit}</Typography>}
                                    </Typography>
                                  )}
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </Paper>
                      </Grid>

                      {/* Activity Timeline */}
                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.light', color: 'info.dark' }}>
                              <AssignmentIcon fontSize="small" />
                            </Avatar>
                            <Typography variant="h6" fontWeight={800}>
                              {label('Recent Activity', 'النشاط الأخير')}
                            </Typography>
                          </Stack>
                          <Stack spacing={1.5}>
                            {/* Latest appointment */}
                            {appts.length > 0 && (
                              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.5 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {label('Appointment', 'موعد')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {fmtNiceDateTime(appts[0]?.date)} • {appts[0]?.status}
                                  </Typography>
                                </Box>
                              </Stack>
                            )}
                            {/* Latest report */}
                            {reports.length > 0 && (
                              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main', mt: 0.5 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {label('Report Added', 'تقرير مضاف')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {fmtNiceDateTime(reports[0]?.date)} • {reports[0]?.titleEn || reports[0]?.title || 'Report'}
                                  </Typography>
                                </Box>
                              </Stack>
                            )}
                            {/* Notes updated */}
                            {patient.notesUpdatedAt && (
                              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', mt: 0.5 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {label('Notes Updated', 'تحديث الملاحظات')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {fmtNiceDateTime(patient.notesUpdatedAt)} • {patient.notesUpdatedBy || 'Staff'}
                                  </Typography>
                                </Box>
                              </Stack>
                            )}
                            {/* If no activity */}
                            {!appts.length && !reports.length && !patient.notesUpdatedAt && (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {label('No recent activity', 'لا يوجد نشاط حديث')}
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Grid container spacing={3}>
                      {/* Contact Info */}
                      <Grid item xs={12} md={5}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 3,
                            height: '100%',
                            background: (t) => `linear-gradient(135deg, ${alpha(t.palette.background.paper, 1)} 0%, ${alpha(t.palette.info.main, 0.03)} 100%)`,
                            border: (t) => `1px solid ${alpha(t.palette.info.main, 0.1)}`,
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                            <Typography variant="h6" fontWeight={800}>
                              {label('Contact Information', 'معلومات الاتصال')}
                            </Typography>
                            {!editMode.contact ? (
                              <IconButton onClick={() => handleEditModeToggle('contact')} size="small" sx={{ bgcolor: 'action.hover' }}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={() => handleCancelEdit('contact')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                                <Button size="small" variant="contained" onClick={() => handleSaveSection('contact')} disabled={savingSection === 'contact'}>
                                  {label('Save', 'حفظ')}
                                </Button>
                              </Stack>
                            )}
                          </Stack>

                          <Stack spacing={3}>
                            {[
                              { key: 'phone', label: label('Phone', 'الهاتف'), icon: <PhoneIcon fontSize="small" />, type: 'tel' },
                              { key: 'email', label: label('Email', 'البريد'), icon: <EmailIcon fontSize="small" />, type: 'email' },
                              { key: 'address', label: label('Address', 'العنوان'), icon: <PlaceIcon fontSize="small" />, type: 'text' }
                            ].map((item) => (
                              <Stack key={item.key} direction="row" spacing={2} alignItems="flex-start">
                                <Avatar sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary' }}>
                                  {item.icon}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 0.5 }}>
                                    {item.label}
                                  </Typography>

                                  {editMode.contact ? (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      value={tempValues[item.key]}
                                      onChange={handleTempChange(item.key)}
                                      placeholder={item.label}
                                      variant="outlined"
                                      sx={{ mt: 0.5 }}
                                    />
                                  ) : (
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography variant="body1" fontWeight={500}>
                                        {patient[item.key] || '—'}
                                      </Typography>
                                      {patient[item.key] && (
                                        <IconButton size="small" onClick={() => copy(patient[item.key])} sx={{ opacity: 0.5, p: 0.5 }}>
                                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      )}
                                    </Stack>
                                  )}

                                  {!editMode.contact && patient[item.key] && (
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                      {item.key === 'phone' && (
                                        <>
                                          <Button size="small" variant="outlined" startIcon={<PhoneIcon />} component={Link} href={`tel:${patient.phone}`} sx={{ borderRadius: 2, py: 0.2, fontSize: '0.75rem' }}>
                                            {label('Call', 'اتصال')}
                                          </Button>
                                          <Button size="small" variant="outlined" component={Link} href={`sms:${patient.phone}`} sx={{ borderRadius: 2, py: 0.2, fontSize: '0.75rem' }}>
                                            SMS
                                          </Button>
                                        </>
                                      )}
                                      {item.key === 'email' && (
                                        <Button size="small" variant="outlined" startIcon={<EmailIcon />} component={Link} href={`mailto:${patient.email}`} sx={{ borderRadius: 2, py: 0.2, fontSize: '0.75rem' }}>
                                          {label('Email', 'إرسال')}
                                        </Button>
                                      )}
                                    </Stack>
                                  )}
                                </Box>
                              </Stack>
                            ))}
                          </Stack>
                        </Paper>
                      </Grid>

                      {/* Clinical Profile */}
                      <Grid item xs={12} md={7}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 3,
                            height: '100%',
                            background: (t) => `linear-gradient(135deg, ${alpha(t.palette.background.paper, 1)} 0%, ${alpha(t.palette.secondary.main, 0.03)} 100%)`,
                            border: (t) => `1px solid ${alpha(t.palette.secondary.main, 0.1)}`,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                            <Typography variant="h6" fontWeight={800}>
                              {label('Clinical Profile', 'الملف السريري')}
                            </Typography>
                            {!editMode.clinical ? (
                              <IconButton onClick={() => handleEditModeToggle('clinical')} size="small" sx={{ bgcolor: 'action.hover' }}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={() => handleCancelEdit('clinical')} color="inherit">{label('Cancel', 'إلغاء')}</Button>
                                <Button size="small" variant="contained" onClick={() => handleSaveSection('clinical')} disabled={savingSection === 'clinical'}>
                                  {label('Save', 'حفظ')}
                                </Button>
                              </Stack>
                            )}
                          </Stack>

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
                                  updatedBy: user?.uid || user?.email || 'doctor'
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

                          <Grid container spacing={3} sx={{ mt: 1 }}>
                            <Grid item xs={12} sm={6}>
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
                                  <Chip label={patient?.maritalStatus || label('Unspecified', 'غير محدد')} variant="outlined" size="small" sx={{ fontWeight: 500 }} />
                                )}
                              </Labeled>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Labeled title={label('Last Visit', 'آخر زيارة')}>
                                <Typography variant="body2" fontWeight={500}>{fmtNiceDate(patient.lastVisit)}</Typography>
                              </Labeled>
                            </Grid>

                            {[
                              { key: 'allergies', label: label('Allergies', 'الحساسيات'), color: 'error', bg: '#f44336' },
                              { key: 'conditions', label: label('Chronic Conditions', 'الأمراض المزمنة'), color: 'warning', bg: '#ff9800' },
                              { key: 'medications', label: label('Current Medications', 'الأدوية الحالية'), color: 'info', bg: '#0288d1' }
                            ].map((section) => (
                              <Grid item xs={12} key={section.key}>
                                <Labeled title={section.label}>
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                    {(editMode.clinical ? tempValues[section.key] : splitCsv(patient?.[section.key])).map((item, i) => (
                                      <Chip
                                        key={i}
                                        label={item}
                                        color={section.color}
                                        variant="soft"
                                        size="small"
                                        onDelete={editMode.clinical ? () => handleRemoveChip(section.key, i) : undefined}
                                        sx={{
                                          bgcolor: alpha(section.bg, 0.1),
                                          color: section.bg,
                                          fontWeight: 600,
                                          borderRadius: 1.5
                                        }}
                                      />
                                    ))}
                                    {editMode.clinical && (
                                      <Box component="form"
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
                                          placeholder="+"
                                          size="small"
                                          sx={{
                                            width: 80,
                                            '& .MuiInputBase-root': { borderRadius: 2, fontSize: '0.8rem', height: 24, padding: 0 }
                                          }}
                                          InputProps={{
                                            sx: { px: 1 }
                                          }}
                                        />
                                      </Box>
                                    )}
                                    {!editMode.clinical && !splitCsv(patient?.[section.key]).length && (
                                      <Typography variant="body2" color="text.secondary">—</Typography>
                                    )}
                                  </Stack>
                                </Labeled>
                              </Grid>
                            ))}
                          </Grid>

                          <Box sx={{ mt: 3 }}>
                            <HealthInfoSection patient={patient} isArabic={isArabic} label={label} />
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Stack>
                </CustomTabPanel>

                {/* TAB 2: APPOINTMENTS */}
                <CustomTabPanel value={tabValue} index={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={800}>
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
                    <Stack spacing={2}>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={80} />)}</Stack>
                  ) : appts.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'background.default' }} variant="outlined">
                      <LocalHospitalIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography color="text.secondary">
                        {label('No appointments found for this patient.', 'لا توجد مواعيد لهذا المريض.')}
                      </Typography>
                    </Paper>
                  ) : (
                    <Grid container spacing={2}>
                      {appts.map((a) => (
                        <Grid item xs={12} md={6} key={a.id}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                            }}
                          >
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: 56, height: 56,
                                bgcolor: alpha(statusColor(a?.status) === 'success' ? '#2e7d32' : '#1976d2', 0.1),
                                color: statusColor(a?.status) === 'success' ? 'success.main' : 'primary.main'
                              }}
                            >
                              <EventIcon />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {fmtApptFull(a)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {a?.doctorName_en || a?.doctorName_ar || label('Doctor', 'طبيب')}
                              </Typography>
                            </Box>
                            <Stack alignItems="flex-end" spacing={1}>
                              <Chip
                                label={String(a?.status || 'pending')}
                                color={statusColor(a?.status)}
                                size="small"
                                variant="soft"
                                sx={{ fontWeight: 700, borderRadius: 1 }}
                              />
                              <Button
                                size="small"
                                component={Link}
                                href={`/appointments/${a.id}${isArabic ? '?lang=ar' : ''}`}
                                endIcon={isArabic ? <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} /> : <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} />}
                              >
                                {label('Details', 'التفاصيل')}
                              </Button>
                            </Stack>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CustomTabPanel>

                {/* TAB 3: REPORTS */}
                <CustomTabPanel value={tabValue} index={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={800}>
                      {label('Medical & Lab Reports', 'التقارير الطبية والمعملية')}
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={() => setLabOpen(true)}
                      size="small"
                    >
                      {label('Add Report', 'إضافة تقرير')}
                    </Button>
                  </Stack>

                  {repLoading ? (
                    <Stack spacing={2}>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={80} />)}</Stack>
                  ) : reports.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'background.default' }} variant="outlined">
                      <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography color="text.secondary">
                        {label('No reports recorded yet.', 'لا توجد تقارير مسجلة بعد.')}
                      </Typography>
                    </Paper>
                  ) : (
                    <Stack spacing={2}>
                      {reports.map((r) => {
                        const isLab = String(r?.type || '').toLowerCase() === 'lab';
                        return (
                          <Paper
                            key={r.id}
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              alignItems: { xs: 'flex-start', sm: 'center' },
                              gap: 2,
                              '&:hover': { borderColor: 'primary.main' }
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 48, height: 48,
                                bgcolor: isLab ? alpha('#9c27b0', 0.1) : alpha('#1976d2', 0.1),
                                color: isLab ? 'secondary.main' : 'primary.main'
                              }}
                            >
                              {isLab ? <ScienceIcon /> : <DescriptionIcon />}
                            </Avatar>

                            <Box sx={{ flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  {r?.titleAr || r?.titleEn || r?.title || (isLab ? label('Lab Report', 'تقرير معملي') : label('Medical Report', 'تقرير طبي'))}
                                </Typography>
                                <Chip
                                  label={isLab ? label('Lab', 'معمل') : label('Clinic', 'عيادة')}
                                  size="small"
                                  variant="outlined"
                                  color={isLab ? 'secondary' : 'primary'}
                                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                                />
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {fmtNiceDateTime(r?.date)} • {isLab ? (r?.labName || label('External Lab', 'معمل خارجي')) : (r?.diagnosis || label('No diagnosis', 'لا يوجد تشخيص'))}
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center">
                              {r?.followUp && (
                                <Chip
                                  icon={<EventIcon fontSize="small" />}
                                  label={fmtNiceDate(r.followUp)}
                                  size="small"
                                  color="warning"
                                  variant="soft"
                                />
                              )}
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setViewReport(r)}
                              >
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
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </CustomTabPanel>

                {/* TAB 4: NOTES */}
                <CustomTabPanel value={tabValue} index={3}>
                  <Grid container spacing={3}>
                    {/* Medical Notes */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', color: 'primary.dark' }}>
                              <AssignmentIcon fontSize="small" />
                            </Avatar>
                            <Typography variant="h6" fontWeight={800}>
                              {label('Medical Notes', 'ملاحظات طبية')}
                            </Typography>
                          </Stack>
                          {canEditNotes && (
                            <IconButton
                              onClick={openEditAll}
                              color="primary"
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          )}
                        </Stack>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ flex: 1, minHeight: 100 }}>
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: patient?.notes ? 'text.primary' : 'text.secondary' }}>
                            {patient?.notes || label('No medical notes added.', 'لا توجد ملاحظات طبية.')}
                          </Typography>
                        </Box>
                        {patient?.notesUpdatedAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                            {label('Updated:', 'تحديث:')} {fmtNiceDateTime(patient.notesUpdatedAt)} {patient.notesUpdatedBy && `by ${patient.notesUpdatedBy}`}
                          </Typography>
                        )}
                      </Paper>
                    </Grid>

                    {/* Financial Notes */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'success.light', color: 'success.dark' }}>
                              <AttachMoneyIcon fontSize="small" />
                            </Avatar>
                            <Typography variant="h6" fontWeight={800}>
                              {label('Financial Notes', 'ملاحظات مالية')}
                            </Typography>
                          </Stack>
                          <IconButton
                            onClick={openEditAll}
                            color="success"
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                        </Stack>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ flex: 1, minHeight: 100 }}>
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: patient?.financialNotes ? 'text.primary' : 'text.secondary' }}>
                            {patient?.financialNotes || label('No financial notes added.', 'لا توجد ملاحظات مالية.')}
                          </Typography>
                        </Box>
                        {patient?.financialNotesUpdatedAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                            {label('Updated:', 'تحديث:')} {fmtNiceDateTime(patient.financialNotesUpdatedAt)}
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>
                </CustomTabPanel>

                {/* TAB 5: EXTERNAL LABS */}
                <CustomTabPanel value={tabValue} index={4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={800}>
                      {label('External Lab Integration', 'ربط المعامل الخارجية')}
                    </Typography>
                  </Stack>

                  <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    {xLabLoading ? (
                      <Box sx={{ p: 3 }}><LinearProgress /></Box>
                    ) : xLabResults.length === 0 ? (
                      <Box sx={{ p: 5, textAlign: 'center' }}>
                        <ScienceIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">
                          {label('No external lab results found linked to this patient.', 'لا توجد نتائج معامل خارجية مرتبطة بهذا المريض.')}
                        </Typography>
                      </Box>
                    ) : (
                      <Table size="medium">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
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
                              <TableCell>
                                <Chip label={l?.status || '—'} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{l?.resultValue || '—'}</TableCell>
                              <TableCell>{Number.isFinite(l?.testCount) ? l.testCount : '—'}</TableCell>
                              <TableCell sx={{ color: 'text.secondary', maxWidth: 200 }} noWrap title={l?.notes}>{l?.notes || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Paper>
                </CustomTabPanel>
              </Paper>
            </Stack>
          )}

          {/* Add Lab Report dialog */}
          <AddLabReportDialog
            open={labOpen}
            onClose={() => setLabOpen(false)}
            isArabic={isArabic}
            onSaved={() => { setLabOpen(false); fetchReports(); }}
          />

          {/* Unified profile editor */}
          <Drawer
            anchor="right"
            open={editAllOpen}
            onClose={() => !savingAll && setEditAllOpen(false)}
            PaperProps={{
              sx: {
                width: { xs: '100%', sm: 420, md: 520 },
                p: 3,
                pt: 2.5,
                borderRadius: { xs: 0, sm: '18px 0 0 18px' },
                bgcolor: (t) => alpha(t.palette.background.paper, 0.98),
              },
            }}
          >
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight={900}>
                  {label('Update Patient Profile', 'تحديث ملف المريض')}
                </Typography>
                <Button onClick={() => setEditAllOpen(false)} size="small" disabled={savingAll}>
                  {label('Close', 'إغلاق')}
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {label(
                  'Edit demographics, contact, clinical flags, and notes from a single place.',
                  'حدّث البيانات الديموغرافية والتواصل والأعلام الصحية والملاحظات من مكان واحد.'
                )}
              </Typography>
              <Divider />

              {editAllValues ? (
                <Stack spacing={2} sx={{ overflowY: 'auto', pr: 0.5, flex: 1 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                      {label('Basics & Contact', 'البيانات الأساسية والتواصل')}
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label={label('Full Name', 'الاسم الكامل')}
                          value={editAllValues.name}
                          onChange={handleEditInput('name')}
                          required
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label={label('Age', 'العمر')}
                          type="number"
                          value={editAllValues.age}
                          onChange={handleEditInput('age')}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          select
                          label={label('Gender', 'النوع')}
                          value={editAllValues.gender}
                          onChange={handleEditInput('gender')}
                        >
                          <MenuItem value="male">{label('Male', 'ذكر')}</MenuItem>
                          <MenuItem value="female">{label('Female', 'أنثى')}</MenuItem>
                          <MenuItem value="other">{label('Other', 'أخرى')}</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          select
                          label={label('Blood Type', 'فصيلة الدم')}
                          value={editAllValues.bloodType}
                          onChange={handleEditInput('bloodType')}
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                            <MenuItem key={b} value={b}>{b}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          select
                          label={label('Marital Status', 'الحالة الاجتماعية')}
                          value={editAllValues.maritalStatus}
                          onChange={handleEditInput('maritalStatus')}
                        >
                          <MenuItem value="single">{label('Single', 'أعزب')}</MenuItem>
                          <MenuItem value="married">{label('Married', 'متزوج')}</MenuItem>
                          <MenuItem value="divorced">{label('Divorced', 'مطلق')}</MenuItem>
                          <MenuItem value="widowed">{label('Widowed', 'أرمل')}</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label={label('Phone', 'الهاتف')}
                          value={editAllValues.phone}
                          onChange={handleEditInput('phone')}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label={label('Email', 'البريد الإلكتروني')}
                          type="email"
                          value={editAllValues.email}
                          onChange={handleEditInput('email')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label={label('Address', 'العنوان')}
                          multiline
                          minRows={2}
                          value={editAllValues.address}
                          onChange={handleEditInput('address')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          type="datetime-local"
                          label={label('Last Visit', 'آخر زيارة')}
                          value={editAllValues.lastVisit}
                          onChange={handleEditInput('lastVisit')}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                      {label('Medical Background', 'الخلفية الطبية')}
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          label={label('Allergies', 'الحساسية')}
                          value={editAllValues.allergies}
                          onChange={handleEditInput('allergies')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          label={label('Chronic Conditions', 'الأمراض المزمنة')}
                          value={editAllValues.conditions}
                          onChange={handleEditInput('conditions')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          label={label('Current Medications', 'الأدوية الحالية')}
                          value={editAllValues.medications}
                          onChange={handleEditInput('medications')}
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                      {label('Health Flags', 'الأعلام الصحية')}
                    </Typography>
                    <Stack spacing={1}>
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.isDiabetic} onChange={handleEditToggle('isDiabetic')} />}
                        label={label('Diabetic', 'مريض سكري')}
                      />
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.hadSurgeries} onChange={handleEditToggle('hadSurgeries')} />}
                        label={label('Past Surgeries', 'عمليات جراحية سابقة')}
                      />
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.isSmoker} onChange={handleEditToggle('isSmoker')} />}
                        label={label('Smoker', 'مدخن')}
                      />
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.drinksAlcohol} onChange={handleEditToggle('drinksAlcohol')} />}
                        label={label('Alcohol Intake', 'يتناول الكحول')}
                      />
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.familyHistory} onChange={handleEditToggle('familyHistory')} />}
                        label={label('Family History', 'تاريخ عائلي مشابه')}
                      />
                      <FormControlLabel
                        control={<Switch checked={!!editAllValues.isPregnant} onChange={handleEditToggle('isPregnant')} />}
                        label={label('Pregnant', 'حامل')}
                      />
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                      {label('Notes', 'الملاحظات')}
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          label={label('Medical Notes', 'ملاحظات طبية')}
                          value={editAllValues.notes}
                          onChange={handleEditInput('notes')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          label={label('Financial Notes', 'ملاحظات مالية')}
                          value={editAllValues.financialNotes}
                          onChange={handleEditInput('financialNotes')}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Stack>
              ) : (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  <Typography color="text.secondary">{label('Loading profile…', 'جاري تحميل الملف…')}</Typography>
                </Box>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={() => setEditAllOpen(false)} disabled={savingAll}>
                  {label('Cancel', 'إلغاء')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={savingAll}
                  sx={{ textTransform: 'none' }}
                >
                  {savingAll ? label('Saving…', 'جارٍ الحفظ…') : label('Save Profile', 'حفظ الملف')}
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
