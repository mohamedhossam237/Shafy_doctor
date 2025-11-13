// /pages/patients/[id].jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Container, Stack, Typography, Paper, Grid, Chip, Button, Divider, Skeleton,
  Snackbar, Alert, Box, Avatar, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  LinearProgress
} from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import EditHealthInfoDialog from '@/components/patients/EditHealthInfoDialog';

import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TagIcon from '@mui/icons-material/Tag';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PrintIcon from '@mui/icons-material/Print';
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
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

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
              icon={isLab ? <ScienceIcon/> : <DescriptionIcon />}
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
    <Typography variant="caption" color="text.secondary">{title}</Typography>
    <Box sx={{ mt: 0.25 }}>{children}</Box>
  </Box>
);

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

  // external lab_results
  const [xLabLoading, setXLabLoading] = React.useState(true);
  const [xLabResults, setXLabResults] = React.useState([]);
  const [editHealthOpen, setEditHealthOpen] = React.useState(false);

const [notesOpen, setNotesOpen] = React.useState(false);
const [notesDraft, setNotesDraft] = React.useState('');
const [savingNotes, setSavingNotes] = React.useState(false);
const [notesType, setNotesType] = React.useState('medical'); // 'medical' | 'financial'


  // AI
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiText, setAiText] = React.useState('');
  const [aiErr, setAiErr] = React.useState('');

  const label = (e, a) => (isArabic ? a : e);

  const canEditNotes =
    (user?.role && String(user.role).toLowerCase() === 'doctor') ||
    user?.isDoctor === true ||
    user?.claims?.role === 'doctor' ||
    true;

  // load patient
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const snap = await getDoc(doc(db, 'patients', String(id)));
        if (!snap.exists()) throw new Error('not-found');
        setPatient({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error(e);
        setError(label('Failed to load patient', 'تعذر تحميل المريض'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);
/* ---------- notes save ---------- */
  const handleSaveNotes = async () => {
    if (!patient?.id) return;
    setSavingNotes(true);
    try {
      const ref = doc(db, 'patients', patient.id);
      const updatedAt = new Date();
      const updatedBy = user?.uid || user?.email || 'unknown';

      await updateDoc(ref, {
        notes: notesDraft,
        notesUpdatedAt: updatedAt,
        notesUpdatedBy: updatedBy,
      });

      setPatient((prev) => ({
        ...prev,
        notes: notesDraft,
        notesUpdatedAt: updatedAt,
        notesUpdatedBy: updatedBy,
      }));

      setOkMsg(label('Notes saved successfully.', 'تم حفظ الملاحظات بنجاح.'));
      setNotesOpen(false);
    } catch (e) {
      console.error(e);
      setError(label('Failed to save notes.', 'تعذر حفظ الملاحظات.'));
    } finally {
      setSavingNotes(false);
    }
  };

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
    try { await navigator.clipboard.writeText(String(txt || '')); setOkMsg(label('Copied', 'تم النسخ')); } catch {}
  };

  const openNotes = () => {
    setNotesDraft(patient?.notes || '');
    setNotesOpen(true);
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
          <h1>${t('Patient Summary Report','تقرير موجز للمريض')}</h1>
          <div class="muted">${t('Generated on','تم الإنشاء في')} ${today.toLocaleString()} ${docName ? `• ${t('by','بواسطة')} ${docName}` : ''}</div>
        </div>
        <div>
          <span class="chip">ID: ${patient?.id || '-'}</span>
          ${Number.isFinite(patient?.age) ? `<span class="chip">${t('Age','العمر')}: ${patient.age}</span>` : ''}
          ${patient?.gender ? `<span class="chip">${patient.gender}</span>` : ''}
          ${patient?.bloodType ? `<span class="chip">${patient.bloodType}</span>` : ''}
        </div>
      </div>
    `;
    const demographics = `
      <h2>${t('Patient','المريض')}</h2>
      <div class="grid">
        <div><strong>${t('Name','الاسم')}:</strong> ${patient?.name || t('Unnamed','بدون اسم')}</div>
        <div><strong>${t('Last visit','آخر زيارة')}:</strong> ${fmtNiceDate(patient?.lastVisit)}</div>
        <div><strong>${t('Phone','الهاتف')}:</strong> ${patient?.phone || '—'}</div>
        <div><strong>${t('Email','البريد')}:</strong> ${patient?.email || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Address','العنوان')}:</strong> ${patient?.address || '—'}</div>
      </div>
    `;
    const clinical = `
      <h2>${t('Clinical profile','الملف السريري')}</h2>
      <div class="grid">
        <div><strong>${t('Marital status','الحالة الاجتماعية')}:</strong> ${patient?.maritalStatus || t('Unspecified','غير محدد')}</div>
        <div><strong>${t('Blood type','فصيلة الدم')}:</strong> ${patient?.bloodType || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Allergies','الحساسيات')}:</strong> ${splitCsv(patient?.allergies).join(', ') || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Chronic conditions','الأمراض المزمنة')}:</strong> ${splitCsv(patient?.conditions).join(', ') || '—'}</div>
        <div style="grid-column: 1 / -1;"><strong>${t('Current medications','الأدوية الحالية')}:</strong> ${splitCsv(patient?.medications).join(', ') || '—'}</div>
      </div>
    `;
    const aiBlock = `
      <h2>${t('AI short report','ملخص ذكي مختصر')}</h2>
      <div class="box" style="white-space: pre-wrap;">${ai || t('No AI summary generated yet.','لا يوجد ملخص ذكي بعد.')}</div>
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
          <td>${isLab ? t('Lab','معملي') : t('Clinic','عيادة')}</td>
          <td>${r?.titleAr || r?.titleEn || r?.title || (isLab ? t('Lab Report','تقرير معملي') : t('Medical Report','تقرير طبي'))}</td>
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
      <h2>${t('History','السجل')}</h2>
      <h3 style="margin-top:8px;">${t('External lab results','نتائج معامل خارجية')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date','التاريخ')}</th>
            <th>${t('Lab ID','معرف المعمل')}</th>
            <th>${t('Result value','النتيجة')}</th>
            <th>${t('Reference range','المعدل المرجعي')}</th>
            <th>${t('Status','الحالة')}</th>
            <th>${t('Tests','الاختبارات')}</th>
          </tr>
        </thead>
        <tbody>${xlabRows || `<tr><td colspan="6" class="muted">${t('No lab results','لا توجد نتائج معمل')}</td></tr>`}</tbody>
      </table>

      <h3 style="margin-top:12px;">${t('Reports','التقارير')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date','التاريخ')}</th>
            <th>${t('Type','النوع')}</th>
            <th>${t('Title','العنوان')}</th>
            <th>${t('Diagnosis','التشخيص')}</th>
            <th>${t('Follow-up','المتابعة')}</th>
          </tr>
        </thead>
        <tbody>${reportsRows || `<tr><td colspan="5" class="muted">${t('No reports','لا توجد تقارير')}</td></tr>`}</tbody>
      </table>

      <h3 style="margin-top:12px;">${t('Appointments','المواعيد')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t('Date/Time','الوقت/التاريخ')}</th>
            <th>${t('Status','الحالة')}</th>
          </tr>
        </thead>
        <tbody>${apptRows || `<tr><td colspan="2" class="muted">${t('No appointments','لا توجد مواعيد')}</td></tr>`}</tbody>
      </table>
    `;
    const dirClass = lang === 'ar' ? 'rtl' : '';
    return `<!doctype html><html lang="${lang}">
      <head><meta charset="utf-8" /><title>${t('Patient Report','تقرير المريض')}</title>${css}</head>
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
              {/* Header */}
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  background: 'linear-gradient(135deg, rgba(25,118,210,.06), rgba(25,118,210,.01))',
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs="auto">
                    <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 900 }}>
                      {initials}
                    </Avatar>
                  </Grid>
                  <Grid item xs>
                    <Typography variant="h5" fontWeight={900} color="text.primary" sx={{ lineHeight: 1.15 }}>
                      {patient.name || label('Unnamed', 'بدون اسم')}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <StatChip icon={<AssignmentIcon />} label={`ID: ${patient.id}`} />
                      {Number.isFinite(patient?.age) && <StatChip icon={<EventIcon />} label={`${label('Age','العمر')}: ${patient.age}`} />}
                      {patient?.gender && <StatChip icon={<PersonIcon />} label={patient.gender} />}
                      {patient?.bloodType && <StatChip icon={<BloodtypeIcon />} label={patient.bloodType} />}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md="auto">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                      <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(patient.id)}>
                        {label('Copy ID','نسخ المعرّف')}
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={printReport} disabled={aiBusy}>
                        {label('Print Report','طباعة التقرير')}
                      </Button>
                      <Button
                        variant="contained" size="small"
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}
                      >
                        {label('New Appointment', 'حجز موعد')}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  <Chip size="small" variant="outlined"
                        label={`${label('Last visit','آخر زيارة')}: ${fmtNiceDate(patient.lastVisit)}`} sx={{ borderRadius: 1 }} />
                  <Chip size="small" variant="outlined"
                        label={`${label('Reports','التقارير')}: ${reports.length}`} sx={{ borderRadius: 1 }} icon={<DescriptionIcon />} />
                  <Chip size="small" variant="outlined"
                        label={`${label('Appointments','المواعيد')}: ${appts.length}`} sx={{ borderRadius: 1 }} icon={<LocalHospitalIcon />} />
                </Stack>
              </Paper>

              {/* AI Short Report */}
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => alpha(t.palette.background.paper, 0.98) }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                  <Typography variant="h6" fontWeight={900} color="text.primary">
                    {label('AI Short Report', 'ملخص ذكي مختصر')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={printReport} disabled={aiBusy}>
                      {label('Print','طباعة')}
                    </Button>
                    <Button
                      variant="contained" size="small" startIcon={<AutoAwesomeIcon />}
                      onClick={summarizeWithAI} disabled={aiBusy}
                      sx={{ textTransform: 'none', fontWeight: 800, bgcolor: (t) => t.palette.primary.main, '&:hover': { bgcolor: (t) => darken(t.palette.primary.main, .07) } }}
                    >
                      {aiBusy ? label('Generating…','جارٍ التوليد…') : label('Summarize with AI','تلخيص بواسطة الذكاء الاصطناعي')}
                    </Button>
                  </Stack>
                </Stack>
                {aiBusy && <LinearProgress sx={{ mt: 1 }} />}
                {!aiBusy && aiErr && <Typography color="error" sx={{ mt: 1 }}>{aiErr}</Typography>}
                {!aiBusy && aiText && <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }} color="text.primary">{aiText}</Typography>}
                {!aiBusy && !aiText && !aiErr && (
                  <Typography sx={{ mt: 1 }} color="text.secondary">
                    {label('Click “Summarize with AI” to generate a concise, structured overview for quick review.',
                           'اضغط «تلخيص بواسطة الذكاء الاصطناعي» لإنشاء نظرة عامة موجزة ومنظمة.')}
                  </Typography>
                )}
              </Paper>

              {/* Contact & Address */}
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => alpha(t.palette.background.paper, 0.97) }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Phone','الهاتف')}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={<PhoneIcon />} label={patient?.phone || '—'} variant="outlined" />
                        {patient?.phone && (
                          <>
                            <Button size="small" component={Link} href={`tel:${patient.phone}`} variant="outlined">{label('Call','اتصال')}</Button>
                            <Button size="small" component={Link} href={`sms:${patient.phone}`} variant="outlined">SMS</Button>
                          </>
                        )}
                      </Stack>
                    </Labeled>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Labeled title="Email">
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={<EmailIcon />} label={patient?.email || '—'} variant="outlined" />
                        {patient?.email && <Button size="small" component={Link} href={`mailto:${patient.email}`} variant="outlined">Email</Button>}
                      </Stack>
                    </Labeled>
                  </Grid>
                  <Grid item xs={12}>
                    <Labeled title={label('Address','العنوان')}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={<PlaceIcon />} label={patient?.address || '—'} variant="outlined" sx={{ maxWidth: '100%' }} />
                      </Stack>
                    </Labeled>
                  </Grid>
                </Grid>
              </Paper>

              {/* Clinical profile */}
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => alpha(t.palette.background.paper, 0.98) }}>
                {/* Medical File Intake — Full Medical Extraction */}
