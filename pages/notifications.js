// /pages/notifications.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, List, ListItemButton, ListItemAvatar, Avatar,
  ListItemText, Typography, Chip, Stack, Tabs, Tab, Badge, IconButton
} from '@mui/material';

import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, limit as qLimit
} from 'firebase/firestore'; // ⬅️ removed orderBy import

/* ---------------- helpers ---------------- */

const LS_SEEN_KEY = 'notif_seen_v1';
const LS_HIDDEN_KEY = 'notif_hidden_v1';

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch {}
}

function toMillis(v) {
  if (!v) return Date.now();
  if (typeof v === 'number') return v;
  if (v?.toDate) return v.toDate().getTime();
  try { return new Date(v).getTime() || Date.now(); } catch { return Date.now(); }
}

function timeAgo(ms, isArabic) {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return isArabic ? `${mins} د` : `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return isArabic ? `${hrs} س` : `${hrs}h`;
  const d = Math.round(hrs / 24);
  return isArabic ? `${d} يوم` : `${d}d`;
}

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  try { return new Date(val); } catch { return null; }
}
const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function apptDate(a){
  if (a?.appointmentDate) return toDate(a.appointmentDate);
  if (a?.date) {
    const [y,m,d] = String(a.date).split('-').map(n=>parseInt(n,10));
    const [hh=0,mm=0] = String(a.time||'00:00').split(':').map(n=>parseInt(n,10));
    if (Number.isFinite(y)&&Number.isFinite(m)&&Number.isFinite(d)) return new Date(y,m-1,d,hh,mm);
  }
  return null;
}
function formatDateTime(a){
  const d = apptDate(a) || toDate(a?.createdAt);
  if (!d) return '—';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------------- page ---------------- */

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isArabic, setIsArabic] = React.useState(true);
  const [tab, setTab] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);

  const seenRef = React.useRef(null);
  const hiddenRef = React.useRef(null);

  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router.query]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!seenRef.current) seenRef.current = loadSet(LS_SEEN_KEY);
    if (!hiddenRef.current) hiddenRef.current = loadSet(LS_HIDDEN_KEY);
  }, []);

  // ✅ No orderBy in the query (avoids composite index requirement)
  React.useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const qA = query(
      collection(db, 'appointments'),
      where('doctorUID', '==', user.uid),
      qLimit(200)
    );
    const qB = query(
      collection(db, 'appointments'),
      where('doctorId', '==', user.uid),
      qLimit(200)
    );

    const map = new Map();

    const buildNotif = (docId, a) => {
      const id = `appt_${docId}`;
      const hidden = hiddenRef.current?.has(id);
      if (hidden) return null;

      const patientName =
        a.patientName_ar || a.patientName_en || a.patientName || a.patientId || 'Patient';

      const title    = `New appointment with ${patientName} on ${formatDateTime(a)}`;
      const title_ar = `موعد جديد مع ${patientName} بتاريخ ${formatDateTime(a)}`;
      const tsMillis = toMillis(a.createdAt || a.date || a.appointmentDate || Date.now());
      const unread   = !(seenRef.current?.has(id));

      return {
        id,
        type: 'appointment',
        title,
        title_ar,
        link: `/appointments/${docId}`,
        tsMillis,
        unread,
      };
    };

    const handleSnap = (snap) => {
      snap.docs.forEach((d) => {
        const a = { id: d.id, ...d.data() };
        const notif = buildNotif(d.id, a);
        if (!notif) return;
        const existing = map.get(notif.id);
        if (!existing || notif.tsMillis > existing.tsMillis) {
          map.set(notif.id, { ...existing, ...notif });
        }
      });

      // Client-side sort by time desc
      const next = Array.from(map.values()).sort((a, b) => b.tsMillis - a.tsMillis);
      setItems(next);
      setLoading(false);
    };

    const unsubA = onSnapshot(qA, handleSnap, (e) => {
      console.error('[notifications] doctorUID listen error:', e);
      setLoading(false);
    });
    const unsubB = onSnapshot(qB, handleSnap, (e) => {
      console.error('[notifications] doctorId listen error:', e);
      setLoading(false);
    });

    return () => { unsubA(); unsubB(); };
  }, [user?.uid]);

  const unreadCount = items.filter((n) => n.unread).length;
  const filtered = items.filter((n) =>
    tab === 'all' ? true : tab === 'unread' ? n.unread : !n.unread
  );

  const withLang = (path) =>
    isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path;

  const go = (link, id) => {
    if (!link) return;
    markSeen(id);
    router.push(withLang(link));
  };

  const markSeen = (id) => {
    seenRef.current?.add(id);
    saveSet(LS_SEEN_KEY, seenRef.current || new Set([id]));
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const toggleRead = (n) => {
    if (n.unread) {
      markSeen(n.id);
    } else {
      seenRef.current?.delete(n.id);
      saveSet(LS_SEEN_KEY, seenRef.current || new Set());
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: true } : x)));
    }
  };

  const markAllRead = () => {
    const allIds = items.map((n) => n.id);
    const s = seenRef.current || new Set();
    allIds.forEach((id) => s.add(id));
    seenRef.current = s;
    saveSet(LS_SEEN_KEY, s);
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    const s = hiddenRef.current || new Set();
    items.forEach((n) => s.add(n.id));
    hiddenRef.current = s;
    saveSet(LS_HIDDEN_KEY, s);
    setItems([]);
  };

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ px: { xs: 1.5, md: 0 }, py: 1 }}>
        <Paper sx={{ p: 1.5, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <NotificationsActiveIcon color="primary" />
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
            {isArabic ? 'الإشعارات' : 'Notifications'}
          </Typography>
          <IconButton onClick={markAllRead} title={isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}>
            <Badge color="primary" badgeContent={unreadCount}><DoneAllIcon /></Badge>
          </IconButton>
          <IconButton onClick={clearAll} title={isArabic ? 'مسح الكل' : 'Clear all'}>
            <DeleteSweepIcon />
          </IconButton>
        </Paper>

        <Paper sx={{ px: 1.5, pt: 0.5 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
            <Tab label={isArabic ? 'الكل' : 'All'} value="all" />
            <Tab
              label={
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <span>{isArabic ? 'غير مقروء' : 'Unread'}</span>
                  <Chip size="small" color="primary" label={unreadCount} />
                </Stack>
              }
              value="unread"
            />
            <Tab label={isArabic ? 'المقروء' : 'Read'} value="read" />
          </Tabs>

          <List>
            {!loading && filtered.map((n) => {
              const title = isArabic ? (n.title_ar || n.title) : n.title;
              return (
                <ListItemButton
                  key={n.id}
                  onClick={() => (n.link ? go(n.link, n.id) : toggleRead(n))}
                  onContextMenu={(e) => { e.preventDefault(); toggleRead(n); }}
                  sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}`, alignItems: 'flex-start' }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <CalendarMonthIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Typography fontWeight={n.unread ? 800 : 600}>{title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {timeAgo(n.tsMillis, isArabic)}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 0.25 }}>
                        <Chip size="small" variant="outlined" label="appointment" />
                        {n.unread && <Chip size="small" color="primary" label={isArabic ? 'جديد' : 'New'} />}
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })}
            {!loading && filtered.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {isArabic ? 'لا توجد إشعارات' : 'No notifications'}
                </Typography>
              </Box>
            )}
            {loading && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">{isArabic ? 'جارِ التحميل…' : 'Loading…'}</Typography>
              </Box>
            )}
          </List>
        </Paper>
      </Container>
    </AppLayout>
  );
}
