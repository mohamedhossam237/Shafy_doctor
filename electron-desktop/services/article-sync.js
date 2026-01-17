const { ipcMain } = require('electron');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');

let firebaseApp = null;
let db = null;
let autoSyncEnabled = false;
let syncInterval = null;

// Firebase configuration (should be loaded from settings or environment variables)
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
  return firebaseApp ? getFirestore(firebaseApp) : null;
}

function setupArticleSync(database) {
  db = database;
  const firestore = initializeFirebase();
  
  if (!firestore) {
    console.warn('Firebase not configured. Article sync disabled.');
    return;
  }
  
  // IPC handler to sync articles from online
  ipcMain.handle('articles:syncFromOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const articlesCol = collection(firestore, 'articles');
      const articlesQuery = query(articlesCol, where('authorId', '==', doctorUID));
      const articlesSnap = await getDocs(articlesQuery);
      
      // Insert or update local articles
      const upsert = db.prepare(`
        INSERT INTO articles (
          id, title_ar, title_en, content_ar, content_en,
          summary_ar, summary_en, type, imageUrl, imagePath,
          publishedAt, authorId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title_ar = excluded.title_ar,
          title_en = excluded.title_en,
          content_ar = excluded.content_ar,
          content_en = excluded.content_en,
          summary_ar = excluded.summary_ar,
          summary_en = excluded.summary_en,
          type = excluded.type,
          imageUrl = excluded.imageUrl,
          imagePath = excluded.imagePath,
          publishedAt = excluded.publishedAt,
          updatedAt = datetime('now')
      `);
      
      let syncedCount = 0;
      const transaction = db.transaction((articles) => {
        for (const articleDoc of articles) {
          const data = articleDoc.data();
          upsert.run(
            articleDoc.id,
            data.title_ar || '',
            data.title_en || '',
            data.content_ar || '',
            data.content_en || '',
            data.summary_ar || '',
            data.summary_en || '',
            data.type || 'article',
            data.imageUrl || '',
            data.imagePath || '',
            data.publishedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            data.authorId || doctorUID,
            data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
          );
          syncedCount++;
        }
      });
      
      transaction(articlesSnap.docs);
      
      return {
        success: true,
        data: { synced: syncedCount }
      };
    } catch (error) {
      console.error('Sync articles from online error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to sync articles to online
  ipcMain.handle('articles:syncToOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      // Get local articles that need to be synced
      const articlesCol = collection(firestore, 'articles');
      const localArticles = db.prepare('SELECT * FROM articles').all();
      
      let syncedCount = 0;
      let updatedCount = 0;
      let createdCount = 0;
      
      for (const article of localArticles) {
        try {
          const articleData = {
            authorId: doctorUID,
            title_ar: article.title_ar || '',
            title_en: article.title_en || '',
            content_ar: article.content_ar || '',
            content_en: article.content_en || '',
            summary_ar: article.summary_ar || '',
            summary_en: article.summary_en || '',
            type: article.type || 'article',
            imageUrl: article.imageUrl || '',
            imagePath: article.imagePath || '',
            publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(),
            createdAt: article.createdAt ? new Date(article.createdAt) : new Date(),
            updatedAt: new Date()
          };
          
          // Try to check if article exists in Firestore
          try {
            const articleRef = doc(firestore, 'articles', article.id);
            const existingDoc = await getDocs(query(articlesCol, where('__name__', '==', article.id)));
            
            if (!existingDoc.empty) {
              // Update existing
              await updateDoc(articleRef, articleData);
              updatedCount++;
            } else {
              // Create new
              await addDoc(articlesCol, { ...articleData, id: article.id });
              createdCount++;
            }
          } catch (e) {
            // If document doesn't exist, create it
            try {
              await addDoc(articlesCol, { ...articleData, id: article.id });
              createdCount++;
            } catch (createError) {
              // If ID already exists, try update with direct doc reference
              const articleRef = doc(firestore, 'articles', article.id);
              await updateDoc(articleRef, articleData);
              updatedCount++;
            }
          }
          
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing article ${article.id}:`, error);
        }
      }
      
      return {
        success: true,
        data: { synced: syncedCount, created: createdCount, updated: updatedCount }
      };
    } catch (error) {
      console.error('Sync articles to online error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to get online articles
  ipcMain.handle('articles:getOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const articlesCol = collection(firestore, 'articles');
      const articlesQuery = query(articlesCol, where('authorId', '==', doctorUID));
      const articlesSnap = await getDocs(articlesQuery);
      
      const articles = [];
      articlesSnap.docs.forEach(doc => {
        articles.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: articles };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to enable/disable auto sync
  ipcMain.handle('articles:enableAutoSync', async (event, enabled) => {
    autoSyncEnabled = enabled;
    
    if (enabled) {
      // Start auto sync every 10 minutes
      syncInterval = setInterval(async () => {
        // Get doctor UID from settings
        const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('doctorUID');
        if (settings) {
          try {
            const doctorUID = JSON.parse(settings.value);
            // Sync from online
            const result = await ipcMain.emit('articles:syncFromOnline', { doctorUID });
            console.log('Auto-synced articles from online:', result);
          } catch (error) {
            console.error('Auto-sync error:', error);
          }
        }
      }, 10 * 60 * 1000); // 10 minutes
    } else {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }
    
    return { success: true };
  });
  
  console.log('Article sync service initialized');
}

module.exports = { setupArticleSync, initializeFirebase };
