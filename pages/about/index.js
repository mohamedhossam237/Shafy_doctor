// /pages/about/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, Divider, Chip
} from '@mui/material';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

export default function AboutPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="md" sx={{ py: 2 }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" spacing={1}>
                  <InfoRoundedIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {label('About the App', 'حول التطبيق')}
                  </Typography>
                  <Chip size="small" variant="outlined" color="primary" label={label('v1.0.0', 'الإصدار 1.0.0')} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {label(
                    'We help doctors manage clinics, reports, and patient communication with a modern, secure workflow.',
                    'نساعد الأطباء على إدارة العيادة والتقارير والتواصل مع المرضى بواجهة حديثة وآمنة.'
                  )}
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    {label('Mission', 'رسالتنا')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label(
                      'Empower clinicians with tools that save time and improve care quality.',
                      'تمكين الأطباء بأدوات توفر الوقت وتحسن جودة الرعاية.'
                    )}
                  </Typography>
                </Stack>

                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    {label('Made with', 'صنع بـ')}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FavoriteRoundedIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">Next.js • Firebase • MUI</Typography>
                  </Stack>
                </Stack>

                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    {label('Region & Compliance', 'المنطقة والامتثال')}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PublicRoundedIcon color="action" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      {label('Data hosted on secure cloud infrastructure.','البيانات مستضافة على بنية سحابية آمنة.')}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </AppLayout>
    </Protected>
  );
}
