/**
 * Migration script to migrate data from Firebase to SQLite
 * Run this once to migrate existing web app data to desktop app
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, getDoc } = require('firebase/firestore');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Firebase configuration (should match your existing web app)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || ""
};

async function migrateData(doctorUID, dbPath) {
  console.log('Starting migration from Firebase to SQLite...');
  console.log('Doctor UID:', doctorUID);
  console.log('Database path:', dbPath);
  
  // Initialize Firebase
  const firebaseApp = initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  
  // Open SQLite database
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  try {
    // Migrate Patients
    console.log('\n1. Migrating patients...');
    const patientsCol = collection(firestore, 'patients');
    const patientsQuery = query(patientsCol, where('registeredBy', '==', doctorUID));
    const patientsSnap = await getDocs(patientsQuery);
    
    const insertPatient = db.prepare(`
      INSERT OR REPLACE INTO patients (
        id, name_ar, name_en, phone, email, dateOfBirth, gender,
        address, medicalHistory, allergies, notes, registeredBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let patientCount = 0;
    patientsSnap.docs.forEach(doc => {
      const data = doc.data();
      insertPatient.run(
        doc.id,
        data.name_ar || '',
        data.name_en || '',
        data.phone || '',
        data.email || '',
        data.dateOfBirth || '',
        data.gender || '',
        data.address || '',
        data.medicalHistory || '',
        data.allergies || '',
        data.notes || '',
        data.registeredBy || doctorUID,
        data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      );
      patientCount++;
    });
    console.log(`   ✓ Migrated ${patientCount} patients`);
    
    // Migrate Reports
    console.log('\n2. Migrating reports...');
    const reportsCol = collection(firestore, 'reports');
    const reportsQuery = query(reportsCol, where('doctorUID', '==', doctorUID));
    const reportsSnap = await getDocs(reportsQuery);
    
    const insertReport = db.prepare(`
      INSERT OR REPLACE INTO reports (
        id, patientId, appointmentId, title, content, date,
        diagnosis, treatment, medications, notes, doctorUID, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let reportCount = 0;
    reportsSnap.docs.forEach(doc => {
      const data = doc.data();
      insertReport.run(
        doc.id,
        data.patientId || '',
        data.appointmentId || '',
        data.title || '',
        data.content || '',
        data.date || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        data.diagnosis || '',
        data.treatment || '',
        data.medications || '',
        data.notes || '',
        data.doctorUID || doctorUID,
        data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      );
      reportCount++;
    });
    console.log(`   ✓ Migrated ${reportCount} reports`);
    
    // Migrate Articles
    console.log('\n3. Migrating articles...');
    const articlesCol = collection(firestore, 'articles');
    const articlesQuery = query(articlesCol, where('authorId', '==', doctorUID));
    const articlesSnap = await getDocs(articlesQuery);
    
    const insertArticle = db.prepare(`
      INSERT OR REPLACE INTO articles (
        id, title_ar, title_en, content_ar, content_en,
        summary_ar, summary_en, type, imageUrl, imagePath,
        publishedAt, authorId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let articleCount = 0;
    articlesSnap.docs.forEach(doc => {
      const data = doc.data();
      insertArticle.run(
        doc.id,
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
      articleCount++;
    });
    console.log(`   ✓ Migrated ${articleCount} articles`);
    
    // Migrate Doctor Profile
    console.log('\n4. Migrating doctor profile...');
    try {
      const doctorDoc = await getDoc(doc(firestore, 'doctors', doctorUID));
      if (doctorDoc.exists()) {
        const data = doctorDoc.data();
        
        const insertProfile = db.prepare(`
          INSERT OR REPLACE INTO doctor_profile (
            id, name_ar, name_en, phone, email,
            specialty_key, specialty_ar, specialty_en,
            bio_ar, bio_en, qualifications_ar, qualifications_en,
            university_ar, university_en,
            checkupPrice, followUpPrice,
            clinics, extraServices, profilePhoto,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertProfile.run(
          'default',
          data.name_ar || '',
          data.name_en || '',
          data.phone || '',
          data.email || '',
          data.specialty_key || '',
          data.specialty_ar || '',
          data.specialty_en || '',
          data.bio_ar || '',
          data.bio_en || '',
          data.qualifications_ar || '',
          data.qualifications_en || '',
          data.university_ar || '',
          data.university_en || '',
          data.checkupPrice || 0,
          data.followUpPrice || 0,
          JSON.stringify(data.clinics || []),
          JSON.stringify(data.extraServices || []),
          data.profilePhoto || '',
          data.createdAt || new Date().toISOString(),
          data.updatedAt || new Date().toISOString()
        );
        console.log('   ✓ Migrated doctor profile');
      }
    } catch (error) {
      console.log('   ✗ Could not migrate doctor profile:', error.message);
    }
    
    // Note: Appointments will be synced separately via appointment sync service
    
    console.log('\n✓ Migration completed successfully!');
    console.log('\nNote: Appointments will be synced automatically via the sync service.');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Export for use in main process or as standalone script
module.exports = { migrateData };

// If run as standalone script
if (require.main === module) {
  const doctorUID = process.argv[2];
  const dbPath = process.argv[3] || path.join(__dirname, '../database/shafy-doctor.db');
  
  if (!doctorUID) {
    console.error('Usage: node migrate-from-firebase.js <doctorUID> [dbPath]');
    process.exit(1);
  }
  
  migrateData(doctorUID, dbPath)
    .then(() => {
      console.log('\nMigration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nMigration failed:', error);
      process.exit(1);
    });
}
