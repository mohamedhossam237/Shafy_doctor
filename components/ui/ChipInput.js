// /components/ui/ChipInput.jsx
'use client';
import * as React from 'react';
import { Stack, TextField, Box, Chip, Typography } from '@mui/material';

export default function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  isArabic,
  helperText,
  disabled = false,
}) {
  const inputRef = React.useRef(null);

  const addChip = (raw) => {
    const v = String(raw ?? '').trim();
    if (!v) return;
    if (values.includes(v)) return;
    onChange([...values, v]);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(e.currentTarget.value);
      e.currentTarget.value = '';
    }
  };

  const handleBlur = (e) => {
    if (disabled) return;
    // add remaining text on blur
    const v = e.currentTarget.value;
    if (v && v.trim()) {
      addChip(v);
      e.currentTarget.value = '';
    }
  };

  const removeChip = (val) => onChange(values.filter((x) => x !== val));

  return (
    <Stack spacing={0.75}>
      <TextField
        inputRef={inputRef}
        label={label}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {values.map((v) => (
          <Chip key={v} label={v} onDelete={() => removeChip(v)} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {helperText ?? (isArabic ? 'اضغط Enter لإضافة عنصر' : 'Press Enter to add an item')}
      </Typography>
    </Stack>
  );
}
