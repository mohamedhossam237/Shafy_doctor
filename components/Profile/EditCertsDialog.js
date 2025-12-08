// /components/profile/EditCertsDialog.jsx
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Button,
  Stack,
  Grid,
  Paper,
  TextField,
  Tooltip,
  CircularProgress,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

/* -------------------------------- helpers -------------------------------- */

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const randId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makeBlankCert = () => ({
  id: randId(),
  title_en: '',
  title_ar: '',
  issuer: '',
  year: '',
  credentialId: '',
  url: '',
});

/** Normalize inputs from many shapes (string/object) to our shape */
function normalizeInitial(initial) {
  if (!Array.isArray(initial)) return [makeBlankCert()];
  const out = [];
  for (const item of initial) {
    if (typeof item === 'string') {
      out.push({
        ...makeBlankCert(),
        id: slug(item) || randId(),
        title_en: item,
        title_ar: item,
      });
    } else if (item && typeof item === 'object') {
      out.push({
        id: item.id || slug(item.title_en || item.title_ar) || randId(),
        title_en: item.title_en ?? item.title ?? '',
        title_ar: item.title_ar ?? item.title ?? '',
        issuer: item.issuer ?? '',
        year: String(item.year ?? '').replace(/[^\d]/g, '').slice(0, 4),
        credentialId: item.credentialId ?? item.credential_id ?? '',
        url: item.url ?? item.link ?? '',
      });
    }
  }
  return out.length ? out : [makeBlankCert()];
}

function validateCert(c, isArabic) {
  const errs = {};
  const hasTitle = (c.title_en || c.title_ar || '').trim().length > 0;
  if (!hasTitle) errs.title = isArabic ? 'العنوان مطلوب' : 'Title is required';

  if (c.year) {
    const y = parseInt(c.year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      errs.year = isArabic ? 'سنة غير صحيحة' : 'Invalid year';
    }
  }
  if (c.url) {
    const ok = /^https?:\/\//i.test(c.url);
    if (!ok) errs.url = isArabic ? 'الرابط يجب أن يبدأ بـ http(s)://' : 'URL must start with http(s)://';
  }
  return errs;
}

/* ------------------------------ main component ----------------------------- */
/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - doctorUID: string (required to save)
 *  - isArabic: boolean
 *  - initialCerts?: Array<string|object>
 *  - onSaved?: (certsArray) => void
 */
