// /pages/ask-shafy.js
'use client';
import * as React from 'react';
import { Container, Box, Typography, Paper, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AppLayout from '@/components/AppLayout';
import AskShafyChat from '@/components/AskShafy/AskShafyChat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';

export default function AskShafyPage() {
  // Arabic as the default UI language
  const isArabic = true;

  return (
    <AppLayout>
      <Box
        sx={{
          minHeight: 'calc(100vh - 64px)',
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.03)} 0%, ${alpha(t.palette.secondary.main, 0.02)} 100%)`,
          py: 3,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative Background Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: isArabic ? 'auto' : -100,
            left: isArabic ? -100 : 'auto',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: (t) => `radial-gradient(circle, ${alpha(t.palette.primary.main, 0.08)} 0%, transparent 70%)`,
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -150,
            right: isArabic ? -150 : 'auto',
            left: isArabic ? 'auto' : -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: (t) => `radial-gradient(circle, ${alpha(t.palette.secondary.main, 0.06)} 0%, transparent 70%)`,
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          {/* Premium Header */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              borderRadius: 4,
              background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)} 0%, ${alpha(t.palette.background.paper, 0.95)} 100%)`,
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
              backdropFilter: 'blur(10px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Animated Glow */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '150%',
                height: '150%',
                background: (t) => `radial-gradient(circle, ${alpha(t.palette.primary.main, 0.05)} 0%, transparent 60%)`,
                animation: 'pulse 3s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.5 },
                  '50%': { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0.8 }
                }
              }}
            />

            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ position: 'relative', zIndex: 1 }}
            >
              {/* Icon with Gradient Background */}
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 3,
                  background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -2,
                    borderRadius: 3,
                    background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.light, 0.3)} 0%, ${alpha(t.palette.secondary.light, 0.3)} 100%)`,
                    zIndex: -1,
                    filter: 'blur(8px)'
                  }
                }}
              >
                <PsychologyIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="h3"
                    fontWeight={900}
                    sx={{
                      background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {isArabic ? 'شافي AI' : 'Shafy AI'}
                  </Typography>
                  <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                </Stack>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                  {isArabic
                    ? 'مساعدك الذكي الطبي - اسأل أي شيء عن مرضاك، تشخيصاتك، ومواعيدك'
                    : 'Your intelligent medical assistant - Ask anything about your patients, diagnoses, and appointments'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Chat Interface */}
          <AskShafyChat isArabic={isArabic} />
        </Container>
      </Box>
    </AppLayout>
  );
}
