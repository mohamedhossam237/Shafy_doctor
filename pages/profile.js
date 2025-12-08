// /pages/doctor/profile.jsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  Box, Container, Stack, Typography, IconButton, Grid, Paper, Button, Avatar,
  Chip, Tooltip, Link as MLink, Skeleton, CircularProgress, Snackbar, Alert, TextField
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WorkIcon from '@mui/icons-material/Work';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import PublicIcon from '@mui/icons-material/Public';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import GroupsIcon from '@mui/icons-material/Groups';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signOut } from 'firebase/auth';

/* dialogs */
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

/* building blocks (kept) */
import SectionCard from '@/components/Profile/SectionCard';
import InfoTile from '@/components/Profile/InfoTile';
import ChipGroup from '@/components/Profile/ChipGroup';
import EmptyPrompt from '@/components/Profile/EmptyPrompt';
import HoursGrid from '@/components/Profile/HoursGrid';
import SocialLinks from '@/components/Profile/SocialLinks';
import Gallery from '@/components/Profile/Gallery';
import EditPaymentDialog from '@/components/Profile/EditPaymentDialog';
import useNormalizedClinics from '@/components/Profile/useNormalizedClinics';

export default function DoctorProfilePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(true);
  const [doctor, setDoctor] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const clinicsList = useNormalizedClinics(doctor);

  const [dlg, setDlg] = React.useState({
    overview: false, services: false, subspecialties: false, clinic: false, clinics: false,
    hours: false, education: false, certs: false, memberships: false, awards: false, links: false,
    payment: false,
  });

  const fileInputRef = React.useRef(null);
  const dropRef = React.useRef(null);

  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);
  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

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
    } catch { }
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
        try { localStorage.setItem('cachedDoctorData', JSON.stringify(fresh)); } catch { }
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

  // Clinic Management State
  const [newClinic, setNewClinic] = React.useState({ name_ar: '', address_ar: '', phone: '' });
  const [editingClinicId, setEditingClinicId] = React.useState(null);
  const [editClinic, setEditClinic] = React.useState({ name_ar: '', address_ar: '', phone: '' });
  const [hoursClinicId, setHoursClinicId] = React.useState(null);
  const [openHours, setOpenHours] = React.useState(false);

  const makeClinicId = () => `clinic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const addClinic = async () => {
    if (!newClinic.name_ar) return setSnack({ open: true, severity: 'error', msg: t('Clinic name required', 'اسم العيادة مطلوب') });
    try {
      setLoading(true);
      const clinicObj = {
        id: makeClinicId(),
        name_ar: newClinic.name_ar,
        address_ar: newClinic.address_ar,
        phone: newClinic.phone,
        active: true,
        working_hours: null,
      };
      const updatedClinics = [...(doctor?.clinics || []), clinicObj];
      await updateDoc(doc(db, 'doctors', user.uid), { clinics: updatedClinics });
      await fetchDoctor();
      setNewClinic({ name_ar: '', address_ar: '', phone: '' });
      setSnack({ open: true, severity: 'success', msg: t('Clinic added', 'تم إضافة العيادة') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to add clinic', 'فشل إضافة العيادة') });
    } finally {
      setLoading(false);
    }
  };

  const deleteClinic = async (clinic) => {
    if (!confirm(t('Delete this clinic?', 'هل أنت متأكد من حذف العيادة؟'))) return;
    try {
      setLoading(true);
      const updatedClinics = (doctor?.clinics || []).filter((c) => c.id !== clinic.id);
      await updateDoc(doc(db, 'doctors', user.uid), { clinics: updatedClinics });
      await fetchDoctor();
      setSnack({ open: true, severity: 'success', msg: t('Clinic deleted', 'تم حذف العيادة') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to delete', 'فشل الحذف') });
    } finally {
      setLoading(false);
    }
  };

  const toggleClinicActive = async (clinic) => {
    try {
      const updatedClinics = (doctor?.clinics || []).map((c) =>
        c.id === clinic.id ? { ...c, active: !c.active } : c
      );
      await updateDoc(doc(db, 'doctors', user.uid), { clinics: updatedClinics });
      await fetchDoctor(); // Refresh to show update
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Update failed', 'فشل التحديث') });
    }
  };

  const startEditClinic = (clinic) => {
    setEditClinic({
      name_ar: clinic.name_ar || '',
      address_ar: clinic.address_ar || '',
      phone: clinic.phone || '',
    });
    setEditingClinicId(clinic.id);
  };

  const cancelEditClinic = () => {
    setEditingClinicId(null);
    setEditClinic({ name_ar: '', address_ar: '', phone: '' });
  };

  const saveEditClinic = async (clinic) => {
    try {
      setLoading(true);
      const updatedClinics = (doctor?.clinics || []).map((c) =>
        c.id === clinic.id ? { ...c, ...editClinic } : c
      );
      await updateDoc(doc(db, 'doctors', user.uid), { clinics: updatedClinics });
      await fetchDoctor();
      setEditingClinicId(null);
      setSnack({ open: true, severity: 'success', msg: t('Clinic updated', 'تم تحديث العيادة') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Update failed', 'فشل التحديث') });
    } finally {
      setLoading(false);
    }
  };

  const openHoursForClinic = (clinic) => {
    setHoursClinicId(clinic.id);
    setOpenHours(true);
  };

  const handleHoursSaved = async (obj) => {
    try {
      setLoading(true);
      const updatedClinics = (doctor?.clinics || []).map((c) =>
        c.id === hoursClinicId ? { ...c, working_hours: obj || {} } : c
      );
      await updateDoc(doc(db, 'doctors', user.uid), { clinics: updatedClinics });
      await fetchDoctor();
      setOpenHours(false);
      setHoursClinicId(null);
      setSnack({ open: true, severity: 'success', msg: t('Hours updated', 'تم تحديث الساعات') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Update failed', 'فشل التحديث') });
    } finally {
      setLoading(false);
    }
  };

  const extras = React.useMemo(
    () => (Array.isArray(doctor?.profileImages) ? doctor.profileImages.filter(Boolean) : []),
    [doctor]
  );
  const avatarUrl = React.useMemo(() => (doctor?.profileImage || extras[0] || ''), [doctor, extras]);
  const allImages = React.useMemo(() => {
    const set = new Set(extras);
    if (doctor?.profileImage) set.add(doctor.profileImage);
    return Array.from(set);
  }, [doctor, extras]);

  const resolvedHours = React.useMemo(() => (
    doctor?.clinic?.workingHours ||
    doctor?.clinic?.working_hours ||
    doctor?.workingHours ||
    doctor?.working_hours ||
    doctor?.hours || null
  ), [doctor]);

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

  const navItems = [
    { id: 'overview', label: t('Overview', 'نظرة عامة'), icon: <PersonIcon /> },
    { id: 'payment', label: t('Payment', 'الدفع'), icon: <MonetizationOnIcon /> },
    { id: 'services', label: t('Services', 'الخدمات'), icon: <MedicalServicesIcon /> },
    { id: 'subspecialties', label: t('Subspecialties', 'التخصصات الفرعية'), icon: <LocalHospitalIcon /> },
    { id: 'clinic', label: t('Clinics', 'العيادات'), icon: <PlaceIcon /> },
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

  /* Small field tile used in Payment section (clean card with icon) */
  const FieldTile = ({ icon, title, value, actions, muted }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(255,255,255,0.5)',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.9)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2.5,
          display: 'grid', placeItems: 'center',
          bgcolor: 'primary.50',
          color: 'primary.main',
          flexShrink: 0,
        }}
      >
        <Box>{icon}</Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{ fontWeight: 800, ...(muted ? { color: 'text.disabled' } : { color: 'text.primary' }) }}
          noWrap
        >
          {value || '—'}
        </Typography>
      </Box>
      {actions}
    </Paper>
  );

  return (
    <AppLayout>
      <Box dir={dir} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container maxWidth="md" sx={{ pt: 2 }}>
          {/* Header */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 5,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              boxShadow: '0 20px 40px -10px rgba(25, 118, 210, 0.4)',
              mb: 3,
              '&:before': {
                content: '""',
                position: 'absolute',
                top: -100,
                right: -100,
                width: 400,
                height: 400,
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              },
            }}
          >
            {loading ? (
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={3} alignItems="center" justifyContent="space-between">
                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={3} alignItems="center">
                  <Skeleton variant="circular" width={120} height={120} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Skeleton variant="text" width={240} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                    <Skeleton variant="text" width={160} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                  </Box>
                </Stack>
                <Skeleton variant="rounded" width={120} height={48} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
              </Stack>
            ) : (
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={3} alignItems="center" justifyContent="space-between">
                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={3} alignItems="center" sx={{ position: 'relative' }}>
                  <Avatar
                    src={avatarUrl || undefined}
                    alt="Profile"
                    sx={{
                      width: 120, height: 120,
                      bgcolor: 'white', color: 'primary.main',
                      fontWeight: 900,
                      border: '4px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                      fontSize: '2.5rem',
                    }}
                  >
                    Dr
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h3" fontWeight={900} noWrap
                      title={doctor ? (isArabic ? doctor?.name_ar : doctor?.name_en) : ''}
                      sx={{
                        fontSize: { xs: '1.75rem', md: '2.5rem' },
                        mb: 0.5,
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {doctor ? (isArabic ? doctor?.name_ar : doctor?.name_en) : t('Doctor', 'الطبيب')}
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 500 }} noWrap>
                      {doctor ? (isArabic ? doctor?.specialty_ar : doctor?.specialty_en) : '—'}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5}>
                  <Tooltip title={t('Refresh', 'تحديث')}>
                    <IconButton onClick={fetchDoctor} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openDlg('overview')}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.4)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', borderColor: 'white' }
                    }}
                  >
                    {t('Edit', 'تعديل')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PublicIcon />}
                    onClick={() => router.push(withLang('/doctor/details'))}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      borderRadius: 3,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      '&:hover': { bgcolor: 'grey.50' }
                    }}
                  >
                    {t('Details', 'التفاصيل')}
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* Sticky inline pill navigation */}
            <Box
              sx={{
                mt: 4,
                display: 'flex',
                gap: 1.5,
                overflowX: 'auto',
                pb: 1,
                flexDirection: isArabic ? 'row-reverse' : 'row',
                position: 'sticky',
                top: 8,
                zIndex: 1,
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  startIcon={item.icon}
                  onClick={() => {
                    const el = document.getElementById(item.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'white',
                      color: 'primary.main',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          </Paper>

          {/* Upload bar */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 4,
              mt: 3,
              border: "1px solid rgba(255, 255, 255, 0.6)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.05)",
            }}
          >
            <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" justifyContent="space-between" spacing={2}>
              <Typography variant="subtitle1" color="text.primary" fontWeight={800}>
                {t('Manage Profile', 'إدارة الملف الشخصي')}
              </Typography>
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.5}>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onSelectedFile} multiple />
                <Button
                  startIcon={<AddAPhotoIcon />}
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    borderRadius: 3,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.50' }
                  }}
                >
                  {t('Upload Photos', 'رفع صور')}
                </Button>
                <Button
                  startIcon={<LogoutIcon />}
                  variant="contained"
                  color="error"
                  onClick={doLogout}
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 4px 12px rgba(211, 47, 47, 0.2)',
                    '&:hover': { boxShadow: '0 6px 16px rgba(211, 47, 47, 0.3)' }
                  }}
                >
                  {t('Logout', 'تسجيل الخروج')}
                </Button>
              </Stack>
            </Stack>

            <Box
              ref={dropRef}
              sx={{
                mt: 2,
                p: 3,
                borderRadius: 3,
                border: (t) => `2px dashed ${t.palette.divider}`,
                textAlign: 'center',
                transition: 'all 0.2s ease',
                bgcolor: 'rgba(255,255,255,0.5)',
                '&[data-hover="1"]': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  transform: 'scale(1.01)'
                },
              }}
            >
              <Stack alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1
                  }}
                >
                  <UploadFileIcon fontSize="large" />
                </Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {t('Drag & drop images here, or click “Upload Photos”.', 'اسحب وأفلت الصور هنا أو اضغط "رفع صور".')}
                </Typography>
              </Stack>
            </Box>
          </Paper>

          {/* Content */}
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>
          ) : !doctor ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                mt: 3,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.5)',
                textAlign: 'center'
              }}
            >
              <Typography color="text.secondary" fontWeight={500}>{t('No data found', 'لا توجد بيانات')}</Typography>
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
                      <InfoTile icon={<WorkIcon />} title={t('Experience', 'سنوات الخبرة')} value={doctor?.experienceYears != null ? `${doctor.experienceYears} ${t('years', 'سنوات')}` : ''} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<MonetizationOnIcon />} title={t('Checkup Price', 'سعر الكشف')} value={doctor?.checkupPrice != null ? `${doctor.checkupPrice} ${t('EGP', 'جنيه')}` : ''} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<MonetizationOnIcon />} title={t('Follow-up Price', 'سعر المتابعة')} value={doctor?.followUpPrice != null ? `${doctor.followUpPrice} ${t('EGP', 'جنيه')}` : ''} rtl={isArabic} />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <InfoTile icon={<PhoneIcon />} title={t('Phone', 'رقم الهاتف')} value={doctor?.phone} rtl={isArabic} />
                    </Grid>
                  </Grid>
                </SectionCard>
              </Box>

              {/* Payment */}
              <Box sx={{ mt: 1.25 }}>
                <SectionCard
                  id="payment"
                  icon={<MonetizationOnIcon />}
                  title={t('Payment for Bookings', 'بيانات الدفع للحجوزات')}
                  rtl={isArabic}
                  action={
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('payment')} sx={{ borderRadius: 2 }}>
                      {t('Edit', 'تعديل')}
                    </Button>
                  }
                >
                  {doctor?.payment ? (
                    <Stack spacing={1.25}>
                      {/* small meta chips */}
                      <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} useFlexGap flexWrap="wrap">
                        <Chip label={`${t('Type', 'النوع')}: ${doctor.payment.type === 'wallet' ? t('Wallet', 'محفظة') : 'InstaPay'}`} />
                        {doctor.payment.walletProvider && (
                          <Chip label={`${t('Provider', 'المزوّد')}: ${{
                            vodafone: t('Vodafone Cash', 'فودافون كاش'),
                            etisalat: t('Etisalat Cash', 'اتصالات كاش'),
                            orange: t('Orange Money', 'أورنج موني'),
                            we: t('WE Pay', 'وي باي')
                          }[doctor.payment.walletProvider] || doctor.payment.walletProvider
                            }`} />
                        )}
                        {doctor.payment.bankName && <Chip label={`${t('Bank', 'البنك')}: ${doctor.payment.bankName}`} />}
                      </Stack>

                      {/* tiles row */}
                      <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                        <Grid item xs={12} md={6}>
                          <FieldTile
                            icon={<PublicIcon />}
                            title={t('InstaPay ID', 'معرّف إنستا باي')}
                            value={doctor.payment.instapayId}
                            muted={!doctor.payment.instapayId}
                            actions={
                              doctor.payment.instapayId ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => copy(doctor.payment.instapayId)}
                                  sx={{ borderRadius: 2 }}
                                >
                                  {t('Copy', 'نسخ')}
                                </Button>
                              ) : null
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FieldTile
                            icon={<PhoneIcon />}
                            title={t('InstaPay Mobile', 'موبايل إنستا باي')}
                            value={doctor.payment.instapayMobile}
                            muted={!doctor.payment.instapayMobile}
                            actions={
                              doctor.payment.instapayMobile ? (
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component={MLink}
                                    href={`tel:${doctor.payment.instapayMobile}`}
                                    startIcon={<PhoneIcon />}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {t('Call', 'اتصال')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={() => copy(doctor.payment.instapayMobile)}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {t('Copy', 'نسخ')}
                                  </Button>
                                </Stack>
                              ) : null
                            }
                          />
                        </Grid>

                        {doctor.payment.type === 'wallet' && (
                          <Grid item xs={12} md={6}>
                            <FieldTile
                              icon={<PhoneIcon />}
                              title={t('Wallet Number', 'رقم المحفظة')}
                              value={doctor.payment.walletNumber}
                              muted={!doctor.payment.walletNumber}
                              actions={
                                doctor.payment.walletNumber ? (
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component={MLink}
                                      href={`tel:${doctor.payment.walletNumber}`}
                                      startIcon={<PhoneIcon />}
                                      sx={{ borderRadius: 2 }}
                                    >
                                      {t('Call', 'اتصال')}
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<ContentCopyIcon />}
                                      onClick={() => copy(doctor.payment.walletNumber)}
                                      sx={{ borderRadius: 2 }}
                                    >
                                      {t('Copy', 'نسخ')}
                                    </Button>
                                  </Stack>
                                ) : null
                              }
                            />
                          </Grid>
                        )}

                        {doctor.payment.notes && (
                          <Grid item xs={12}>
                            <FieldTile
                              icon={<MonetizationOnIcon />}
                              title={t('Notes', 'ملاحظات')}
                              value={doctor.payment.notes}
                            />
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  ) : (
                    <EmptyPrompt
                      rtl={isArabic}
                      text={t('Add payment details (InstaPay or Wallet) so patients can transfer the fee and upload receipt.',
                        'أضف بيانات الدفع (إنستا باي أو محفظة) ليتمكن المرضى من التحويل ورفع إيصال.')}
                      actionLabel={t('Add payment', 'إضافة الدفع')}
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
                    title={t('Services Offered', 'الخدمات المقدمة')}
                    rtl={isArabic}
                    action={
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openDlg('services')}
                        sx={{ borderRadius: 2 }}
                      >
                        {t('Edit', 'تعديل')}
                      </Button>
                    }
                  >
                    {(() => {
                      // Prefer structured extraServices; fallback to legacy "services" (strings)
                      const structured = Array.isArray(doctor?.extraServices) ? doctor.extraServices.filter(Boolean) : [];
                      const legacy = Array.isArray(doctor?.services) ? doctor.services.filter(Boolean) : [];

                      if (structured.length > 0) {
                        return (
                          <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} useFlexGap flexWrap="wrap">
                            {structured.map((e) => (
                              <Stack key={e.id || e.name_ar} direction="row" spacing={0.75} alignItems="center">
                                <Chip label={e.name_ar || '—'} sx={{ fontWeight: 800 }} />
                                <Chip label={`${Number(e.price || 0)} ${t('EGP', 'ج.م')}`} />
                              </Stack>
                            ))}
                          </Stack>
                        );
                      }

                      if (legacy.length > 0) {
                        // display legacy list without prices
                        return <ChipGroup items={legacy} />;
                      }

                      return (
                        <EmptyPrompt
                          rtl={isArabic}
                          text={t('List procedures or services you offer.', 'أضف الإجراءات أو الخدمات التي تقدمها.')}
                          actionLabel={t('Add services', 'إضافة خدمات')}
                          onAction={() => openDlg('services')}
                        />
                      );
                    })()}
                  </SectionCard>
                </Grid>

                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="subspecialties"
                    icon={<LocalHospitalIcon />}
                    title={t('Subspecialties', 'التخصصات الفرعية')}
                    rtl={isArabic}
                    action={
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openDlg('subspecialties')}
                        sx={{ borderRadius: 2 }}
                      >
                        {t('Edit', 'تعديل')}
                      </Button>
                    }
                  >
                    {Array.isArray(doctor?.subspecialties) && doctor.subspecialties.length > 0 ? (
                      <ChipGroup items={doctor.subspecialties} />
                    ) : (
                      <EmptyPrompt
                        rtl={isArabic}
                        text={t('Show your subspecialties to help patients find you.', 'اعرض تخصصاتك الفرعية لمساعدة المرضى.')}
                        actionLabel={t('Add subspecialties', 'إضافة تخصصات')}
                        onAction={() => openDlg('subspecialties')}
                      />
                    )}
                  </SectionCard>
                </Grid>
              </Grid>


              {/* Clinics & Hours */}
              {/* Clinics Management */}
              <Box sx={{ mt: 2 }}>
                <SectionCard
                  id="clinic"
                  icon={<PlaceIcon />}
                  title={t('Clinics', 'العيادات')}
                  rtl={isArabic}
                >
                  {/* Add Clinic Form */}
                  <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label={t('Clinic Name', 'اسم العيادة')}
                          value={newClinic.name_ar}
                          onChange={(e) => setNewClinic((c) => ({ ...c, name_ar: e.target.value }))}
                          fullWidth size="small"
                        />
                      </Grid>
                      <Grid item xs={12} md={5}>
                        <TextField
                          label={t('Address', 'العنوان')}
                          value={newClinic.address_ar}
                          onChange={(e) => setNewClinic((c) => ({ ...c, address_ar: e.target.value }))}
                          fullWidth size="small"
                        />
                      </Grid>
                      <Grid item xs={7} md={2}>
                        <TextField
                          label={t('Phone', 'هاتف العيادة')}
                          value={newClinic.phone}
                          onChange={(e) => setNewClinic((c) => ({ ...c, phone: e.target.value }))}
                          fullWidth size="small"
                        />
                      </Grid>
                      <Grid item xs={5} md={1} sx={{ display: 'flex', alignItems: 'stretch' }}>
                        <Button
                          onClick={addClinic}
                          variant="contained"
                          sx={{ borderRadius: 2, width: '100%' }}
                          disabled={!user?.uid}
                        >
                          {t('Add', 'إضافة')}
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Clinics List */}
                  <Stack spacing={1.25}>
                    {clinicsList.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" align="center">
                        {t('No clinics yet.', 'لا توجد عيادات بعد.')}
                      </Typography>
                    ) : (
                      clinicsList.map((c) => {
                        const editing = editingClinicId === c.id;
                        return (
                          <Paper
                            key={c.id}
                            elevation={0}
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              bgcolor: 'rgba(255,255,255,0.6)',
                              border: '1px solid rgba(255,255,255,0.5)',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.9)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                              }
                            }}
                          >
                            {editing ? (
                              <Grid container spacing={1} alignItems="center">
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    label={t('Clinic Name', 'اسم العيادة')}
                                    value={editClinic.name_ar}
                                    onChange={(e) => setEditClinic((v) => ({ ...v, name_ar: e.target.value }))}
                                    fullWidth size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    label={t('Address', 'العنوان')}
                                    value={editClinic.address_ar}
                                    onChange={(e) => setEditClinic((v) => ({ ...v, address_ar: e.target.value }))}
                                    fullWidth size="small"
                                  />
                                </Grid>
                                <Grid item xs={7} md={2}>
                                  <TextField
                                    label={t('Phone', 'هاتف العيادة')}
                                    value={editClinic.phone}
                                    onChange={(e) => setEditClinic((v) => ({ ...v, phone: e.target.value }))}
                                    fullWidth size="small"
                                  />
                                </Grid>
                                <Grid item xs={5} md={1}>
                                  <Stack direction="row" spacing={1}>
                                    <Button size="small" variant="contained" onClick={() => saveEditClinic(c)}>{t('Save', 'حفظ')}</Button>
                                    <Button size="small" onClick={cancelEditClinic}>{t('Cancel', 'إلغاء')}</Button>
                                  </Stack>
                                </Grid>
                              </Grid>
                            ) : (
                              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} alignItems="center" justifyContent="space-between">
                                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                  <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                    <Typography variant="subtitle1" fontWeight={800} color="primary.main" sx={{ maxWidth: { xs: '100%', md: 400 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {c.name_ar || '—'}
                                    </Typography>
                                    <Chip
                                      label={c.active ? t('Active', 'مفعل') : t('Inactive', 'موقوف')}
                                      size="small"
                                      color={c.active ? 'success' : 'default'}
                                      sx={{ fontWeight: 700 }}
                                    />
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary">
                                    {c.address_ar || '—'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {t('Phone', 'هاتف')}: {c.phone || '—'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {c.working_hours ? t('Working hours set', 'تم ضبط ساعات العمل') : t('No hours yet', 'لا توجد ساعات بعد')}
                                  </Typography>
                                </Stack>
                                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={0.5}>
                                  <Tooltip title={t('Edit Hours', 'تعديل ساعات العمل')}>
                                    <IconButton onClick={() => openHoursForClinic(c)}>
                                      <AccessTimeIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('Toggle Status', 'تبديل الحالة')}>
                                    <IconButton onClick={() => toggleClinicActive(c)}>
                                      {c.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('Edit', 'تعديل')}>
                                    <IconButton onClick={() => startEditClinic(c)}>
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('Delete', 'حذف')}>
                                    <IconButton onClick={() => deleteClinic(c)}>
                                      <DeleteOutlineIcon color="error" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            )}
                          </Paper>
                        );
                      })
                    )}
                  </Stack>
                </SectionCard>
              </Box>

              {/* Education, Certs, Memberships, Awards */}
              <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="education"
                    icon={<SchoolIcon />}
                    title={t('Education & Training', 'التعليم والتدريب')}
                    rtl={isArabic}
                    action={<Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('education')} sx={{ borderRadius: 2 }}>{t('Edit', 'تعديل')}</Button>}
                  >
                    {Array.isArray(doctor?.education) && doctor.education.length > 0 ? (
                      <Stack spacing={0.75}>
                        {doctor.education.map((e, i) => (
                          <Typography key={i} variant="body2">
                            <strong>{e?.degree}</strong>{e?.school ? ` — ${e.school}` : ''}{e?.year ? ` (${e.year})` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Add your degrees and training.', 'أضف درجاتك وبرامج التدريب.')} actionLabel={t('Add education', 'إضافة التعليم')} onAction={() => openDlg('education')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="certs"
                    icon={<WorkspacePremiumIcon />}
                    title={t('Certifications & Licenses', 'الشهادات والتراخيص')}
                    rtl={isArabic}
                    action={<Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('certs')} sx={{ borderRadius: 2 }}>{t('Edit', 'تعديل')}</Button>}
                  >
                    {Array.isArray(doctor?.certifications) && doctor.certifications.length > 0 ? (
                      <Stack spacing={0.75}>
                        {doctor.certifications.map((c, i) => (
                          <Typography key={i} variant="body2">
                            <strong>{c?.title}</strong>{c?.issuer ? ` — ${c.issuer}` : ''}{c?.year ? ` (${c.year})` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('Show your certifications and licenses.', 'اعرض شهاداتك وتراخيصك.')} actionLabel={t('Add certifications', 'إضافة الشهادات')} onAction={() => openDlg('certs')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="memberships"
                    icon={<GroupsIcon />}
                    title={t('Memberships', 'العضويات')}
                    rtl={isArabic}
                    dense
                    action={<Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('memberships')} sx={{ borderRadius: 2 }}>{t('Edit', 'تعديل')}</Button>}
                  >
                    {Array.isArray(doctor?.memberships) && doctor.memberships.length > 0 ? (
                      <ChipGroup items={doctor.memberships} />
                    ) : (
                      <EmptyPrompt rtl={isArabic} text={t('List your professional memberships.', 'أدرج عضوياتك المهنية.')} actionLabel={t('Add memberships', 'إضافة العضويات')} onAction={() => openDlg('memberships')} />
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard
                    id="awards"
                    icon={<WorkspacePremiumIcon />}
                    title={t('Awards', 'الجوائز')}
                    rtl={isArabic}
                    dense
                    action={<Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('awards')} sx={{ borderRadius: 2 }}>{t('Edit', 'تعديل')}</Button>}
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
                      <EmptyPrompt rtl={isArabic} text={t('Share notable awards to build trust.', 'اعرض الجوائز المميزة لتعزيز الثقة.')} actionLabel={t('Add awards', 'إضافة الجوائز')} onAction={() => openDlg('awards')} />
                    )}
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Online Presence */}
              <Box sx={{ mt: 1.25 }}>
                <SectionCard
                  id="links"
                  icon={<PublicIcon />}
                  title={t('Online Presence', 'التواجد الإلكتروني')}
                  rtl={isArabic}
                  dense
                  action={<Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openDlg('links')} sx={{ borderRadius: 2 }}>{t('Edit', 'تعديل')}</Button>}
                >
                  {doctor?.socials ? (
                    <SocialLinks links={doctor.socials} rtl={isArabic} />
                  ) : (
                    <EmptyPrompt rtl={isArabic} text={t('Add your website or social profiles.', 'أضف موقعك وروابط وسائل التواصل.')} actionLabel={t('Add links', 'إضافة الروابط')} onAction={() => openDlg('links')} />
                  )}
                </SectionCard>
              </Box>

              {/* Photos */}
              <Box sx={{ mt: 2 }}>
                <SectionCard
                  id="photos"
                  icon={<PhotoLibraryIcon />}
                  title={t('Photos', 'الصور')}
                  rtl={isArabic}
                  bleedTop
                  action={<Button size="small" variant="outlined" startIcon={<AddAPhotoIcon />} onClick={() => fileInputRef.current?.click()} sx={{ borderRadius: 2 }}>{t('Upload', 'رفع')}</Button>}
                >
                  {allImages.length ? (
                    <Gallery images={allImages} rtl={isArabic} avatarUrl={avatarUrl} onSetAvatar={setAvatar} />
                  ) : (
                    <EmptyPrompt
                      rtl={isArabic}
                      text={t('Add photos to showcase your clinic or work.', 'أضف صوراً لعرض عيادتك أو أعمالك.')}
                      actionLabel={t('Upload photo', 'رفع صورة')}
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

      {/* Dialogs */}
      <EditOverviewDialog open={dlg.overview} onClose={() => closeDlg('overview')} isArabic={isArabic} doctor={doctor || {}} onSaved={fetchDoctor} />
      <EditServicesDialog
        open={dlg.services}
        onClose={() => closeDlg('services')}
        isArabic={isArabic}
        services={doctor?.extraServices || doctor?.services || []}
        onSaved={fetchDoctor}
      />
      <EditSubspecialtiesDialog open={dlg.subspecialties} onClose={() => closeDlg('subspecialties')} isArabic={isArabic} subspecialties={doctor?.subspecialties || []} onSaved={fetchDoctor} />
      <EditClinicDialog open={dlg.clinic} onClose={() => closeDlg('clinic')} isArabic={isArabic} onSaved={fetchDoctor} />
      <EditHoursDialog
        open={openHours}
        onClose={() => { setOpenHours(false); setHoursClinicId(null); }}
        isArabic={isArabic}
        doctorUID={user?.uid}
        initialHours={clinicsList.find(c => c.id === hoursClinicId)?.working_hours || null}
        onSaved={handleHoursSaved}
        skipDirectSave={true}
      />
      <EditEducationDialog open={dlg.education} onClose={() => closeDlg('education')} isArabic={isArabic} education={doctor?.education || []} onSaved={fetchDoctor} />
      <EditCertsDialog open={dlg.certs} onClose={() => closeDlg('certs')} isArabic={isArabic} certifications={doctor?.certifications || []} onSaved={fetchDoctor} />
      <EditMembershipsDialog open={dlg.memberships} onClose={() => closeDlg('memberships')} isArabic={isArabic} memberships={doctor?.memberships || []} onSaved={fetchDoctor} />
      <EditAwardsDialog open={dlg.awards} onClose={() => closeDlg('awards')} isArabic={isArabic} awards={doctor?.awards || []} onSaved={fetchDoctor} />
      <EditSocialLinksDialog open={dlg.links} onClose={() => closeDlg('links')} isArabic={isArabic} socials={doctor?.socials || {}} onSaved={fetchDoctor} />
      <EditPaymentDialog open={dlg.payment} onClose={() => closeDlg('payment')} isArabic={isArabic} doctorUID={user?.uid} initial={doctor?.payment || {}} onSaved={fetchDoctor} />

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
