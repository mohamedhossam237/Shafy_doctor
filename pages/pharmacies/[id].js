// /pages/pharmacies/[id].js
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
  IconButton,
  Skeleton,
  Button,
  Divider,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PhoneIcon from '@mui/icons-material/Phone';
import PlaceIcon from '@mui/icons-material/Place';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

function mapMedicationData(id, data) {
  const clean = data || {};
  return {
    id,
    nameEn: clean.nameEn || clean.name || '',
    nameAr: clean.nameAr || clean.name || '',
    brand: clean.brand || '',
    form: clean.form || '', // e.g., Tablet/Syrup/Capsule
    dosage: clean.dosage || '', // e.g., 500 mg
    sku: clean.sku || clean.code || '',
    price: clean.price ?? '',
    stock: typeof clean.stock === 'number' ? clean.stock : Number(clean.stock ?? 0),
    // anything else you store:
    note: clean.note || '',
  };
}

export default function PharmacyDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  // Language: Arabic default unless explicitly set to EN
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

  const L = (en, ar) => (isArabic ? ar : en);

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [pharmacy, setPharmacy] = React.useState(null);
  const [meds, setMeds] = React.useState([]);
  const [qText, setQText] = React.useState('');
  const [inStockOnly, setInStockOnly] = React.useState(false);

  // Fetch pharmacy + medications
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // Pharmacy document
        const pSnap = await getDoc(doc(db, 'pharmacies', String(id)));
        if (!pSnap.exists()) {
          setErr(L('Pharmacy not found.', 'الصيدلية غير موجودة.'));
          setLoading(false);
          return;
        }
        const pdata = pSnap.data() || {};
        setPharmacy({
          id: pSnap.id,
          nameEn: pdata.nameEn || '',
          nameAr: pdata.nameAr || '',
          address: pdata.address || '',
          phone: pdata.phone || '',
          city: pdata.city || '',
          country: pdata.country || '',
        });

        // Prefer subcollection: pharmacies/{id}/medications
        let items = [];
        const subSnap = await getDocs(collection(db, 'pharmacies', String(id), 'medications'));
        if (!subSnap.empty) {
          items = subSnap.docs.map((d) => mapMedicationData(d.id, d.data()));
        } else {
          // Fallback: top-level medications collection with pharmacyId field
          const topSnap = await getDocs(
            query(collection(db, 'medications'), where('pharmacyId', '==', String(id)))
          );
          items = topSnap.docs.map((d) => mapMedicationData(d.id, d.data()));
        }
        setMeds(items);
      } catch (e) {
        console.error(e);
        setErr(e?.message || L('Failed to load data.', 'تعذّر تحميل البيانات.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = React.useMemo(() => {
    const t = qText.trim().toLowerCase();
    let out = meds;
    if (t) {
      out = out.filter((m) => {
        const nameMix = `${m.nameEn} ${m.nameAr}`.toLowerCase();
        const brand = (m.brand || '').toLowerCase();
        const form = (m.form || '').toLowerCase();
        const dosage = (m.dosage || '').toLowerCase();
        const sku = (m.sku || '').toLowerCase();
        return (
          nameMix.includes(t) ||
          brand.includes(t) ||
          form.includes(t) ||
          dosage.includes(t) ||
          sku.includes(t)
        );
      });
    }
    if (inStockOnly) {
      out = out.filter((m) => (Number.isFinite(m.stock) ? m.stock > 0 : true));
    }
    // Optional: sort alphabetically by localized name
    out = out.slice().sort((a, b) => {
      const an = isArabic ? (a.nameAr || a.nameEn) : (a.nameEn || a.nameAr);
      const bn = isArabic ? (b.nameAr || b.nameEn) : (b.nameEn || b.nameAr);
      return String(an).localeCompare(String(bn), isArabic ? 'ar' : undefined);
    });
    return out;
  }, [meds, qText, inStockOnly, isArabic]);

  if (!mounted) return null;

  const name = pharmacy ? (isArabic ? pharmacy.nameAr || pharmacy.nameEn : pharmacy.nameEn || pharmacy.nameAr) : '';

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
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={{ xs: 1.5, md: 2 }}>
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
                    {name || L('Pharmacy', 'الصيدلية')}
                  </Typography>
                  {pharmacy && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                      <PlaceIcon fontSize="small" />
                      <Typography variant="body2">
                        {pharmacy.address || L('No address', 'لا يوجد عنوان')}
                      </Typography>
                      {pharmacy.city && (
                        <Chip size="small" label={pharmacy.city} sx={{ ml: 1 }} />
                      )}
                    </Stack>
                  )}
                </Box>
              </Stack>

              {/* Search + toggles */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder={L('Search medications by name, brand, SKU…', 'ابحث في الأدوية بالاسم أو الماركة أو الكود…')}
                  size="small"
                  sx={{ width: { xs: '100%', md: 420 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControlLabel
                  control={<Switch checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />}
                  label={L('In stock only', 'المتوفر فقط')}
                />
                <Button
                  component={Link}
                  href={withLang('/pharmacies')}
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  sx={{ fontWeight: 800 }}
                >
                  {L('All Pharmacies', 'كل الصيدليات')}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {err && (
            <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
              <Typography color="error" fontWeight={700}>
                {L('Error', 'خطأ')}: {err}
              </Typography>
            </Paper>
          )}

          {/* Pharmacy contact quick bar */}
          {pharmacy && (
            <Paper sx={{ p: 1.25, borderRadius: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1, justifyContent: isArabic ? 'flex-start' : 'flex-end' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneIcon sx={{ color: 'text.disabled' }} />
                <Typography variant="body2">
                  {pharmacy.phone ? (
                    <Box component="a" href={`tel:${pharmacy.phone}`} sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>
                      {pharmacy.phone}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {L('No phone', 'لا يوجد هاتف')}
                    </Box>
                  )}
                </Typography>
              </Stack>
            </Paper>
          )}

          {/* Medications list */}
          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container spacing={2}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4}>
                    <Skeleton variant="rounded" height={130} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mt: 3, mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {L('Medications', 'الأدوية')}: {filtered.length}
                </Typography>
              </Stack>
              <Divider />

              {filtered.length === 0 ? (
                <Paper sx={{ p: 3, mt: 2, borderRadius: 2 }}>
                  <Typography color="text.secondary">
                    {qText
                      ? L('No medications match your search.', 'لا توجد أدوية مطابقة لبحثك.')
                      : L('No medications found for this pharmacy.', 'لا توجد أدوية لهذه الصيدلية.')}
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {filtered.map((m) => {
                    const title = isArabic ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr);
                    const subtitle = [m.brand, m.form, m.dosage].filter(Boolean).join(' • ');
                    const stockChip =
                      Number.isFinite(m.stock) ? (
                        <Chip
                          size="small"
                          label={
                            m.stock > 0
                              ? L(`In stock: ${m.stock}`, `متاح: ${m.stock}`)
                              : L('Out of stock', 'غير متوفر')
                          }
                          color={m.stock > 0 ? 'success' : 'default'}
                          variant="outlined"
                        />
                      ) : null;

                    return (
                      <Grid key={m.id} item xs={12} sm={6} md={4}>
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
                          {/* Header row: icon left, title to the right */}
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                width: 38,
                                height: 38,
                                flexShrink: 0,
                                fontWeight: 800,
                              }}
                            >
                              {title?.charAt(0)?.toUpperCase() || 'M'}
                            </Avatar>
                            <Typography
                              variant="subtitle1"
                              fontWeight={800}
                              sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}
                              title={title}
                            >
                              {title || L('Unnamed', 'بدون اسم')}
                            </Typography>
                          </Stack>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            title={subtitle}
                          >
                            {subtitle || L('No details', 'لا توجد تفاصيل')}
                          </Typography>

                          <Box sx={{ flexGrow: 1 }} />

                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            {/* SKU / Price */}
                            <Stack spacing={0.25}>
                              {m.sku ? (
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {L('SKU', 'الكود')}: {m.sku}
                                </Typography>
                              ) : null}
                              {m.price !== '' && m.price !== null && m.price !== undefined ? (
                                <Typography variant="caption" color="text.secondary">
                                  {L('Price', 'السعر')}: {m.price}
                                </Typography>
                              ) : null}
                            </Stack>

                            {/* Stock */}
                            {stockChip}
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
