'use client';
import * as React from 'react';
import {
  Grid,
  TextField,
  CircularProgress,
  Chip,
  Stack,
  Box,
  Typography,
  Paper,
  Fade,
} from '@mui/material';
import HealingIcon from '@mui/icons-material/Healing';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SectionWrapper from './SectionWrapper';
import { useAuth } from '@/providers/AuthProvider';

/**
 * 🧠 ClinicalSection — AI-Enhanced Clinical Input Fields
 * Beautifully designed with smart AI suggestions for medical text.
 */
export default function ClinicalSection({
  t,
  form,
  setForm,
  errors,
  imgbbURL,
  doctorSpecialty = '',
  lang = 'en',
}) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState({ field: '', items: [] });

  const debounceRef = React.useRef();
  const debounce = (fn, delay = 600) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  };

  const onChange = (key) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    if (['diagnosis', 'findings', 'procedures', 'chiefComplaint'].includes(key)) {
      debounce(() => fetchSuggestions(key, val), 600);
    }
  };

  async function fetchSuggestions(field, text) {
    if (!text || text.length < 3)
      return setSuggestions({ field: '', items: [] });
    setLoading(true);
    try {
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `Suggest relevant ${field} terms or ICD/CPT-like phrases for "${text}" in a ${doctorSpecialty} context. Return a JSON array of short suggestions.`,
          lang,
          enable_rag: false,
          use_server_context: false,
        }),
      });

      const data = await res.json();
      const raw = data?.text || '';
      let parsed = [];

      try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) parsed = j;
        else if (typeof j === 'object') parsed = Object.values(j);
        else if (typeof j === 'string') parsed = j.split(/[\n,]+/);
      } catch {
        parsed =
          raw
            ?.split(/[\n,]+/)
            ?.map((x) => x.trim())
            ?.filter((x) => x.length > 1) || [];
      }

      if (!Array.isArray(parsed)) parsed = [];
      setSuggestions({ field, items: parsed.slice(0, 8) });
    } catch (err) {
      console.error('AI suggest error:', err);
      setSuggestions({ field: '', items: [] });
    } finally {
      setLoading(false);
    }
  }

  const insertSuggestion = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setSuggestions({ field: '', items: [] });
  };

  const renderSuggestChips = (field) =>
    suggestions.field === field && suggestions.items.length > 0 ? (
      <Fade in timeout={400}>
        <Paper
          elevation={2}
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 3,
            bgcolor: '#f9fafb',
            border: '1px solid #e0e0e0',
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            alignItems="center"
          >
            <AutoAwesomeIcon
              fontSize="small"
              sx={{ color: '#8a4baf', opacity: 0.8 }}
            />
            {suggestions.items.map((s, i) => (
              <Chip
                key={i}
                label={s}
                onClick={() => insertSuggestion(field, s)}
                variant="outlined"
                sx={{
                  borderColor: '#8a4baf',
                  color: '#8a4baf',
                  fontWeight: 500,
                  borderRadius: '16px',
                  '&:hover': {
                    bgcolor: '#8a4baf',
                    color: '#fff',
                    borderColor: '#8a4baf',
                  },
                }}
              />
            ))}
          </Stack>
        </Paper>
      </Fade>
    ) : null;

  return (
    <SectionWrapper
      icon={<HealingIcon fontSize="small" />}
      title={t(
        'Clinical Details (optional if image attached)',
        'التفاصيل السريرية (اختياري عند إرفاق صورة)'
      )}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: '#fff',
          boxShadow: '0 3px 8px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
        }}
      >
        <Grid container spacing={2}>
          {/* Chief Complaint */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
              }}
            >
              <TextField
                label={t('Chief Complaint', 'الشكوى الرئيسية')}
                fullWidth
                value={form.chiefComplaint}
                onChange={onChange('chiefComplaint')}
                inputProps={{ maxLength: 160 }}
                helperText={`${form.chiefComplaint.length}/160`}
              />
              {loading && suggestions.field === 'chiefComplaint' && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <CircularProgress size={18} />
                </Box>
              )}
              {renderSuggestChips('chiefComplaint')}
            </Paper>
          </Grid>

          {/* Diagnosis */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
              }}
            >
              <TextField
                label={`${t(
                  'Diagnosis (ICD if available)',
                  'التشخيص (إن وُجد ICD)'
                )}${!imgbbURL ? ' *' : ''}`}
                fullWidth
                required={!imgbbURL}
                value={form.diagnosis}
                onChange={onChange('diagnosis')}
                error={!imgbbURL && Boolean(errors.diagnosis)}
                helperText={
                  !imgbbURL && errors.diagnosis
                    ? t(
                        'Diagnosis is required (or attach an image)',
                        'التشخيص مطلوب (أو أرفق صورة)'
                      )
                    : `${form.diagnosis.length}/200`
                }
                inputProps={{ maxLength: 200 }}
              />
              {loading && suggestions.field === 'diagnosis' && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <CircularProgress size={18} />
                </Box>
              )}
              {renderSuggestChips('diagnosis')}
            </Paper>
          </Grid>

          {/* Findings */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
              }}
            >
              <TextField
                label={t('Findings / Examination', 'النتائج / الفحص')}
                fullWidth
                multiline
                minRows={3}
                value={form.findings}
                onChange={onChange('findings')}
                inputProps={{ maxLength: 800 }}
                helperText={`${form.findings.length}/800`}
              />
              {loading && suggestions.field === 'findings' && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <CircularProgress size={18} />
                </Box>
              )}
              {renderSuggestChips('findings')}
            </Paper>
          </Grid>

          {/* Procedures */}
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
              }}
            >
              <TextField
                label={t(
                  'Procedures (CPT if available)',
                  'الإجراءات (إن وُجد CPT)'
                )}
                fullWidth
                multiline
                minRows={3}
                value={form.procedures}
                onChange={onChange('procedures')}
                inputProps={{ maxLength: 600 }}
                helperText={`${form.procedures.length}/600`}
              />
              {loading && suggestions.field === 'procedures' && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <CircularProgress size={18} />
                </Box>
              )}
              {renderSuggestChips('procedures')}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </SectionWrapper>
  );
}
