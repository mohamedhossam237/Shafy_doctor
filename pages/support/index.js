// /pages/support/index.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, Button, Divider, Chip
} from '@mui/material';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

export default function SupportPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);
  const withLang = React.useCallback((path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path), [isArabic]);

  // Final WhatsApp deep links (wa.me requires country code and digits only)
  const WHATSAPP_SUPPORT = 'https://wa.me/201019264094';  // +20 10 19264094
  const WHATSAPP_BUGS    = 'https://wa.me/201028177021';  // 01028177021 (Egypt +20)

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="md" sx={{ py: 2 }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" spacing={1}>
                  <SupportAgentRoundedIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {label('Tech Support', 'الدعم الفني')}
                  </Typography>
                  <Chip size="small" color="primary" variant="outlined" label={label('Help Center', 'مركز المساعدة')} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {label('We’re here to help with any issues or questions.', 'نحن هنا لمساعدتك في أي مشكلة أو استفسار.')}
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Stack spacing={1} direction={{ xs: 'column', sm: isArabic ? 'row-reverse' : 'row' }}>
                  {/* Email Support */}
                  <Button
                    startIcon={<MailOutlineRoundedIcon />}
                    variant="contained"
                    component={Link}
                    href="mailto:shafyHealth@gmail.com"
                    sx={{ borderRadius: 2 }}
                  >
                    {label('Email Support', 'أرسل بريدًا للدعم')}
                  </Button>

                  {/* WhatsApp Support */}
                  <Button
                    startIcon={<WhatsAppIcon />}
                    variant="outlined"
                    component={Link}
                    href={WHATSAPP_SUPPORT}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ borderRadius: 2 }}
                  >
                    {label('WhatsApp', 'واتساب')}
                  </Button>

                  {/* Report a Bug via WhatsApp */}
                  <Button
                    startIcon={<WhatsAppIcon />}
                    variant="outlined"
                    component={Link}
                    href={WHATSAPP_BUGS}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ borderRadius: 2 }}
                  >
                    {label('Report a Bug', 'الإبلاغ عن خلل')}
                  </Button>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    {label('Common Topics', 'مواضيع شائعة')}
                  </Typography>
                  <ul style={{ margin: 0, paddingInlineStart: isArabic ? 16 : 20 }}>
                    <li><Typography variant="body2">{label('Account access & password reset', 'الوصول للحساب وإعادة تعيين كلمة المرور')}</Typography></li>
                    <li><Typography variant="body2">{label('Managing clinic profile & photos', 'إدارة ملف العيادة والصور')}</Typography></li>
                    <li><Typography variant="body2">{label('Connecting pharmacies & labs', 'ربط الصيدليات والمختبرات')}</Typography></li>
                  </ul>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    startIcon={<DescriptionRoundedIcon />}
                    variant="text"
                    component={Link}
                    href={withLang('/about')}
                    sx={{ borderRadius: 2 }}
                  >
                    {label('Learn more about the app', 'تعرف أكثر على التطبيق')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </AppLayout>
    </Protected>
  );
}
