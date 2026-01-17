const { ipcMain } = require('electron');

function setupIPC(db) {
  // ==================== PATIENTS ====================
  
  ipcMain.handle('db:getPatients', async () => {
    try {
      const patients = db.prepare('SELECT * FROM patients ORDER BY createdAt DESC').all();
      return { success: true, data: patients };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:getPatient', async (event, id) => {
    try {
      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
      return { success: true, data: patient || null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:createPatient', async (event, data) => {
    try {
      const insert = db.prepare(`
        INSERT INTO patients (
          id, name_ar, name_en, phone, email, dateOfBirth, gender,
          address, medicalHistory, allergies, notes, registeredBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const id = data.id || `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      insert.run(
        id,
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
        data.registeredBy || ''
      );
      
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:updatePatient', async (event, id, data) => {
    try {
      const update = db.prepare(`
        UPDATE patients SET
          name_ar = ?, name_en = ?, phone = ?, email = ?, dateOfBirth = ?,
          gender = ?, address = ?, medicalHistory = ?, allergies = ?,
          notes = ?, updatedAt = datetime('now')
        WHERE id = ?
      `);
      
      update.run(
        data.name_ar,
        data.name_en,
        data.phone,
        data.email,
        data.dateOfBirth,
        data.gender,
        data.address,
        data.medicalHistory,
        data.allergies,
        data.notes,
        id
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:deletePatient', async (event, id) => {
    try {
      db.prepare('DELETE FROM patients WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==================== REPORTS ====================
  
  ipcMain.handle('db:getReports', async () => {
    try {
      const reports = db.prepare('SELECT * FROM reports ORDER BY date DESC, createdAt DESC').all();
      return { success: true, data: reports };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:getReport', async (event, id) => {
    try {
      const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
      return { success: true, data: report || null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:createReport', async (event, data) => {
    try {
      const insert = db.prepare(`
        INSERT INTO reports (
          id, patientId, appointmentId, title, content, date,
          diagnosis, treatment, medications, notes, doctorUID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const id = data.id || `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      insert.run(
        id,
        data.patientId || '',
        data.appointmentId || '',
        data.title || '',
        data.content || '',
        data.date || new Date().toISOString(),
        data.diagnosis || '',
        data.treatment || '',
        data.medications || '',
        data.notes || '',
        data.doctorUID || ''
      );
      
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:updateReport', async (event, id, data) => {
    try {
      const update = db.prepare(`
        UPDATE reports SET
          patientId = ?, appointmentId = ?, title = ?, content = ?, date = ?,
          diagnosis = ?, treatment = ?, medications = ?, notes = ?,
          updatedAt = datetime('now')
        WHERE id = ?
      `);
      
      update.run(
        data.patientId,
        data.appointmentId,
        data.title,
        data.content,
        data.date,
        data.diagnosis,
        data.treatment,
        data.medications,
        data.notes,
        id
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:deleteReport', async (event, id) => {
    try {
      db.prepare('DELETE FROM reports WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==================== ARTICLES ====================
  
  ipcMain.handle('db:getArticles', async () => {
    try {
      const articles = db.prepare('SELECT * FROM articles ORDER BY publishedAt DESC, createdAt DESC').all();
      return { success: true, data: articles };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:getArticle', async (event, id) => {
    try {
      const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
      return { success: true, data: article || null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:createArticle', async (event, data) => {
    try {
      const insert = db.prepare(`
        INSERT INTO articles (
          id, title_ar, title_en, content_ar, content_en,
          summary_ar, summary_en, type, imageUrl, imagePath,
          publishedAt, authorId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const id = data.id || `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      insert.run(
        id,
        data.title_ar || '',
        data.title_en || '',
        data.content_ar || '',
        data.content_en || '',
        data.summary_ar || '',
        data.summary_en || '',
        data.type || 'article',
        data.imageUrl || '',
        data.imagePath || '',
        data.publishedAt || new Date().toISOString(),
        data.authorId || ''
      );
      
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:updateArticle', async (event, id, data) => {
    try {
      const update = db.prepare(`
        UPDATE articles SET
          title_ar = ?, title_en = ?, content_ar = ?, content_en = ?,
          summary_ar = ?, summary_en = ?, type = ?, imageUrl = ?,
          imagePath = ?, publishedAt = ?, updatedAt = datetime('now')
        WHERE id = ?
      `);
      
      update.run(
        data.title_ar,
        data.title_en,
        data.content_ar,
        data.content_en,
        data.summary_ar,
        data.summary_en,
        data.type,
        data.imageUrl,
        data.imagePath,
        data.publishedAt,
        id
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:deleteArticle', async (event, id) => {
    try {
      db.prepare('DELETE FROM articles WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==================== DOCTOR PROFILE ====================
  
  ipcMain.handle('db:getDoctorProfile', async () => {
    try {
      const profile = db.prepare('SELECT * FROM doctor_profile WHERE id = ?').get('default');
      return { success: true, data: profile || null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:updateDoctorProfile', async (event, data) => {
    try {
      const existing = db.prepare('SELECT id FROM doctor_profile WHERE id = ?').get('default');
      
      if (existing) {
        const update = db.prepare(`
          UPDATE doctor_profile SET
            name_ar = ?, name_en = ?, phone = ?, email = ?,
            specialty_key = ?, specialty_ar = ?, specialty_en = ?,
            bio_ar = ?, bio_en = ?, qualifications_ar = ?, qualifications_en = ?,
            university_ar = ?, university_en = ?,
            checkupPrice = ?, followUpPrice = ?,
            clinics = ?, extraServices = ?, profilePhoto = ?,
            updatedAt = datetime('now')
          WHERE id = 'default'
        `);
        
        update.run(
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
          data.profilePhoto || ''
        );
      } else {
        const insert = db.prepare(`
          INSERT INTO doctor_profile (
            id, name_ar, name_en, phone, email,
            specialty_key, specialty_ar, specialty_en,
            bio_ar, bio_en, qualifications_ar, qualifications_en,
            university_ar, university_en,
            checkupPrice, followUpPrice,
            clinics, extraServices, profilePhoto
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insert.run(
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
          data.profilePhoto || ''
        );
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==================== SETTINGS ====================
  
  ipcMain.handle('db:getSettings', async () => {
    try {
      const settings = db.prepare('SELECT * FROM settings').all();
      const result = {};
      settings.forEach(s => {
        try {
          result[s.key] = JSON.parse(s.value);
        } catch {
          result[s.key] = s.value;
        }
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('db:updateSettings', async (event, data) => {
    try {
      const upsert = db.prepare(`
        INSERT INTO settings (key, value, updatedAt)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updatedAt = datetime('now')
      `);
      
      Object.entries(data).forEach(([key, value]) => {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        upsert.run(key, stringValue);
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==================== APPOINTMENTS (Local) ====================
  
  ipcMain.handle('appointments:getLocal', async () => {
    try {
      const appointments = db.prepare('SELECT * FROM appointments_local ORDER BY date DESC, time DESC').all();
      return { success: true, data: appointments };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  console.log('IPC handlers registered successfully');
}

module.exports = { setupIPC };
