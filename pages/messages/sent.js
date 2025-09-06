// /pages/messages/sent.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  AppBar, Toolbar, IconButton, InputBase, Paper, Container, List, ListItemButton,
  ListItemAvatar, Avatar, ListItemText, Typography, Badge, Box, CircularProgress, Button, Chip, Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OutboxIcon from '@mui/icons-material/Outbox';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, limit as qLimit,
} from 'firebase/firestore';

/* ---------- utils ---------- */
function timeAgo(ms) {
  const mins = Math.max(1, Math.round((Date.now()-ms)/60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins/60);
  if (hrs < 24) return `${hrs}h`;
  const d = Math.round(hrs/24);
  return `${d}d`;
}
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v?.toDate) return v.toDate().getTime();
  try { return new Date(v).getTime() || 0; } catch { return 0; }
}

/* ---------- page ---------- */
export default function SentMessagesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isArabic, setIsArabic] = React.useState(true);
  const [qText, setQText] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(()=>{
    const rq = router?.query||{};
    if (rq.lang) setIsArabic(String(rq.lang).toLowerCase().startsWith('ar'));
    else if (rq.ar) setIsArabic(rq.ar==='1'||String(rq.ar).toLowerCase()==='true');
    else setIsArabic(true);
  }, [router.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  // Realtime subscription to messages sent by this doctor
  React.useEffect(()=>{
    if (!user?.uid) return;
    setLoading(true);

    // Keep query simple (no orderBy, no extra where) to AVOID composite index requirements.
    const qRef = query(
      collection(db, 'messages'),
      where('doctorUID', '==', user.uid),
      qLimit(500)
    );

    const unsub = onSnapshot(qRef, (snap)=>{
      const list = snap.docs
        .map(d => {
          const m = d.data() || {};
          return {
            id: d.id,
            patientId: m.patientId || '',
            patientName: m.patientName || '',
            subject: m.subject || '',
            body: m.body || '',
            lang: m.lang || '',
            type: m.type || 'direct',
            createdAt: toMillis(m.createdAt),
          };
        })
        // Filter to only the ones composed from Patients page (type === 'direct')
        .filter(x => (x.type || 'direct') === 'direct')
        // Client-side order newest first
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setRows(list);
      setLoading(false);
    }, ()=>{
      setLoading(false);
    });

    return ()=>unsub();
  }, [user?.uid]);

  const filtered = React.useMemo(()=>{
    const q = qText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [
        r.patientName, r.patientId, r.subject, r.body,
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [rows, qText]);

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md" sx={{ px:{xs:1.25, md:0} }}>
          {/* Header + actions + search */}
          <AppBar position="static" color="transparent" elevation={0} sx={{ mb:1 }}>
            <Toolbar sx={{ px:0, gap:1 }}>
              <IconButton onClick={()=>router.back()} edge="start" size="small">
                <ArrowBackIcon />
              </IconButton>
              <OutboxIcon color="primary" />
              <Typography variant="h6" fontWeight={800} sx={{ flex:1 }}>
                {isArabic ? 'الرسائل المُرسلة' : 'Sent Messages'}
              </Typography>

              <Button onClick={()=>router.push(withLang('/patients'))} variant="outlined" size="small">
                {isArabic ? 'رسالة جديدة' : 'New Message'}
              </Button>
            </Toolbar>

            <Paper sx={{ p:0.75, display:'flex', alignItems:'center', border: t=>`1px solid ${t.palette.divider}` }}>
              <IconButton size="small"><SearchIcon/></IconButton>
              <InputBase
                fullWidth
                placeholder={isArabic? 'ابحث بالاسم، الموضوع أو النص…' : 'Search by name, subject or message…'}
                value={qText}
                onChange={e=>setQText(e.target.value)}
                sx={{ px:1 }}
              />
            </Paper>
          </AppBar>

          {/* List */}
          <Paper>
            {loading ? (
              <Box sx={{ py:4, textAlign:'center' }}>
                <CircularProgress size={22}/>
              </Box>
            ) : (
              <List>
                {filtered.map(m => (
                  <ListItemButton
                    key={m.id}
                    onClick={() => m.patientId && router.push(withLang(`/patients/${m.patientId}`))}
                    sx={{ borderBottom: theme=>`1px solid ${theme.palette.divider}` }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor:'primary.main' }}>
                        <PersonIcon/>
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display:'flex', alignItems:'baseline', gap:1, flexWrap:'wrap' }}>
                          <Typography fontWeight={800} noWrap sx={{ maxWidth: '60%' }}>
                            {m.patientName || (isArabic ? 'مريض' : 'Patient')} {m.patientId ? `· ${m.patientId}` : ''}
                          </Typography>
                          {!!m.subject && (
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ flex:1 }}>
                              — {m.subject}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ ml:'auto' }}>
                            {m.createdAt ? timeAgo(m.createdAt) : ''}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ flex:1 }}>
                            {m.body || (isArabic ? 'بدون نص' : 'No content')}
                          </Typography>
                          {!!m.lang && <Chip size="small" label={m.lang.toUpperCase()} />}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
                {filtered.length === 0 && (
                  <Box sx={{ py:4, textAlign:'center' }}>
                    <Typography color="text.secondary">
                      {isArabic? 'لا توجد رسائل مُرسلة' : 'No sent messages'}
                    </Typography>
                  </Box>
                )}
              </List>
            )}
          </Paper>
        </Container>
      </AppLayout>
    </Protected>
  );
}
