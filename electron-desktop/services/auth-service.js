const { ipcMain } = require('electron');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const https = require('https');
const http = require('http');

let firebaseApp = null;
let db = null;
let currentUser = null;
let isOnline = false;
let networkCheckInterval = null;

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || ""
};

function initializeFirebase() {
  if (!firebaseApp && firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
  }
  return firebaseApp ? getAuth(firebaseApp) : null;
}

/**
 * Check internet connectivity
 */
async function checkInternetConnectivity() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 3000
    };

    const req = https.request(options, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Get cached authentication from SQLite
 */
function getCachedAuth() {
  try {
    const cached = db.prepare('SELECT * FROM auth_cache WHERE id = ?').get('default');
    if (cached && cached.uid) {
      // Check if token is expired (if stored)
      if (cached.expiresAt) {
        const expiresAt = new Date(cached.expiresAt);
        if (expiresAt < new Date()) {
          return null; // Token expired
        }
      }
      return {
        uid: cached.uid,
        email: cached.email,
        displayName: cached.displayName,
        photoURL: cached.photoURL,
        emailVerified: cached.emailVerified === 1,
        cached: true
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting cached auth:', error);
    return null;
  }
}

/**
 * Cache authentication in SQLite
 */
function cacheAuth(user, token = null, expiresAt = null) {
  try {
    const upsert = db.prepare(`
      INSERT INTO auth_cache (
        id, uid, email, displayName, photoURL, emailVerified,
        lastLoginAt, token, expiresAt, cachedAt
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        uid = excluded.uid,
        email = excluded.email,
        displayName = excluded.displayName,
        photoURL = excluded.photoURL,
        emailVerified = excluded.emailVerified,
        lastLoginAt = datetime('now'),
        token = excluded.token,
        expiresAt = excluded.expiresAt,
        cachedAt = datetime('now')
    `);
    
    upsert.run(
      'default',
      user.uid,
      user.email || '',
      user.displayName || '',
      user.photoURL || '',
      user.emailVerified ? 1 : 0,
      token,
      expiresAt
    );
    
    return true;
  } catch (error) {
    console.error('Error caching auth:', error);
    return false;
  }
}

/**
 * Clear cached authentication
 */
function clearCachedAuth() {
  try {
    db.prepare('DELETE FROM auth_cache WHERE id = ?').run('default');
    return true;
  } catch (error) {
    console.error('Error clearing cached auth:', error);
    return false;
  }
}

function setupAuthService(database) {
  db = database;
  const auth = initializeFirebase();
  
  // Start network monitoring
  startNetworkMonitoring();
  
  // Try to get cached auth on startup
  const cachedUser = getCachedAuth();
  if (cachedUser) {
    currentUser = cachedUser;
    console.log('Loaded cached authentication:', cachedUser.email);
  }
  
  if (auth) {
    // Listen to auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is logged in, cache the auth
        const token = await user.getIdToken();
        const tokenResult = await user.getIdTokenResult();
        
        currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          cached: false
        };
        
        cacheAuth(currentUser, token, tokenResult.expirationTime);
        console.log('User authenticated and cached:', user.email);
      } else {
        // User logged out
        currentUser = null;
        clearCachedAuth();
        console.log('User logged out');
      }
    });
  }
  
  // IPC handler: Check online status
  ipcMain.handle('auth:isOnline', async () => {
    const online = await checkInternetConnectivity();
    isOnline = online;
    return { success: true, data: online };
  });
  
  // IPC handler: Get current user (cached or online)
  ipcMain.handle('auth:getCurrentUser', async () => {
    if (currentUser) {
      return { success: true, data: currentUser };
    }
    
    // Try to get cached user
    const cached = getCachedAuth();
    if (cached) {
      currentUser = cached;
      return { success: true, data: cached };
    }
    
    return { success: true, data: null };
  });
  
  // IPC handler: Email/Password login
  ipcMain.handle('auth:emailLogin', async (event, email, password) => {
    try {
      const online = await checkInternetConnectivity();
      isOnline = online;
      
      if (!online) {
        // Try cached auth
        const cached = getCachedAuth();
        if (cached && cached.email === email) {
          currentUser = cached;
          return {
            success: true,
            data: { user: cached, offline: true, message: 'Using cached credentials (offline mode)' }
          };
        }
        return {
          success: false,
          error: 'No internet connection and no cached credentials found'
        };
      }
      
      // Online login
      if (!auth) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();
      const tokenResult = await user.getIdTokenResult();
      
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        cached: false
      };
      
      cacheAuth(currentUser, token, tokenResult.expirationTime);
      
      // Verify doctor role
      const firestore = getFirestore(firebaseApp);
      const doctorDoc = await getDoc(doc(firestore, 'doctors', user.uid));
      
      return {
        success: true,
        data: {
          user: currentUser,
          isDoctor: doctorDoc.exists(),
          offline: false
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  });
  
  // IPC handler: Google login
  ipcMain.handle('auth:googleLogin', async () => {
    try {
      const online = await checkInternetConnectivity();
      isOnline = online;
      
      if (!online) {
        // Try cached auth
        const cached = getCachedAuth();
        if (cached) {
          currentUser = cached;
          return {
            success: true,
            data: { user: cached, offline: true, message: 'Using cached credentials (offline mode)' }
          };
        }
        return {
          success: false,
          error: 'No internet connection and no cached credentials found'
        };
      }
      
      // Online login
      if (!auth) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const token = await user.getIdToken();
      const tokenResult = await user.getIdTokenResult();
      
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        cached: false
      };
      
      cacheAuth(currentUser, token, tokenResult.expirationTime);
      
      // Verify doctor role
      const firestore = getFirestore(firebaseApp);
      const doctorDoc = await getDoc(doc(firestore, 'doctors', user.uid));
      
      return {
        success: true,
        data: {
          user: currentUser,
          isDoctor: doctorDoc.exists(),
          offline: false
        }
      };
    } catch (error) {
      console.error('Google login error:', error);
      return {
        success: false,
        error: error.message || 'Google login failed'
      };
    }
  });
  
  // IPC handler: Sign out
  ipcMain.handle('auth:signOut', async () => {
    try {
      if (auth) {
        await auth.signOut();
      }
      currentUser = null;
      clearCachedAuth();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      currentUser = null;
      clearCachedAuth();
      return { success: true }; // Still clear local cache even if Firebase signout fails
    }
  });
  
  // IPC handler: Get network status
  ipcMain.handle('network:getStatus', async () => {
    const online = await checkInternetConnectivity();
    isOnline = online;
    return { success: true, data: { online } };
  });
  
  console.log('Auth service initialized');
}

let mainWindowRef = null;

function setMainWindowRef(window) {
  mainWindowRef = window;
}

function startNetworkMonitoring() {
  // Check network status every 30 seconds
  networkCheckInterval = setInterval(async () => {
    const online = await checkInternetConnectivity();
    if (online !== isOnline) {
      isOnline = online;
      console.log(`Network status changed: ${online ? 'Online' : 'Offline'}`);
      // Optionally emit event to renderer
      if (mainWindowRef) {
        mainWindowRef.webContents.send('network-status-changed', { online });
      }
    }
  }, 30000); // Check every 30 seconds
  
  // Initial check
  checkInternetConnectivity().then(online => {
    isOnline = online;
    console.log(`Initial network status: ${online ? 'Online' : 'Offline'}`);
  });
}

module.exports = {
  setupAuthService,
  checkInternetConnectivity,
  getCachedAuth,
  cacheAuth,
  clearCachedAuth,
  setMainWindowRef,
  get isOnline() { return isOnline; },
  get currentUser() { return currentUser; }
};
