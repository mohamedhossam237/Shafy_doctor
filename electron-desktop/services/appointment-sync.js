const { ipcMain } = require('electron');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } = require('firebase/firestore');

let firebaseApp = null;
let db = null;
let autoSyncEnabled = false;
let syncInterval = null;

// Firebase configuration (should be in environment or settings)
const firebaseConfig = {
  // Add your Firebase config here
  // This should be loaded from settings or environment variables
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

function setupAppointmentSync(database) {
  db = database;
  const firestore = initializeFirebase();
  
  if (!firestore) {
    console.warn('Firebase not configured. Appointment sync disabled.');
    return;
  }
  
  // IPC handler to sync appointments from online
  ipcMain.handle('appointments:syncFromOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const appointmentsCol = collection(firestore, 'appointments');
      
      // Fetch appointments for this doctor
      const [q1, q2] = await Promise.all([
        getDocs(query(appointmentsCol, where('doctorUID', '==', doctorUID))),
        getDocs(query(appointmentsCol, where('doctorId', '==', doctorUID)))
      ]);
      
      const appointmentsMap = new Map();
      
      // Combine results from both queries
      [...q1.docs, ...q2.docs].forEach(doc => {
        const data = doc.data();
        appointmentsMap.set(doc.id, { id: doc.id, ...data });
      });
      
      // Insert or update local appointments
      const upsert = db.prepare(`
        INSERT INTO appointments_local (
          id, patientId, patientName, date, time, appointmentType,
          status, doctorPrice, followUpPrice, additionalFees, extraFees,
          totalAmount, notes, clinicId, clinicName, syncedToOnline, syncedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          patientId = excluded.patientId,
          patientName = excluded.patientName,
          date = excluded.date,
          time = excluded.time,
          appointmentType = excluded.appointmentType,
          status = excluded.status,
          doctorPrice = excluded.doctorPrice,
          followUpPrice = excluded.followUpPrice,
          additionalFees = excluded.additionalFees,
          extraFees = excluded.extraFees,
          totalAmount = excluded.totalAmount,
          notes = excluded.notes,
          clinicId = excluded.clinicId,
          clinicName = excluded.clinicName,
          syncedToOnline = 1,
          syncedAt = datetime('now'),
          updatedAt = datetime('now')
      `);
      
      const transaction = db.transaction((appointments) => {
        for (const appointment of appointments) {
          upsert.run(
            appointment.id,
            appointment.patientId || '',
            appointment.patientName || '',
            appointment.date || appointment.appointmentDate || '',
            appointment.time || '',
            appointment.appointmentType || 'checkup',
            appointment.status || 'pending',
            appointment.doctorPrice || 0,
            appointment.followUpPrice || 0,
            appointment.additionalFees || 0,
            JSON.stringify(appointment.extraFees || []),
            appointment.totalAmount || appointment.doctorPrice || 0,
            appointment.notes || '',
            appointment.clinicId || '',
            appointment.clinicName || '',
          );
        }
      });
      
      transaction(Array.from(appointmentsMap.values()));
      
      return {
        success: true,
        data: { synced: appointmentsMap.size }
      };
    } catch (error) {
      console.error('Sync from online error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to sync appointments to online
  ipcMain.handle('appointments:syncToOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      // Get local appointments that haven't been synced
      const unsynced = db.prepare(`
        SELECT * FROM appointments_local
        WHERE syncedToOnline = 0
        ORDER BY createdAt DESC
      `).all();
      
      if (unsynced.length === 0) {
        return { success: true, data: { synced: 0 } };
      }
      
      const appointmentsCol = collection(firestore, 'appointments');
      let syncedCount = 0;
      
      for (const appointment of unsynced) {
        try {
          const appointmentData = {
            doctorUID: doctorUID,
            doctorId: doctorUID,
            patientId: appointment.patientId,
            patientName: appointment.patientName,
            date: appointment.date,
            appointmentDate: appointment.date,
            time: appointment.time,
            appointmentType: appointment.appointmentType,
            status: appointment.status,
            doctorPrice: appointment.doctorPrice,
            followUpPrice: appointment.followUpPrice,
            additionalFees: appointment.additionalFees,
            extraFees: appointment.extraFees ? JSON.parse(appointment.extraFees) : [],
            totalAmount: appointment.totalAmount,
            notes: appointment.notes,
            clinicId: appointment.clinicId,
            clinicName: appointment.clinicName,
            fromDoctorApp: true,
            source: 'Doctor_app',
            createdAt: appointment.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          if (appointment.id.startsWith('appointment_')) {
            // New appointment, create in Firestore
            await addDoc(appointmentsCol, appointmentData);
          } else {
            // Existing appointment, update in Firestore
            const appointmentRef = doc(firestore, 'appointments', appointment.id);
            await updateDoc(appointmentRef, appointmentData);
          }
          
          // Mark as synced in local database
          db.prepare(`
            UPDATE appointments_local
            SET syncedToOnline = 1, syncedAt = datetime('now')
            WHERE id = ?
          `).run(appointment.id);
          
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing appointment ${appointment.id}:`, error);
        }
      }
      
      return {
        success: true,
        data: { synced: syncedCount }
      };
    } catch (error) {
      console.error('Sync to online error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to get online appointments
  ipcMain.handle('appointments:getOnline', async (event, doctorUID) => {
    try {
      if (!doctorUID) {
        return { success: false, error: 'Doctor UID is required' };
      }
      
      const firestore = initializeFirebase();
      if (!firestore) {
        return { success: false, error: 'Firebase not configured' };
      }
      
      const appointmentsCol = collection(firestore, 'appointments');
      const [q1, q2] = await Promise.all([
        getDocs(query(appointmentsCol, where('doctorUID', '==', doctorUID))),
        getDocs(query(appointmentsCol, where('doctorId', '==', doctorUID)))
      ]);
      
      const appointments = [];
      [...q1.docs, ...q2.docs].forEach(doc => {
        appointments.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: appointments };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // IPC handler to enable/disable auto sync
  ipcMain.handle('appointments:enableAutoSync', async (event, enabled) => {
    autoSyncEnabled = enabled;
    
    if (enabled) {
      // Start auto sync every 5 minutes
      syncInterval = setInterval(async () => {
        // Get doctor UID from settings
        const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('doctorUID');
        if (settings) {
          const doctorUID = JSON.parse(settings.value);
          // Sync from online
          await ipcMain.emit('appointments:syncFromOnline', { doctorUID });
        }
      }, 5 * 60 * 1000); // 5 minutes
    } else {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }
    
    return { success: true };
  });
  
  console.log('Appointment sync service initialized');
}

module.exports = { setupAppointmentSync, initializeFirebase };
