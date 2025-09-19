// /lib/firebaseAdmin.js
// Node-only Firebase Admin initializer with robust env handling.
// Exports: adminApp, authAdmin, dbAdmin, FieldValue, Timestamp, ensureAdmin()

let admin;
try {
  // Use require to avoid bundling for the browser
  admin = require('firebase-admin');
} catch (e) {
  admin = null;
}

/** Try to parse a full service account JSON (raw or base64), normalizing \n in private_key */
function parseServiceAccount(raw) {
  if (!raw) return null;
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s);
      if (obj?.private_key?.includes('\\n')) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
      return obj;
    } catch { return null; }
  };
  return tryParse(raw) || tryParse(Buffer.from(raw, 'base64').toString('utf8'));
}

/** Build credentials object from env vars (two strategies: full JSON or split vars) */
function getCredential() {
  if (!admin) return null;

  // Strategy A: one env with the whole JSON (recommended)
  const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const svcJson = parseServiceAccount(svcRaw);
  if (svcJson) return admin.credential.cert(svcJson);

  // Strategy B: split vars (project, email, key with literal \n)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  // Strategy C: fall back to ADC (GCP runtimes)
  try {
    return admin.credential.applicationDefault();
  } catch {
    return null;
  }
}

function init() {
  if (!admin) return { admin: null, app: null, authAdmin: null, dbAdmin: null };

  if (!admin.apps.length) {
    const credential = getCredential();
    if (!credential) {
      // Initialize without explicit credential (ADC may be available)
      admin.initializeApp();
    } else {
      admin.initializeApp({ credential });
    }
  }

  const app = admin.app();
  const db = admin.firestore();

  return {
    admin,
    app,
    authAdmin: admin.auth(),
    dbAdmin: db,
    FieldValue: admin.firestore.FieldValue,
    Timestamp: admin.firestore.Timestamp,
  };
}

const bundle = init();

export const adminApp = bundle.app || null;
export const authAdmin = bundle.authAdmin || null;
export const dbAdmin = bundle.dbAdmin || null;
export const FieldValue = bundle.FieldValue || null;
export const Timestamp = bundle.Timestamp || null;

// If you need to access the full bundle safely later
export function ensureAdmin() {
  return bundle;
}
