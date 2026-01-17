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
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

const CONTENT_BLOCK_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  LINK: 'link',
};

export default function AddArticleDialog({ open, onClose, onCreated }) {
  const { user } = useAuth();
  
  // AR fields (default/primary) - Only title and description mandatory
  const [titleAr, setTitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');

  // EN fields (AI translated)
  const [titleEn, setTitleEn] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');

  // Dynamic content blocks
  const [contentBlocks, setContentBlocks] = useState([]);

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

  // Load doctor info when dialog opens
  useEffect(() => {
    if (open && user?.uid && !doctorInfo) {
      loadDoctorInfo();
    }
  }, [open, user?.uid]);

  const loadDoctorInfo = async () => {
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
  };

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
      // If no cover image, set as cover image
      await handleImageUpload(imageFiles[0], 'cover');
    } else if (imageFiles.length > 0) {
      // Add as image block
      await handleImageUpload(imageFiles[0], 'block');
    }
  }, [coverImage]);

  const handleImageUpload = async (file, type = 'cover') => {
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

      const imageUrl = json.data.url;

      if (type === 'cover') {
        setCoverImage(imageUrl);
      } else {
        // Add as image block
        addContentBlock(CONTENT_BLOCK_TYPES.IMAGE, { imageUrl });
      }
    } catch (e2) {
      setErr(e2?.message || 'فشل تحميل الصورة');
    } finally {
      setLoading(false);
    }
  };

  const onPickCoverImage = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleImageUpload(files[0], 'cover');
    }
    if (e?.target) e.target.value = '';
  };

  // Add content block
  const addContentBlock = (type, initialData = {}) => {
    const newBlock = {
      id: Date.now() + Math.random(),
      type,
      ...initialData,
    };
    setContentBlocks((prev) => [...prev, newBlock]);
  };

  // Remove content block
  const removeContentBlock = (id) => {
    setContentBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  // Update content block
  const updateContentBlock = (id, updates) => {
    setContentBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...updates } : block))
    );
  };

  // Upload image for content block
  const handleBlockImageUpload = async (file, blockId) => {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
    if (!apiKey) {
      setErr('مفتاح API مفقود');
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const base64 = String(dataUrl).split(',')[1];

      const resp = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ image: base64 }),
      });
      const json = await resp.json();
      if (resp.ok && json?.data?.url) {
        updateContentBlock(blockId, { imageUrl: json.data.url });
      }
    } catch (error) {
      setErr(error.message || 'فشل تحميل الصورة');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTitleAr('');
    setDescriptionAr('');
    setTitleEn('');
    setDescriptionEn('');
    setContentBlocks([]);
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
      setErr(langTab === 0 ? 'الرجاء إدخال عنوان المقال بالعربية' : 'Please provide article title in Arabic');
      return;
    }

    if (!descriptionAr.trim()) {
      setErr(langTab === 0 ? 'الرجاء إدخال وصف المقال بالعربية' : 'Please provide article description in Arabic');
      return;
    }

    if (!coverImage) {
      setErr(langTab === 0 ? 'الرجاء تحميل صورة الغلاف' : 'Please upload a cover image');
      return;
    }

    setLoading(true);
    setErr('');

    try {
      // Prepare content from blocks
      const contentData = {
        blocks: contentBlocks,
        hasText: contentBlocks.some(b => b.type === CONTENT_BLOCK_TYPES.TEXT && b.text?.trim()),
        hasImages: contentBlocks.some(b => b.type === CONTENT_BLOCK_TYPES.IMAGE && b.imageUrl),
        hasLinks: contentBlocks.some(b => b.type === CONTENT_BLOCK_TYPES.LINK && b.linkUrl?.trim()),
      };

      const articleData = {
        // Type field for filtering
        type: 'article',
        // Arabic fields (primary) - only title and description mandatory
        title_ar: titleAr.trim(),
        description_ar: descriptionAr.trim(),
        content_ar: contentBlocks
          .filter(b => b.type === CONTENT_BLOCK_TYPES.TEXT)
          .map(b => b.textAr || b.text || '')
          .filter(t => t.trim())
          .join('\n\n') || null,
        // English fields (AI translated)
        title_en: titleEn.trim() || null,
        description_en: descriptionEn.trim() || null,
        content_en: contentBlocks
          .filter(b => b.type === CONTENT_BLOCK_TYPES.TEXT)
          .map(b => b.textEn || '')
          .filter(t => t.trim())
          .join('\n\n') || null,
        // Legacy fields for compatibility
        title: titleAr.trim() || titleEn.trim() || '',
        description: descriptionAr.trim() || descriptionEn.trim() || null,
        content: contentData.hasText ? contentBlocks
          .filter(b => b.type === CONTENT_BLOCK_TYPES.TEXT)
          .map(b => b.textAr || b.text || b.textEn || '')
          .filter(t => t.trim())
          .join('\n\n') : null,
        // Cover image (mandatory)
        image: coverImage,
        coverImage: coverImage,
        thumbnail: coverImage,
        // Images from blocks
        images: [
          coverImage,
          ...contentBlocks
            .filter(b => b.type === CONTENT_BLOCK_TYPES.IMAGE && b.imageUrl)
            .map(b => b.imageUrl)
        ],
        // Links from blocks
        links: contentBlocks
          .filter(b => b.type === CONTENT_BLOCK_TYPES.LINK && b.linkUrl?.trim())
          .map(b => ({
            url: b.linkUrl,
            label: b.linkLabel || b.linkUrl,
          })),
        // Content blocks structure
        contentBlocks: contentBlocks,
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

      await addDoc(collection(db, 'articles'), articleData);
      
      if (onCreated) {
        onCreated();
      }
      
      reset();
      onClose();
    } catch (error) {
      console.error('Error adding article:', error);
      setErr(error.message || 'فشل إضافة المقال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading || loadingDoctor ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}>
        {langTab === 0 ? 'إضافة مقال جديد' : 'Add New Article'}
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <Stack spacing={2} mt={0.5}>
          {!!err && <Alert severity="error">{err}</Alert>}
          {(loading || loadingDoctor) && <LinearProgress />}

          {/* Cover Image - Mandatory - Shared for both languages */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Cover Image * (صورة الغلاف *)
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
                    alt="Cover"
                    sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverImage(null);
                    }}
                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Drag and drop cover image here or click to select / اسحب وأفلت صورة الغلاف هنا أو انقر للاختيار
                  </Typography>
                </>
              )}
            </Paper>
          </Box>

          {/* Language tabs - Tab 0 = Arabic, Tab 1 = English */}
          <Tabs value={langTab} onChange={(_, v) => setLangTab(v)} sx={{ mb: 1 }}>
            <Tab label="العربية" />
            <Tab label="English (AI Translated)" />
          </Tabs>

          {/* Title - Mandatory - Show Arabic when tab 0, English when tab 1 */}
          <TextField
            label={langTab === 0 ? 'عنوان المقال *' : 'Article Title * (Editable after AI translation)'}
            fullWidth
            value={langTab === 0 ? titleAr : titleEn}
            onChange={(e) => langTab === 0 ? setTitleAr(e.target.value) : setTitleEn(e.target.value)}
            disabled={loading || loadingDoctor}
            required
            inputProps={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}
            sx={langTab === 0 ? { '& label': { left: 'auto', right: 0, transformOrigin: 'top right' } } : {}}
            helperText={langTab === 1 && !titleEn ? 'AI will translate from Arabic. You can edit after translation.' : ''}
          />

          {/* Description - Mandatory - Show Arabic when tab 0, English when tab 1 */}
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

          {/* Dynamic Content Blocks - Images and links shared for both languages, only text changes */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {langTab === 0 ? 'محتوى إضافي (اختياري)' : 'Additional Content (Optional)'}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value === CONTENT_BLOCK_TYPES.TEXT) {
                      addContentBlock(CONTENT_BLOCK_TYPES.TEXT, { textAr: '', textEn: '' });
                    } else if (e.target.value === CONTENT_BLOCK_TYPES.IMAGE) {
                      addContentBlock(CONTENT_BLOCK_TYPES.IMAGE, {});
                    } else if (e.target.value === CONTENT_BLOCK_TYPES.LINK) {
                      addContentBlock(CONTENT_BLOCK_TYPES.LINK, { linkUrl: '', linkLabel: '' });
                    }
                    e.target.value = '';
                  }}
                  displayEmpty
                  disabled={loading || loadingDoctor}
                >
                  <MenuItem value="" disabled>
                    <AddIcon sx={{ mr: 1 }} />
                    {langTab === 0 ? 'إضافة' : 'Add'}
                  </MenuItem>
                  <MenuItem value={CONTENT_BLOCK_TYPES.TEXT}>
                    <TextFieldsIcon sx={{ mr: 1, fontSize: 20 }} />
                    {langTab === 0 ? 'نص' : 'Text'}
                  </MenuItem>
                  <MenuItem value={CONTENT_BLOCK_TYPES.IMAGE}>
                    <ImageIcon sx={{ mr: 1, fontSize: 20 }} />
                    {langTab === 0 ? 'صورة' : 'Image'}
                  </MenuItem>
                  <MenuItem value={CONTENT_BLOCK_TYPES.LINK}>
                    <LinkIcon sx={{ mr: 1, fontSize: 20 }} />
                    {langTab === 0 ? 'رابط' : 'Link'}
                  </MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Content Blocks */}
            <Stack spacing={2} sx={{ mt: 1 }}>
              {contentBlocks.map((block) => (
                <Paper key={block.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                        {block.type === CONTENT_BLOCK_TYPES.TEXT && (langTab === 0 ? 'نص' : 'Text')}
                        {block.type === CONTENT_BLOCK_TYPES.IMAGE && (langTab === 0 ? 'صورة' : 'Image')}
                        {block.type === CONTENT_BLOCK_TYPES.LINK && (langTab === 0 ? 'رابط' : 'Link')}
                      </Typography>
                      <IconButton size="small" onClick={() => removeContentBlock(block.id)} color="error" disabled={loading || loadingDoctor}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    {/* Text Block */}
                    {block.type === CONTENT_BLOCK_TYPES.TEXT && (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={langTab === 0 ? (block.textAr || '') : (block.textEn || '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateContentBlock(block.id, langTab === 0 ? { textAr: value } : { textEn: value });
                        }}
                        placeholder={langTab === 0 ? 'أدخل النص...' : 'Enter text... (Editable after AI translation)'}
                        inputProps={{ dir: langTab === 0 ? 'rtl' : 'ltr' }}
                        disabled={loading || loadingDoctor}
                      />
                    )}

                    {/* Image Block - Shared for both languages */}
                    {block.type === CONTENT_BLOCK_TYPES.IMAGE && (
                      <Box>
                        {block.imageUrl ? (
                          <Box sx={{ position: 'relative', display: 'inline-block' }}>
                            <Box
                              component="img"
                              src={block.imageUrl}
                              alt="Content"
                              sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 1 }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => updateContentBlock(block.id, { imageUrl: null })}
                              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: 'white' }}
                              disabled={loading || loadingDoctor}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Button
                            variant="outlined"
                            component="label"
                            startIcon={<CloudUploadIcon />}
                            fullWidth
                            disabled={loading || loadingDoctor}
                          >
                            Select Image / اختر صورة
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBlockImageUpload(file, block.id);
                              }}
                            />
                          </Button>
                        )}
                      </Box>
                    )}

                    {/* Link Block - Shared for both languages */}
                    {block.type === CONTENT_BLOCK_TYPES.LINK && (
                      <Stack spacing={1}>
                        <TextField
                          fullWidth
                          label="URL Link / رابط URL"
                          value={block.linkUrl || ''}
                          onChange={(e) => updateContentBlock(block.id, { linkUrl: e.target.value })}
                          placeholder="https://..."
                          disabled={loading || loadingDoctor}
                        />
                        <TextField
                          fullWidth
                          label="Link Label (Optional) / تسمية الرابط (اختياري)"
                          value={block.linkLabel || ''}
                          onChange={(e) => updateContentBlock(block.id, { linkLabel: e.target.value })}
                          disabled={loading || loadingDoctor}
                        />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}

              {contentBlocks.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  {langTab === 0 
                    ? 'لا توجد محتويات إضافية. استخدم القائمة أعلاه لإضافة نص أو صورة أو رابط.' 
                    : 'No additional content. Use the menu above to add text, image, or link.'}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading || loadingDoctor} color="inherit">
          {langTab === 0 ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleAdd} disabled={loading || loadingDoctor} variant="contained">
          {langTab === 0 ? 'إضافة المقال' : 'Add Article'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
