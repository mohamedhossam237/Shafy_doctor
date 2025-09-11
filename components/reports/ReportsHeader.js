// /components/reports/ReportsHeader.jsx
'use client';
import * as React from 'react';
import {
  Avatar,
  Box,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';

export default function ReportsHeader({ isArabic, totalCount, tab, onTabChange }) {
  return (
    <Paper
      elevation={0}
      sx={{
        mt: 1,
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 1.25, md: 1.75 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack
        direction={isArabic ? 'row-reverse' : 'row'}
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <DescriptionIcon />
          </Avatar>
          <Typography variant="h6" fontWeight={800} noWrap>
            {isArabic ? 'تقارير اليوم' : "Today's Reports"}
          </Typography>
        </Stack>

        <Chip
          label={isArabic ? `${totalCount} تقرير` : `${totalCount} reports`}
          color="primary"
          variant="outlined"
        />
      </Stack>

      <Box sx={{ mt: 1 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => onTabChange(v)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': { fontWeight: 700 },
            ...(isArabic && { direction: 'rtl' }),
          }}
        >
          <Tab label={isArabic ? 'تقارير العيادة' : 'Clinic Reports'} />
          <Tab label={isArabic ? 'تقارير أخرى' : 'Other Reports'} />
        </Tabs>
      </Box>
    </Paper>
  );
}
