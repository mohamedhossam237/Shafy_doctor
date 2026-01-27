import * as React from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, limit as qLimit, collectionGroup } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

export function useUnreadCounts() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = React.useState({ notifications: 0, messages: 0 });

  // messages: sum unreadCounts[uid]
  React.useEffect(() => {
    if (!user?.uid) { setUnreadCounts((u) => ({ ...u, messages: 0 })); return; }
    
    // Safety check for collection availability (optional but good practice)
    try {
        const qRef = query(
          collection(db, 'messages_threads'),
          where('participants', 'array-contains', user.uid),
          qLimit(500)
        );
        const unsub = onSnapshot(qRef, (snap) => {
          let total = 0;
          snap.forEach((d) => {
            const counts = (d.data() || {}).unreadCounts || {};
            const n = Number(counts[user.uid] || 0);
            if (!Number.isNaN(n)) total += n;
          });
          setUnreadCounts((u) => ({ ...u, messages: total }));
        }, (err) => {
            console.warn("Message listener error:", err);
            setUnreadCounts((u) => ({ ...u, messages: 0 }));
        });
        return () => unsub();
    } catch(e) {
        console.warn("Failed to init message listener", e);
    }
  }, [user?.uid]);

  // notifications: any 'notifications' subcollection
  function pathTargetsUser(docRef, uid) {
    const p = String(docRef?.path || '');
    return new RegExp(`/(doctors|users|patients|profiles)/${uid}/notifications/`, 'i').test(p);
  }

  React.useEffect(() => {
    if (!user?.uid) { setUnreadCounts((u) => ({ ...u, notifications: 0 })); return; }
    
    try {
        const cgRef = collectionGroup(db, 'notifications');
        // Ideally we should filter this significantly more in firestore rules/queries to avoid reading *every* notification 
        // But for now, keeping logic parity, just ensuring it doesn't break.
        // NOTE: collectionGroup queries typically need an index.
        const unsub = onSnapshot(cgRef, (snap) => {
          let total = 0;
          snap.forEach((d) => {
            const n = d.data() || {};
            const isRead = (typeof n.read === 'boolean' ? n.read : n.isRead) === true;
            const recipientMatch =
              [
                'userUID','userId','doctorUID','doctorId','uid','toUID','toId',
                'recipientUID','recipientId','ownerUID','ownerId',
              ].some((k) => String(n?.[k] || '') === user.uid) || pathTargetsUser(d.ref, user.uid);
            if (!isRead && recipientMatch) total += 1;
          });
          setUnreadCounts((u) => ({ ...u, notifications: total }));
        }, (err) => {
            console.warn("Notification listener error:", err);
            setUnreadCounts((u) => ({ ...u, notifications: 0 }));
        });
        return () => unsub();
    } catch (e) {
        console.warn("Failed to init notification listener", e);
    }
  }, [user?.uid]);

  return unreadCounts;
}
