'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Box,
  Paper,
  Typography,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

export default function AddInfographicDialog({ open, onClose, onCreated }) {
  const { user } = useAuth();
  
  // AR fields (default/primary) - Only title and description mandatory
  const [titleAr, setTitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');

  // EN fields (AI translated)
  const [titleEn, setTitleEn] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');

  // Cover image (mandatory)
  const [coverImage, setCoverImage] = useState(null);

  // Doctor info
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [loadingDoctor, setLoadingDoctor] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [langTab, setLangTab] = useState(0); // Start with Arabic (0) as default
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Load doctor info
  const loadDoctorInfo = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoadingDoctor(true);
    try {
      const doctorDoc = await getDoc(doc(db, 'doctors', user.uid));
      if (doctorDoc.exists()) {
        const data = doctorDoc.data();
        setDoctorInfo({
          name_ar: data.name_ar || '',
          name_en: data.name_en || '',
          uid: user.uid,
          email: user.email || '',
        });
      } else {
        // Fallback if doctor doc doesn't exist
        setDoctorInfo({
          name_ar: user.displayName || 'الطبيب',
          name_en: user.displayName || 'Doctor',
          uid: user.uid,
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading doctor info:', error);
      // Fallback
      setDoctorInfo({
        name_ar: user.displayName || 'الطبيب',
        name_en: user.displayName || 'Doctor',
        uid: user.uid,
        email: user.email || '',
      });
    } finally {
      setLoadingDoctor(false);
    }
  }, [user]);

  // Load doctor info when dialog opens
  useEffect(() => {
    if (open && user?.uid && !doctorInfo) {
      loadDoctorInfo();
    }
  }, [open, user?.uid, doctorInfo, loadDoctorInfo]);


  // Handle drag and drop for cover image
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0 && !coverImage) {
      await handleImageUpload(imageFiles[0]);
    }
  }, [coverImage]);

  const handleImageUpload = async (file) => {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
    if (!apiKey) {
      setErr('مفتاح API مفقود (NEXT_PUBLIC_IMGBB_KEY)');
      return;
    }

    setLoading(true);
    setErr('');
    try {
      // read file as base64
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const base64 = String(dataUrl).split(',')[1];

      // upload to imgbb
      const resp = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ image: base64 }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.data?.url) {
        throw new Error(json?.error?.message || 'فشل تحميل الصورة');
      }

      setCoverImage(json.data.url);
    } catch (e2) {
      setErr(e2?.message || 'فشل تحميل الصورة');
    } finally {
      setLoading(false);
    }
  };

  const onPickCoverImage = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleImageUpload(files[0]);
    }
    if (e?.target) e.target.value = '';
  };

  const reset = () => {
    setTitleAr('');
    setDescriptionAr('');
    setTitleEn('');
    setDescriptionEn('');
    setCoverImage(null);
    setErr('');
    setLangTab(0);
    setDoctorInfo(null);
  };

  const handleAdd = async () => {
    // Wait for doctor info to load
    if (loadingDoctor) {
      setErr(langTab === 0 ? 'جاري تحميل معلومات الطبيب...' : 'Loading doctor information...');
      return;
    }

    if (!doctorInfo) {
      setErr(langTab === 0 ? 'فشل تحميل معلومات الطبيب' : 'Failed to load doctor information');
      return;
    }

    // Validation - only title, description, and cover image are mandatory
    if (!titleAr.trim()) {
      setErr(langTab === 0 ? 'الرجاء إدخال عنوان الإنفوجرافيك بالعربية' : 'Please provide infographic title in Arabic');
      return;
    }

    if (!descriptionAr.trim()) {
      setErr(langTab === 0 ? 'الرجاء إدخال وصف الإنفوجرافيك بالعربية' : 'Please provide infographic description in Arabic');
      return;
    }

    if (!coverImage) {
      setErr(langTab === 0 ? 'الرجاء تحميل صورة الإنفوجرافيك' : 'Please upload the infographic image');
      return;
    }

    setLoading(true);
    setErr('');

    try {
      const infographicData = {
        // Type field for filtering
        type: 'infographic',
        // Arabic fields (primary) - only title and description mandatory
        title_ar: titleAr.trim(),
        description_ar: descriptionAr.trim(),
        // English fields (AI translated)
        title_en: titleEn.trim() || null,
        description_en: descriptionEn.trim() || null,
        // Legacy fields for compatibility
        title: titleAr.trim() || titleEn.trim() || '',
        description: descriptionAr.trim() || descriptionEn.trim() || null,
        // Cover image (mandatory)
        image: coverImage,
        coverImage: coverImage,
        thumbnail: coverImage,
        url: coverImage,
        imageUrl: coverImage,
        images: [coverImage],
        // Doctor/Author information
        authorId: doctorInfo.uid,
        author: doctorInfo.name_ar || doctorInfo.name_en || 'Doctor',
        author_ar: doctorInfo.name_ar || '',
        author_en: doctorInfo.name_en || '',
        authorEmail: doctorInfo.email || '',
        publishedBy: doctorInfo.name_ar || doctorInfo.name_en || 'Doctor',
        publisher: doctorInfo.name_ar || doctorInfo.name_en || 'Doctor',
        source: doctorInfo.name_ar || doctorInfo.name_en || 'Doctor',
        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'articles'), infographicData);
      
      if (onCreated) {
        onCreated();
      }
      
      reset();
      onClose();
    } catch (error) {
      console.error('Error adding infographic:', error);
      setErr(error.message || 'فشل إضافة الإنفوجرافيك');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading || loadingDoctor ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}>
        {langTab === 0 ? 'إضافة إنفوجرافيك جديد' : 'Add New Infographic'}
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <Stack spacing={2} mt={0.5}>
          {!!err && <Alert severity="error">{err}</Alert>}
          {(loading || loadingDoctor) && <LinearProgress />}

          {/* Cover Image - Mandatory - Shared for both languages */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Infographic Image * (صورة الإنفوجرافيك *)
            </Typography>
            <Paper
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                p: 3,
                border: `2px dashed ${isDragging ? 'primary.main' : coverImage ? 'success.main' : 'divider'}`,
                bgcolor: isDragging ? 'action.hover' : 'background.paper',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
              onClick={() => !coverImage && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPickCoverImage}
                style={{ display: 'none' }}
              />
              {coverImage ? (
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Box
                    component="img"
                    src={coverImage}
                    alt="Infographic"
                    sx={{ maxWidth: '100%', maxHeight: 400, borderRadius: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverImage(null);
                    }}
                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white' }}
                    disabled={loading || loadingDoctor}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Drag and drop infographic image here or click to select / اسحب وأفلت صورة الإنفوجرافيك هنا أو انقر للاختيار
                  </Typography>
                </>
              )}
            </Paper>
          </Box>

          {/* Language tabs - Only text fields change when switching tabs */}
          <Tabs value={langTab} onChange={(_, v) => setLangTab(v)} sx={{ mb: 1 }}>
            <Tab label="العربية" />
            <Tab label="English (AI Translated)" />
          </Tabs>

          {/* Title - Mandatory */}
          <TextField
            label={langTab === 0 ? 'عنوان الإنفوجرافيك *' : 'Infographic Title * (Editable after AI translation)'}
            fullWidth
            value={langTab === 0 ? titleAr : titleEn}
            onChange={(e) => langTab === 0 ? setTitleAr(e.target.value) : setTitleEn(e.target.value)}
            disabled={loading || loadingDoctor}
            required
            inputProps={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}
            sx={langTab === 0 ? { '& label': { left: 'auto', right: 0, transformOrigin: 'top right' } } : {}}
            helperText={langTab === 1 && !titleEn ? 'AI will translate from Arabic. You can edit after translation.' : ''}
          />

          {/* Description - Mandatory */}
          <TextField
            label={langTab === 0 ? 'الوصف *' : 'Description * (Editable after AI translation)'}
            fullWidth
            multiline
            rows={3}
            value={langTab === 0 ? descriptionAr : descriptionEn}
            onChange={(e) => langTab === 0 ? setDescriptionAr(e.target.value) : setDescriptionEn(e.target.value)}
            disabled={loading || loadingDoctor}
            required
            inputProps={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}
            sx={langTab === 0 ? { '& label': { left: 'auto', right: 0, transformOrigin: 'top right' } } : {}}
            helperText={langTab === 1 && !descriptionEn ? 'AI will translate from Arabic. You can edit after translation.' : ''}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading || loadingDoctor} color="inherit">
          {langTab === 0 ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleAdd} disabled={loading || loadingDoctor} variant="contained">
          {langTab === 0 ? 'إضافة الإنفوجرافيك' : 'Add Infographic'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
