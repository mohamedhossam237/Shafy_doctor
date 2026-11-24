// /pages/ask-shafy.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Box, Stack, Typography } from '@mui/material';
import AppLayout from '@/components/AppLayout';
import AskShafyChat from '@/components/AskShafy/AskShafyChat';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';

export default function AskShafyPage() {
  const router = useRouter();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    return true;
  }, [router.query]);

  return (
    <AppLayout
      title={isArabic ? 'المساعد الطبي الذكي شافي AI' : 'Shafy AI Clinical Copilot'}
      subtitle={
        isArabic
          ? 'استشارات إكلينيكية ذكية وتحليل فوري لبيانات مرضاك ومواعيدك'
          : 'Intelligent medical copilot connected to your clinic data'
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Physio-Matched Luxury Hero Shell in Royal Sapphire */}
        <div className="shafy-hero-shell" style={{ padding: '26px 28px' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2.5}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ position: 'relative', zIndex: 2 }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.24), rgba(56,189,248,0.22))',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
                  flexShrink: 0,
                }}
              >
                <PsychologyRoundedIcon sx={{ fontSize: 36, color: '#ffffff' }} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h4" fontWeight={900} sx={{ color: '#ffffff', fontSize: { xs: '1.35rem', md: '1.65rem' } }}>
                    {isArabic ? 'مساعد شافي الإكلينيكي الذكي' : 'Shafy AI Clinical Copilot'}
                  </Typography>
                  <AutoAwesomeRoundedIcon sx={{ color: '#fef08a', fontSize: 24 }} />
                </Stack>
                <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.5, fontWeight: 600 }}>
                  {isArabic
                    ? 'اسأل أي شيء عن مرضاك، التشخيصات، الأدوية، التقارير، وجدول مواعيدك اليومي'
                    : 'Ask anything about your patients, diagnoses, prescriptions, reports, and schedule'}
                </Typography>
              </Box>
            </Stack>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.16)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fef08a',
                fontSize: '0.78rem',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              <VerifiedRoundedIcon sx={{ fontSize: 15 }} />
              <span>{isArabic ? 'متصل بملفات العيادة' : 'Live Clinic Context'}</span>
            </div>
          </Stack>
        </div>

        {/* Chat Interface inside Glass Panel */}
        <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden' }}>
          <AskShafyChat isArabic={isArabic} />
        </div>
      </div>
    </AppLayout>
  );
}
