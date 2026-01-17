const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase, getDatabase } = require('./database/init');
const { setupIPC } = require('./database/ipc-handlers');
const { setupAppointmentSync } = require('./services/appointment-sync');
const { setupArticleSync } = require('./services/article-sync');

let mainWindow;
let db;

// Initialize database when app is ready
app.whenReady().then(async () => {
  try {
    // Initialize SQLite database
    db = await initDatabase();
    console.log('Database initialized successfully');
    
    // Setup IPC handlers for database operations
    setupIPC(db);
    
    // Setup appointment sync service
    setupAppointmentSync(db);
    
    // Setup article sync service
    setupArticleSync(db);
    
    // Create main window
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    dialog.showErrorBox('Initialization Error', `Failed to initialize application: ${error.message}`);
    app.quit();
  }
});

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/logo.png'),
    show: false,
    backgroundColor: '#ffffff'
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../.next/server/pages/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle app activation (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Application Error', `An unexpected error occurred: ${error.message}`);
});
