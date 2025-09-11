'use client';

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';
import ListEditor from './ListEditor';

export default function EditMembershipsDialog({ open, onClose, isArabic = false, memberships = [], onSaved }) {
  const { user } = useAuth();
  const [list, setList] = React.useState(memberships || []);
  React.useEffect(() => setList(memberships || []), [memberships]);

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    await updateDoc(doc(db, 'doctors', user.uid), { memberships: list });
    onSaved?.();
  };

  return (
    <BaseDialog open={open} onClose={onClose} onSave={onSave} title={isArabic ? 'العضويات' : 'Memberships'} isArabic={isArabic}>
      <ListEditor value={list} onChange={setList} placeholder="e.g. AMA, ESC..." isArabic={isArabic} />
    </BaseDialog>
  );
}
