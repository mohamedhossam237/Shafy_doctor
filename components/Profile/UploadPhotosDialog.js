'use client';

import * as React from 'react';
import { Stack, Button, Typography, Alert } from '@mui/material';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function UploadPhotosDialog({ open, onClose, isArabic = false, onSaved }) {
  const { user } = useAuth();
  const [files, setFiles] = React.useState([]);
  const [err, setErr] = React.useState('');

  const t = (en, ar) => (isArabic ? ar : en);

  const onPick = (e) => {
    setErr('');
    const list = Array.from(e.target.files || []);
    setFiles(list);
  };

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    if (!files.length) throw new Error(t('Select at least one image','اختر صورة واحدة على الأقل'));
    const urls = [];
    for (const file of files) {
      const path = `doctors/${user.uid}/profile/${Date.now()}_${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      urls.push(url);
    }
    await updateDoc(doc(db, 'doctors', user.uid), { profileImages: arrayUnion(...urls) });
    onSaved?.();
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onSave={onSave}
      title={t('Upload Photos','رفع الصور')}
      isArabic={isArabic}
    >
      <Stack spacing={1}>
        {err && <Alert severity="error">{err}</Alert>}
        <input type="file" accept="image/*" multiple onChange={onPick} />
        <Typography variant="body2" color="text.secondary">
          {t('You can select multiple files. They will be added to your gallery.','يمكنك اختيار عدة ملفات. ستُضاف إلى معرض الصور.')}
        </Typography>
      </Stack>
    </BaseDialog>
  );
}
