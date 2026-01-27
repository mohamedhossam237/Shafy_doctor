const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase, getDatabase } = require('./database/init');
const { setupIPC } = require('./database/ipc-handlers');
const { setupAppointmentSync } = require('./services/appointment-sync');
const { setupArticleSync } = require('./services/article-sync');
const { setupAuthService, setMainWindowRef } = require('./services/auth-service');
const { startNextServer, stopNextServer } = require('./services/next-server');

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
    
    // Setup authentication service (must be before sync services)
    setupAuthService(db);
    
    // Setup appointment sync service
    setupAppointmentSync(db);
    
    // Setup article sync service
    setupArticleSync(db);
    
    // Start Next.js server if in production mode
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    let serverUrl = null;
    
    if (!isDev) {
      try {
        console.log('Starting Next.js server for production...');
        serverUrl = await startNextServer();
        console.log(`Next.js server started at ${serverUrl}`);
      } catch (error) {
        console.error('Failed to start Next.js server:', error);
        dialog.showErrorBox(
          'Server Start Failed',
          `Failed to start Next.js server:\n\n${error.message}\n\nPlease ensure the Next.js build exists.`
        );
        app.quit();
        return;
      }
    } else {
      serverUrl = 'http://localhost:3000';
    }
    
    // Create main window with the server URL
    createWindow(serverUrl);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    dialog.showErrorBox('Initialization Error', `Failed to initialize application: ${error.message}`);
    app.quit();
  }
});

function createWindow(serverUrl = null) {
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

  // Load the app - use provided serverUrl or default to dev port
  const url = serverUrl || (isDev ? 'http://localhost:3000' : 'http://localhost:3001');
  console.log(`Loading app from: ${url}`);
  
  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    if (errorCode === -106) {
      // ERR_INTERNET_DISCONNECTED or similar
      dialog.showErrorBox(
        'Connection Error',
        `Failed to load the application. Please ensure Next.js server is running.\n\nError: ${errorDescription}`
      );
    }
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
  
  mainWindow.loadURL(url).catch((error) => {
    console.error('Error loading URL:', error);
    dialog.showErrorBox('Load Error', `Failed to load application: ${error.message}`);
  });
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Set main window reference for auth service
  setMainWindowRef(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
    setMainWindowRef(null);
  });
}

// Handle app activation (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const serverUrl = isDev ? 'http://localhost:3000' : 'http://localhost:3001';
    createWindow(serverUrl);
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
  stopNextServer();
  if (db) {
    db.close();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Application Error', `An unexpected error occurred: ${error.message}`);
});
