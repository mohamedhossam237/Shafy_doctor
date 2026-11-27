const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { initDatabase, getDatabase } = require('./database/init');
const { setupIPC } = require('./database/ipc-handlers');
const { setupAppointmentSync } = require('./services/appointment-sync');
const { setupArticleSync } = require('./services/article-sync');
const { setupAuthService, setMainWindowRef } = require('./services/auth-service');
const { startNextServer, stopNextServer } = require('./services/next-server');

let mainWindow;
let db;

// Enforce single instance lock to prevent port clashes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

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
          const errorMessage = error.message || 'Unknown error';
          dialog.showErrorBox(
            'Server Start Failed',
            `Failed to start Next.js server:\n\n${errorMessage}\n\n` +
            `To fix this issue:\n` +
            `1. Make sure you've built the Next.js app first:\n` +
            `   Run "npm run build" in the project root\n\n` +
            `2. Copy the build files:\n` +
            `   Run "cd electron-desktop && npm run prebuild"\n\n` +
            `3. Then build the Electron app:\n` +
            `   Run "npm run build:electron"\n\n` +
            `If you're in development mode, make sure the Next.js dev server is running on port 3000.`
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
}

function createWindow(serverUrl = null) {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Resolve icon path safely
  let iconPath = path.join(__dirname, 'public/logo.png');
  if (!require('fs').existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../public/logo.png');
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: 'Shafy Doctor | شافي دكتور',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1936' // Royal Sapphire dark startup tone matching webapp
  });

  // Remove the legacy Windows File/Edit/View menu for clean modern appearance
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  // Open external links (whatsapp, external protocols, outside domains) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me/') || url.startsWith('whatsapp:') || url.startsWith('mailto:') || url.startsWith('tel:') || !url.includes('localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Load the app - use provided serverUrl or default to dev port
  const url = serverUrl || (isDev ? 'http://localhost:3000' : 'http://localhost:3001');
  console.log(`Loading app from: ${url}`);
  
  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    if (errorCode === -106) {
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

  // Show window smoothly when content is ready
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
