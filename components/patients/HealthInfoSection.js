'use client';

import * as React from 'react';
import { Box, Typography, Stack, CircularProgress } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import SmokingRoomsRoundedIcon from '@mui/icons-material/SmokingRoomsRounded';
import LocalBarRoundedIcon from '@mui/icons-material/LocalBarRounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import PregnantWomanRoundedIcon from '@mui/icons-material/PregnantWomanRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';

/**
 * HealthInfoSection – Compact 2-column clinical flag cards
 * Supports controlled mode (form/setForm) and instant save mode (patient/onUpdate).
 */
export default function HealthInfoSection({ form, setForm, patient, onUpdate, t, isArabic }) {
  const [updating, setUpdating] = React.useState({});

  const translate = React.useCallback(
    (en, ar) => (typeof t === 'function' ? t(en, ar) : isArabic ? ar : en),
    [t, isArabic]
  );

  const values = form || patient || {};
  const isReadOnly = !setForm && !onUpdate;

  const handleToggle = (field, val) => async () => {
    if (isReadOnly || values[field] === val) return;

    if (setForm) {
      setForm((f) => ({ ...(f || {}), [field]: val }));
    } else if (onUpdate) {
      try {
        setUpdating((prev) => ({ ...prev, [field]: true }));
        await onUpdate(field, val);
      } catch (error) {
        console.error('Failed to update:', error);
      } finally {
        setUpdating((prev) => ({ ...prev, [field]: false }));
      }
    }
  };

  const questions = React.useMemo(() => {
    const base = [
      {
        key: 'isDiabetic',
        label: translate('Diabetic', 'مصاب بالسكري'),
        icon: MonitorHeartRoundedIcon,
        accent: '#d97706',
        softBg: '#fef3c7',
      },
      {
        key: 'hadSurgeries',
        label: translate('Past Surgeries', 'عمليات جراحية سابقة'),
        icon: MedicalServicesRoundedIcon,
        accent: '#2563eb',
        softBg: '#eff6ff',
      },
      {
        key: 'isSmoker',
        label: translate('Smoker', 'مدخن'),
        icon: SmokingRoomsRoundedIcon,
        accent: '#dc2626',
        softBg: '#fee2e2',
      },
      {
        key: 'drinksAlcohol',
        label: translate('Alcohol Intake', 'يتناول الكحول'),
        icon: LocalBarRoundedIcon,
        accent: '#7c3aed',
        softBg: '#f3e8ff',
      },
      {
        key: 'familyHistory',
        label: translate('Family History', 'تاريخ عائلي مشابه'),
        icon: FamilyRestroomRoundedIcon,
        accent: '#0284c7',
        softBg: '#e0f2fe',
      },
    ];
    if (String(values?.gender || '').toLowerCase() === 'female') {
      base.push({
        key: 'isPregnant',
        label: translate('Pregnant', 'حامل'),
        icon: PregnantWomanRoundedIcon,
        accent: '#db2777',
        softBg: '#fce7f3',
      });
    }
    return base;
  }, [translate, values?.gender]);

  return (
    <Box sx={{ mt: 2.5 }} dir={isArabic ? 'rtl' : 'ltr'}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.75 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 14px -4px rgba(37, 99, 235, 0.4)',
            flexShrink: 0,
          }}
        >
          <HealthAndSafetyRoundedIcon sx={{ fontSize: 20 }} />
        </div>
        <Box>
          <Typography variant="subtitle1" fontWeight={900} sx={{ color: '#0f172a', lineHeight: 1.2 }}>
            {translate('Health Flags & Risk Assessment', 'تقييم الحالة الصحية وعوامل الخطورة')}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
            {translate('Tap Yes / No to toggle clinical flags instantly', 'اضغط نعم / لا لتحديث المؤشرات الصحية فوراً')}
          </Typography>
        </Box>
      </Stack>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '10px',
        }}
      >
        {questions.map((q) => {
          const isYes = values[q.key] === true;
          const isNo = values[q.key] === false;
          const isLoading = updating[q.key];
          const Icon = q.icon;

          return (
            <div
              key={q.key}
              style={{
                padding: '12px 14px',
                borderRadius: '15px',
                background: isYes ? q.softBg : '#ffffff',
                border: `1.5px solid ${isYes ? q.accent + '66' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: isYes ? '#ffffff' : '#f1f5f9',
                    color: isYes ? q.accent : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </div>
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {q.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                {isLoading ? (
                  <CircularProgress size={20} sx={{ color: '#2563eb' }} />
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={handleToggle(q.key, true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '9px',
                        border: `1px solid ${isYes ? q.accent : '#cbd5e1'}`,
                        background: isYes ? q.accent : '#ffffff',
                        color: isYes ? '#ffffff' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: isReadOnly ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      {isYes && <CheckCircleRoundedIcon sx={{ fontSize: 13 }} />}
                      <span>{translate('Yes', 'نعم')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={handleToggle(q.key, false)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '9px',
                        border: `1px solid ${isNo ? '#10b981' : '#cbd5e1'}`,
                        background: isNo ? '#ecfdf5' : '#ffffff',
                        color: isNo ? '#047857' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: isReadOnly ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      {isNo && <CancelRoundedIcon sx={{ fontSize: 13 }} />}
                      <span>{translate('No', 'لا')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
