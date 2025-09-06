// /components/AskShafy/AskShafyChat.jsx
'use client';
import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

/* ---------------- helpers ---------------- */
const asDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) try { return v.toDate(); } catch {}
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDT = (d) =>
  d
    ? new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).format(d)
    : '—';

function buildDoctorContext({ lang, doctorDoc, patients, reports, appts }) {
  const isAr = lang === 'ar';
  const dName =
    (isAr ? doctorDoc?.name_ar : doctorDoc?.name_en) ||
    doctorDoc?.name ||
    (isAr ? 'الطبيب' : 'Doctor');

  const patientSamples = patients.slice(0, 8).map((p) => p.name || p.id).filter(Boolean);

  const reportLines = reports.slice(0, 20).map((r) => {
    const dt = fmtDT(asDate(r.date));
    const who = r.patientName || r.patientID || '—';
    const title =
      r.titleAr || r.titleEn || r.title ||
      (r.type === 'lab' ? (isAr ? 'تقرير معملي' : 'Lab report') : (isAr ? 'تقرير سريري' : 'Clinical report'));
    const extra = r.diagnosis ? ` • ${r.diagnosis}` : '';
    return `- ${dt} — ${who} — ${title}${extra}`;
  });

  const now = Date.now();
  const in14d = now + 14 * 24 * 60 * 60 * 1000;
  const apptRows = appts
    .map((a) => ({ ...a, _dt: asDate(a.appointmentDate || a.date) }))
    .filter((a) => {
      const t = a._dt?.getTime?.() || 0;
      return t >= now - 24 * 60 * 60 * 1000 && t <= in14d;
    })
    .sort((a, b) => (a._dt?.getTime() || 0) - (b._dt?.getTime() || 0))
    .slice(0, 20)
    .map((a) => {
      const dt = fmtDT(a._dt);
      const who = a.patientName || a.patientID || '—';
      const status = String(a.status || 'pending');
      return `- ${dt} — ${who} — ${isAr ? 'الحالة' : 'status'}: ${status}`;
    });

  if (isAr) {
    return `
أنت شافي AI. ساعد الطبيب "${dName}" بالاعتماد على السياق أدناه (خاص وسري):

• عدد المرضى: ${patients.length}${patientSamples.length ? ` — أمثلة: ${patientSamples.join(', ')}` : ''}
• عدد التقارير: ${reports.length}
• عدد المواعيد (حديثة/قريبة): ${appts.length}

أحدث التقارير:
${reportLines.join('\n') || '—'}

المواعيد القادمة (حتى ١٤ يوماً):
${apptRows.join('\n') || '—'}
`.trim();
  }
  return `
You are Shafy AI. Assist the physician "${dName}" using the private context below:

• Patients: ${patients.length}${patientSamples.length ? ` — samples: ${patientSamples.join(', ')}` : ''}
• Reports: ${reports.length}
• Appointments (recent/upcoming): ${appts.length}

Recent reports:
${reportLines.join('\n') || '—'}

Upcoming appointments (next 14 days):
${apptRows.join('\n') || '—'}
`.trim();
}

