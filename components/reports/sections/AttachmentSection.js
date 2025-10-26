'use client';
import * as React from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import SectionWrapper from './SectionWrapper';
import { uploadImageToImgbb } from '../utils/imgbb';

/**
 * AttachmentSection — upload and preview image report
 */
export default function AttachmentSection({
  t,
  previewURL,
  setPreviewURL,
  fileName,
  setFileName,
  setImgbbURL,
  attaching,
  setAttaching,
  setSnack,
}) {
  const handleFilePick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Only image files are supported.', 'الصور فقط مدعومة.'),
      });
      return;
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
    setFileName(f.name);

    setAttaching(true);
    try {
      const hosted = await uploadImageToImgbb(f);
      setImgbbURL(hosted);
      setSnack({
        open: true,
        severity: 'success',
        msg: t('Image uploaded successfully.', 'تم رفع الصورة بنجاح.'),
      });
    } catch (err) {
      console.error(err);
      setImgbbURL('');
      setSnack({
        open: true,
        severity: 'error',
        msg: err?.message || t('Failed to upload image.', 'فشل رفع الصورة.'),
      });
    } finally {
      setAttaching(false);
    }
  };

  const clearFile = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL('');
    setFileName('');
    setImgbbURL('');
  };

  return (
    <SectionWrapper icon={<NoteAltIcon fontSize="small" />} title={t('Attachment', 'المرفق')}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Tooltip title={t('Attach report image', 'إرفاق صورة التقرير')}>
            <Button variant="outlined" startIcon={<AddPhotoAlternateIcon />} component="label">
              {t('Attach Image', 'إرفاق صورة')}
              <input type="file" hidden accept="image/*" onChange={handleFilePick} />
            </Button>
          </Tooltip>

          {fileName && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 240 }}>
              {fileName}
            </Typography>
          )}
          {previewURL && (
            <Button color="error" size="small" onClick={clearFile}>
              {t('Remove', 'إزالة')}
            </Button>
          )}
        </Stack>

        {attaching && (
          <Stack sx={{ minWidth: 220 }}>
            <Typography variant="caption" color="text.secondary">
              {t('Uploading image…', 'جاري رفع الصورة…')}
            </Typography>
            <LinearProgress />
          </Stack>
        )}

        {!!previewURL && (
          <Box
            sx={{
              mt: 1.5,
              width: '100%',
              borderRadius: 2,
              border: (t2) => `1px solid ${t2.palette.divider}`,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                aspectRatio: '16 / 9',
                backgroundImage: `url(${previewURL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </Box>
        )}
      </Stack>
    </SectionWrapper>
  );
}
