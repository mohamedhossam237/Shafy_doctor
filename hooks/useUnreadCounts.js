// /hooks/useUnreadCounts.js
import * as React from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, limit as qLimit } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import globalCache from '@/lib/cache';

// Singleton subscription manager so route transitions NEVER tear down and re-subscribe Firestore listeners
let activeUid = null;
let currentCounts = { notifications: 0, messages: 0 };
let unsubMessages = null;
let unsubNotifications = null;
let idleTimer = null;
const subscribers = new Set();

function emitCounts() {
  globalCache.unreadCounts = currentCounts;
  subscribers.forEach((fn) => fn(currentCounts));
}

function teardownSingleton() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (unsubMessages) {
    try { unsubMessages(); } catch {}
    unsubMessages = null;
  }
  if (unsubNotifications) {
    try { unsubNotifications(); } catch {}
    unsubNotifications = null;
  }
  activeUid = null;
}

function ensureListenersForUid(uid) {
  if (!uid) {
    teardownSingleton();
    if (currentCounts.messages !== 0 || currentCounts.notifications !== 0) {
      currentCounts = { notifications: 0, messages: 0 };
      emitCounts();
    }
    return;
  }

  if (activeUid === uid) return;

  teardownSingleton();
  activeUid = uid;

  // Defer non-critical badge listeners slightly so primary page data always loads first
  idleTimer = setTimeout(() => {
    if (activeUid !== uid) return;

    // 1. Messages unread count (bounded to 80 recent threads)
    try {
      const qRef = query(
        collection(db, 'messages_threads'),
        where('participants', 'array-contains', uid),
        qLimit(80)
      );
      unsubMessages = onSnapshot(
        qRef,
        (snap) => {
          let total = 0;
          snap.forEach((d) => {
            const counts = (d.data() || {}).unreadCounts || {};
            const n = Number(counts[uid] || 0);
            if (!Number.isNaN(n)) total += n;
          });
          if (currentCounts.messages !== total) {
            currentCounts = { ...currentCounts, messages: total };
            emitCounts();
          }
        },
        (err) => {
          console.warn('Message listener error:', err);
        }
      );
    } catch (e) {
      console.warn('Failed to init message listener', e);
    }

    // 2. Doctor notifications subcollection (scoped strictly to this doctor instead of full-DB collectionGroup scan!)
    try {
      const notifRef = query(
        collection(db, 'doctors', uid, 'notifications'),
        where('read', '==', false),
        qLimit(50)
      );
      unsubNotifications = onSnapshot(
        notifRef,
        (snap) => {
          const total = snap.size;
          if (currentCounts.notifications !== total) {
            currentCounts = { ...currentCounts, notifications: total };
            emitCounts();
          }
        },
        () => {
          // Graceful fallback if subcollection/index doesn't exist
          if (currentCounts.notifications !== 0) {
            currentCounts = { ...currentCounts, notifications: 0 };
            emitCounts();
          }
        }
      );
    } catch (e) {
      console.warn('Failed to init notification listener', e);
    }
  }, 250);
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = React.useState(
    () => globalCache.unreadCounts || currentCounts
  );

  React.useEffect(() => {
    subscribers.add(setUnreadCounts);
    ensureListenersForUid(user?.uid || null);
    setUnreadCounts(currentCounts);

    return () => {
      subscribers.delete(setUnreadCounts);
    };
  }, [user?.uid]);

  return unreadCounts;
}