/* ---------------- component ---------------- */
export default function AskShafyChat({ lang = 'ar' }) {
  const theme = useTheme();
  const isArabic = lang === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';

  // auth
  const [user, setUser] = React.useState(null);

  // live doctor context (client-side only)
  const [doctorDoc, setDoctorDoc] = React.useState(null);
  const [patients, setPatients] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [appts, setAppts] = React.useState([]);

  const [loadingCtx, setLoadingCtx] = React.useState(false);

  // chat
  const [messages, setMessages] = React.useState([
    {
      role: 'assistant',
      text:
        (new Date().getHours() < 12
          ? (isArabic ? 'صباح الخير ☀️' : 'Good morning ☀️')
          : (isArabic ? 'مرحبًا 👋' : 'Hello 👋')) +
        (isArabic ? ' كيف يمكنني مساعدتك اليوم؟' : ' How can I assist you today?'),
    },
  ]);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'info' });

  // images + OCR
  const [images, setImages] = React.useState([]);     // {name, url}
  const [ocrTexts, setOcrTexts] = React.useState([]); // string per image
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);

  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const openSnack = (msg, severity = 'info') => setSnack({ open: true, msg, severity });

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // auth listener
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // real-time doctor context (ALL client-side)
  React.useEffect(() => {
    if (!user) {
      setDoctorDoc(null);
      setPatients([]);
      setReports([]);
      setAppts([]);
      return;
    }
    setLoadingCtx(true);

    // doctor doc
    const unsubDoctor = onSnapshot(doc(db, 'doctors', user.uid), (snap) => {
      setDoctorDoc(snap.exists() ? snap.data() : null);
    }, () => { /* ignore */ });

    // patients registered by this doctor
    const qPatients = query(collection(db, 'patients'), where('registeredBy', '==', user.uid));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPatients(rows);
    }, () => { setPatients([]); });

    // reports by this doctor (order newest first, cap to 400)
    const qReports = query(
      collection(db, 'reports'),
      where('doctorUID', '==', user.uid),
      orderBy('date', 'desc'),
      limit(400)
    );
    const unsubReports = onSnapshot(qReports, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReports(rows);
    }, () => { setReports([]); });

    // appointments by doctorUID
    const qAppt1 = query(collection(db, 'appointments'), where('doctorUID', '==', user.uid));
    const unsubAppt1 = onSnapshot(qAppt1, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppts((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        rows.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    }, () => { /* ignore */ });

    // appointments by doctorId (alt field some apps use)
    const qAppt2 = query(collection(db, 'appointments'), where('doctorId', '==', user.uid));
    const unsubAppt2 = onSnapshot(qAppt2, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppts((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        rows.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    }, () => { /* ignore */ });

    setLoadingCtx(false);
    return () => {
      unsubDoctor?.();
      unsubPatients?.();
      unsubReports?.();
      unsubAppt1?.();
      unsubAppt2?.();
    };
  }, [user]);

  // OCR (client-side)
  const runOcrOnFile = async (file) => {
    setOcrBusy(true);
    setOcrProgress(5);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng+ara', {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      return data?.text || '';
    } catch (e) {
      console.warn('OCR failed:', e?.message || e);
      return '';
    } finally {
      setOcrBusy(false);
      setOcrProgress(0);
    }
  };

  const addLocalImage = async (file) => {
    const url = URL.createObjectURL(file);
    setImages((prev) => [...prev, { name: file.name, url }]);
    const text = await runOcrOnFile(file); // best-effort
    setOcrTexts((prev) => [...prev, text]);
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addLocalImage(file);
    e.target.value = '';
  };

  // memoize context so it's always fresh when state updates
  const doctorContext = React.useMemo(
    () => buildDoctorContext({ lang, doctorDoc, patients, reports, appts }),
    [lang, doctorDoc, patients, reports, appts]
  );

  const send = async () => {
    const msg = text.trim();
    if (!msg && images.length === 0) {
      inputRef.current?.focus();
      return;
    }

    setMessages((m) => [...m, { role: 'user', text: msg, images }]);
    setText('');
    setBusy(true);

    try {
      const r = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          images: images.map((i) => i.url),
          ocrTexts,
          lang,
          doctorContext, // <-- client-built, always up-to-date
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: isArabic ? 'تعذر إكمال الطلب.' : 'Could not complete the request.' },
        ]);
        openSnack(j?.error || (isArabic ? 'فشل الطلب' : 'Request failed'), 'error');
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', text: j.text }]);
    } catch (e) {
      openSnack(e?.message || 'Network error', 'error');
    } finally {
      setBusy(false);
      // reset attachments after send
      setImages([]);
      setOcrTexts([]);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy) send();
    }
  };

  const bubble = (role) =>
    role === 'user'
      ? {
          bg: theme.palette.primary.main,
          fg: theme.palette.primary.contrastText,
          align: isArabic ? 'flex-start' : 'flex-end',
          row: isArabic ? 'row-reverse' : 'row',
          shadow: '0 8px 20px rgba(33,150,243,.15)',
        }
      : {
          bg: theme.palette.background.paper,
          fg: theme.palette.text.primary,
          align: isArabic ? 'flex-end' : 'flex-start',
          row: isArabic ? 'row' : 'row',
          shadow: '0 8px 20px rgba(0,0,0,.06)',
        };

  const AssistantAvatar = (
    <Avatar
      src="/ai_logo.png"
      imgProps={{
        onError: (e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/images/ai_logo.png';
        },
      }}
      sx={{ width: 34, height: 34, bgcolor: 'transparent' }}
    />
  );
  const UserAvatar = (
    <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 34, height: 34 }}>
      <PersonIcon />
    </Avatar>
  );

  return (
    <Box dir={dir} sx={{ height: 'calc(100dvh - 140px)', minHeight: 500, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper
        ref={scrollRef}
        elevation={0}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 1.25, sm: 2 },
          py: { xs: 1.25, sm: 2 },
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
          backgroundImage: `radial-gradient( rgba(0,0,0,0.015) 1px, transparent 1px )`,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0',
        }}
      >
        {loadingCtx && (
          <Box sx={{ mb: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {isArabic ? 'يتم تحميل سياق الطبيب…' : 'Loading doctor context…'}
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {ocrBusy && (
          <Box sx={{ mb: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              {isArabic ? 'قراءة الصورة (OCR)…' : 'Reading image (OCR)…'}
            </Typography>
            <LinearProgress variant="determinate" value={ocrProgress} />
          </Box>
        )}

        <Stack spacing={1.25}>
          {messages.map((m, i) => {
            const b = bubble(m.role);
            return (
              <Box key={i} sx={{ display: 'flex', justifyContent: b.align, width: '100%' }}>
                <Stack direction={b.row} spacing={1} alignItems="flex-end" sx={{ maxWidth: '92%' }}>
                  {m.role === 'user' ? UserAvatar : AssistantAvatar}
                  <Box
                    sx={{
                      bgcolor: b.bg,
                      color: b.fg,
                      px: 1.5,
                      py: 1.1,
                      borderRadius: 2,
                      boxShadow: b.shadow,
                      maxWidth: '100%',
                    }}
                  >
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                    {!!m.images?.length && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} justifyContent="flex-start">
                        {m.images.map((img, k) => (
                          <Avatar key={k} variant="rounded" src={img.url} sx={{ width: 54, height: 54 }} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {!!images.length && (
        <Paper sx={{ p: 1.2, borderRadius: 2 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <Stack key={i} spacing={0.25} alignItems="center">
                <Avatar variant="rounded" src={img.url} sx={{ width: 44, height: 44 }} />
                <Typography variant="caption" sx={{ maxWidth: 80 }} noWrap>
                  {img.name}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper elevation={3} sx={{ borderRadius: 3, p: 1, position: 'sticky', bottom: 8 }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            inputRef={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            placeholder={isArabic ? 'اكتب رسالتك…' : 'Type your message…'}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton component="label" size="small">
                    <ImageIcon />
                    <input type="file" hidden accept="image/*" onChange={onPickImage} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            onClick={send}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={busy || (!text.trim() && images.length === 0)}
            sx={{ borderRadius: 2 }}
          >
            {busy ? (isArabic ? '...إرسال' : 'Sending…') : (isArabic ? 'إرسال' : 'Send')}
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ whiteSpace: 'pre-wrap' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
