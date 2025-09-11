'use client';

import * as React from 'react';
import { Stack, TextField, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function ListEditor({ value = [], onChange, placeholder = 'Add item', isArabic = false }) {
  const [input, setInput] = React.useState('');

  const add = () => {
    const v = input.trim();
    if (!v) return;
    const next = [...(value || [])];
    next.push(v);
    onChange?.(next);
    setInput('');
  };

  const remove = (idx) => {
    const next = (value || []).filter((_, i) => i !== idx);
    onChange?.(next);
  };

  return (
    <Stack spacing={1}>
      <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
        <TextField
          fullWidth
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isArabic ? 'أضف عنصرًا' : placeholder}
        />
        <Button onClick={add} variant="contained" startIcon={<AddIcon />}>
          {isArabic ? 'إضافة' : 'Add'}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {(value || []).map((x, i) => (
          <Chip
            key={`${x}-${i}`}
            label={x}
            onDelete={() => remove(i)}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Stack>
    </Stack>
  );
}
