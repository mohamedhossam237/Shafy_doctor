'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Stack, Typography, Paper, CircularProgress, Chip, Box
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val?.toDate) return val.toDate();
  if (typeof val === 'string') return new Date(val);
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  return null;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DailyFinancePage() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query]);

  const [loading, setLoading] = React.useState(true);
  const [todayIncome, setTodayIncome] = React.useState(0);
  const [series, setSeries] = React.useState([]);

  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoading(true);
      try {
        const col = collection(db, 'appointments');
        const qRef = query(col, where('doctorId', '==', user.uid));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data(), _dt: toDate(d.data().appointmentDate || d.data().date) }));

        const today = new Date();
        const incomeToday = rows
          .filter(r => r._dt && isSameDay(r._dt, today))
          .reduce((acc, r) => acc + Number(r.doctorPrice || 0) + Number(r.additionalFees || 0), 0);
        setTodayIncome(incomeToday);

        const days = Array.from({ length: 14 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return d;
        });
        const data = days.map(d => {
          const total = rows
            .filter(r => r._dt && isSameDay(r._dt, d))
            .reduce((acc, r) => acc + Number(r.doctorPrice || 0) + Number(r.additionalFees || 0), 0);
          return {
            day: d.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric' }),
            value: total
          };
        });
        setSeries(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid, isArabic]);

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
        <Container maxWidth="md">
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight={800}>
                {isArabic ? 'الملخص المالي اليومي' : 'Daily Financial Summary'}
              </Typography>
              <Chip label={isArabic ? 'آخر 14 يوم' : 'Last 14 days'} color="primary" variant="outlined" />
            </Stack>

            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                {isArabic ? 'إيراد اليوم' : 'Income Today'}
              </Typography>
              <Typography variant="h3" fontWeight={800} color="primary">
                {todayIncome.toLocaleString()} <Typography component="span" variant="h6" color="text.secondary">EGP</Typography>
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: 360 }}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                  <CircularProgress />
                </Stack>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary }} />
                    <Tooltip
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.08) }}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}
                    />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Stack>
        </Container>
      </Box>
    </AppLayout>
  );
}
