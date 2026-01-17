const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    // Patients
    getPatients: () => ipcRenderer.invoke('db:getPatients'),
    getPatient: (id) => ipcRenderer.invoke('db:getPatient', id),
    createPatient: (data) => ipcRenderer.invoke('db:createPatient', data),
    updatePatient: (id, data) => ipcRenderer.invoke('db:updatePatient', id, data),
    deletePatient: (id) => ipcRenderer.invoke('db:deletePatient', id),
    
    // Reports
    getReports: () => ipcRenderer.invoke('db:getReports'),
    getReport: (id) => ipcRenderer.invoke('db:getReport', id),
    createReport: (data) => ipcRenderer.invoke('db:createReport', data),
    updateReport: (id, data) => ipcRenderer.invoke('db:updateReport', id, data),
    deleteReport: (id) => ipcRenderer.invoke('db:deleteReport', id),
    
    // Articles
    getArticles: () => ipcRenderer.invoke('db:getArticles'),
    getArticle: (id) => ipcRenderer.invoke('db:getArticle', id),
    createArticle: (data) => ipcRenderer.invoke('db:createArticle', data),
    updateArticle: (id, data) => ipcRenderer.invoke('db:updateArticle', id, data),
    deleteArticle: (id) => ipcRenderer.invoke('db:deleteArticle', id),
    
    // Doctor Profile
    getDoctorProfile: () => ipcRenderer.invoke('db:getDoctorProfile'),
    updateDoctorProfile: (data) => ipcRenderer.invoke('db:updateDoctorProfile', data),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('db:getSettings'),
    updateSettings: (data) => ipcRenderer.invoke('db:updateSettings', data),
  },
  
  // Appointment Sync
  appointments: {
    syncFromOnline: (doctorUID) => ipcRenderer.invoke('appointments:syncFromOnline', doctorUID),
    syncToOnline: (doctorUID) => ipcRenderer.invoke('appointments:syncToOnline', doctorUID),
    getLocalAppointments: () => ipcRenderer.invoke('appointments:getLocal'),
    getOnlineAppointments: (doctorUID) => ipcRenderer.invoke('appointments:getOnline', doctorUID),
    enableAutoSync: (enabled) => ipcRenderer.invoke('appointments:enableAutoSync', enabled),
  },
  
  // Article Sync
  articles: {
    syncFromOnline: (doctorUID) => ipcRenderer.invoke('articles:syncFromOnline', doctorUID),
    syncToOnline: (doctorUID) => ipcRenderer.invoke('articles:syncToOnline', doctorUID),
    getOnlineArticles: (doctorUID) => ipcRenderer.invoke('articles:getOnline', doctorUID),
    enableAutoSync: (enabled) => ipcRenderer.invoke('articles:enableAutoSync', enabled),
  },
  
  // System
  platform: process.platform,
  version: app.getVersion(),
});
