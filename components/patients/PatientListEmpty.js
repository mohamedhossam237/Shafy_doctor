'use client';
import * as React from 'react';
import { Paper, Stack, Typography, Button } from '@mui/material';
import Link from 'next/link';


export default function PatientListEmpty({ isArabic }) {
return (
<Paper sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
<Stack spacing={1} alignItems="center">
<Typography variant="h6" fontWeight={700}>
{isArabic ? 'لا يوجد مرضى' : 'No patients found'}
</Typography>
<Typography variant="body2" color="text.secondary">
{isArabic ? 'أضف أول مريض لبدء المتابعة' : 'Add your first patient to get started'}
</Typography>
<Button component={Link} href={`/patients/new${isArabic ? '?lang=ar' : ''}`} variant="contained">
{isArabic ? 'إضافة مريض' : 'Add Patient'}
</Button>
</Stack>
</Paper>
);
}