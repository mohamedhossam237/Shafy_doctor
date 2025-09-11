// /pages/messages/[threadId].js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Container, Paper,
  TextField, InputAdornment, Avatar, Stack, CircularProgress
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  doc, collection, onSnapshot, orderBy, query, addDoc, serverTimestamp,
  updateDoc, writeBatch, limit as qLimit
} from 'firebase/firestore';

function toMillis(v){ if(!v) return Date.now(); if(typeof v==='number') return v; if(v.toDate) return v.toDate().getTime(); try{ return new Date(v).getTime()||Date.now(); }catch{ return Date.now(); } }

function Bubble({ me, text, time }) {
  return (
    <Stack direction={me? 'row-reverse' : 'row'} spacing={1} alignItems="flex-end">
      <Avatar sx={{ width:28, height:28, bgcolor: me? 'secondary.main':'primary.main' }}>
        {me? <PersonIcon fontSize="small"/> : <SmartToyIcon fontSize="small"/>}
      </Avatar>
      <Box sx={{
        bgcolor: me? 'secondary.main' : 'primary.main',
        color: 'primary.contrastText',
        px:1.25, py:0.75, borderRadius: 2,
        maxWidth:'70%',
      }}>
        <Typography sx={{ whiteSpace:'pre-wrap' }}>{text}</Typography>
        <Typography variant="caption" sx={{ opacity:0.8 }}>
          {new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(time)}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { threadId } = router.query;

  const [isArabic, setIsArabic] = React.useState(true);
  const [thread, setThread] = React.useState(null);
  const [messages, setMessages] = React.useState(null);
  const [draft, setDraft] = React.useState('');

  React.useEffect(()=>{
    const q = router?.query||{};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar==='1'||String(q.ar).toLowerCase()==='true');
    else setIsArabic(true);
  }, [router.query]);

  const withLang = (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path);

  // Subscribe to thread & messages
  React.useEffect(()=>{
    if (!threadId) return;
    const threadRef = doc(db, 'messages_threads', String(threadId));

    // thread meta (name, unreadCounts, etc.)
    const unsubThread = onSnapshot(threadRef, (snap)=>{
      setThread({ id: snap.id, ...snap.data() });
    });

    // messages
    const q = query(
      collection(threadRef, 'messages'),
      orderBy('ts','asc'),
      qLimit(500)
    );
    const unsubMsgs = onSnapshot(q, (snap)=>{
      setMessages(snap.docs.map(d=>({ id:d.id, ...d.data(), tsMillis: toMillis(d.data().ts) })));
    });

    return ()=>{ unsubThread(); unsubMsgs(); };
  }, [threadId]);

  // Mark as read when viewing
  React.useEffect(()=>{
    if (!thread?.id || !user?.uid) return;
    const unread = (thread.unreadCounts && thread.unreadCounts[user.uid]) || 0;
    if (unread > 0) {
      const ref = doc(db, 'messages_threads', thread.id);
      updateDoc(ref, { [`unreadCounts.${user.uid}`]: 0 }).catch(()=>{});
    }
  }, [thread?.id, thread?.unreadCounts, user?.uid]);

  const send = async () => {
    if (!draft.trim() || !user?.uid || !threadId) return;
    const threadRef = doc(db, 'messages_threads', String(threadId));
    const msgsRef = collection(threadRef, 'messages');

    const text = draft;
    const text_ar = draft; // optional: translate upstream or store as-is

    setDraft('');

    // add message + update thread atomically-ish with a batch
    const batch = writeBatch(db);
    const newMsgRef = doc(msgsRef);
    batch.set(newMsgRef, {
      fromUID: user.uid,
      text,
      text_ar,
      ts: serverTimestamp(),
      readBy: { [user.uid]: true },
    });

    // increase unread for others, zero for me, and set last message
    const update = {
      lastMessage: text,
      lastMessage_ar: text_ar,
      lastTs: serverTimestamp(),
      [`unreadCounts.${user.uid}`]: 0,
    };
    batch.update(threadRef, update);

    // If you store participants, increment others' counts on server via Cloud Function OR:
    // (Optional) client-side fetch & update for known participant IDs.

    await batch.commit();
  };

  return (
    <AppLayout showBackOnMobile>
      <Container maxWidth="md" sx={{ px:{xs:0, md:0}, height:'calc(100vh - 160px)' }}>
        {/* Chat header */}
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ px:{xs:1.25, md:0} }}>
            <IconButton edge="start" onClick={()=>router.push(withLang('/messages'))}>
              <ArrowBackIosNewIcon/>
            </IconButton>
            <Avatar sx={{ mr:1, bgcolor: thread?.isBot ? 'info.main':'primary.main' }}>
              <PersonIcon/>
            </Avatar>
            <Typography variant="h6" fontWeight={800}>
              {isArabic ? (thread?.name_ar || thread?.name || 'محادثة') : (thread?.name || 'Chat')}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Messages area */}
        <Paper sx={{
          mx:{xs:1.25, md:0}, my:1, p:1.25, height:'calc(100% - 64px - 70px)',
          overflowY:'auto', display:'flex', flexDirection:'column', gap:1.25
        }}>
          {!messages ? (
            <Box sx={{ py:4, textAlign:'center' }}><CircularProgress size={22}/></Box>
          ) : (
            messages.map(m => (
              <Bubble
                key={m.id}
                me={m.fromUID === user?.uid}
                text={isArabic ? (m.text_ar || m.text) : m.text}
                time={m.tsMillis}
              />
            ))
          )}
        </Paper>

        {/* Composer */}
        <Box sx={{ px:{xs:1.25, md:0} }}>
          <TextField
            fullWidth
            value={draft}
            onChange={e=>setDraft(e.target.value)}
            placeholder={isArabic? 'اكتب رسالة…' : 'Type a message…'}
            onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
            multiline
            minRows={1}
            maxRows={4}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton color="primary" onClick={send}>
                    <SendIcon/>
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>
      </Container>
    </AppLayout>
  );
}
