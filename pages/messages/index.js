// /pages/messages/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  AppBar, Toolbar, IconButton, InputBase, Paper, Container, List, ListItemButton,
  ListItemAvatar, Avatar, ListItemText, Typography, Badge, Box, CircularProgress,
  Tabs, Tab, Stack, Chip, Button
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OutboxIcon from '@mui/icons-material/Outbox';
import PersonIcon from '@mui/icons-material/Person';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, limit as qLimit, // no orderBy → no composite index needed
  doc, getDoc
} from 'firebase/firestore';

/* ---------- utils ---------- */
function timeAgo(ms) {
  if (!ms) return '';
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
const chunk10 = (arr=[]) => {
  const out = [];
  for (let i=0;i<arr.length;i+=10) out.push(arr.slice(i, i+10));
  return out;
};

export default function MessagesIndex() {
  const router = useRouter();
  const { user } = useAuth();

  const [qText, setQText] = React.useState('');
  const [isArabic, setIsArabic] = React.useState(true);
  const [tab, setTab] = React.useState('threads'); // 'threads' | 'sent'

  // inbox (threads)
  const [threads, setThreads] = React.useState([]);
  const [loadingThreads, setLoadingThreads] = React.useState(true);

  // sent (messages composed from Patients page)
  const [sentRows, setSentRows] = React.useState([]);
  const [loadingSent, setLoadingSent] = React.useState(true);

  // replies meta for sent rows: { [rootId]: { count, lastTs, lastBody } }
  const [repliesMeta, setRepliesMeta] = React.useState({});

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

  /* -------- Subscribe to conversation threads (Inbox) -------- */
  React.useEffect(()=>{
    if (!user?.uid) return;
    setLoadingThreads(true);

    const qRef = query(
      collection(db, 'messages_threads'),
      where('participants', 'array-contains', user.uid),
      qLimit(200)
    );

    const unsub = onSnapshot(qRef, (snap)=>{
      const rows = snap.docs.map(d=>{
        const data = d.data() || {};
        return {
          id: d.id,
          name: data.name || 'Conversation',
          name_ar: data.name_ar || data.name,
          lastMessage: data.lastMessage || '',
          lastMessage_ar: data.lastMessage_ar || data.lastMessage,
          lastTs: toMillis(data.lastTs),           // may be 0 if missing
          unreadCount: (data.unreadCounts && data.unreadCounts[user.uid]) || 0,
          isBot: !!data.isBot,
          avatarUrl: data.avatarUrl || null,
        };
      })
      // client-side sort by lastTs desc
      .sort((a,b)=> (b.lastTs||0) - (a.lastTs||0));

      setThreads(rows);
      setLoadingThreads(false);
    }, ()=> setLoadingThreads(false));

    return ()=>unsub();
  }, [user?.uid]);

  /* -------- Subscribe to sent messages (from Patients page) -------- */
  React.useEffect(()=>{
    if (!user?.uid) return;
    setLoadingSent(true);

    // Keep the query simple: only a single WHERE and a LIMIT → no index needed.
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
            createdAt: toMillis(m.createdAt || m.created_at || m.sentAt || m.ts),
          };
        })
        .filter(x => (x.type || 'direct') === 'direct') // only direct messages you send
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setSentRows(list);
      setLoadingSent(false);
    }, ()=> setLoadingSent(false));

    return ()=>unsub();
  }, [user?.uid]);

  /* -------- Subscribe to replies for (recent) sent messages --------
     We aggregate replies where replyTo == sentRow.id,
     counting ONLY patient replies (senderRole === 'patient').
     We watch the first N most-recent roots to limit listeners. */
  const MAX_TRACKED_SENT = 40;
  React.useEffect(()=>{
    const roots = sentRows.slice(0, MAX_TRACKED_SENT).map(r => r.id);
    if (roots.length === 0) { setRepliesMeta({}); return; }

    const unsubs = [];
    const caches = new Map(); // chunkKey -> last snap

    const apply = () => {
      // Merge all cached chunks into one meta map
      const meta = {};
      caches.forEach((snap)=>{
        snap.docs.forEach(d=>{
          const data = d.data() || {};
          const root = data.replyTo;
          const senderRole = String(data.senderRole || data.role || '').toLowerCase();
          if (!root) return;
          if (senderRole && senderRole !== 'patient') return; // keep only patient responses
          const ts = toMillis(data.createdAt || data.created_at || data.sentAt || data.ts);
          const body = data.body || '';

          const prev = meta[root] || { count: 0, lastTs: 0, lastBody: '' };
          const next = { ...prev, count: prev.count + 1 };
          if ((ts || 0) >= (prev.lastTs || 0)) {
            next.lastTs = ts || prev.lastTs;
            next.lastBody = body || prev.lastBody;
          }
          meta[root] = next;
        });
      });
      setRepliesMeta(meta);
    };

    chunk10(roots).forEach((ids, idx)=>{
      // where('replyTo', 'in', ids) + limit — no orderBy → no composite index required
      const qRef = query(
        collection(db, 'messages'),
        where('replyTo', 'in', ids),
        qLimit(1000)
      );
      const unsub = onSnapshot(qRef, (snap)=>{
        caches.set(String(idx), snap);
        apply();
      }, ()=>{});
      unsubs.push(unsub);
    });

    return ()=> unsubs.forEach(u=>{ try{u();}catch{} });
  }, [sentRows]);

  /* -------- Filters -------- */
  const filterText = (txt='') => txt.toLowerCase().includes(qText.toLowerCase());

  const inboxList = React.useMemo(()=>(
    threads.filter(t =>
      [t.name, t.name_ar, t.lastMessage, t.lastMessage_ar]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(qText.toLowerCase())
    )
  ), [threads, qText]);

  const sentList = React.useMemo(()=>(
    sentRows.filter(m =>
      [
        m.patientName,
        m.patientId,
        m.subject,
        m.body,
      ].filter(Boolean).join(' ').toLowerCase().includes(qText.toLowerCase())
    )
  ), [sentRows, qText]);

  const loading = tab === 'threads' ? loadingThreads : loadingSent;
  const list = tab === 'threads' ? inboxList : sentList;

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ px:{xs:1.25, md:0} }}>
        {/* Header + search + tabs */}
        <AppBar position="static" color="transparent" elevation={0} sx={{ mb:1 }}>
          <Toolbar sx={{ px:0, gap:1 }}>
            {tab === 'threads' ? <MailOutlineIcon color="primary" /> : <OutboxIcon color="primary" />}
            <Typography variant="h6" fontWeight={800} sx={{ flex:1 }}>
              {tab === 'threads'
                ? (isArabic ? 'الرسائل' : 'Messages')
                : (isArabic ? 'المرسلة' : 'Sent')
              }
            </Typography>
          </Toolbar>

          <Paper sx={{ p:0.75, display:'flex', alignItems:'center', border: t=>`1px solid ${t.palette.divider}` }}>
            <IconButton size="small"><SearchIcon/></IconButton>
            <InputBase
              fullWidth
              placeholder={isArabic? 'ابحث…' : 'Search…'}
              value={qText}
              onChange={e=>setQText(e.target.value)}
              sx={{ px:1 }}
            />
          </Paper>

          <Tabs
            value={tab}
            onChange={(_, v)=> setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ mt:0.5 }}
          >
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{isArabic ? 'الوارد' : 'Inbox'}</span>
                  <Chip
                    size="small"
                    label={threads.reduce((a,t)=>a + (t.unreadCount||0), 0)}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
              }
              value="threads"
            />
            <Tab label={isArabic ? 'المرسلة' : 'Sent'} value="sent" />
          </Tabs>
        </AppBar>

        {/* List */}
        <Paper>
          {loading ? (
            <Box sx={{ py:4, textAlign:'center' }}>
              <CircularProgress size={22}/>
            </Box>
          ) : tab === 'threads' ? (
            <List>
              {list.map(t => (
                <ListItemButton
                  key={t.id}
                  onClick={()=>router.push(withLang(`/messages/${t.id}`))}
                  sx={{ borderBottom: theme=>`1px solid ${theme.palette.divider}` }}
                >
                  <ListItemAvatar>
                    <Badge color="error" badgeContent={t.unreadCount} invisible={!t.unreadCount}>
                      <Avatar
                        src={t.avatarUrl || undefined}
                        sx={{ bgcolor: t.isBot ? 'info.main':'primary.main' }}
                      >
                        <PersonIcon/>
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display:'flex', alignItems:'baseline', gap:1 }}>
                        <Typography fontWeight={800}>
                          {isArabic ? (t.name_ar || t.name) : t.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.lastTs ? timeAgo(t.lastTs) : ''}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography noWrap color="text.secondary">
                        {isArabic ? (t.lastMessage_ar || t.lastMessage) : t.lastMessage}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
              {list.length===0 && (
                <Box sx={{ py:4, textAlign:'center' }}>
                  <Typography color="text.secondary">
                    {isArabic? 'لا توجد رسائل' : 'No messages'}
                  </Typography>
                </Box>
              )}
            </List>
          ) : (
            <List>
              {list.map(m => {
                const meta = repliesMeta[m.id] || { count: 0, lastTs: 0, lastBody: '' };
                return (
                  <ListItemButton
                    key={m.id}
                    onClick={() => router.push(withLang(`/messages/${m.id}`))} // open the thread page
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
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25, flexWrap:'wrap' }}>
                          {/* original body preview */}
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ flex:1, minWidth: 200 }}>
                            {m.body || (isArabic ? 'بدون نص' : 'No content')}
                          </Typography>

                          {/* Replies chip */}
                          <Chip
                            size="small"
                            color={meta.count ? 'primary' : 'default'}
                            variant={meta.count ? 'filled' : 'outlined'}
                            label={
                              isArabic
                                ? `الردود: ${meta.count || 0}`
                                : `Replies: ${meta.count || 0}`
                            }
                          />

                          {/* Last reply preview (if any) */}
                          {meta.lastTs ? (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ width: '100%' }}>
                              {isArabic ? 'آخر رد' : 'Last reply'} · {timeAgo(meta.lastTs)} — {meta.lastBody || (isArabic ? 'بدون نص' : 'No content')}
                            </Typography>
                          ) : null}

                          {!!m.lang && <Chip size="small" label={m.lang.toUpperCase()} />}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                );
              })}
              {list.length===0 && (
                <Box sx={{ py:4, textAlign:'center' }}>
                  <Typography color="text.secondary">
                    {isArabic? 'لا توجد رسائل مُرسلة' : 'No sent messages'}
                  </Typography>
                  <Button
                    onClick={()=>router.push(withLang('/patients'))}
                    variant="outlined"
                    sx={{ mt:1 }}
                  >
                    {isArabic ? 'رسالة جديدة' : 'New Message'}
                  </Button>
                </Box>
              )}
            </List>
          )}
        </Paper>
      </Container>
    </AppLayout>
  );
}