export default function EditCertsDialog({
  open,
  onClose,
  doctorUID,
  isArabic = false,
  initialCerts = [],
  onSaved,
}) {
  const dir = isArabic ? 'rtl' : 'ltr';

  // Memoize normalized props using a simple, correct dependency list
  const initialMemo = React.useMemo(
    () => normalizeInitial(initialCerts),
    [initialCerts]
  );

  const [rows, setRows] = React.useState(initialMemo);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Hydrate state ONLY when the dialog transitions from closed -> open
  const openedOnceRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !openedOnceRef.current) {
      setRows(initialMemo);
      setError('');
      openedOnceRef.current = true;
    }
    if (!open) {
      openedOnceRef.current = false; // allow re-hydration on next open
    }
  }, [open, initialMemo]);

  const updateRow = (id, patch) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const { __errs, ...rest } = r; // drop old validation on edit
        return { ...rest, ...patch };
      })
    );

  const addRow = () => {
    setError('');
    setRows((prev) => [...prev.map(({ __errs, ...r }) => r), makeBlankCert()]);
  };

  const removeRow = (id) => {
    setError('');
    setRows((prev) => {
      const cleaned = prev.map(({ __errs, ...r }) => r);
      return cleaned.length > 1 ? cleaned.filter((r) => r.id !== id) : cleaned;
    });
  };

  const copyRow = (id) =>
    setRows((prev) => {
      const cleaned = prev.map(({ __errs, ...r }) => r);
      const src = cleaned.find((r) => r.id === id);
      if (!src) return cleaned;
      const copy = { ...src, id: randId() };
      return [...cleaned, copy];
    });

  const handleSave = async () => {
    // Validate all rows
    const allErrs = rows.map((r) => validateCert(r, isArabic));
    const hasAnyErr = allErrs.some((e) => Object.keys(e).length > 0);
    if (hasAnyErr) {
      setError(isArabic ? 'من فضلك صحّح الأخطاء ثم احفظ.' : 'Please fix validation errors before saving.');
      // Attach errs to rows (one render) so the UI shows them
      setRows((prev) => prev.map((r, i) => ({ ...r, __errs: allErrs[i] })));
      return;
    }

    if (!doctorUID) {
      setError(isArabic ? 'لا يمكن الحفظ: معرّف الطبيب غير موجود.' : 'Cannot save: doctor UID missing.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const clean = rows.map(({ __errs, ...r }) => ({
        ...r,
        year: r.year ? parseInt(r.year, 10) : '',
      }));

      const ref = doc(db, 'doctors', doctorUID);
      await updateDoc(ref, {
        certificates: clean,
        certs: clean, // alias for older code paths
        updatedAt: new Date().toISOString(),
      });

      if (onSaved) onSaved(clean);
      if (onClose) onClose();
    } catch (e) {
      setError(e?.message || (isArabic ? 'تعذّر الحفظ' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" dir={dir}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'تعديل الشهادات والاعتمادات' : 'Edit Certifications & Credentials'}
        </Typography>
        <IconButton onClick={onClose} disabled={saving} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isArabic
            ? 'أضف شهاداتك: العنوان، الجهة المانحة، السنة، رقم الاعتماد ورابط التحقق.'
            : 'Add your certifications: title, issuer, year, credential ID, and verification link.'}
        </Typography>

        <Stack spacing={1.25}>
          {rows.map((row, idx) => {
            const errs = row.__errs || {};
            const labelTitle = isArabic ? 'العنوان' : 'Title';
            const labelIssuer = isArabic ? 'الجهة المانحة' : 'Issuer';
            const labelYear = isArabic ? 'السنة' : 'Year';
            const labelCredId = isArabic ? 'رقم الاعتماد' : 'Credential ID';
            const labelUrl = isArabic ? 'رابط التحقق (اختياري)' : 'Verification URL (optional)';

            return (
              <Paper key={row.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Grid container spacing={1.25} alignItems="center">
                  {/* Title (dual language) */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={`${labelTitle} (AR)`}
                      value={row.title_ar}
                      onChange={(e) => updateRow(row.id, { title_ar: e.target.value })}
                      error={Boolean(errs.title)}
                      helperText={idx === 0 && errs.title ? errs.title : ' '}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={`${labelTitle} (EN)`}
                      value={row.title_en}
                      onChange={(e) => updateRow(row.id, { title_en: e.target.value })}
                    />
                  </Grid>

                  {/* Issuer / Year */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={labelIssuer}
                      value={row.issuer}
                      onChange={(e) => updateRow(row.id, { issuer: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      label={labelYear}
                      value={row.year}
                      onChange={(e) =>
                        updateRow(row.id, { year: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })
                      }
                      error={Boolean(errs.year)}
                      helperText={errs.year ? errs.year : ' '}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      label={labelCredId}
                      value={row.credentialId}
                      onChange={(e) => updateRow(row.id, { credentialId: e.target.value })}
                    />
                  </Grid>

                  {/* URL */}
                  <Grid item xs={12} md={9}>
                    <TextField
                      fullWidth
                      label={labelUrl}
                      value={row.url}
                      onChange={(e) => updateRow(row.id, { url: e.target.value })}
                      error={Boolean(errs.url)}
                      helperText={errs.url ? errs.url : ' '}
                      placeholder="https://..."
                    />
                  </Grid>

                  {/* Row actions */}
                  <Grid
                    item
                    xs={12}
                    md={3}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isArabic ? 'flex-start' : 'flex-end',
                      gap: 1,
                    }}
                  >
                    <Tooltip title={isArabic ? 'نسخ الصف' : 'Duplicate'}>
                      <span>
                        <IconButton onClick={() => copyRow(row.id)}>
                          <ContentCopyIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isArabic ? 'حذف الصف' : 'Delete'}>
                      <span>
                        <IconButton
                          color="error"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Paper>
            );
          })}

          <Button
            onClick={addRow}
            startIcon={<AddCircleOutlineIcon />}
            sx={{ alignSelf: isArabic ? 'flex-start' : 'flex-end' }}
          >
            {isArabic ? 'إضافة شهادة' : 'Add certification'}
          </Button>
        </Stack>

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        )}
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
