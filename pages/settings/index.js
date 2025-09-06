// /pages/settings/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, Switch, FormControlLabel, Divider, Button
} from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

export default function SettingsPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  // local demos (wire to your theme/store if needed)
  const [emailNotifs, setEmailNotifs] = React.useState(true);
  const [pushNotifs, setPushNotifs] = React.useState(true);

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="md" sx={{ py: 2 }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" spacing={1}>
                  <SettingsRoundedIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {label('Settings', 'الإعدادات')}
                  </Typography>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <FormControlLabel
                  control={<Switch checked={emailNotifs} onChange={e => setEmailNotifs(e.target.checked)} />}
                  label={label('Email notifications', 'إشعارات البريد')}
                />
                <FormControlLabel
                  control={<Switch checked={pushNotifs} onChange={e => setPushNotifs(e.target.checked)} />}
                  label={label('Push notifications', 'الإشعارات الفورية')}
                />

                <Divider sx={{ my: 1 }} />

                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                  <Button variant="contained" sx={{ borderRadius: 2 }}>{label('Save changes', 'حفظ التغييرات')}</Button>
                  <Button variant="outlined" sx={{ borderRadius: 2 }}>{label('Reset', 'إعادة ضبط')}</Button>
                </Stack>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </AppLayout>
    </Protected>
  );
}
