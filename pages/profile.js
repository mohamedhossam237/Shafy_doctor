// /pages/doctor/profile.jsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Stack,
  Typography,
  IconButton,
  Grid,
  Paper,
  Button,
  Avatar,
  Card,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Dialog,
  DialogContent,
  Divider,
  Link as MLink,
  Skeleton,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
} from '@mui/material';

import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WorkIcon from '@mui/icons-material/Work';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import GroupsIcon from '@mui/icons-material/Groups';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PublicIcon from '@mui/icons-material/Public';
import LinkIcon from '@mui/icons-material/Link';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';
import TwitterIcon from '@mui/icons-material/Twitter';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signOut } from 'firebase/auth';

/* ---- Dialog components (drop these files into components/Profile/) ---- */
import EditOverviewDialog from '@/components/Profile/EditOverviewDialog';
import EditServicesDialog from '@/components/Profile/EditServicesDialog';
import EditSubspecialtiesDialog from '@/components/Profile/EditSubspecialtiesDialog';
import EditClinicDialog from '@/components/Profile/EditClinicDialog';
import EditHoursDialog from '@/components/Profile/EditHoursDialog';
import EditEducationDialog from '@/components/Profile/EditEducationDialog';
import EditCertsDialog from '@/components/Profile/EditCertsDialog';
import EditMembershipsDialog from '@/components/Profile/EditMembershipsDialog';
import EditAwardsDialog from '@/components/Profile/EditAwardsDialog';
import EditSocialLinksDialog from '@/components/Profile/EditSocialLinksDialog';

/* ---------- helpers ---------- */
const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Simple Egyptian mobile validator (010/011/012/015 + 8 digits)
const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v || '').trim());
const isInstaPayId = (v) => /@/.test(String(v || ''));

/* ---------- small building blocks ---------- */

function PillNav({ rtl, items }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 999,
        display: 'flex',
        gap: 0.75,
        flexWrap: 'wrap',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      {items.map((it) => (
        <Chip
          key={it.id}
          icon={it.icon}
          label={it.label}
          onClick={() => scrollToId(it.id)}
          clickable
          sx={{
            borderRadius: 999,
            fontWeight: 800,
            '& .MuiChip-icon': { color: 'primary.main' },
          }}
        />
      ))}
    </Paper>
  );
}

function SectionCard({ id, icon, title, children, rtl, dense, bleedTop, action }) {
  return (
    <Paper
      id={id}
      variant="outlined"
      sx={{
        p: dense ? 1.25 : 1.75,
        borderRadius: 3,
        textAlign: rtl ? 'right' : 'left',
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, rgba(25,118,210,0.06) 0%, rgba(25,118,210,0.02) 100%)',
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(600px 120px at 10% -20%, rgba(25,118,210,.12), transparent)',
          pointerEvents: 'none',
        },
        mt: bleedTop ? -2 : 0,
      }}
    >
      <Stack
        direction={rtl ? 'row-reverse' : 'row'}
        spacing={1.25}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction={rtl ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center">
          <Avatar
            sx={{
              width: 30,
              height: 30,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: '0 4px 12px rgba(25,118,210,.25)',
            }}
          >
            {icon}
          </Avatar>
          <Typography variant="subtitle2" fontWeight={900} letterSpacing={0.2}>
            {title}
          </Typography>
        </Stack>
        {action ? <Box>{action}</Box> : null}
      </Stack>
      <Divider sx={{ mb: 1.25 }} />
      {children}
    </Paper>
  );
}

function InfoTile({ icon, title, value, rtl }) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2.5,
        p: 1.5,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) =>
          t.palette.mode === 'light'
            ? 'rgba(255,255,255,.9)'
            : 'rgba(255,255,255,.04)',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 24px rgba(0,0,0,.08)',
        },
      }}
    >
      <Stack
        direction={rtl ? 'row-reverse' : 'row'}
        spacing={1.25}
        alignItems="center"
      >
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            width: 36,
            height: 36,
            fontSize: 18,
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, mt: 0.25, wordBreak: 'break-word' }}
          >
            {String(value ?? '') || '—'}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function ChipGroup({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
      {items.map((x, i) => (
        <Chip
          key={`${x}-${i}`}
          label={x}
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      ))}
    </Stack>
  );
}

function EmptyPrompt({ text, actionLabel, onAction, rtl }) {
  return (
    <Stack
      direction={rtl ? 'row-reverse' : 'row'}
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: (t) => `1px dashed ${t.palette.divider}`,
        bgcolor: (t) =>
          t.palette.mode === 'light'
            ? 'rgba(0,0,0,0.02)'
            : 'rgba(255,255,255,0.04)',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
      <Button onClick={onAction} size="small" variant="contained" sx={{ borderRadius: 2 }}>
        {actionLabel}
      </Button>
    </Stack>
  );
}

