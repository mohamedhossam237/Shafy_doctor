// /pages/pharmacies/index.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Skeleton,
  Button,
  Divider,
  Avatar,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PhoneIcon from '@mui/icons-material/Phone';
import PlaceIcon from '@mui/icons-material/Place';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

export default function PharmaciesPage() {
  const router = useRouter();

  // Arabic is default unless explicitly set to EN
  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) {
      setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    } else if (q.ar) {
      setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    } else {
      setIsArabic(true);
    }
  }, [router.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  // State
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [pharmacies, setPharmacies] = React.useState([]);
  const [queryText, setQueryText] = React.useState('');

  // Fetch pharmacies
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const snap = await getDocs(collection(db, 'pharmacies'));
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            nameEn: data.nameEn || '',
            nameAr: data.nameAr || '',
            address: data.address || '',
            phone: data.phone || '',
            city: data.city || '',
            country: data.country || '',
          };
        });
        setPharmacies(rows);
      } catch (e) {
        console.error(e);
        setErr(e?.message || 'Failed to load pharmacies.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const L = (en, ar) => (isArabic ? ar : en);

  // Filter by name/address/city
  const filtered = React.useMemo(() => {
    const t = queryText.trim().toLowerCase();
    if (!t) return pharmacies;
    return pharmacies.filter((p) => {
      const name = `${p.nameEn} ${p.nameAr}`.toLowerCase();
      const addr = (p.address || '').toLowerCase();
      const city = (p.city || '').toLowerCase();
      return name.includes(t) || addr.includes(t) || city.includes(t);
    });
  }, [pharmacies, queryText]);

  if (!mounted) return null;

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg" sx={{ pb: 4 }}>
          {/* Header */}
          <Paper
            sx={{
              mt: 1,
              p: { xs: 1.5, md: 2.5 },
              borderRadius: 3,
              backgroundImage: (t) => grad('#e9f3ff', '#ffffff'),
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              spacing={{ xs: 1.5, md: 2 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontWeight: 800,
                  }}
                >
                  <LocalPharmacyIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                    {L('Pharmacies', 'الصيدليات')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {L('Find and contact nearby pharmacies', 'اعثر على الصيدليات وتواصل معها')}
                  </Typography>
                </Box>
              </Stack>

              {/* Search */}
              <TextField
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder={L('Search by name or address…', 'ابحث بالاسم أو العنوان…')}
                size="small"
                sx={{ width: { xs: '100%', md: 360 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </Paper>

          {/* Error */}
          {err && (
            <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
              <Typography color="error" fontWeight={700}>
                {L('Error', 'خطأ')}: {err}
              </Typography>
            </Paper>
          )}

          {/* Content */}
          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container spacing={2}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4}>
                    <Skeleton variant="rounded" height={140} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : filtered.length === 0 ? (
            <Paper sx={{ p: 3, mt: 2, borderRadius: 2 }}>
              <Typography color="text.secondary">
                {L('No pharmacies available.', 'لا توجد صيدليات متاحة حالياً')}
              </Typography>
            </Paper>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 3, mb: 1 }}
              >
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {L('Results', 'النتائج')}: {filtered.length}
                </Typography>
                <Button
                  component={Link}
                  href={withLang('/')}
                  size="small"
                  sx={{ fontWeight: 800, alignSelf: { xs: 'stretch', sm: 'auto' } }}
                >
                  {L('Back to Dashboard', 'العودة إلى لوحة التحكم')}
                </Button>
              </Stack>
              <Divider />

              {/* Grid */}
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {filtered.map((ph) => {
                  const name = isArabic ? ph.nameAr || ph.nameEn : ph.nameEn || ph.nameAr;
                  const phone = String(ph.phone || '').trim();
                  const address = ph.address || '';
                  const mapsHref = address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                    : null;

                  return (
                    <Grid key={ph.id} item xs={12} sm={6} md={4}>
                      <Paper
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: (t) => `1px solid ${t.palette.divider}`,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          textAlign: isArabic ? 'right' : 'left',
                        }}
                      >
                        {/* Header: icon left, text aligns by language */}
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              width: 40,
                              height: 40,
                              flexShrink: 0,
                            }}
                          >
                            <LocalPharmacyIcon />
                          </Avatar>
                          <Typography
                            variant="subtitle1"
                            fontWeight={800}
                            sx={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                            }}
                            title={name}
                          >
                            {name || L('Unnamed', 'بدون اسم')}
                          </Typography>
                        </Stack>

                        {/* Address */}
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <PlaceIcon sx={{ color: 'text.disabled', mt: '2px' }} />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                            title={address}
                          >
                            {address || L('No address provided', 'لا يوجد عنوان')}
                          </Typography>
                        </Stack>

                        {/* Phone */}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PhoneIcon sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2">
                            {phone ? (
                              <Box
                                component="a"
                                href={`tel:${phone}`}
                                sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}
                              >
                                {phone}
                              </Box>
                            ) : (
                              <Box component="span" sx={{ color: 'text.secondary' }}>
                                {L('No phone', 'لا يوجد هاتف')}
                              </Box>
                            )}
                          </Typography>
                        </Stack>

                        <Box sx={{ flexGrow: 1 }} />

                        {/* Actions */}
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent={isArabic ? 'flex-start' : 'flex-end'}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            component={Link}
                            href={withLang(`/pharmacies/${ph.id}`)}
                            sx={{ borderRadius: 2 }}
                          >
                            {L('View', 'عرض')}
                          </Button>

                          {phone && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<PhoneIcon />}
                              component="a"
                              href={`tel:${phone}`}
                              sx={{ borderRadius: 2 }}
                            >
                              {L('Call', 'اتصال')}
                            </Button>
                          )}

                          {mapsHref && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<OpenInNewIcon />}
                              component="a"
                              href={mapsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ borderRadius: 2 }}
                            >
                              {L('Map', 'خريطة')}
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
