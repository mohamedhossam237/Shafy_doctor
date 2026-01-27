// /lib/firebase-edge.js
// Edge runtime-safe Firebase utilities (no Node.js dependencies)

import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID =
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

/**
 * Verifies Firebase ID token (Edge-safe using JOSE)
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<{uid: string, email?: string, name?: string}>}
 * @throws {Error} If token is invalid
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!FIREBASE_PROJECT_ID) {
    throw Object.assign(new Error('Missing FIREBASE_PROJECT_ID'), { status: 500 });
  }
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const uid = payload.user_id || payload.sub;
  if (!uid) throw Object.assign(new Error('Invalid token (no uid/sub)'), { status: 401 });
  return {
    uid,
    email: payload.email || '',
    name: payload.name || '',
  };
}
