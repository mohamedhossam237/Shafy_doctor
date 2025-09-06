/* /public/firebase-messaging-sw.js
   Firebase Cloud Messaging Service Worker
   - Must be served from the site root.
   - Uses compat scripts via importScripts for broad browser support.
   Docs:
   https://firebase.google.com/docs/cloud-messaging/js/client
   https://firebase.google.com/docs/cloud-messaging/js/receive
*/

/* Load Firebase SDKs for service workers (compat builds) */
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

/* ---- REQUIRED: Initialize Firebase (inline config) ----
   Replace the placeholder values with your project's web config
   (Project Settings → General → Your apps → Firebase SDK snippet).
*/
firebase.initializeApp({
apiKey: 'AIzaSyBSxgaWL6KM3R1XGiI4YR3IHBnzVL75Ubc',
authDomain: 'shafy-b0d78.firebaseapp.com',
projectId: 'shafy-b0d78',
storageBucket: 'shafy-b0d78.firebasestorage.app',
messagingSenderId: '528676651672',
appId: '1:528676651672:web:431081f31f9cad81b946ed',
measurementId: 'G-MXBF5HMSNY',
});

/* Initialize Messaging */
const messaging = firebase.messaging();

/* Utility: open or focus a client window */
async function openOrFocus(url) {
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // If a window with the URL is already open, focus it.
  for (const client of allClients) {
    try {
      const clientUrl = new URL(client.url);
      if (clientUrl.pathname === new URL(url, self.location.origin).pathname) {
        return client.focus();
      }
    } catch (_) {}
  }

  // Otherwise, open a new window.
  return self.clients.openWindow(url);
}

/* Handle background messages (data-only payloads) 
   To invoke this handler, send FCM messages WITHOUT a "notification" key,
   and include your fields in "data".
*/
messaging.onBackgroundMessage(async (payload) => {
  // Example shape:
  // payload.data = { title, body, icon, image, url, badge, tag, requireInteraction, ... }
  // or payload.notification = { title, body, icon, image, click_action }

  const data = payload?.data || {};
  const notif = payload?.notification || {};

  const title =
    data.title || notif.title || 'New message';
  const options = {
    body: data.body || notif.body || '',
    icon: data.icon || notif.icon || '/icons/icon-192.png',   // provide this icon in /public if you want
    image: data.image || notif.image,
    badge: data.badge || '/icons/icon-72.png',                 // optional badge
    tag: data.tag,                                             // optional collapse key
    requireInteraction: data.requireInteraction === 'true' || false,
    data: {
      // Prefer explicit URL in data; fallback to click_action if present
      url: data.url || notif.click_action || '/',
      // Carry entire payload through for app-side handling if needed
      fcmPayload: payload,
    },
  };

  // Show the notification
  await self.registration.showNotification(title, options);
});

/* Optional: Click handler to route the user */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dest = event.notification?.data?.url || '/';
  event.waitUntil(openOrFocus(dest));
});

/* (Optional) Lifecycle logging for debugging in DevTools */
self.addEventListener('install', () => {
  // Skip waiting so updates to this file take effect immediately on refresh
  self.skipWaiting && self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
