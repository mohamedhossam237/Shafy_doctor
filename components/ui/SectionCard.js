'use client';
import * as React from 'react';
import { Paper, Stack, Typography, Box } from '@mui/material';

export default function SectionCard({ title, subtitle, icon, isArabic, children, actions, sx }) {
  return (
    <Paper
      sx={{
        p: { xs: 1.75, md: 2.25 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        ...sx,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.25}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            {icon && <Box sx={{ fontSize: 24 }}>{icon}</Box>}
            <Box sx={{ textAlign: isArabic ? 'right' : 'left' }}>
              <Typography variant="h6" fontWeight={800}>{title}</Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
              )}
            </Box>
          </Stack>
          {actions}
        </Stack>
        <Box>{children}</Box>
      </Stack>
    </Paper>
  );
}
