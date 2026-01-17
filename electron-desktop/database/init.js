const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

let db = null;

function getDatabasePath() {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  
  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'shafy-doctor.db');
}

async function initDatabase() {
  const dbPath = getDatabasePath();
  console.log('Initializing database at:', dbPath);
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
  db.pragma('foreign_keys = ON'); // Enable foreign keys
  
  // Create tables
  createTables();
  
  return db;
}

function createTables() {
  // Patients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name_ar TEXT,
      name_en TEXT,
      phone TEXT,
      email TEXT,
      dateOfBirth TEXT,
      gender TEXT,
      address TEXT,
      medicalHistory TEXT,
      allergies TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      registeredBy TEXT
    )
  `);
  
  // Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      patientId TEXT,
      appointmentId TEXT,
      title TEXT,
      content TEXT,
      date TEXT,
      diagnosis TEXT,
      treatment TEXT,
      medications TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      doctorUID TEXT,
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
    )
  `);
  
  // Appointments table (local)
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments_local (
      id TEXT PRIMARY KEY,
      patientId TEXT,
      patientName TEXT,
      date TEXT,
      time TEXT,
      appointmentType TEXT,
      status TEXT DEFAULT 'pending',
      doctorPrice REAL DEFAULT 0,
      followUpPrice REAL DEFAULT 0,
      additionalFees REAL DEFAULT 0,
      extraFees TEXT,
      totalAmount REAL DEFAULT 0,
      notes TEXT,
      clinicId TEXT,
      clinicName TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      syncedToOnline INTEGER DEFAULT 0,
      syncedAt TEXT,
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL
    )
  `);
  
  // Articles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title_ar TEXT,
      title_en TEXT,
      content_ar TEXT,
      content_en TEXT,
      summary_ar TEXT,
      summary_en TEXT,
      type TEXT DEFAULT 'article',
      imageUrl TEXT,
      imagePath TEXT,
      publishedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      authorId TEXT
    )
  `);
  
  // Doctor profile table
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctor_profile (
      id TEXT PRIMARY KEY DEFAULT 'default',
      name_ar TEXT,
      name_en TEXT,
      phone TEXT,
      email TEXT,
      specialty_key TEXT,
      specialty_ar TEXT,
      specialty_en TEXT,
      bio_ar TEXT,
      bio_en TEXT,
      qualifications_ar TEXT,
      qualifications_en TEXT,
      university_ar TEXT,
      university_en TEXT,
      checkupPrice REAL DEFAULT 0,
      followUpPrice REAL DEFAULT 0,
      clinics TEXT,
      extraServices TEXT,
      profilePhoto TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patients_registeredBy ON patients(registeredBy);
    CREATE INDEX IF NOT EXISTS idx_reports_patientId ON reports(patientId);
    CREATE INDEX IF NOT EXISTS idx_reports_doctorUID ON reports(doctorUID);
    CREATE INDEX IF NOT EXISTS idx_appointments_patientId ON appointments_local(patientId);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments_local(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_synced ON appointments_local(syncedToOnline);
    CREATE INDEX IF NOT EXISTS idx_articles_authorId ON articles(authorId);
    CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(type);
  `);
  
  console.log('Database tables created successfully');
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = {
  initDatabase,
  getDatabase,
  getDatabasePath
};
