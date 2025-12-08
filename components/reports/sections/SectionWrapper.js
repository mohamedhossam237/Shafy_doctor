'use client';
import * as React from 'react';
import { Paper, Stack, Divider, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Generic section wrapper used across all report sections
 * Provides consistent padding, background, and title icon layout
 */
export default function SectionWrapper({ icon, title, children }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2.25 },
        borderRadius: 2,
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.9)}`,
        background:
          theme.palette.mode === 'light'
            ? alpha(theme.palette.background.paper, 0.65)
            : alpha(theme.palette.background.paper, 0.25),
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {icon}
          <Typography variant="subtitle2" fontWeight={700} letterSpacing={0.2}>
            {title}
          </Typography>
        </Stack>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}
