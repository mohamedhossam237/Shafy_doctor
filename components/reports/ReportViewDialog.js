'use client';
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Stack, Chip, Divider, Grid, Box
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';

export default function ReportViewDialog({ open, onClose, report, isAr }) {
  if (!open || !report) return null;
  const t = (en, ar) => (isAr ? ar : en);

  const fmtDate = (d) => {
    if (!d) return '—';
    const date = d.toDate ? d.toDate() : new Date(d);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DescriptionIcon color="primary" />
        {t('Clinical Report', 'تقرير سريري')}
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '80vh' }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={800}>
            {report.titleAr || report.titleEn || report.title || t('Medical Report', 'تقرير طبي')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('Date', 'التاريخ')}: {fmtDate(report.date)}
          </Typography>

          <Divider />
          {report.chiefComplaint && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{t('Chief Complaint', 'الشكوى الرئيسية')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.chiefComplaint}</Typography>
            </>
          )}
          {report.findings && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{t('Findings', 'النتائج')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.findings}</Typography>
            </>
          )}
          {report.diagnosis && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{t('Diagnosis', 'التشخيص')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.diagnosis}</Typography>
            </>
          )}
          {report.procedures && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{t('Procedures', 'الإجراءات')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.procedures}</Typography>
            </>
          )}
          {report.followUp && (
            <Chip
              icon={<CalendarMonthIcon />}
              color="info"
              label={`${t('Follow-up', 'متابعة')}: ${fmtDate(report.followUp)}`}
              sx={{ borderRadius: 2 }}
            />
          )}
          {report.notes && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{t('Notes', 'ملاحظات')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.notes}</Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>{t('Close', 'إغلاق')}</Button>
      </DialogActions>
    </Dialog>
  );
}
