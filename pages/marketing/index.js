// /pages/marketing/index.js
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Button,
  TextField,
  Tabs,
  Tab,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArticleIcon from '@mui/icons-material/Article';
import ImageIcon from '@mui/icons-material/Image';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import SummarizeIcon from '@mui/icons-material/Summarize';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MenuBookIcon from '@mui/icons-material/MenuBook';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db, storage } from '@/lib/firebase';
import AddArticleDialog from '@/components/blogs/AddArticleDialog';
import AddInfographicDialog from '@/components/blogs/AddInfographicDialog';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const ARTICLE_COLLECTION = 'articles';

/* ---------------- helpers ---------------- */

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val?.toDate) return val.toDate();
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d, isAr = false) {
  if (!d) return '—';
  const date = toDate(d);
  if (!date) return '—';
  const locale = isAr ? 'ar-EG' : undefined;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/* ---------------- component ---------------- */

export default function MarketingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(true);
  
  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) {
      setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    } else if (q.ar) {
      setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    } else {
      setIsArabic(true); // Default to Arabic
    }
  }, [router.query]);
  
  const isAr = isArabic;
  const t = (en, ar) => (isAr ? ar : en);

  const [tab, setTab] = React.useState(0); // 0: Articles, 1: Infographics
  const [articles, setArticles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [snack, setSnack] = React.useState({ open: false, severity: 'info', msg: '' });
  const loadingRef = React.useRef(false); // Prevent multiple simultaneous loads

  // Article form dialog - using new component for adding
  const [articleDialogOpen, setArticleDialogOpen] = React.useState(false);
  const [editingArticle, setEditingArticle] = React.useState(null);
  const [articleForm, setArticleForm] = React.useState({
    title_ar: '',
    title_en: '',
    content_ar: '',
    content_en: '',
    summary_ar: '',
    summary_en: '',
    tags: [],
  });
  const [articleSaving, setArticleSaving] = React.useState(false);
  const [aiGenerating, setAiGenerating] = React.useState({ type: null, field: null });

  // Infographic form dialog - using new component for adding
  const [infographicDialogOpen, setInfographicDialogOpen] = React.useState(false);
  const [editingInfographic, setEditingInfographic] = React.useState(null);
  const [infographicForm, setInfographicForm] = React.useState({
    title_ar: '',
    title_en: '',
    description_ar: '',
    description_en: '',
    imageUrl: '',
  });
  const [infographicSaving, setInfographicSaving] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Menu for article/infographic actions
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const menuOpen = Boolean(anchorEl);

  /* ---------- load articles ---------- */
  React.useEffect(() => {
    let isMounted = true;
    let abortController = new AbortController();
    
    if (!user?.uid || !mounted) {
      if (isMounted && mounted) {
        setLoading(false);
        setArticles([]);
      }
      return () => {
        isMounted = false;
        abortController.abort();
      };
    }
    
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      return () => {
        isMounted = false;
        abortController.abort();
      };
    }
    
    (async () => {
      try {
        loadingRef.current = true;
        setLoading(true);
        setSnack({ open: false, severity: 'info', msg: '' });

        // Helper function to fetch with timeout (increased timeout for Firestore queries)
        const fetchWithTimeout = async (url, timeout = 30000) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new Error('Request timeout - API took too long to respond');
            }
            throw error;
          }
        };

        // Fetch articles and infographics from API (same as admin)
        // Use Promise.allSettled to handle partial failures gracefully
        const [articlesResult, infographicsResult] = await Promise.allSettled([
          fetchWithTimeout(`/api/articles?authorId=${user.uid}`, 30000),
          fetchWithTimeout(`/api/infographics?authorId=${user.uid}`, 30000),
        ]);
        
        // Check if component is still mounted and not aborted
        if (!isMounted || abortController.signal.aborted) return;

        if (!isMounted) return;
        
        // Process articles
        let articlesData = [];
        if (articlesResult.status === 'fulfilled' && articlesResult.value.ok) {
          try {
            const data = await articlesResult.value.json();
            if (data.success) {
              articlesData = data.articles || [];
            } else {
              console.error('Failed to fetch articles:', data.error);
            }
          } catch (e) {
            console.error('Error parsing articles response:', e);
          }
        } else if (articlesResult.status === 'rejected') {
          console.error('Error fetching articles:', articlesResult.reason);
        } else if (articlesResult.value && !articlesResult.value.ok) {
          console.error(`Articles API returned ${articlesResult.value.status}`);
        }

        // Process infographics
        let infographicsData = [];
        if (infographicsResult.status === 'fulfilled' && infographicsResult.value.ok) {
          try {
            const data = await infographicsResult.value.json();
            if (data.success) {
              infographicsData = data.infographics || [];
            } else {
              console.error('Failed to fetch infographics:', data.error);
            }
          } catch (e) {
            console.error('Error parsing infographics response:', e);
          }
        } else if (infographicsResult.status === 'rejected') {
          console.error('Error fetching infographics:', infographicsResult.reason);
        } else if (infographicsResult.value && !infographicsResult.value.ok) {
          console.error(`Infographics API returned ${infographicsResult.value.status}`);
        }

        // Combine articles and infographics (both are in articles collection with type field)
        const allItems = [...articlesData, ...infographicsData];
        
        // Sort client-side by date (most recent first)
        allItems.sort((a, b) => {
          const aDate = toDate(a.publishedAt || a.createdAt || a.updatedAt);
          const bDate = toDate(b.publishedAt || b.createdAt || b.updatedAt);
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        });
        
        if (isMounted && !abortController.signal.aborted) {
          setArticles(allItems);
        }
      } catch (e) {
        console.error('Error loading articles:', e);
        if (isMounted && !abortController.signal.aborted) {
          // Check if we have any articles loaded, if not show error
          // The articles state might have previous data, so we check if the error is critical
          const errorMsg = e.message?.includes('timeout') 
            ? (isAr ? 'انتهت مهلة الطلب. قد لا تكون بعض البيانات قد تم تحميلها. يرجى تحديث الصفحة.' : 'Request timeout. Some data may not have loaded. Please refresh the page.')
            : (isAr ? 'فشل تحميل بعض المقالات. يرجى تحديث الصفحة.' : 'Failed to load some articles. Please refresh the page.');
          setSnack({ open: true, severity: 'warning', msg: errorMsg });
          // Don't clear articles on error - keep what we have
        }
      } finally {
        loadingRef.current = false;
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    
    return () => {
      isMounted = false;
      loadingRef.current = false;
      abortController.abort();
    };
  }, [user?.uid, mounted, isAr]); // Added isAr instead of t to prevent infinite loop

  /* ---------- AI content generation ---------- */
  const generateAIContent = async (type, field, topic, language = 'ar') => {
    if (!user?.uid) {
      setSnack({ open: true, severity: 'warning', msg: t('Please sign in first', 'يرجى تسجيل الدخول أولاً') });
      return;
    }
    if (!topic?.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter a topic', 'يرجى إدخال موضوع') });
      return;
    }

    setAiGenerating({ type, field });
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/marketing/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ type, topic: topic.trim(), language }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t('AI generation failed', 'فشل توليد المحتوى بواسطة الذكاء الاصطناعي'));
      }

      const content = data.content || '';
      if (type === 'article_content') {
        setArticleForm((f) => ({
          ...f,
          [field === 'ar' ? 'content_ar' : 'content_en']: content,
        }));
        setSnack({ open: true, severity: 'success', msg: t('Content generated successfully', 'تم توليد المحتوى بنجاح') });
      } else if (type === 'article_summary') {
        setArticleForm((f) => ({
          ...f,
          [field === 'ar' ? 'summary_ar' : 'summary_en']: content,
        }));
        setSnack({ open: true, severity: 'success', msg: t('Summary generated successfully', 'تم توليد الملخص بنجاح') });
      } else if (type === 'infographic_description') {
        setInfographicForm((f) => ({
          ...f,
          [field === 'ar' ? 'description_ar' : 'description_en']: content,
        }));
        setSnack({ open: true, severity: 'success', msg: t('Description generated successfully', 'تم توليد الوصف بنجاح') });
      }
    } catch (e) {
      console.error('AI generation error:', e);
      setSnack({ open: true, severity: 'error', msg: e.message || t('Failed to generate content', 'فشل توليد المحتوى') });
    } finally {
      setAiGenerating({ type: null, field: null });
    }
  };

  /* ---------- article handlers ---------- */
  const openArticleDialog = (article = null) => {
    if (article) {
      // For editing, use the old dialog
      setEditingArticle(article);
      setArticleForm({
        title_ar: article.title_ar || '',
        title_en: article.title_en || '',
        content_ar: article.content_ar || '',
        content_en: article.content_en || '',
        summary_ar: article.summary_ar || '',
        summary_en: article.summary_en || '',
        tags: article.tags || [],
      });
      setArticleDialogOpen(true);
    } else {
      // For adding, use the new component
      setEditingArticle(null);
    setArticleDialogOpen(true);
    }
  };

  const closeArticleDialog = () => {
    setArticleDialogOpen(false);
    setEditingArticle(null);
  };

  const saveArticle = async () => {
    if (!user?.uid) return;
    if (!articleForm.title_ar?.trim() && !articleForm.title_en?.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter at least one title', 'يرجى إدخال عنوان واحد على الأقل') });
      return;
    }
    if (!articleForm.content_ar?.trim() && !articleForm.content_en?.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter content', 'يرجى إدخال المحتوى') });
      return;
    }

    setArticleSaving(true);
    try {
      const payload = {
        type: 'article',
        authorId: user.uid,
        title_ar: String(articleForm.title_ar || '').trim(),
        title_en: String(articleForm.title_en || '').trim(),
        content_ar: String(articleForm.content_ar || '').trim(),
        content_en: String(articleForm.content_en || '').trim(),
        summary_ar: String(articleForm.summary_ar || '').trim(),
        summary_en: String(articleForm.summary_en || '').trim(),
        tags: Array.isArray(articleForm.tags) ? articleForm.tags.filter(Boolean) : [],
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingArticle) {
        await updateDoc(doc(db, ARTICLE_COLLECTION, editingArticle.id), payload);
        setSnack({ open: true, severity: 'success', msg: t('Article updated', 'تم تحديث المقال') });
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, ARTICLE_COLLECTION), payload);
        setSnack({ open: true, severity: 'success', msg: t('Article published', 'تم نشر المقال') });
      }

      // Reload articles using API (same pattern as initial load)
      try {
        const [articlesRes, infographicsRes] = await Promise.all([
          fetch(`/api/articles?authorId=${user.uid}`),
          fetch(`/api/infographics?authorId=${user.uid}`),
        ]);
        
        let articlesData = [];
        if (articlesRes.ok) {
          const data = await articlesRes.json();
          if (data.success) {
            articlesData = data.articles || [];
          }
        }
        
        let infographicsData = [];
        if (infographicsRes.ok) {
          const data = await infographicsRes.json();
          if (data.success) {
            infographicsData = data.infographics || [];
          }
        }
        
        const allItems = [...articlesData, ...infographicsData];
        allItems.sort((a, b) => {
          const aDate = toDate(a.publishedAt || a.createdAt);
          const bDate = toDate(b.publishedAt || b.createdAt);
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        });
        setArticles(allItems);
      } catch (e) {
        console.error('Error reloading articles:', e);
        // On error, just show success message - data will reload on next page visit
      }

      closeArticleDialog();
    } catch (e) {
      console.error('Error saving article:', e);
      setSnack({ open: true, severity: 'error', msg: e.message || t('Failed to save article', 'فشل حفظ المقال') });
    } finally {
      setArticleSaving(false);
    }
  };

  /* ---------- infographic handlers ---------- */
  const openInfographicDialog = (infographic = null) => {
    if (infographic) {
      // For editing, use the old dialog
      setEditingInfographic(infographic);
      setInfographicForm({
        title_ar: infographic.title_ar || '',
        title_en: infographic.title_en || '',
        description_ar: infographic.description_ar || '',
        description_en: infographic.description_en || '',
        imageUrl: infographic.imageUrl || '',
      });
      setInfographicDialogOpen(true);
    } else {
      // For adding, use the new component
      setEditingInfographic(null);
    setInfographicDialogOpen(true);
    }
  };

  const closeInfographicDialog = () => {
    setInfographicDialogOpen(false);
    setEditingInfographic(null);
  };

  const handleImageUpload = async (file) => {
    if (!user?.uid || !file) return;
    setUploadingImage(true);
    try {
      const path = `marketing/infographics/${user.uid}/${Date.now()}_${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      setInfographicForm((f) => ({ ...f, imageUrl: url }));
      setSnack({ open: true, severity: 'success', msg: t('Image uploaded', 'تم رفع الصورة') });
    } catch (e) {
      console.error('Error uploading image:', e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to upload image', 'فشل رفع الصورة') });
    } finally {
      setUploadingImage(false);
    }
  };

  const saveInfographic = async () => {
    if (!user?.uid) return;
    if (!infographicForm.title_ar?.trim() && !infographicForm.title_en?.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter at least one title', 'يرجى إدخال عنوان واحد على الأقل') });
      return;
    }
    if (!infographicForm.imageUrl?.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please upload an image', 'يرجى رفع صورة') });
      return;
    }

    setInfographicSaving(true);
    try {
      const payload = {
        type: 'infographic',
        authorId: user.uid,
        title_ar: String(infographicForm.title_ar || '').trim(),
        title_en: String(infographicForm.title_en || '').trim(),
        description_ar: String(infographicForm.description_ar || '').trim(),
        description_en: String(infographicForm.description_en || '').trim(),
        imageUrl: String(infographicForm.imageUrl || '').trim(),
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingInfographic) {
        // Note: Deleting old image requires the path, not the URL
        // If you need to delete old images, store the path alongside the URL when uploading
        // TODO: Store image path when uploading and use it here for deletion
        // if (editingInfographic.imagePath && editingInfographic.imagePath !== infographicForm.imagePath) {
        //   try {
        //     const oldRef = storageRef(storage, editingInfographic.imagePath);
        //     await deleteObject(oldRef);
        //   } catch (e) {
        //     console.warn('Could not delete old image:', e);
        //   }
        // }
        await updateDoc(doc(db, ARTICLE_COLLECTION, editingInfographic.id), payload);
        setSnack({ open: true, severity: 'success', msg: t('Infographic updated', 'تم تحديث الإنفوجرافيك') });
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, ARTICLE_COLLECTION), payload);
        setSnack({ open: true, severity: 'success', msg: t('Infographic published', 'تم نشر الإنفوجرافيك') });
      }

      // Reload articles using API (same pattern as initial load)
      try {
        const [articlesRes, infographicsRes] = await Promise.all([
          fetch(`/api/articles?authorId=${user.uid}`),
          fetch(`/api/infographics?authorId=${user.uid}`),
        ]);
        
        let articlesData = [];
        if (articlesRes.ok) {
          const data = await articlesRes.json();
          if (data.success) {
            articlesData = data.articles || [];
          }
        }
        
        let infographicsData = [];
        if (infographicsRes.ok) {
          const data = await infographicsRes.json();
          if (data.success) {
            infographicsData = data.infographics || [];
          }
        }
        
        const allItems = [...articlesData, ...infographicsData];
        allItems.sort((a, b) => {
          const aDate = toDate(a.publishedAt || a.createdAt);
          const bDate = toDate(b.publishedAt || b.createdAt);
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        });
        setArticles(allItems);
      } catch (e) {
        console.error('Error reloading articles:', e);
        // On error, just show success message - data will reload on next page visit
      }

      closeInfographicDialog();
    } catch (e) {
      console.error('Error saving infographic:', e);
      setSnack({ open: true, severity: 'error', msg: e.message || t('Failed to save infographic', 'فشل حفظ الإنفوجرافيك') });
    } finally {
      setInfographicSaving(false);
    }
  };

  /* ---------- delete handler ---------- */
  const handleMenuOpen = (event, item) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    handleMenuClose();
    
    if (!confirm(t(`Are you sure you want to delete this ${selectedItem.type === 'article' ? 'article' : 'infographic'}?`, `هل أنت متأكد من حذف ${selectedItem.type === 'article' ? 'هذا المقال' : 'هذا الإنفوجرافيك'}؟`))) {
      return;
    }

    try {
      // Note: Deleting images from Storage requires the path, not the URL
      // If you need to delete images, store the path alongside the URL when uploading
      // For now, we only delete the document - images remain in Storage
      // TODO: Store image path when uploading and use it here for deletion
      // if (selectedItem.type === 'infographic' && selectedItem.imagePath) {
      //   try {
      //     const imageRef = storageRef(storage, selectedItem.imagePath);
      //     await deleteObject(imageRef);
      //   } catch (e) {
      //     console.warn('Could not delete image:', e);
      //   }
      // }

      await deleteDoc(doc(db, ARTICLE_COLLECTION, selectedItem.id));
      setArticles((prev) => prev.filter((a) => a.id !== selectedItem.id));
      setSnack({ open: true, severity: 'success', msg: t('Deleted successfully', 'تم الحذف بنجاح') });
    } catch (e) {
      console.error('Error deleting:', e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to delete', 'فشل الحذف') });
    }
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    handleMenuClose();
    if (selectedItem.type === 'article') {
      openArticleDialog(selectedItem);
    } else {
      openInfographicDialog(selectedItem);
    }
  };

  /* ---------- filter by type ---------- */
  const filteredArticles = articles.filter((a) => (tab === 0 ? a.type === 'article' : a.type === 'infographic'));

  /* ---------- UI ---------- */
  return (
    <Protected>
      <AppLayout>
        <Box
          sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            pb: 4,
            direction: isAr ? 'rtl' : 'ltr',
            fontFamily: isAr ? 'Cairo, sans-serif' : undefined,
          }}
        >
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Stack spacing={3}>
              {/* Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                    {t('Marketing & Content', 'التسويق والمحتوى')}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {t('Publish articles and infographics on Shafy blogs', 'انشر المقالات والإنفوجرافيك على مدونة شافي')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="outlined"
                    startIcon={<MenuBookIcon />}
                    endIcon={<OpenInNewIcon />}
                    onClick={() => window.open('https://notebooklm.google.com', '_blank')}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    {t('Open NotebookLM', 'افتح NotebookLM')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => (tab === 0 ? openArticleDialog() : openInfographicDialog())}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {t(tab === 0 ? 'New Article' : 'New Infographic', tab === 0 ? 'مقال جديد' : 'إنفوجرافيك جديد')}
                  </Button>
                </Stack>
              </Stack>

              {/* Tabs */}
              <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Tabs
                  value={tab}
                  onChange={(e, v) => setTab(v)}
                  variant="fullWidth"
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
                  }}
                >
                  <Tab
                    icon={<ArticleIcon />}
                    iconPosition="start"
                    label={t('Articles', 'المقالات')}
                    sx={{ minHeight: 64 }}
                  />
                  <Tab
                    icon={<ImageIcon />}
                    iconPosition="start"
                    label={t('Infographics', 'الإنفوجرافيك')}
                    sx={{ minHeight: 64 }}
                  />
                </Tabs>

                {/* Content */}
                <Box sx={{ p: 3 }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                      <CircularProgress />
                    </Box>
                  ) : filteredArticles.length === 0 ? (
                    <Box 
                      sx={{ 
                        textAlign: 'center', 
                        py: 8,
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 3,
                        bgcolor: 'background.default'
                      }}
                    >
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                        {tab === 0 ? (
                          <ArticleIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                        ) : (
                          <ImageIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                        )}
                      </Box>
                      <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                        {t(
                          tab === 0 ? 'No articles yet' : 'No infographics yet',
                          tab === 0 ? 'لا توجد مقالات بعد' : 'لا توجد إنفوجرافيك بعد'
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t(
                          tab === 0 ? 'Start creating your first article to share with patients' : 'Start creating your first infographic to share with patients',
                          tab === 0 ? 'ابدأ بإنشاء أول مقال لمشاركته مع المرضى' : 'ابدأ بإنشاء أول إنفوجرافيك لمشاركته مع المرضى'
                        )}
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={() => (tab === 0 ? openArticleDialog() : openInfographicDialog())}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        {t(tab === 0 ? 'Create Article' : 'Create Infographic', tab === 0 ? 'إنشاء مقال' : 'إنشاء إنفوجرافيك')}
                      </Button>
                    </Box>
                  ) : (
                    <Grid container spacing={3}>
                      {filteredArticles.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.id}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 4,
                              },
                            }}
                          >
                            {item.type === 'infographic' && item.imageUrl && (
                              <CardMedia
                                component="img"
                                height="200"
                                image={item.imageUrl}
                                alt={isAr ? item.title_ar : item.title_en}
                                sx={{ objectFit: 'cover' }}
                              />
                            )}
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>
                                  {isAr ? item.title_ar || item.title_en : item.title_en || item.title_ar}
                                </Typography>
                                <IconButton size="small" onClick={(e) => handleMenuOpen(e, item)}>
                                  <MoreVertIcon />
                                </IconButton>
                              </Stack>
                              {item.type === 'article' && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mb: 1,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {isAr ? item.summary_ar || item.content_ar : item.summary_en || item.content_en}
                                </Typography>
                              )}
                              {item.type === 'infographic' && item.description_ar && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mb: 1,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {isAr ? item.description_ar : item.description_en}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {fmtDate(item.publishedAt || item.createdAt, isAr)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              </Paper>
            </Stack>
          </Container>

          {/* Article Dialog - New component for adding, old dialog for editing */}
          {!editingArticle ? (
            <AddArticleDialog
              open={articleDialogOpen}
              onClose={closeArticleDialog}
              onCreated={async () => {
                // Reload articles using API (same pattern as initial load)
                try {
                  const [articlesRes, infographicsRes] = await Promise.all([
                    fetch(`/api/articles?authorId=${user.uid}`),
                    fetch(`/api/infographics?authorId=${user.uid}`),
                  ]);
                  
                  let articlesData = [];
                  if (articlesRes.ok) {
                    const data = await articlesRes.json();
                    if (data.success) {
                      articlesData = data.articles || [];
                    }
                  }
                  
                  let infographicsData = [];
                  if (infographicsRes.ok) {
                    const data = await infographicsRes.json();
                    if (data.success) {
                      infographicsData = data.infographics || [];
                    }
                  }
                  
                  const allItems = [...articlesData, ...infographicsData];
                  allItems.sort((a, b) => {
                    const aDate = toDate(a.publishedAt || a.createdAt);
                    const bDate = toDate(b.publishedAt || b.createdAt);
                    return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
                  });
                  setArticles(allItems);
                } catch (e) {
                  console.error('Error reloading articles:', e);
                }
                closeArticleDialog();
              }}
            />
          ) : (
          <Dialog
            open={articleDialogOpen}
            onClose={closeArticleDialog}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                {editingArticle ? t('Edit Article', 'تعديل المقال') : t('New Article', 'مقال جديد')}
              </Typography>
              <IconButton onClick={closeArticleDialog} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={3} sx={{ pt: 2 }}>
                <TextField
                  label={t('Title (Arabic)', 'العنوان (عربي)')}
                  value={articleForm.title_ar}
                  onChange={(e) => setArticleForm((f) => ({ ...f, title_ar: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                  dir="rtl"
                />
                <TextField
                  label={t('Title (English)', 'العنوان (إنجليزي)')}
                  value={articleForm.title_en}
                  onChange={(e) => setArticleForm((f) => ({ ...f, title_en: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                />
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label={t('Summary (Arabic)', 'الملخص (عربي)')}
                    value={articleForm.summary_ar}
                    onChange={(e) => setArticleForm((f) => ({ ...f, summary_ar: e.target.value }))}
                    fullWidth
                    multiline
                    rows={3}
                    helperText={t('Brief summary of the article', 'ملخص موجز للمقال')}
                    dir="rtl"
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={
                      aiGenerating.type === 'article_summary' && aiGenerating.field === 'ar' ? (
                        <CircularProgress size={16} />
                      ) : (
                        <AutoAwesomeIcon />
                      )
                    }
                    onClick={() =>
                      generateAIContent(
                        'article_summary',
                        'ar',
                        articleForm.title_ar || articleForm.title_en || t('Medical article', 'مقال طبي'),
                        'ar'
                      )
                    }
                    disabled={!articleForm.title_ar && !articleForm.title_en || (aiGenerating.type === 'article_summary' && aiGenerating.field === 'ar')}
                    sx={{ minWidth: 'auto', mt: 0.5 }}
                    title={t('Generate summary with AI', 'توليد الملخص بالذكاء الاصطناعي')}
                  >
                    <SummarizeIcon />
                  </Button>
                </Stack>
                <TextField
                  label={t('Summary (English)', 'الملخص (إنجليزي)')}
                  value={articleForm.summary_en}
                  onChange={(e) => setArticleForm((f) => ({ ...f, summary_en: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                  helperText={t('Brief summary of the article', 'ملخص موجز للمقال')}
                />
                <Stack direction="column" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                      {t('Content (Arabic)', 'المحتوى (عربي)')} *
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={
                        aiGenerating.type === 'article_content' && aiGenerating.field === 'ar' ? (
                          <CircularProgress size={16} />
                        ) : (
                          <AutoAwesomeIcon />
                        )
                      }
                      onClick={() =>
                        generateAIContent(
                          'article_content',
                          'ar',
                          articleForm.title_ar || articleForm.title_en || t('Medical article', 'مقال طبي'),
                          'ar'
                        )
                      }
                      disabled={!articleForm.title_ar && !articleForm.title_en || (aiGenerating.type === 'article_content' && aiGenerating.field === 'ar')}
                      sx={{ textTransform: 'none' }}
                    >
                      {t('Generate with AI', 'توليد بالذكاء الاصطناعي')}
                    </Button>
                  </Stack>
                  <TextField
                    value={articleForm.content_ar}
                    onChange={(e) => setArticleForm((f) => ({ ...f, content_ar: e.target.value }))}
                    fullWidth
                    multiline
                    rows={12}
                    required
                    dir="rtl"
                    placeholder={t('Enter article content...', 'أدخل محتوى المقال...')}
                  />
                </Stack>
                <TextField
                  label={t('Content (English)', 'المحتوى (إنجليزي)')}
                  value={articleForm.content_en}
                  onChange={(e) => setArticleForm((f) => ({ ...f, content_en: e.target.value }))}
                  fullWidth
                  multiline
                  rows={12}
                  required
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 1 }}>
              <Button onClick={closeArticleDialog} disabled={articleSaving}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                variant="contained"
                onClick={saveArticle}
                disabled={articleSaving}
                startIcon={articleSaving ? <CircularProgress size={16} /> : <SaveIcon />}
              >
                {articleSaving ? t('Saving...', 'جارٍ الحفظ...') : t('Publish', 'نشر')}
              </Button>
            </DialogActions>
          </Dialog>
          )}

          {/* Infographic Dialog - New component for adding, old dialog for editing */}
          {!editingInfographic ? (
            <AddInfographicDialog
              open={infographicDialogOpen}
              onClose={closeInfographicDialog}
              onCreated={async () => {
                // Reload articles using API (same pattern as initial load)
                try {
                  const [articlesRes, infographicsRes] = await Promise.all([
                    fetch(`/api/articles?authorId=${user.uid}`),
                    fetch(`/api/infographics?authorId=${user.uid}`),
                  ]);
                  
                  let articlesData = [];
                  if (articlesRes.ok) {
                    const data = await articlesRes.json();
                    if (data.success) {
                      articlesData = data.articles || [];
                    }
                  }
                  
                  let infographicsData = [];
                  if (infographicsRes.ok) {
                    const data = await infographicsRes.json();
                    if (data.success) {
                      infographicsData = data.infographics || [];
                    }
                  }
                  
                  const allItems = [...articlesData, ...infographicsData];
                  allItems.sort((a, b) => {
                    const aDate = toDate(a.publishedAt || a.createdAt);
                    const bDate = toDate(b.publishedAt || b.createdAt);
                    return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
                  });
                  setArticles(allItems);
                } catch (e) {
                  console.error('Error reloading articles:', e);
                }
                closeInfographicDialog();
              }}
            />
          ) : (
          <Dialog
            open={infographicDialogOpen}
            onClose={closeInfographicDialog}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                {editingInfographic ? t('Edit Infographic', 'تعديل الإنفوجرافيك') : t('New Infographic', 'إنفوجرافيك جديد')}
              </Typography>
              <IconButton onClick={closeInfographicDialog} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={3} sx={{ pt: 2 }}>
                <TextField
                  label={t('Title (Arabic)', 'العنوان (عربي)')}
                  value={infographicForm.title_ar}
                  onChange={(e) => setInfographicForm((f) => ({ ...f, title_ar: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label={t('Title (English)', 'العنوان (إنجليزي)')}
                  value={infographicForm.title_en}
                  onChange={(e) => setInfographicForm((f) => ({ ...f, title_en: e.target.value }))}
                  fullWidth
                />
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label={t('Description (Arabic)', 'الوصف (عربي)')}
                    value={infographicForm.description_ar}
                    onChange={(e) => setInfographicForm((f) => ({ ...f, description_ar: e.target.value }))}
                    fullWidth
                    multiline
                    rows={3}
                    dir="rtl"
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={
                      aiGenerating.type === 'infographic_description' && aiGenerating.field === 'ar' ? (
                        <CircularProgress size={16} />
                      ) : (
                        <AutoAwesomeIcon />
                      )
                    }
                    onClick={() =>
                      generateAIContent(
                        'infographic_description',
                        'ar',
                        infographicForm.title_ar || infographicForm.title_en || t('Medical infographic', 'إنفوجرافيك طبي'),
                        'ar'
                      )
                    }
                    disabled={!infographicForm.title_ar && !infographicForm.title_en || (aiGenerating.type === 'infographic_description' && aiGenerating.field === 'ar')}
                    sx={{ minWidth: 'auto', mt: 0.5 }}
                    title={t('Generate description with AI', 'توليد الوصف بالذكاء الاصطناعي')}
                  >
                    <AutoAwesomeIcon />
                  </Button>
                </Stack>
                <TextField
                  label={t('Description (English)', 'الوصف (إنجليزي)')}
                  value={infographicForm.description_en}
                  onChange={(e) => setInfographicForm((f) => ({ ...f, description_en: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                />
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {t('Image', 'الصورة')} {infographicForm.imageUrl ? '(✓)' : '(*)'}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AutoStoriesIcon />}
                      endIcon={<OpenInNewIcon />}
                      onClick={() => window.open('https://notebooklm.google.com', '_blank')}
                      sx={{ textTransform: 'none' }}
                      color="secondary"
                    >
                      {t('Open NotebookLM', 'افتح NotebookLM')}
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    {t('Tip: Use NotebookLM to create infographics and then upload them here', 'نصيحة: استخدم NotebookLM لإنشاء الإنفوجرافيك ثم ارفعها هنا')}
                  </Typography>
                    {infographicForm.imageUrl && (
                    <Box sx={{ mb: 2, position: 'relative', height: 400, width: '100%' }}>
                      <Image
                        src={infographicForm.imageUrl}
                        alt="Preview"
                        fill
                        unoptimized
                        style={{
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                        }}
                      />
                    </Box>
                  )}
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadFileIcon />}
                    disabled={uploadingImage}
                    fullWidth
                  >
                    {uploadingImage ? t('Uploading...', 'جارٍ الرفع...') : t('Upload Image', 'رفع صورة')}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </Button>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 1 }}>
              <Button onClick={closeInfographicDialog} disabled={infographicSaving || uploadingImage}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                variant="contained"
                onClick={saveInfographic}
                disabled={infographicSaving || uploadingImage}
                startIcon={infographicSaving ? <CircularProgress size={16} /> : <SaveIcon />}
              >
                {infographicSaving ? t('Saving...', 'جارٍ الحفظ...') : t('Publish', 'نشر')}
              </Button>
            </DialogActions>
          </Dialog>
          )}

          {/* Actions Menu */}
          <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('Edit', 'تعديل')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleDelete}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('Delete', 'حذف')}</ListItemText>
            </MenuItem>
          </Menu>

          {/* Snackbar */}
          <Snackbar
            open={snack.open}
            autoHideDuration={4000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: isAr ? 'left' : 'right' }}
          >
            <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
              {snack.msg}
            </Alert>
          </Snackbar>
        </Box>
      </AppLayout>
    </Protected>
  );
}
