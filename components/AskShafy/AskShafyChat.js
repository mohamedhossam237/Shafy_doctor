// /components/AskShafy/AskShafyChat.js
'use client';

import * as React from 'react';
import {
  Alert, Avatar, Box, Button, IconButton, InputAdornment, Paper, Snackbar,
  Stack, TextField, Tooltip, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckIcon from '@mui/icons-material/Check';

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
    { 
      id: 'welcome-msg',
      role: 'assistant', 
      text: (new Date().getHours() < 12 ? (isArabic ? 'صباح الخير ☀️' : 'Good morning ☀️') : (isArabic ? 'مرحبًا 👋' : 'Hello 👋')) + (isArabic ? ' كيف يمكنني مساعدتك اليوم؟' : ' How can I assist you today?'),
      timestamp: new Date()
    },
  ]);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'info' });

  const [images, setImages] = React.useState([]);
  const [ocrTexts, setOcrTexts] = React.useState([]);
  const [ocrPending, setOcrPending] = React.useState(0);

  // Audio recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [mediaRecorder, setMediaRecorder] = React.useState(null);
  const [audioChunks, setAudioChunks] = React.useState([]);
  const recordingIntervalRef = React.useRef(null);

  // TTS playback state
  const [enableTTS, setEnableTTS] = React.useState(true);
  const audioPlayerRef = React.useRef(null);
  const [playingAudioId, setPlayingAudioId] = React.useState(null);
  const [copiedMessageId, setCopiedMessageId] = React.useState(null);
  const [ttsGenerating, setTtsGenerating] = React.useState(false);

  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

  const openSnack = (msg, severity = 'info') => setSnack({ open: true, msg, severity });
  
  // Check if user has scrolled away from bottom
  const checkScrollPosition = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      checkScrollPosition();
    }
  }, [messages, checkScrollPosition]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollPosition);
    return () => el.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

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
    // OCR on the client: extract text to send along with the question
    try {
      setOcrPending((c) => c + 1);
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng+ara');
      setOcrTexts((prev) => [...prev, data?.text || '']);
    } catch {
      // If OCR fails, we just skip OCR for this image
    } finally {
      setOcrPending((c) => Math.max(0, c - 1));
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    await addLocalImage(file); e.target.value = '';
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Convert to WAV format for better compatibility with FANAR STT
        // For now, we'll send webm and let the API handle it
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
          
          try {
            setBusy(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
              openSnack(isArabic ? 'يرجى تسجيل الدخول.' : 'Please sign in.', 'warning');
              return;
            }

            // Send audio for transcription
            const r = await fetch('/api/ask-shafy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                mode: 'stt',
                audioBase64: base64Audio,
                audioMimeType: 'audio/webm',
              }),
            });

            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j?.error || 'Transcription failed');

            // Set transcribed text as message
            if (j.text) {
              setText(j.text);
              inputRef.current?.focus();
            } else {
              openSnack(isArabic ? 'لم يتم العثور على نص في التسجيل.' : 'No text found in recording.', 'info');
            }
          } catch (e) {
            openSnack(e?.message || (isArabic ? 'فشل تحويل الصوت إلى نص.' : 'Speech-to-text failed.'), 'error');
          } finally {
            setBusy(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      openSnack(isArabic ? 'فشل في بدء التسجيل. تحقق من إذن الميكروفون.' : 'Failed to start recording. Check microphone permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Format recording time (MM:SS)
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder, isRecording]);

  const doctorContext = React.useMemo(
    () => buildDoctorContext({ lang, doctorDoc, patients, reports, appts }),
    [lang, doctorDoc, patients, reports, appts]
  );

  const sendText = async () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    const msg = text.trim();
    if (!msg && images.length === 0) { inputRef.current?.focus(); return; }

    // Ensure OCR has finished for all selected images before sending to the AI
    if (ocrPending > 0) {
      openSnack(isArabic ? 'جارٍ استخراج النص من الصور، انتظر لحظات ثم حاول مرة أخرى.' : 'Still reading text from images, please wait a moment and try again.', 'info');
      return;
    }

    if (!auth.currentUser) {
      openSnack(isArabic ? 'يرجى تسجيل الدخول.' : 'Please sign in.', 'warning');
      return;
    }

    const userMessageId = `user-${Date.now()}-${Math.random()}`;
    setMessages((m) => [...m, { id: userMessageId, role: 'user', text: msg, images, timestamp: new Date() }]);
    setText(''); setBusy(true);
    setTtsGenerating(enableTTS);

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
          enable_tts: enableTTS, // Request TTS audio generation
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Request failed');
      
      // Add message with text and optional TTS audio
      const assistantMessageId = `assistant-${Date.now()}-${Math.random()}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        text: j.text,
        ttsAudioBase64: j.tts_audio_base64 || null,
        ttsAudioMimeType: j.tts_audio_mime_type || 'audio/mpeg',
        timestamp: new Date(),
      };
      setMessages((m) => [...m, assistantMessage]);
      setTtsGenerating(false);

      // Debug: Log TTS status
      console.log('TTS Status:', j.tts_status, 'Has Audio:', !!j.tts_audio_base64, 'Audio Length:', j.tts_audio_base64?.length || 0);
      
      // Auto-play TTS if available and enabled
      if (enableTTS && j.tts_audio_base64) {
        try {
          const audioData = `data:${j.tts_audio_mime_type || 'audio/mpeg'};base64,${j.tts_audio_base64}`;
          if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
          }
          const audio = new Audio(audioData);
          audioPlayerRef.current = audio;
          setPlayingAudioId(assistantMessageId);
          
          // Add error handler
          audio.onerror = (e) => {
            console.error('Audio playback error:', e, audio.error);
            setPlayingAudioId(null);
            openSnack(isArabic ? 'خطأ في تشغيل الصوت.' : 'Audio playback error.', 'error');
          };
          
          // Handle playback end
          audio.onended = () => {
            setPlayingAudioId(null);
          };
          
          // Handle pause
          audio.onpause = () => {
            if (audio.ended) {
              setPlayingAudioId(null);
            }
          };
          
          audio.play().catch((e) => {
            console.warn('Auto-play blocked or failed:', e);
            setPlayingAudioId(null);
            // Show a message to user that they can click the play button
            if (e.name === 'NotAllowedError') {
              openSnack(isArabic ? 'انقر على أيقونة الصوت لتشغيل الرسالة الصوتية.' : 'Click the audio icon to play the voice message.', 'info');
            }
          });
        } catch (e) {
          console.error('TTS playback error:', e);
          openSnack(isArabic ? 'خطأ في تحميل الصوت.' : 'Error loading audio.', 'error');
        }
      } else if (enableTTS && j.tts_status === 'error') {
        console.warn('TTS generation failed on server');
        openSnack(isArabic ? 'فشل توليد الصوت. تحقق من إعدادات الخادم.' : 'TTS generation failed. Check server settings.', 'warning');
      }
    } catch (e) {
      const errorMessageId = `error-${Date.now()}`;
      setMessages((m) => [...m, { id: errorMessageId, role: 'assistant', text: isArabic ? 'تعذر إكمال الطلب.' : 'Could not complete the request.', timestamp: new Date() }]);
      openSnack(e?.message || 'Network error', 'error');
      setTtsGenerating(false);
    } finally {
      setBusy(false);
      setImages([]);
      setOcrTexts([]);
      setOcrPending(0);
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
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          position: 'relative'
        }}
      >
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <IconButton
            onClick={scrollToBottom}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: isArabic ? 'auto' : 16,
              left: isArabic ? 16 : 'auto',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
              zIndex: 10,
              '&:hover': {
                bgcolor: 'primary.dark',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.5)',
              },
              transition: 'all 0.2s ease',
              animation: 'bounce 2s infinite',
              '@keyframes bounce': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-4px)' },
              }
            }}
          >
            <SendIcon sx={{ transform: 'rotate(-90deg)' }} />
          </IconButton>
        )}
        <Stack spacing={2}>
          {messages.map((m, i) => {
            const b = bubble(m.role);
            const messageId = m.id || `msg-${i}`;
            const isPlaying = playingAudioId === messageId;
            const isCopied = copiedMessageId === messageId;
            
            return (
              <Box
                key={messageId}
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
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: m.role === 'user' 
                          ? '0 16px 32px rgba(25, 118, 210, 0.3)'
                          : '0 12px 24px rgba(0,0,0,.12)',
                      },
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
                    
                    {/* Timestamp */}
                    {m.timestamp && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          mt: 0.5, 
                          opacity: 0.6, 
                          fontSize: '0.7rem',
                          textAlign: m.role === 'user' ? (isArabic ? 'left' : 'right') : (isArabic ? 'right' : 'left')
                        }}
                      >
                        {new Intl.DateTimeFormat(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(m.timestamp))}
                      </Typography>
                    )}
                    
                    {/* Message actions */}
                    <Stack 
                      direction="row" 
                      spacing={0.5} 
                      sx={{ mt: 1, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}
                    >
                      {/* Copy button */}
                      <Tooltip title={isCopied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ النص' : 'Copy text')}>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.text);
                              setCopiedMessageId(messageId);
                              setTimeout(() => setCopiedMessageId(null), 2000);
                            } catch (e) {
                              openSnack(isArabic ? 'فشل نسخ النص.' : 'Failed to copy text.', 'error');
                            }
                          }}
                          sx={{
                            color: isCopied ? 'success.main' : 'text.secondary',
                            transition: 'all 0.2s ease',
                            '&:hover': { 
                              bgcolor: (t) => alpha(t.palette.action.hover, 0.1),
                              transform: 'scale(1.1)'
                            }
                          }}
                        >
                          {isCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      
                      {/* TTS playback button */}
                      {m.role === 'assistant' && m.ttsAudioBase64 && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            try {
                              if (isPlaying && audioPlayerRef.current) {
                                // Pause if playing
                                audioPlayerRef.current.pause();
                                setPlayingAudioId(null);
                              } else {
                                // Play audio
                                const audioData = `data:${m.ttsAudioMimeType || 'audio/mpeg'};base64,${m.ttsAudioBase64}`;
                                if (audioPlayerRef.current && audioPlayerRef.current.src === audioData) {
                                  audioPlayerRef.current.play();
                                } else {
                                  const audio = new Audio(audioData);
                                  audioPlayerRef.current = audio;
                                  setPlayingAudioId(messageId);
                                  
                                  audio.onended = () => setPlayingAudioId(null);
                                  audio.onerror = () => {
                                    setPlayingAudioId(null);
                                    openSnack(isArabic ? 'خطأ في تشغيل الصوت.' : 'Audio playback error.', 'error');
                                  };
                                  audio.play().catch((e) => {
                                    setPlayingAudioId(null);
                                    console.warn('Audio play failed:', e);
                                    openSnack(isArabic ? 'فشل تشغيل الصوت.' : 'Failed to play audio.', 'error');
                                  });
                                }
                              }
                            } catch (e) {
                              console.error('TTS playback error:', e);
                              openSnack(isArabic ? 'خطأ في تشغيل الصوت.' : 'Audio playback error.', 'error');
                            }
                          }}
                          sx={{
                            color: isPlaying ? 'primary.main' : 'text.secondary',
                            bgcolor: isPlaying ? (t) => alpha(t.palette.primary.main, 0.1) : 'transparent',
                            animation: isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none',
                            '@keyframes pulse': {
                              '0%, 100%': { opacity: 1 },
                              '50%': { opacity: 0.7 }
                            },
                            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }
                          }}
                        >
                          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      )}
                    </Stack>
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
                    {ttsGenerating 
                      ? (isArabic ? 'شافي يكتب ويولد الصوت' : 'Shafy is typing and generating audio')
                      : (isArabic ? 'شافي يكتب' : 'Shafy is typing')
                    }
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
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      component="label"
                      size="small"
                      disabled={isRecording || busy}
                      sx={{
                        color: 'primary.main',
                        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }
                      }}
                    >
                      <ImageIcon />
                      <input type="file" hidden accept="image/*" onChange={onPickImage} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={toggleRecording}
                      disabled={busy}
                      sx={{
                        color: isRecording ? 'error.main' : 'primary.main',
                        bgcolor: isRecording ? (t) => alpha(t.palette.error.main, 0.1) : 'transparent',
                        animation: isRecording ? 'pulseRecording 1s ease-in-out infinite' : 'none',
                        '@keyframes pulseRecording': {
                          '0%, 100%': { 
                            transform: 'scale(1)',
                            boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.4)'
                          },
                          '50%': { 
                            transform: 'scale(1.05)',
                            boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)'
                          },
                        },
                        '&:hover': { 
                          bgcolor: isRecording 
                            ? (t) => alpha(t.palette.error.main, 0.2)
                            : (t) => alpha(t.palette.primary.main, 0.1) 
                        }
                      }}
                    >
                      {isRecording ? <MicOffIcon /> : <MicIcon />}
                    </IconButton>
                  </Stack>
                </InputAdornment>
              ),
              endAdornment: isRecording ? (
                <InputAdornment position="end">
                  <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                    {formatRecordingTime(recordingTime)}
                  </Typography>
                </InputAdornment>
              ) : null,
            }}
          />
          <Tooltip title={enableTTS ? (isArabic ? 'إيقاف الصوت' : 'Disable TTS') : (isArabic ? 'تفعيل الصوت' : 'Enable TTS')}>
            <IconButton
              onClick={() => setEnableTTS(!enableTTS)}
              disabled={busy}
              sx={{
                color: enableTTS ? 'primary.main' : 'text.disabled',
                bgcolor: enableTTS ? (t) => alpha(t.palette.primary.main, 0.1) : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: enableTTS 
                    ? (t) => alpha(t.palette.primary.main, 0.2)
                    : (t) => alpha(t.palette.action.hover, 0.05),
                  transform: 'scale(1.1)'
                }
              }}
            >
              {enableTTS ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
          </Tooltip>
          <Button
            onClick={sendText}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={busy || isRecording || (!text.trim() && images.length === 0)}
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
