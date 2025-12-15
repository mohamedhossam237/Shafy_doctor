// /components/AskShafy/AskShafyChat.js
'use client';

import * as React from 'react';
import {
  Alert, Avatar, Box, Button, IconButton, InputAdornment, Paper, Snackbar,
  Stack, TextField, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';

/* ---------------- helpers ---------------- */
const asDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) try { return v.toDate(); } catch { }
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDT = (d) => d
  ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
  : '—';

function buildDoctorContext({ lang, doctorDoc, patients, reports, appts }) {
  const isAr = lang === 'ar';
  const dName =
    (isAr ? doctorDoc?.name_ar : doctorDoc?.name_en) ||
    doctorDoc?.name || (isAr ? 'الطبيب' : 'Doctor');

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

  const [user, setUser] = React.useState(null);

  const [doctorDoc, setDoctorDoc] = React.useState(null);
  const [patients, setPatients] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [appts, setAppts] = React.useState([]);
  const [messages, setMessages] = React.useState([
    { role: 'assistant', text: (new Date().getHours() < 12 ? (isArabic ? 'صباح الخير ☀️' : 'Good morning ☀️') : (isArabic ? 'مرحبًا 👋' : 'Hello 👋')) + (isArabic ? ' كيف يمكنني مساعدتك اليوم؟' : ' How can I assist you today?') },
  ]);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'info' });

  const [images, setImages] = React.useState([]);
  const [ocrTexts, setOcrTexts] = React.useState([]);

  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const openSnack = (msg, severity = 'info') => setSnack({ open: true, msg, severity });

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  React.useEffect(() => {
    if (!user) { setDoctorDoc(null); setPatients([]); setReports([]); setAppts([]); return; }

    const unsubDoctor = onSnapshot(doc(db, 'doctors', user.uid), (snap) => setDoctorDoc(snap.exists() ? snap.data() : null));
    const unsubPatients = onSnapshot(query(collection(db, 'patients'), where('registeredBy', '==', user.uid)), (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setPatients([]));

    const unsubReports = onSnapshot(query(collection(db, 'reports'), where('doctorUID', '==', user.uid), orderBy('date', 'desc'), limit(400)), (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setReports([]));

    const unsubAppt1 = onSnapshot(query(collection(db, 'appointments'), where('doctorUID', '==', user.uid)), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppts((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        rows.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    });

    const unsubAppt2 = onSnapshot(query(collection(db, 'appointments'), where('doctorId', '==', user.uid)), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppts((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        rows.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    });

    return () => { unsubDoctor?.(); unsubPatients?.(); unsubReports?.(); unsubAppt1?.(); unsubAppt2?.(); };
  }, [user]);

  const addLocalImage = async (file) => {
    const url = URL.createObjectURL(file);
    setImages((prev) => [...prev, { name: file.name, url }]);
    // Optional OCR (kept lightweight)
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng+ara');
      setOcrTexts((prev) => [...prev, data?.text || '']);
    } catch { /* ignore */ }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    await addLocalImage(file); e.target.value = '';
  };

  const doctorContext = React.useMemo(
    () => buildDoctorContext({ lang, doctorDoc, patients, reports, appts }),
    [lang, doctorDoc, patients, reports, appts]
  );

  const sendText = async () => {
    const msg = text.trim();
    if (!msg && images.length === 0) { inputRef.current?.focus(); return; }

    if (!auth.currentUser) {
      openSnack(isArabic ? 'يرجى تسجيل الدخول.' : 'Please sign in.', 'warning');
      return;
    }

    setMessages((m) => [...m, { role: 'user', text: msg, images }]);
    setText(''); setBusy(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: msg,
          images: images.map((i) => i.url),
          ocrTexts,
          lang,
          doctorContext, // optional (server builds its own too)
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Request failed');
      setMessages((m) => [...m, { role: 'assistant', text: j.text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: isArabic ? 'تعذر إكمال الطلب.' : 'Could not complete the request.' }]);
      openSnack(e?.message || 'Network error', 'error');
    } finally {
      setBusy(false); setImages([]); setOcrTexts([]);
    }
  };

  const bubble = (role) =>
    role === 'user'
      ? {
        bg: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
        fg: theme.palette.primary.contrastText,
        align: isArabic ? 'flex-start' : 'flex-end',
        row: isArabic ? 'row-reverse' : 'row',
        shadow: '0 12px 24px rgba(25, 118, 210, 0.25)',
        border: 'none'
      }
      : {
        bg: theme.palette.background.paper,
        fg: theme.palette.text.primary,
        align: isArabic ? 'flex-end' : 'flex-start',
        row: isArabic ? 'row' : 'row',
        shadow: '0 8px 20px rgba(0,0,0,.08)',
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`
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
      sx={{
        width: 40,
        height: 40,
        bgcolor: 'transparent',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: (t) => `2px solid ${alpha(t.palette.primary.main, 0.1)}`
      }}
    />
  );
  const UserAvatar = (
    <Avatar
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        width: 40,
        height: 40,
        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
      }}
    >
      <PersonIcon />
    </Avatar>
  );

  return (
    <Box dir={dir} sx={{ height: 'calc(100dvh - 360px)', minHeight: 500, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper
        ref={scrollRef}
        elevation={0}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 3 },
          borderRadius: 4,
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
          background: (t) => alpha(t.palette.background.paper, 0.6),
          backdropFilter: 'blur(20px)',
          backgroundImage: `radial-gradient(${alpha('#000', 0.02)} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)'
        }}
      >
        <Stack spacing={2}>
          {messages.map((m, i) => {
            const b = bubble(m.role);
            return (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: b.align,
                  width: '100%',
                  animation: 'fadeIn 0.3s ease-in',
                  '@keyframes fadeIn': {
                    from: { opacity: 0, transform: 'translateY(10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                  }
                }}
              >
                <Stack direction={b.row} spacing={1.5} alignItems="flex-end" sx={{ maxWidth: '85%' }}>
                  {m.role === 'user' ? UserAvatar : AssistantAvatar}
                  <Box
                    sx={{
                      background: typeof b.bg === 'function' ? b.bg : b.bg,
                      color: b.fg,
                      px: 2.5,
                      py: 1.75,
                      borderRadius: 3,
                      boxShadow: b.shadow,
                      border: typeof b.border === 'function' ? (t) => b.border(t) : b.border,
                      maxWidth: '100%',
                      position: 'relative',
                      '&::before': m.role === 'assistant' ? {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: (t) => `linear-gradient(90deg, transparent, ${alpha(t.palette.primary.main, 0.1)}, transparent)`
                      } : {}
                    }}
                  >
                    <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem' }}>
                      {m.text}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })}

          {busy && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: bubble('assistant').align,
                width: '100%',
              }}
            >
              <Stack
                direction={bubble('assistant').row}
                spacing={1.5}
                alignItems="flex-end"
                sx={{ maxWidth: '60%' }}
              >
                {AssistantAvatar}
                <Box
                  sx={{
                    background: (t) => t.palette.background.paper,
                    color: 'text.secondary',
                    px: 2,
                    py: 1.5,
                    borderRadius: 3,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                    border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.15)}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {isArabic ? 'شافي يكتب' : 'Shafy is typing'}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      '& span': {
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        animation: 'typingDots 1.4s infinite ease-in-out both',
                      },
                      '& span:nth-of-type(2)': {
                        animationDelay: '0.2s',
                      },
                      '& span:nth-of-type(3)': {
                        animationDelay: '0.4s',
                      },
                      '@keyframes typingDots': {
                        '0%, 80%, 100%': { transform: 'scale(0)', opacity: 0.4 },
                        '40%': { transform: 'scale(1)', opacity: 1 },
                      },
                    }}
                  >
                    <span />
                    <span />
                    <span />
                  </Box>
                </Box>
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>

      {!!images.length && (
        <Paper
          sx={{
            p: 1.5,
            borderRadius: 3,
            border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
            background: (t) => alpha(t.palette.background.paper, 0.8),
            backdropFilter: 'blur(10px)'
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <Stack key={i} spacing={0.5} alignItems="center">
                <Avatar
                  variant="rounded"
                  src={img.url}
                  sx={{
                    width: 56,
                    height: 56,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    border: (t) => `2px solid ${alpha(t.palette.primary.main, 0.2)}`
                  }}
                />
                <Typography variant="caption" sx={{ maxWidth: 80 }} noWrap>
                  {img.name}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper
        elevation={4}
        sx={{
          borderRadius: 4,
          p: 1.5,
          position: 'sticky',
          bottom: 8,
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
          background: (t) => alpha(t.palette.background.paper, 0.95),
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-end">
          <TextField
            inputRef={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!busy) sendText();
              }
            }}
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            placeholder={isArabic ? 'اكتب رسالتك…' : 'Type your message…'}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: (t) => alpha(t.palette.background.default, 0.5),
                '& fieldset': {
                  borderColor: (t) => alpha(t.palette.divider, 0.3)
                },
                '&:hover fieldset': {
                  borderColor: (t) => alpha(t.palette.primary.main, 0.3)
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                  borderWidth: 2
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton
                    component="label"
                    size="small"
                    sx={{
                      color: 'primary.main',
                      '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }
                    }}
                  >
                    <ImageIcon />
                    <input type="file" hidden accept="image/*" onChange={onPickImage} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            onClick={sendText}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={busy || (!text.trim() && images.length === 0)}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
              boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
              '&:hover': {
                background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
                boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)'
              },
              '&:disabled': {
                background: (t) => alpha(t.palette.action.disabled, 0.12)
              }
            }}
          >
            {busy ? (isArabic ? '...إرسال' : 'Sending…') : (isArabic ? 'إرسال' : 'Send')}
          </Button>
        </Stack>
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ whiteSpace: 'pre-wrap' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
