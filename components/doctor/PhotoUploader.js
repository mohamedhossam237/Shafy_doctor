'use client';
import * as React from 'react';
import { Stack, Button, Box, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function PhotoUploader({ images, setImages, onPickImages, loading, isArabic }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button component="label" variant="outlined" disabled={loading}>
        {isArabic ? 'رفع الصور' : 'Upload Photos'}
        <input hidden type="file" accept="image/*" multiple onChange={onPickImages} />
      </Button>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {images.map((url) => (
          <Box key={url} sx={{ position: 'relative' }}>
            <Box
              component="img"
              src={url}
              alt="uploaded"
              sx={{ width: 64, height: 64, borderRadius: 1, objectFit: 'cover' }}
            />
            <IconButton
              size="small"
              onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
              sx={{ position: 'absolute', top: -8, right: -8 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