<MedicalFileIntake
  patientId={patient?.id}
  patient={patient}
  isArabic={isArabic}
  onExtract={(extractedData) => {
    setPatient((prev) => ({ ...prev, ...extractedData }));
    setOkMsg(label('Medical information extracted successfully.', 'تم استخراج المعلومات الطبية بنجاح.'));
  }}
/>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Labeled title={label('Marital Status','الحالة الاجتماعية')}>
                      <Chip label={patient?.maritalStatus || label('Unspecified','غير محدد')} variant="outlined" />
                    </Labeled>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Labeled title={label('Allergies','الحساسيات')}>
                      {splitCsv(patient?.allergies).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.allergies).map((a, i) => (<Chip key={i} label={a} color="warning" variant="outlined" size="small" />))}
                        </Stack>
                      ) : (<Typography color="text.secondary">—</Typography>)}
                    </Labeled>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Chronic Conditions','الأمراض المزمنة')}>
                      {splitCsv(patient?.conditions).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.conditions).map((c, i) => (<Chip key={i} label={c} variant="outlined" size="small" />))}
                        </Stack>
                      ) : (<Typography color="text.secondary">—</Typography>)}
                    </Labeled>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Current Medications','الأدوية الحالية')}>
                      {splitCsv(patient?.medications).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.medications).map((m, i) => (<Chip key={i} label={m} variant="outlined" size="small" />))}
                        </Stack>
                      ) : (<Typography color="text.secondary">—</Typography>)}
                    </Labeled>
                  </Grid>
                </Grid>
              </Paper>

              {/* External Lab Results */}
              <Typography variant="h6" fontWeight={900} color="text.primary">
                {label('External Lab Results', 'نتائج معامل خارجية')}
              </Typography>
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
                {xLabLoading ? (
                  <Stack spacing={1.25}>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>
                ) : xLabResults.length === 0 ? (
                  <Typography color="text.secondary">{label('No lab results found for this patient.', 'لا توجد نتائج معمل لهذا المريض.')}</Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 720 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{label('Date','التاريخ')}</TableCell>
                          <TableCell>{label('Lab ID','معرف المعمل')}</TableCell>
                          <TableCell>{label('Status','الحالة')}</TableCell>
                          <TableCell>{label('Result value','النتيجة')}</TableCell>
                          <TableCell>{label('Reference range','المعدل المرجعي')}</TableCell>
                          <TableCell>{label('Tests','الاختبارات')}</TableCell>
                          <TableCell>{label('Notes','ملاحظات')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {xLabResults.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{fmtNiceDateTime(l?.resultDate || l?.createdAt)}</TableCell>
                            <TableCell>{l?.labId || '—'}</TableCell>
                            <TableCell>{String(l?.status || '—')}</TableCell>
                            <TableCell>{l?.resultValue || '—'}</TableCell>
                            <TableCell>{l?.referenceRange || '—'}</TableCell>
                            <TableCell>{Number.isFinite(l?.testCount) ? l.testCount : '—'}</TableCell>
                            <TableCell>{l?.notes || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Paper>

              {/* History overview (compact) */}
              <Typography variant="h6" fontWeight={900} color="text.primary">
                {label('History Overview', 'نبذة عن التاريخ')}
              </Typography>
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                    {label('Recent Reports', 'أحدث التقارير')}
                  </Typography>
                  {repLoading ? (
                    <Skeleton variant="rounded" height={56} />
                  ) : reports.length === 0 ? (
                    <Typography color="text.secondary">{label('No reports yet.','لا توجد تقارير.')}</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {reports.slice(0, 5).map((r) => {
                        const isLab = String(r?.type || '').toLowerCase() === 'lab';
                        return (
                          <Stack key={r.id} direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 28, height: 28, bgcolor: isLab ? 'secondary.light' : 'primary.light', color: isLab ? 'secondary.dark' : 'primary.dark' }}>
                              {isLab ? <ScienceIcon fontSize="small" /> : <DescriptionIcon fontSize="small" />}
                            </Avatar>
                            <Typography sx={{ minWidth: 140 }} color="text.secondary">{fmtNiceDateTime(r?.date)}</Typography>
                            <Typography sx={{ flex: 1 }} noWrap color="text.primary">
                              {r?.titleAr || r?.titleEn || r?.title || (isLab ? label('Lab Report','تقرير معملي') : label('Medical Report','تقرير طبي'))}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}

                  <Divider sx={{ my: 1 }} />
<Stack direction="row" alignItems="center" justifyContent="space-between">
  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
  </Typography>
  <Button
    variant="outlined"
    size="small"
    startIcon={<EditOutlinedIcon />}
    onClick={() => setEditHealthOpen(true)}
  >
    {label('Edit', 'تعديل')}
  </Button>
</Stack>

<HealthInfoSection patient={patient} isArabic={isArabic} label={label} />
                  <Divider sx={{ my: 1 }} />

                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                    {label('Recent Appointments', 'أحدث المواعيد')}
                  </Typography>
                  {apptLoading ? (
                    <Skeleton variant="rounded" height={56} />
                  ) : appts.length === 0 ? (
                    <Typography color="text.secondary">{label('No appointments yet.','لا توجد مواعيد.')}</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {appts.slice(0, 5).map((a) => (
                        <Stack key={a.id} direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                            <LocalHospitalIcon fontSize="small" />
                          </Avatar>
                          <Typography sx={{ minWidth: 140 }} color="text.secondary">{fmtApptFull(a)}</Typography>
                          <Chip size="small" variant="outlined" icon={<TagIcon />} label={String(a?.status || 'pending')} />
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>

{/* Medical Notes */}
<Stack direction="row" alignItems="center" justifyContent="space-between">
  <Typography variant="h6" fontWeight={900} color="text.primary">
    {label('Medical Notes', 'ملاحظات طبية')}
  </Typography>
  {canEditNotes && (
    <Button
      onClick={() => {
        setNotesType('medical');
        setNotesDraft(patient?.notes || '');
        setNotesOpen(true);
      }}
      startIcon={<EditOutlinedIcon />}
      variant="outlined"
      size="small"
    >
      {patient?.notes
        ? label('Edit Notes', 'تعديل الملاحظات')
        : label('Add Notes', 'إضافة ملاحظات')}
    </Button>
  )}
</Stack>


        <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
  <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
    {patient.notes || label('No notes yet.', 'لا توجد ملاحظات.')}
  </Typography>

  {patient?.notesUpdatedAt && (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ mt: 1, display: 'block', textAlign: isArabic ? 'right' : 'left' }}
    >
      {label('Last updated on', 'آخر تعديل في')}: {fmtNiceDateTime(patient.notesUpdatedAt)}
      {patient?.notesUpdatedBy && ` (${patient.notesUpdatedBy})`}
    </Typography>
  )}
</Paper>


              {/* Doctor reports (full) */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={900} color="text.primary">
                  {label('Reports by this doctor', 'تقارير هذا الطبيب')}
                </Typography>
                <Button onClick={() => setLabOpen(true)} startIcon={<AddCircleOutlineIcon />} variant="outlined" size="small">
                  {label('Add Lab Report', 'إضافة تقرير معملي')}
                </Button>
              </Stack>

              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
                {repLoading ? (
                  <Stack spacing={1.25}>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={72} />)}</Stack>
                ) : reports.length === 0 ? (
                  <Typography color="text.secondary">
                    {label('No reports yet for this patient by this doctor.', 'لا توجد تقارير لهذا المريض من هذا الطبيب.')}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {reports.map((r) => {
                      const isLab = String(r?.type || '').toLowerCase() === 'lab';
                      return (
                        <Paper key={r.id} variant="outlined"
                               sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Avatar sx={{ bgcolor: isLab ? 'secondary.light' : 'primary.light', color: isLab ? 'secondary.dark' : 'primary.dark' }}>
                            {isLab ? <ScienceIcon /> : <DescriptionIcon />}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight={900} color="text.primary" noWrap
                                          title={r?.titleAr || r?.titleEn || r?.title || ''}>
                                {r?.titleAr || r?.titleEn || r?.title || (isLab ? label('Lab Report', 'تقرير معملي') : label('Medical Report', 'تقرير طبي'))}
                              </Typography>
                              <Chip size="small" label={isLab ? label('Lab', 'معملي') : label('Clinic', 'عيادة')}
                                    variant="outlined" sx={{ borderRadius: 1 }} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {fmtNiceDateTime(r?.date)} • {isLab ? (r?.labName || label('External lab', 'معمل خارجي')) : (r?.diagnosis || label('No diagnosis', 'لا يوجد تشخيص'))}
                            </Typography>
                          </Box>
                          {r?.followUp && (
                            <Chip size="small" icon={<EventIcon />} label={`${label('Follow-up', 'متابعة')}: ${fmtNiceDateTime(r.followUp)}`} sx={{ mr: 1 }} variant="outlined" />
                          )}
                          {r?.appointmentId && (
                            <Button size="small" component={Link} href={`/appointments/${r.appointmentId}${isArabic ? '?lang=ar' : ''}`}
                                    startIcon={<VisibilityIcon />} sx={{ fontWeight: 800 }}>
                              {label('Open Appointment', 'فتح الموعد')}
                            </Button>
                          )}
                          <Button size="small" variant="text" onClick={() => setViewReport(r)} sx={{ fontWeight: 800 }}>
                            {label('View', 'عرض')}
                          </Button>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              {/* Appointments list */}
              <Typography variant="h6" fontWeight={900} color="text.primary" sx={{ mt: 1 }}>
                {label('Appointments with this doctor', 'المواعيد مع هذا الطبيب')}
              </Typography>
              <Paper sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
                {apptLoading ? (
                  <Stack spacing={1.25}>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={72} />)}</Stack>
                ) : appts.length === 0 ? (
                  <Typography color="text.secondary">
                    {label('No appointments yet between this doctor and patient.', 'لا توجد مواعيد بين هذا الطبيب والمريض.')}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {appts.map((a) => (
                      <Paper key={a.id} variant="outlined"
                             sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                          <LocalHospitalIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={900} color="text.primary" noWrap>{fmtApptFull(a)}</Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {(a?.doctorName_en || a?.doctorName_ar || a?.doctorId || a?.doctorUID || '')}
                          </Typography>
                        </Box>
                        <Chip size="small" icon={<TagIcon />} label={String(a?.status || 'pending')} color={statusColor(a?.status)} variant="outlined" />
                        <Button size="small" component={Link} href={`/appointments/${a.id}${isArabic ? '?lang=ar' : ''}`}
                                startIcon={<VisibilityIcon />} sx={{ fontWeight: 800 }}>
                          {label('Open', 'فتح')}
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Divider />
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" component={Link} href={`/patients${isArabic ? '?lang=ar' : ''}`}>
                  {label('Back', 'رجوع')}
                </Button>
                <Button variant="contained"
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}>
                  {label('New Appointment', 'حجز موعد')}
                </Button>
              </Stack>
            </Stack>
          )}

          {/* View report (read-only) */}
          <ReportInlineView report={viewReport} isArabic={isArabic} onClose={() => setViewReport(null)} />

          {/* Add Lab Report dialog */}
          <AddLabReportDialog
            open={labOpen}
            onClose={() => setLabOpen(false)}
            isArabic={isArabic}
            onSaved={() => { setLabOpen(false); fetchReports(); }}
          />
       <Stack spacing={2} sx={{ mt: 2 }}>

{/* 💰 Financial Notes Section */}
<Stack direction="row" alignItems="center" justifyContent="space-between">
  <Typography variant="h6" fontWeight={900} color="text.primary">
    {label('Financial Notes', 'ملاحظات مالية')}
  </Typography>
  <Button
    onClick={() => {
      setNotesType('financial');
      setNotesDraft(patient?.financialNotes || '');
      setNotesOpen(true);
    }}
    startIcon={<EditOutlinedIcon />}
    variant="outlined"
    size="small"
  >
    {patient?.financialNotes
      ? label('Edit Notes', 'تعديل الملاحظات')
      : label('Add Notes', 'إضافة ملاحظات')}
  </Button>
</Stack>


<Paper
  sx={{
    p: 2,
    borderRadius: 2,
    border: (t) => `1px solid ${t.palette.divider}`,
    bgcolor: (t) => alpha(t.palette.background.paper, 0.98),
  }}
>
  <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
    {patient?.financialNotes || label('No notes yet.', 'لا توجد ملاحظات.')}
  </Typography>

  {patient?.financialNotesUpdatedAt && (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ mt: 1, display: 'block', textAlign: isArabic ? 'right' : 'left' }}
    >
      {label('Last updated on', 'آخر تعديل في')}:{' '}
      {fmtNiceDateTime(patient.financialNotesUpdatedAt)}
      {patient?.financialNotesUpdatedBy && ` (${patient.financialNotesUpdatedBy})`}
    </Typography>
  )}
</Paper>

<Dialog
  open={notesOpen}
  onClose={() => !savingNotes && setNotesOpen(false)}
  fullWidth
  maxWidth="sm"
>
  <DialogTitle
    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
  >
    <Typography fontWeight={900}>
      {notesType === 'medical'
        ? label('Medical Notes', 'ملاحظات طبية')
        : label('Patient Financial Notes', 'ملاحظات المريض المالية')}
    </Typography>
    <IconButton onClick={() => !savingNotes && setNotesOpen(false)} disabled={savingNotes}>
      <CloseRoundedIcon />
    </IconButton>
  </DialogTitle>

  <DialogContent dividers>
    <TextField
      autoFocus
      fullWidth
      multiline
      minRows={6}
      value={notesDraft}
      onChange={(e) => setNotesDraft(e.target.value)}
      placeholder={
        notesType === 'medical'
          ? label('Type medical notes here…', 'اكتب الملاحظات الطبية هنا…')
          : label('Type financial notes here…', 'اكتب الملاحظات المالية هنا…')
      }
    />
    <Typography variant="caption" sx={{ mt: 1, display: 'block' }} color="text.secondary">
      {label(
        'Only authorized staff can edit these notes. Saved with timestamp and author.',
        'يمكن فقط للموظفين المعتمدين تعديل هذه الملاحظات. يتم حفظها مع الوقت والكاتب.'
      )}
    </Typography>
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setNotesOpen(false)} disabled={savingNotes}>
      {label('Cancel', 'إلغاء')}
    </Button>
    <Button
      onClick={async () => {
        if (!patient?.id) return;
        setSavingNotes(true);
        try {
          const ref = doc(db, 'patients', patient.id);
          const updatedAt = new Date();
          const updatedBy = user?.uid || user?.email || 'unknown';

          if (notesType === 'medical') {
            await updateDoc(ref, {
              notes: notesDraft,
              notesUpdatedAt: updatedAt,
              notesUpdatedBy: updatedBy,
            });

            setPatient((prev) => ({
              ...prev,
              notes: notesDraft,
              notesUpdatedAt: updatedAt,
              notesUpdatedBy: updatedBy,
            }));
          } else {
            await updateDoc(ref, {
              financialNotes: notesDraft,
              financialNotesUpdatedAt: updatedAt,
              financialNotesUpdatedBy: updatedBy,
            });

            setPatient((prev) => ({
              ...prev,
              financialNotes: notesDraft,
              financialNotesUpdatedAt: updatedAt,
              financialNotesUpdatedBy: updatedBy,
            }));
          }

          setOkMsg(label('Notes saved successfully.', 'تم حفظ الملاحظات بنجاح.'));
          setNotesOpen(false);
        } catch (e) {
          console.error(e);
          setError(label('Failed to save notes.', 'تعذر حفظ الملاحظات.'));
        } finally {
          setSavingNotes(false);
        }
      }}
      variant="contained"
      disabled={savingNotes}
    >
      {savingNotes
        ? label('Saving…', 'جارٍ الحفظ…')
        : label('Save Notes', 'حفظ الملاحظات')}
    </Button>
  </DialogActions>
</Dialog>

  <EditHealthInfoDialog
  open={editHealthOpen}
  onClose={() => setEditHealthOpen(false)}
  patient={patient}
  t={(en, ar) => label(en, ar)}     // reuse your label helper
  isArabic={isArabic}
  onSave={(updated) => {
    setPatient((p) => ({ ...p, ...updated }));
    setOkMsg(label('Health information updated', 'تم تحديث المعلومات الصحية'));
  }}
/>

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
            </Stack>
        </Container>
      </AppLayout>
    </Protected>
  );
}