/* UPDATED: HoursGrid now supports { open, start, end } objects, arrays, or strings */
function HoursGrid({ hours = {}, rtl }) {
  const days = [
    { k: 'mon', en: 'Mon', ar: 'الإثنين' },
    { k: 'tue', en: 'Tue', ar: 'الثلاثاء' },
    { k: 'wed', en: 'Wed', ar: 'الأربعاء' },
    { k: 'thu', en: 'Thu', ar: 'الخميس' },
    { k: 'fri', en: 'Fri', ar: 'الجمعة' },
    { k: 'sat', en: 'Sat', ar: 'السبت' },
    { k: 'sun', en: 'Sun', ar: 'الأحد' },
  ];

  const fmt = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.open) return `${v.start || '—'} – ${v.end || '—'}`;
      return rtl ? 'مغلق' : 'Closed';
    }
    if (Array.isArray(v)) return v.join(' • ');
    return v || (rtl ? 'مغلق' : 'Closed');
  };

  return (
    <Grid container spacing={1}>
      {days.map((d) => {
        const v = hours?.[d.k];
        return (
          <Grid item xs={6} sm={4} key={d.k}>
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                borderRadius: 2,
                textAlign: rtl ? 'right' : 'left',
                height: '100%',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {rtl ? d.ar : d.en}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {fmt(v)}
              </Typography>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

function SocialLinks({ links = {}, rtl }) {
  const items = [
    { k: 'website', icon: <PublicIcon />, label: 'Website' },
    { k: 'booking', icon: <LinkIcon />, label: 'Booking' },
    { k: 'facebook', icon: <FacebookIcon />, label: 'Facebook' },
    { k: 'instagram', icon: <InstagramIcon />, label: 'Instagram' },
    { k: 'twitter', icon: <TwitterIcon />, label: 'Twitter' },
    { k: 'linkedin', icon: <LinkedInIcon />, label: 'LinkedIn' },
    { k: 'youtube', icon: <YouTubeIcon />, label: 'YouTube' },
  ].filter((x) => links?.[x.k]);
  if (items.length === 0) return null;
  return (
    <Stack direction={rtl ? 'row-reverse' : 'row'} spacing={1} flexWrap="wrap" useFlexGap>
      {items.map((x) => (
        <Button
          key={x.k}
          component={MLink}
          href={links[x.k]}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={x.icon}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2 }}
        >
          {x.label}
        </Button>
      ))}
    </Stack>
  );
}

/** Gallery with lightbox + Set as avatar */
function Gallery({ images = [], rtl, avatarUrl, onSetAvatar }) {
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const openAt = (i) => { setIndex(i); setViewerOpen(true); };
  const close = () => setViewerOpen(false);
  const prev = React.useCallback(() => images.length && setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = React.useCallback(() => images.length && setIndex((i) => (i + 1) % images.length), [images.length]);

  React.useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') (rtl ? next() : prev());
      if (e.key === 'ArrowRight') (rtl ? prev() : next());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, prev, next, rtl]);

  if (!images.length) return null;

  const pattern = (i) => {
    const mod = i % 9;
    switch (mod) {
      case 0: return { aspect: { xs: '1/1', md: '4/3' }, span: { xs: 'auto', md: 'span 2' } };
      case 3: return { aspect: '3/4' };
      case 5: return { aspect: '16/10' };
      case 7: return { aspect: '4/5' };
      default: return { aspect: '1/1' };
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {images.map((src, i) => {
          const isAvatar = src === avatarUrl;
          const conf = pattern(i);
          return (
            <Box
              key={`${src}-${i}`}
              onClick={() => openAt(i)}
              role="button"
              tabIndex={0}
              sx={{
                position: 'relative',
                borderRadius: 2.5,
                overflow: 'hidden',
                border: (t) => `1px solid ${t.palette.divider}`,
                aspectRatio: conf.aspect || '1 / 1',
                gridColumn: conf.span || 'auto',
                cursor: 'zoom-in',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 26px rgba(0,0,0,.12)' },
                '&:hover img': { transform: 'scale(1.03)' },
              }}
            >
              <Image
                src={src}
                alt={`Doctor photo ${i + 1}`}
                fill
                sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw"
                style={{ objectFit: 'cover', transition: 'transform .25s ease' }}
              />
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
                  justifyContent: 'space-between', p: 1, pointerEvents: 'none',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)',
                  opacity: 0, transition: 'opacity .2s ease',
                  '&:hover, &:focus-within': { opacity: 1, pointerEvents: 'auto' },
                }}
              >
                {isAvatar ? (
                  <Chip
                    icon={<AccountCircleIcon />}
                    label={rtl ? 'الصورة الشخصية' : 'Profile photo'}
                    color="primary"
                    sx={{ color: 'primary.contrastText', bgcolor: 'rgba(25,118,210,.9)' }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AccountCircleIcon />}
                    onClick={() => onSetAvatar?.(src)}
                    sx={{ borderRadius: 2 }}
                  >
                    {rtl ? 'تعيين كصورة شخصية' : 'Set as avatar'}
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Dialog open={viewerOpen} onClose={close} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: 'black', position: 'relative' } }}>
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <Box sx={{ position: 'relative', width: '100%', height: { xs: 360, sm: 520, md: 620 } }}>
            <Image key={images[index]} src={images[index]} alt={`Photo ${index + 1}`} fill sizes="100vw" style={{ objectFit: 'contain' }} />
          </Box>
          <IconButton aria-label="close" onClick={close} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="prev" onClick={rtl ? next : prev} sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            {rtl ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
          <IconButton aria-label="next" onClick={rtl ? prev : next} sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            {rtl ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
          {images[index] !== avatarUrl ? (
            <Button onClick={() => onSetAvatar?.(images[index])} startIcon={<AccountCircleIcon />} variant="contained" sx={{ position: 'absolute', bottom: 12, left: 12, borderRadius: 2 }}>
              {rtl ? 'تعيين كصورة شخصية' : 'Set as avatar'}
            </Button>
          ) : (
            <Chip
              icon={<AccountCircleIcon />}
              label={rtl ? 'الصورة الشخصية' : 'Profile photo'}
              color="primary"
              sx={{ position: 'absolute', bottom: 12, left: 12, color: 'primary.contrastText', bgcolor: 'rgba(25,118,210,.9)' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Edit Payment Dialog (inline) ---------- */
function EditPaymentDialog({ open, onClose, isArabic, doctorUID, initial, onSaved }) {
  const t = (en, ar) => (isArabic ? ar : en);
  const [type, setType] = React.useState(initial?.type || 'instapay');
  const [instapayId, setInstapayId] = React.useState(initial?.instapayId || '');
  const [instapayMobile, setInstapayMobile] = React.useState(initial?.instapayMobile || '');
  const [walletProvider, setWalletProvider] = React.useState(initial?.walletProvider || 'vodafone');
  const [walletNumber, setWalletNumber] = React.useState(initial?.walletNumber || '');
  const [bankName, setBankName] = React.useState(initial?.bankName || '');
  const [notes, setNotes] = React.useState(initial?.notes || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'instapay');
    setInstapayId(initial?.instapayId || '');
    setInstapayMobile(initial?.instapayMobile || '');
    setWalletProvider(initial?.walletProvider || 'vodafone');
    setWalletNumber(initial?.walletNumber || '');
    setBankName(initial?.bankName || '');
    setNotes(initial?.notes || '');
    setErr('');
  }, [open, initial]);

  const save = async () => {
    setErr('');
    // validation
    if (type === 'instapay') {
      const idOk = instapayId ? isInstaPayId(instapayId) : false;
      const mobOk = instapayMobile ? isEgMobile(instapayMobile) : false;
      if (!idOk && !mobOk) {
        setErr(t('Enter a valid InstaPay ID (name@bank) or Egyptian mobile (01xxxxxxxxx).',
                 'أدخل مُعرّف إنستا باي صحيح (name@bank) أو رقم موبايل مصري صحيح (01xxxxxxxxx).'));
        return;
      }
    }
    if (type === 'wallet' && walletNumber && !isEgMobile(walletNumber)) {
      setErr(t('Enter a valid Egyptian wallet number (01xxxxxxxxx).','أدخل رقم محفظة مصري صحيح (01xxxxxxxxx).'));
      return;
    }

    try {
      setBusy(true);
      await updateDoc(doc(db, 'doctors', doctorUID), {
        payment: {
          type,
          instapayId: type === 'instapay' ? instapayId.trim() : '',
          instapayMobile: type === 'instapay' ? instapayMobile.trim() : '',
          walletProvider: type === 'wallet' ? walletProvider : '',
          walletNumber: type === 'wallet' ? walletNumber.trim() : '',
          bankName: bankName.trim(),
          notes: notes.trim(),
          updatedAt: serverTimestamp(),
        }
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || t('Failed to save','فشل الحفظ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="h6" fontWeight={900}>
            {t('Payment details for bookings','بيانات الدفع لتأكيد الحجز')}
          </Typography>

          {err && <Alert severity="error">{err}</Alert>}

          <RadioGroup row value={type} onChange={(e) => setType(e.target.value)}>
            <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
            <FormControlLabel value="wallet" control={<Radio />} label={isArabic ? 'محفظة موبايل' : 'Mobile Wallet'} />
          </RadioGroup>

          {type === 'instapay' && (
            <Stack spacing={1}>
              <TextField
                label={t('InstaPay ID (e.g. name@bank)','معرّف إنستا باي (مثل name@bank)')}
                placeholder="username@bank"
                value={instapayId}
                onChange={(e) => setInstapayId(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('InstaPay mobile (01xxxxxxxxx)','موبايل إنستا باي (01xxxxxxxxx)')}
                placeholder="01xxxxxxxxx"
                value={instapayMobile}
                onChange={(e) => setInstapayMobile(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('Bank (optional)','اسم البنك (اختياري)')}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          {type === 'wallet' && (
            <Stack spacing={1}>
              <TextField
                select
                label={t('Wallet provider','شركة المحفظة')}
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
              >
                <MenuItem value="vodafone">{t('Vodafone Cash','فودافون كاش')}</MenuItem>
                <MenuItem value="etisalat">{t('Etisalat Cash','اتصالات كاش')}</MenuItem>
                <MenuItem value="orange">{t('Orange Money','أورنج موني')}</MenuItem>
                <MenuItem value="we">{t('WE Pay','وي باي')}</MenuItem>
              </TextField>
              <TextField
                label={t('Wallet number (01xxxxxxxxx)','رقم المحفظة (01xxxxxxxxx)')}
                placeholder="01xxxxxxxxx"
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          <TextField
            label={t('Notes (optional)','ملاحظات (اختياري)')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Example: Please write your name in the transfer note.','مثال: رجاء كتابة اسمك في ملاحظة التحويل.')}
            multiline minRows={2}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>{t('Cancel','إلغاء')}</Button>
            <Button onClick={save} disabled={busy} variant="contained">
              {busy ? t('Saving…','جارٍ الحفظ…') : t('Save','حفظ')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- page ---------- */

export default function DoctorProfilePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(true);
  const [doctor, setDoctor] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const [dlg, setDlg] = React.useState({
    overview: false,
    services: false,
    subspecialties: false,
    clinic: false,
    hours: false,
    education: false,
    certs: false,
    memberships: false,
    awards: false,
    links: false,
    payment: false, // NEW
  });

  const fileInputRef = React.useRef(null);
  const dropRef = React.useRef(null);

  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);
  const withLang = React.useCallback((path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path), [isArabic]);

  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router.query]);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      const cached = localStorage.getItem('cachedDoctorData');
      if (cached) {
        setDoctor(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}
  }, [mounted]);

  const fetchDoctor = React.useCallback(async () => {
    try {
      if (!user?.uid) return;
      setLoading(true);
      setErr('');
      const snap = await getDoc(doc(db, 'doctors', user.uid));
      if (snap.exists()) {
        const fresh = snap.data();
        setDoctor(fresh);
        try { localStorage.setItem('cachedDoctorData', JSON.stringify(fresh)); } catch {}
      } else {
        setDoctor(null);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  React.useEffect(() => { if (user?.uid) fetchDoctor(); }, [user?.uid, fetchDoctor]);

  const extras = React.useMemo(() => (Array.isArray(doctor?.profileImages) ? doctor.profileImages.filter(Boolean) : []), [doctor]);
  const avatarUrl = React.useMemo(() => (doctor?.profileImage || extras[0] || ''), [doctor, extras]);
  const allImages = React.useMemo(() => {
    const set = new Set(extras);
    if (doctor?.profileImage) set.add(doctor.profileImage);
    return Array.from(set);
  }, [doctor, extras]);

  /* UPDATED: derive hours from any of the fields the dialog might write */
  const resolvedHours = React.useMemo(() => {
    return (
      doctor?.clinic?.workingHours ||
      doctor?.clinic?.working_hours ||
      doctor?.workingHours ||
      doctor?.working_hours ||
      doctor?.hours ||
      null
    );
  }, [doctor]);

  const uploadFiles = async (files) => {
    try {
      if (!files || !files.length || !user?.uid) return;
      const uploaded = [];
      for (const file of files) {
        const path = `doctors/${user.uid}/profile/${Date.now()}_${file.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        uploaded.push(url);
      }
      if (uploaded.length) {
        await updateDoc(doc(db, 'doctors', user.uid), { profileImages: arrayUnion(...uploaded) });
        await fetchDoctor();
        setSnack({ open: true, severity: 'success', msg: t('Image uploaded', 'تم رفع الصورة') });
      }
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Upload failed', 'فشل الرفع') });
    }
  };

  const onSelectedFile = async (e) => {
    await uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & drop
  React.useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    const enter = (e) => { prevent(e); el.dataset.hover = '1'; };
    const leave = (e) => { prevent(e); el.dataset.hover = ''; };
    const drop = (e) => {
      prevent(e);
      el.dataset.hover = '';
      const files = e.dataTransfer?.files;
      uploadFiles(files);
    };
    el.addEventListener('dragenter', enter);
    el.addEventListener('dragover', enter);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragenter', enter);
      el.removeEventListener('dragover', enter);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
  }, [dropRef.current, user?.uid]); // eslint-disable-line

  const setAvatar = async (url) => {
    try {
      if (!user?.uid || !url) return;
      await updateDoc(doc(db, 'doctors', user.uid), { profileImage: url });
      await fetchDoctor();
      setSnack({ open: true, severity: 'success', msg: t('Avatar updated', 'تم تعيين الصورة الشخصية') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to set avatar', 'فشل تعيين الصورة') });
    }
  };

  const doLogout = async () => {
    try {
      await signOut(getAuth());
      router.replace(withLang('/login'));
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Logout failed', 'فشل تسجيل الخروج') });
    }
  };

  const openDlg = (k) => setDlg((d) => ({ ...d, [k]: true }));
  const closeDlg = (k) => setDlg((d) => ({ ...d, [k]: false }));

  const dir = isArabic ? 'rtl' : 'ltr';

  // Pill navigation (+ Payment)
  const navItems = [
    { id: 'overview', label: t('Overview', 'نظرة عامة'), icon: <PersonIcon /> },
    { id: 'payment', label: t('Payment', 'الدفع'), icon: <MonetizationOnIcon /> }, // NEW
    { id: 'services', label: t('Services', 'الخدمات'), icon: <MedicalServicesIcon /> },
    { id: 'subspecialties', label: t('Subspecialties', 'التخصصات الفرعية'), icon: <LocalHospitalIcon /> },
    { id: 'clinic', label: t('Clinic', 'العيادة'), icon: <PlaceIcon /> },
    { id: 'hours', label: t('Hours', 'الساعات'), icon: <AccessTimeIcon /> },
    { id: 'education', label: t('Education', 'التعليم'), icon: <SchoolIcon /> },
    { id: 'certs', label: t('Certs', 'الشهادات'), icon: <WorkspacePremiumIcon /> },
    { id: 'memberships', label: t('Memberships', 'العضويات'), icon: <GroupsIcon /> },
    { id: 'awards', label: t('Awards', 'الجوائز'), icon: <WorkspacePremiumIcon /> },
    { id: 'links', label: t('Links', 'الروابط'), icon: <PublicIcon /> },
    { id: 'photos', label: t('Photos', 'الصور'), icon: <PhotoLibraryIcon /> },
  ];

  const copy = async (txt) => {
    try {
      await navigator.clipboard.writeText(String(txt || ''));
      setSnack({ open: true, severity: 'success', msg: t('Copied to clipboard', 'تم النسخ') });
    } catch {
      setSnack({ open: true, severity: 'error', msg: t('Copy failed', 'فشل النسخ') });
    }
  };

  return (
    <AppLayout>
      <Box dir={dir} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container maxWidth="md" sx={{ pt: 2 }}>
          {/* Header card */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
              background:
                'linear-gradient(135deg, rgba(25,118,210,.10), rgba(25,118,210,.02))',
              '&:before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(800px 200px at 10% -20%, rgba(25,118,210,.16), transparent)',
                pointerEvents: 'none',
              },
            }}
          >
            {loading ? (
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5} alignItems="center" justifyContent="space-between">
                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5} alignItems="center">
                  <Skeleton variant="circular" width={84} height={84} />
                  <Box sx={{ minWidth: 0 }}>
                    <Skeleton variant="text" width={180} height={28} />
                    <Skeleton variant="text" width={120} />
                  </Box>
                </Stack>
                <Skeleton variant="rounded" width={96} height={40} />
              </Stack>
            ) : (
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5} alignItems="center" justifyContent="space-between">
                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5} alignItems="center">
                  <Avatar
                    src={avatarUrl || undefined}
                    alt="Profile"
                    sx={{
                      width: 84,
                      height: 84,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 900,
                      border: '2px solid rgba(255,255,255,.75)',
                      boxShadow: '0 8px 30px rgba(25,118,210,.25)',
                    }}
                  >
                    Dr
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      fontWeight={900}
                      noWrap
                      title={doctor ? (isArabic ? doctor?.name_ar : doctor?.name_en) : ''}
                    >
                      {doctor ? (isArabic ? doctor?.name_ar : doctor?.name_en) : t('Doctor', 'الطبيب')}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {doctor ? (isArabic ? doctor?.specialty_ar : doctor?.specialty_en) : '—'}
                      </Typography>
                      {doctor?.profileCompleted && (
                        <Chip
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon sx={{ color: 'inherit !important' }} />}
                          label={t('Verified', 'موثق')}
                          sx={{ color: 'success.contrastText', bgcolor: 'rgba(46,125,50,.85)' }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                  <Tooltip title={t('Refresh', 'تحديث')}><IconButton onClick={fetchDoctor}><RefreshIcon /></IconButton></Tooltip>
                  <Tooltip title={t('Edit overview', 'تعديل النظرة العامة')}>
                    <IconButton onClick={() => openDlg('overview')}><EditIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title={t('Edit details page', 'صفحة تفاصيل موسعة')}>
                    <IconButton onClick={() => router.push(withLang('/doctor/details'))}><PublicIcon /></IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            )}

            {/* Pill navigation */}
            <Box sx={{ mt: 1.5 }}>
              <PillNav rtl={isArabic} items={navItems} />
            </Box>
          </Paper>

          {/* Action bar with drag & drop upload */}
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, mt: 1.25 }}>
            <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>
                {t('Manage Profile', 'إدارة الملف الشخصي')}
              </Typography>
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onSelectedFile} multiple />
                <Button startIcon={<AddAPhotoIcon />} variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderRadius: 2 }}>
                  {t('Upload Photos', 'رفع صور')}
                </Button>
                <Button startIcon={<LogoutIcon />} variant="contained" color="error" onClick={doLogout} sx={{ borderRadius: 2 }}>
                  {t('Logout', 'تسجيل الخروج')}
                </Button>
              </Stack>
            </Stack>

            <Box
              ref={dropRef}
              sx={{
                mt: 1,
                p: 1.5,
                borderRadius: 2,
                border: (t) => `2px dashed ${t.palette.divider}`,
                textAlign: 'center',
                transition: 'border-color .15s ease, background-color .15s ease',
                bgcolor: 'transparent',
                '&[data-hover="1"]': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(25,118,210,.06)',
                },
              }}
            >
              <Stack alignItems="center" spacing={0.5}>
                <UploadFileIcon color="primary" />
                <Typography variant="body2" color="text.secondary">
                  {t('Drag & drop images here, or click “Upload Photos”.', 'اسحب وأفلت الصور هنا أو اضغط "رفع صور".')}
                </Typography>
              </Stack>
            </Box>
          </Paper>

          {/* Content */}
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>
          ) : !doctor ? (
            <Paper sx={{ p: 3, mt: 2, borderRadius: 3 }}>
              <Typography color="text.secondary">{t('No data found', 'لا توجد بيانات')}</Typography>
            </Paper>
          ) : (
            <>
              {/* Overview */}
              <Box sx={{ mt: 2 }}>
                <SectionCard
                  id="overview"
                  icon={<PersonIcon />}
                  title={t('Overview', 'نظرة عامة')}
                  rtl={isArabic}
                  action={
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('overview')} sx={{ borderRadius: 2 }}>
                      {t('Edit', 'تعديل')}
                    </Button>
                  }
                >
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} md={6}>
                      <InfoTile icon={<PersonIcon />} title={t('Bio', 'نبذة')} value={doctor[isArabic ? 'bio_ar' : 'bio_en']} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <InfoTile icon={<SchoolIcon />} title={t('Qualifications', 'المؤهل العلمي')} value={doctor[isArabic ? 'qualifications_ar' : 'qualifications_en']} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <InfoTile icon={<ApartmentIcon />} title={t('University', 'الجامعة')} value={doctor[isArabic ? 'university_ar' : 'university_en']} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<CalendarMonthIcon />} title={t('Graduation Year', 'سنة التخرج')} value={doctor?.graduationYear} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<WorkIcon />} title={t('Experience', 'سنوات الخبرة')} value={doctor?.experienceYears != null ? `${doctor.experienceYears} ${t('years','سنوات')}` : ''} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<MonetizationOnIcon />} title={t('Checkup Price','سعر الكشف')} value={doctor?.checkupPrice != null ? `${doctor.checkupPrice} ${t('EGP','جنيه')}` : ''} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<PhoneIcon />} title={t('Phone','رقم الهاتف')} value={doctor?.phone} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={12}>
                      <InfoTile icon={<VerifiedUserIcon />} title={t('Profile Completed','الحساب مكتمل؟')} value={doctor?.profileCompleted === true ? t('Yes','نعم') : t('No','لا')} rtl={isArabic} />
                    </Grid>
                  </Grid>
                </SectionCard>
              </Box>

              {/* Payment (NEW) */}
              <Box sx={{ mt: 1.25 }}>
                <SectionCard
                  id="payment"
                  icon={<MonetizationOnIcon />}
                  title={t('Payment for Bookings','بيانات الدفع للحجوزات')}
                  rtl={isArabic}
                  action={
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('payment')} sx={{ borderRadius: 2 }}>
                      {t('Edit','تعديل')}
                    </Button>
                  }
                >
                  {doctor?.payment ? (
                    <Stack spacing={1}>
                      <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} useFlexGap flexWrap="wrap">
                        <Chip label={`${t('Type','النوع')}: ${doctor.payment.type === 'wallet' ? t('Wallet','محفظة') : 'InstaPay'}`} />
                        {doctor.payment.walletProvider && (
                          <Chip label={`${t('Provider','المزوّد')}: ${
                            { vodafone: t('Vodafone Cash','فودافون كاش'),
                              etisalat: t('Etisalat Cash','اتصالات كاش'),
                              orange: t('Orange Money','أورنج موني'),
                              we: t('WE Pay','وي باي') }[doctor.payment.walletProvider] || doctor.payment.walletProvider
                          }`} />
                        )}
                        {doctor.payment.bankName && <Chip label={`${t('Bank','البنك')}: ${doctor.payment.bankName}`} />}
                      </Stack>

                      <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                        <Grid item xs={12} md={6}>
                          <InfoTile
                            icon={<LinkIcon />}
                            title={t('InstaPay ID','معرّف إنستا باي')}
                            value={doctor.payment.instapayId}
                            rtl={isArabic}
                          />
                          {doctor.payment.instapayId && (
                            <Box sx={{ mt: 0.5 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copy(doctor.payment.instapayId)}
                                sx={{ borderRadius: 2 }}
                              >
                                {t('Copy','نسخ')}
                              </Button>
                            </Box>
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <InfoTile
                            icon={<PhoneIcon />}
                            title={t('InstaPay Mobile','موبايل إنستا باي')}
                            value={doctor.payment.instapayMobile}
                            rtl={isArabic}
                          />
                          {doctor.payment.instapayMobile && (
                            <Box sx={{ mt: 0.5, display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                component={MLink}
                                href={`tel:${doctor.payment.instapayMobile}`}
                                startIcon={<PhoneIcon />}
                                sx={{ borderRadius: 2 }}
                              >
                                {t('Call','اتصال')}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copy(doctor.payment.instapayMobile)}
                                sx={{ borderRadius: 2 }}
                              >
                                {t('Copy','نسخ')}
                              </Button>
                            </Box>
                          )}
                        </Grid>

                        {doctor.payment.type === 'wallet' && (
                          <Grid item xs={12} md={6}>
                            <InfoTile
                              icon={<PhoneIcon />}
                              title={t('Wallet Number','رقم المحفظة')}
                              value={doctor.payment.walletNumber}
                              rtl={isArabic}
                            />
                            {doctor.payment.walletNumber && (
                              <Box sx={{ mt: 0.5, display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  component={MLink}
                                  href={`tel:${doctor.payment.walletNumber}`}
                                  startIcon={<PhoneIcon />}
                                  sx={{ borderRadius: 2 }}
                                >
                                  {t('Call','اتصال')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => copy(doctor.payment.walletNumber)}
                                  sx={{ borderRadius: 2 }}
                                >
                                  {t('Copy','نسخ')}
                                </Button>
                              </Box>
                            )}
                          </Grid>
                        )}
                        {doctor.payment.notes && (
                          <Grid item xs={12}>
                            <InfoTile icon={<MonetizationOnIcon />} title={t('Notes','ملاحظات')} value={doctor.payment.notes} rtl={isArabic} />
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  ) : (
                    <EmptyPrompt
                      rtl={isArabic}
                      text={t('Add payment details (InstaPay or Wallet) so patients can transfer the fee and upload receipt.',
                              'أضف بيانات الدفع (إنستا باي أو محفظة) ليتمكن المرضى من التحويل ورفع إيصال.')}
                      actionLabel={t('Add payment','إضافة الدفع')}
                      onAction={() => openDlg('payment')}
                    />
                  )}
                </SectionCard>
              </Box>

              {/* Services & Subspecialties */}
              <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="services"
                    icon={<MedicalServicesIcon />}
                    title={t('Services Offered','الخدمات المقدمة')}
                    rtl={isArabic}
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('services')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.services) && doctor.services.length > 0 ? (
                      <ChipGroup items={doctor.services} />
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('List procedures or services you offer.','أضف الإجراءات أو الخدمات التي تقدمها.')} actionLabel={t('Add services','إضافة خدمات')} onAction={() => openDlg('services')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="subspecialties"
                    icon={<LocalHospitalIcon />}
                    title={t('Subspecialties','التخصصات الفرعية')}
                    rtl={isArabic}
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('subspecialties')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.subspecialties) && doctor.subspecialties.length > 0 ? (
                      <ChipGroup items={doctor.subspecialties} />
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Show your subspecialties to help patients find you.','اعرض تخصصاتك الفرعية لمساعدة المرضى.')} actionLabel={t('Add subspecialties','إضافة تخصصات')} onAction={() => openDlg('subspecialties')} />
                    )}
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Clinic & Hours */}
              <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <SectionCard
                    id="clinic"
                    icon={<PlaceIcon />}
                    title={t('Clinic Location','موقع العيادة')}
                    rtl={isArabic}
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('clinic')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {doctor?.clinic?.address || doctor?.clinic?.name ? (
                      <Stack spacing={0.75}>
                        {doctor?.clinic?.name && <Typography fontWeight={800}>{doctor.clinic.name}</Typography>}
                        <Typography color="text.secondary">{[doctor?.clinic?.address, doctor?.clinic?.city].filter(Boolean).join(', ')}</Typography>
                        <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} sx={{ mt: 0.5 }}>
                          {doctor?.clinic?.mapUrl && (
                            <Button size="small" variant="outlined" component={MLink} href={doctor.clinic.mapUrl} target="_blank" rel="noopener noreferrer" startIcon={<PlaceIcon />} sx={{ borderRadius: 2 }}>
                              {t('Open in Maps','افتح في الخرائط')}
                            </Button>
                          )}
                          {doctor?.clinic?.whatsapp && (
                            <Button size="small" variant="outlined" component={MLink} href={`https://wa.me/${doctor.clinic.whatsapp}`} target="_blank" rel="noopener noreferrer" startIcon={<PhoneIcon />} sx={{ borderRadius: 2 }}>
                              WhatsApp
                            </Button>
                          )}
                          {doctor?.clinic?.phone && (
                            <Button size="small" variant="outlined" component={MLink} href={`tel:${doctor.clinic.phone}`} startIcon={<PhoneIcon />} sx={{ borderRadius: 2 }}>
                              {doctor.clinic.phone}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Add your clinic address and contact details.','أضف عنوان العيادة وبيانات التواصل.')} actionLabel={t('Add location','إضافة الموقع')} onAction={() => openDlg('clinic')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={5}>
                  <SectionCard
                    id="hours"
                    icon={<AccessTimeIcon />}
                    title={t('Working Hours','ساعات العمل')}
                    rtl={isArabic}
                    action={
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openDlg('hours')}
                        sx={{ borderRadius: 2 }}
                        disabled={!user?.uid}
                      >
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {resolvedHours ? (
                      <HoursGrid hours={resolvedHours} rtl={isArabic} />
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Let patients know your weekly schedule.','عرّف المرضى على جدول عملك الأسبوعي.')} actionLabel={t('Add hours','إضافة الساعات')} onAction={() => openDlg('hours')} />
                    )}
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Education, Certifications, Memberships, Awards */}
              <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="education"
                    icon={<SchoolIcon />}
                    title={t('Education & Training','التعليم والتدريب')}
                    rtl={isArabic}
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('education')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.education) && doctor.education.length > 0 ? (
                      <Stack spacing={0.75}>
                        {doctor.education.map((e, i) => (
                          <Typography key={i} variant="body2">
                            <strong>{e?.degree}</strong>
                            {e?.school ? ` — ${e.school}` : ''}{e?.year ? ` (${e.year})` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Add your degrees and training.','أضف درجاتك وبرامج التدريب.')} actionLabel={t('Add education','إضافة التعليم')} onAction={() => openDlg('education')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="certs"
                    icon={<WorkspacePremiumIcon />}
                    title={t('Certifications & Licenses','الشهادات والتراخيص')}
                    rtl={isArabic}
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('certs')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.certifications) && doctor.certifications.length > 0 ? (
                      <Stack spacing={0.75}>
                        {doctor.certifications.map((c, i) => (
                          <Typography key={i} variant="body2">
                            <strong>{c?.title}</strong>
                            {c?.issuer ? ` — ${c.issuer}` : ''}{c?.year ? ` (${c.year})` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Show your certifications and licenses.','اعرض شهاداتك وتراخيصك.')} actionLabel={t('Add certifications','إضافة الشهادات')} onAction={() => openDlg('certs')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="memberships"
                    icon={<GroupsIcon />}
                    title={t('Memberships','العضويات')}
                    rtl={isArabic}
                    dense
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('memberships')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.memberships) && doctor.memberships.length > 0 ? (
                      <ChipGroup items={doctor.memberships} />
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('List your professional memberships.','أدرج عضوياتك المهنية.')} actionLabel={t('Add memberships','إضافة العضويات')} onAction={() => openDlg('memberships')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="awards"
                    icon={<WorkspacePremiumIcon />}
                    title={t('Awards','الجوائز')}
                    rtl={isArabic}
                    dense
                    action={
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('awards')} sx={{ borderRadius: 2 }}>
                        {t('Edit','تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.awards) && doctor.awards.length > 0 ? (
                      <Stack spacing={0.75}>
                        {doctor.awards.map((a, i) => (
                          <Typography key={i} variant="body2">
                            <strong>{a?.title}</strong>{a?.year ? ` (${a.year})` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Share notable awards to build trust.','اعرض الجوائز المميزة لتعزيز الثقة.')} actionLabel={t('Add awards','إضافة الجوائز')} onAction={() => openDlg('awards')} />
                    )}
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Online Presence */}
              <Box sx={{ mt: 1.25 }}>
                <SectionCard
                  id="links"
                  icon={<PublicIcon />}
                  title={t('Online Presence','التواجد الإلكتروني')}
                  rtl={isArabic}
                  dense
                  action={
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('links')} sx={{ borderRadius: 2 }}>
                      {t('Edit','تعديل')}
                    </Button>
                  }
                >
                  {doctor?.socials ? (
                    <SocialLinks links={doctor.socials} rtl={isArabic} />
                  ) : (
                    <EmptyPrompt rtl={isArabic} text={t('Add your website or social profiles.','أضف موقعك وروابط وسائل التواصل.')} actionLabel={t('Add links','إضافة الروابط')} onAction={() => openDlg('links')} />
                  )}
                </SectionCard>
              </Box>

              {/* Photos */}
              <Box sx={{ mt: 2 }}>
                <SectionCard
                  id="photos"
                  icon={<PhotoLibraryIcon />}
                  title={t('Photos','الصور')}
                  rtl={isArabic}
                  bleedTop
                  action={
                    <Button size="small" variant="outlined" startIcon={<AddAPhotoIcon />} onClick={() => fileInputRef.current?.click()} sx={{ borderRadius: 2 }}>
                      {t('Upload','رفع')}
                    </Button>
                  }
                >
                  {allImages.length ? (
                    <Gallery images={allImages} rtl={isArabic} avatarUrl={avatarUrl} onSetAvatar={setAvatar} />
                  ) : (
                    <EmptyPrompt
                      rtl={isArabic}
                      text={t('Add photos to showcase your clinic or work.','أضف صوراً لعرض عيادتك أو أعمالك.')}
                      actionLabel={t('Upload photo','رفع صورة')}
                      onAction={() => fileInputRef.current?.click()}
                    />
                  )}
                </SectionCard>
              </Box>
            </>
          )}

          {err && (
            <Paper sx={{ p: 2, mt: 2, borderRadius: 2 }}>
              <Typography color="error">{err}</Typography>
            </Paper>
          )}
        </Container>
      </Box>

      {/* Mount dialogs */}
      <EditOverviewDialog
        open={dlg.overview}
        onClose={() => closeDlg('overview')}
        isArabic={isArabic}
        doctor={doctor || {}}
        onSaved={fetchDoctor}
      />
      <EditServicesDialog
        open={dlg.services}
        onClose={() => closeDlg('services')}
        isArabic={isArabic}
        services={doctor?.services || []}
        onSaved={fetchDoctor}
      />
      <EditSubspecialtiesDialog
        open={dlg.subspecialties}
        onClose={() => closeDlg('subspecialties')}
        isArabic={isArabic}
        subspecialties={doctor?.subspecialties || []}
        onSaved={fetchDoctor}
      />
      <EditClinicDialog
        open={dlg.clinic}
        onClose={() => closeDlg('clinic')}
        isArabic={isArabic}
        clinic={doctor?.clinic || {}}
        onSaved={fetchDoctor}
      />
      {/* UPDATED: pass doctorUID + initialHours; remove old `hours` prop */}
      <EditHoursDialog
        open={dlg.hours}
        onClose={() => closeDlg('hours')}
        isArabic={isArabic}
        doctorUID={user?.uid}
        initialHours={resolvedHours || doctor}
        onSaved={fetchDoctor}
      />
      <EditEducationDialog
        open={dlg.education}
        onClose={() => closeDlg('education')}
        isArabic={isArabic}
        education={doctor?.education || []}
        onSaved={fetchDoctor}
      />
      <EditCertsDialog
        open={dlg.certs}
        onClose={() => closeDlg('certs')}
        isArabic={isArabic}
        certifications={doctor?.certifications || []}
        onSaved={fetchDoctor}
      />
      <EditMembershipsDialog
        open={dlg.memberships}
        onClose={() => closeDlg('memberships')}
        isArabic={isArabic}
        memberships={doctor?.memberships || []}
        onSaved={fetchDoctor}
      />
      <EditAwardsDialog
        open={dlg.awards}
        onClose={() => closeDlg('awards')}
        isArabic={isArabic}
        awards={doctor?.awards || []}
        onSaved={fetchDoctor}
      />
      <EditSocialLinksDialog
        open={dlg.links}
        onClose={() => closeDlg('links')}
        isArabic={isArabic}
        socials={doctor?.socials || {}}
        onSaved={fetchDoctor}
      />

      {/* NEW: Edit Payment Dialog */}
      <EditPaymentDialog
        open={dlg.payment}
        onClose={() => closeDlg('payment')}
        isArabic={isArabic}
        doctorUID={user?.uid}
        initial={doctor?.payment || {}}
        onSaved={fetchDoctor}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
