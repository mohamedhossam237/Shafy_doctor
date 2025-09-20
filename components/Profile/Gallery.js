// /components/Profile/Gallery.jsx
import * as React from 'react';
import Image from 'next/image';
import {
  Box, Button, Chip, Dialog, DialogContent, IconButton
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function Gallery({ images = [], rtl, avatarUrl, onSetAvatar }) {
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const openAt = (i) => { setIndex(i); setViewerOpen(true); };
  const close = () => setViewerOpen(false);
  const prev = React.useCallback(() => images.length && setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = React.useCallback(() => images.length && setIndex((i) => (i + 1) % images.length), [images.length]);

  React.useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') (rtl ? next() : prev());
      if (e.key === 'ArrowRight') (rtl ? prev() : next());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, prev, next, rtl]);

  if (!images.length) return null;

  const pattern = (i) => {
    const mod = i % 9;
    switch (mod) {
      case 0: return { aspect: { xs: '1/1', md: '4/3' }, span: { xs: 'auto', md: 'span 2' } };
      case 3: return { aspect: '3/4' };
      case 5: return { aspect: '16/10' };
      case 7: return { aspect: '4/5' };
      default: return { aspect: '1/1' };
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {images.map((src, i) => {
          const isAvatar = src === avatarUrl;
          const conf = pattern(i);
          return (
            <Box
              key={`${src}-${i}`}
              onClick={() => openAt(i)}
              role="button"
              tabIndex={0}
              sx={{
                position: 'relative',
                borderRadius: 2.5,
                overflow: 'hidden',
                border: (t) => `1px solid ${t.palette.divider}`,
                aspectRatio: conf.aspect || '1 / 1',
                gridColumn: conf.span || 'auto',
                cursor: 'zoom-in',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 26px rgba(0,0,0,.12)' },
                '&:hover img': { transform: 'scale(1.03)' },
              }}
            >
              <Image
                src={src}
                alt={`Doctor photo ${i + 1}`}
                fill
                sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw"
                style={{ objectFit: 'cover', transition: 'transform .25s ease' }}
              />
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
                  justifyContent: 'space-between', p: 1, pointerEvents: 'none',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)',
                  opacity: 0, transition: 'opacity .2s ease',
                  '&:hover, &:focus-within': { opacity: 1, pointerEvents: 'auto' },
                }}
              >
                {isAvatar ? (
                  <Chip
                    icon={<AccountCircleIcon />}
                    label={rtl ? 'الصورة الشخصية' : 'Profile photo'}
                    color="primary"
                    sx={{ color: 'primary.contrastText', bgcolor: 'rgba(25,118,210,.9)' }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AccountCircleIcon />}
                    onClick={() => onSetAvatar?.(src)}
                    sx={{ borderRadius: 2 }}
                  >
                    {rtl ? 'تعيين كصورة شخصية' : 'Set as avatar'}
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Dialog open={viewerOpen} onClose={close} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: 'black', position: 'relative' } }}>
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <Box sx={{ position: 'relative', width: '100%', height: { xs: 360, sm: 520, md: 620 } }}>
            <Image key={images[index]} src={images[index]} alt={`Photo ${index + 1}`} fill sizes="100vw" style={{ objectFit: 'contain' }} />
          </Box>
          <IconButton aria-label="close" onClick={close} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="prev" onClick={rtl ? next : prev} sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            {rtl ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
          <IconButton aria-label="next" onClick={rtl ? prev : next} sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.12)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
            {rtl ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
          {images[index] !== avatarUrl ? (
            <Button onClick={() => onSetAvatar?.(images[index])} startIcon={<AccountCircleIcon />} variant="contained" sx={{ position: 'absolute', bottom: 12, left: 12, borderRadius: 2 }}>
              {rtl ? 'تعيين كصورة شخصية' : 'Set as avatar'}
            </Button>
          ) : (
            <Chip icon={<AccountCircleIcon />} label={rtl ? 'الصورة الشخصية' : 'Profile photo'} color="primary" sx={{ position: 'absolute', bottom: 12, left: 12, color: 'primary.contrastText', bgcolor: 'rgba(25,118,210,.9)' }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
