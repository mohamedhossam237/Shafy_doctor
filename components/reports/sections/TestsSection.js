'use client';
import * as React from 'react';
import {
  Box,
  Grid,
  Paper,
  Stack,
  TextField,
  IconButton,
  Button,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ScienceIcon from '@mui/icons-material/Science';
import { alpha } from '@mui/material/styles';
import SectionWrapper from './SectionWrapper';

/**
 * TestsSection — Autocomplete with JSON-based dataset (no AI needed)
 */
export default function TestsSection({
  t,
  testsList,
  updateTest,
  addTest,
  removeTest,
}) {
  const [allTests, setAllTests] = React.useState([]);
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');

  // === Load tests list from public JSON ===
  React.useEffect(() => {
    const loadTests = async () => {
      try {
        const res = await fetch('/data/medical_tests_list.json');
        if (!res.ok) throw new Error('Failed to load test list');
        const data = await res.json();
        const names = data.map((t) => t.TestName?.trim()).filter(Boolean);
        setAllTests(names);
        setOptions(names.slice(0, 50));
      } catch (err) {
        console.error('Error loading JSON:', err);
        setAllTests([]);
      } finally {
        setLoading(false);
      }
    };
    loadTests();
  }, []);

  // === Filter suggestions dynamically ===
  React.useEffect(() => {
    if (!query) {
      setOptions(allTests.slice(0, 50));
      return;
    }
    const qLower = query.toLowerCase();
    const filtered = allTests
      .filter((t) => t.toLowerCase().includes(qLower))
      .slice(0, 30);
    setOptions(filtered);
  }, [query, allTests]);

  return (
    <SectionWrapper
      icon={<ScienceIcon fontSize="small" />}
      title={t(
        'Required: Medical tests (optional if image attached)',
        'مطلوب: فحوصات طبية (اختياري عند إرفاق صورة)'
      )}
    >
      <Stack spacing={1.5}>
        {testsList.map((x, idx) => (
          <Paper
            key={idx}
            variant="outlined"
            sx={{
              p: 1.25,
              borderRadius: 2,
              borderStyle: 'dashed',
              borderColor: (t2) => alpha(t2.palette.divider, 0.8),
            }}
          >
            <Grid container spacing={1.25} alignItems="center">
              {/* --- Autocomplete for test name --- */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={options}
                  loading={loading}
                  value={x.name || ''}
                  onInputChange={(_, v) => {
                    updateTest(idx, 'name', v || '');
                    setQuery(v || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Test / Investigation', 'الفحص / التحليل')}
                      placeholder={t(
                        'Type to search or choose a test…',
                        'اكتب أو اختر فحصًا…'
                      )}
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loading ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              {/* --- Notes field --- */}
              <Grid item xs={12} md={5.2}>
                <TextField
                  label={t('Notes / Instructions', 'ملاحظات / تعليمات')}
                  fullWidth
                  value={x.notes}
                  onChange={(e) => updateTest(idx, 'notes', e.target.value)}
                  placeholder={t('Fasting 8 hours, etc.', 'صيام ٨ ساعات مثلاً')}
                />
              </Grid>

              {/* --- Remove --- */}
              <Grid item xs={12} md="auto">
                <IconButton
                  color="error"
                  onClick={() => removeTest(idx)}
                  aria-label={t('Remove test', 'إزالة الفحص')}
                  sx={{ ml: { md: 0.5 } }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Paper>
        ))}

        {/* --- Add Test --- */}
        <Box>
          <Button
            onClick={addTest}
            startIcon={<AddCircleOutlineIcon />}
            variant="outlined"
          >
            {t('Add test', 'إضافة فحص')}
          </Button>
        </Box>
      </Stack>
    </SectionWrapper>
  );
}
