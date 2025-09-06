// /components/profile/EditSubspecialtiesDialog.jsx
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Chip,
  Stack,
  Box,
  IconButton,
  CircularProgress,
  Typography,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';

/* -------------------------------- helpers -------------------------------- */

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const DEFAULT_SUBSPECIALTIES = [
  { id: 'cardiology', name_en: 'Cardiology', name_ar: 'أمراض القلب' },
  { id: 'dermatology', name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' },
  { id: 'pediatrics', name_en: 'Pediatrics', name_ar: 'طب الأطفال' },
  { id: 'orthopedics', name_en: 'Orthopedics', name_ar: 'العظام' },
  { id: 'neurology', name_en: 'Neurology', name_ar: 'الأعصاب' },
  { id: 'psychiatry', name_en: 'Psychiatry', name_ar: 'الطب النفسي' },
  { id: 'ophthalmology', name_en: 'Ophthalmology', name_ar: 'العيون' },
  { id: 'ent', name_en: 'ENT', name_ar: 'أنف وأذن وحنجرة' },
  { id: 'urology', name_en: 'Urology', name_ar: 'المسالك البولية' },
  { id: 'gastroenterology', name_en: 'Gastroenterology', name_ar: 'الجهاز الهضمي' },
  { id: 'endocrinology', name_en: 'Endocrinology', name_ar: 'الغدد الصماء' },
  { id: 'pulmonology', name_en: 'Pulmonology', name_ar: 'الصدرية' },
  { id: 'nephrology', name_en: 'Nephrology', name_ar: 'الكلى' },
  { id: 'obgyn', name_en: 'Obstetrics & Gynecology', name_ar: 'النساء والتوليد' },
  { id: 'general-surgery', name_en: 'General Surgery', name_ar: 'الجراحة العامة' },
  { id: 'radiology', name_en: 'Radiology', name_ar: 'الأشعة' },
  { id: 'anesthesiology', name_en: 'Anesthesiology', name_ar: 'التخدير' },
  { id: 'oncology', name_en: 'Oncology', name_ar: 'الأورام' },
  { id: 'rheumatology', name_en: 'Rheumatology', name_ar: 'الروماتيزم' },
  { id: 'infectious-diseases', name_en: 'Infectious Diseases', name_ar: 'الأمراض المعدية' },
];

/* ------------------------------ main component ----------------------------- */
/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - doctorUID: string (required to save)
 *  - isArabic: boolean
 *  - initialSelected: string[] | {id,name_en,name_ar}[]
 *  - onSaved?: (selectedObjects: Array<{id,name_en,name_ar}>) => void
 */
export default function EditSubspecialtiesDialog({
  open,
  onClose,
  doctorUID,
  isArabic,
  initialSelected = [],
  onSaved,
}) {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [allSubs, setAllSubs] = React.useState(DEFAULT_SUBSPECIALTIES);
  const [selected, setSelected] = React.useState(new Set());

  const dir = isArabic ? 'rtl' : 'ltr';

  // Load available subspecialties (Firestore → fallback to default)
  React.useEffect(() => {
    let isMounted = true;
    if (!open) return;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const q = query(collection(db, 'subspecialties'), orderBy('name_en'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const arr = snap.docs.map((d) => {
            const data = d.data() || {};
            return {
              id: data.id || d.id || slug(data.name_en || data.name_ar || 'sub'),
              name_en: data.name_en || data.name || d.id,
              name_ar: data.name_ar || data.name || data.name_en || d.id,
            };
          });
          if (isMounted) setAllSubs(arr);
        } else if (isMounted) {
          setAllSubs(DEFAULT_SUBSPECIALTIES);
        }
      } catch (e) {
        console.warn('subspecialties fallback:', e);
        if (isMounted) setAllSubs(DEFAULT_SUBSPECIALTIES);
      } finally {
        isMounted && setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Apply initial selection on open
  React.useEffect(() => {
    if (!open) return;
    const asSet = new Set();

    const addByMatch = (token) => {
      const t = String(token || '').trim();
      if (!t) return;
      const found =
        allSubs.find(
          (s) =>
            s.id === t ||
            s.name_en.toLowerCase() === t.toLowerCase() ||
            s.name_ar === t
        ) || null;
      if (found) asSet.add(found.id);
    };

    if (Array.isArray(initialSelected)) {
      initialSelected.forEach((item) => {
        if (typeof item === 'string') addByMatch(item);
        else if (item && typeof item === 'object') addByMatch(item.id || item.name_en || item.name_ar);
      });
    }
    setSelected(asSet);
  }, [open, allSubs, initialSelected]);

  const toggle = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const removeChip = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSubs;
    return allSubs.filter(
      (s) =>
        s.name_en.toLowerCase().includes(q) ||
        String(s.name_ar).toLowerCase().includes(q)
    );
  }, [search, allSubs]);

  const selectedObjects = React.useMemo(
    () => allSubs.filter((s) => selected.has(s.id)),
    [allSubs, selected]
  );

  const handleSave = async () => {
    if (!doctorUID) {
      setError(isArabic ? 'لا يمكن الحفظ: معرّف الطبيب غير موجود.' : 'Cannot save: doctor UID missing.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const ref = doc(db, 'doctors', doctorUID);
      await updateDoc(ref, {
        subspecialties: selectedObjects.map((s) => s.id),
        subspecialties_detail: selectedObjects,
        subspecialties_en: selectedObjects.map((s) => s.name_en),
        subspecialties_ar: selectedObjects.map((s) => s.name_ar),
        updatedAt: new Date().toISOString(),
      });
      onSaved && onSaved(selectedObjects);
      onClose && onClose();
    } catch (e) {
      setError(e?.message || (isArabic ? 'تعذّر الحفظ' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      dir={dir}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'تعديل التخصصات الفرعية' : 'Edit Subspecialties'}
        </Typography>
        <IconButton onClick={onClose} disabled={saving} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {isArabic
              ? 'ابحث واختر التخصصات الفرعية المناسبة. يمكنك اختيار أكثر من تخصص.'
              : 'Search and select the subspecialties that apply. You can choose multiple.'}
          </Typography>

          {/* Selected chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedObjects.length === 0 ? (
              <Typography variant="caption" color="text.disabled">
                {isArabic ? 'لا توجد اختيارات بعد' : 'No selections yet'}
              </Typography>
            ) : (
              selectedObjects.map((s) => (
                <Chip
                  key={s.id}
                  label={isArabic ? s.name_ar : s.name_en}
                  onDelete={() => removeChip(s.id)}
                />
              ))
            )}
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isArabic ? 'ابحث عن تخصص...' : 'Search subspecialty...'}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* List */}
          <Box
            sx={{
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 2,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {loading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <List dense disablePadding>
                {filtered.map((s) => {
                  const checked = selected.has(s.id);
                  return (
                    <ListItemButton
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      sx={{ py: 1 }}
                    >
                      {/* Put checkbox near the start regardless of RTL */}
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox edge="start" checked={checked} tabIndex={-1} />
                      </ListItemIcon>
                      <ListItemText
                        primary={isArabic ? s.name_ar : s.name_en}
                        primaryTypographyProps={{ fontWeight: checked ? 700 : 500 }}
                      />
                    </ListItemButton>
                  );
                })}
                {filtered.length === 0 && (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {isArabic ? 'لا نتائج مطابقة' : 'No matching results'}
                    </Typography>
                  </Box>
                )}
              </List>
            )}
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          justifyContent: isArabic ? 'space-between' : 'flex-end',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={saving}>
          {isArabic ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {isArabic ? 'حفظ' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
