'use client';

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';
import ListEditor from './ListEditor';

export default function EditServicesDialog({ open, onClose, isArabic = false, services = [], onSaved }) {
  const { user } = useAuth();
  const [list, setList] = React.useState(services || []);
  React.useEffect(() => setList(services || []), [services]);

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    await updateDoc(doc(db, 'doctors', user.uid), { services: list });
    onSaved?.();
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onSave={onSave}
      title={isArabic ? 'الخدمات المقدمة' : 'Services Offered'}
      isArabic={isArabic}
    >
      <ListEditor value={list} onChange={setList} placeholder="e.g. Endoscopy, Suturing, ECG..." isArabic={isArabic} />
    </BaseDialog>
  );
}
