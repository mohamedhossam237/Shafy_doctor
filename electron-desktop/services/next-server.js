const http = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

let httpServer = null;
let nextApp = null;
const PORT = 3001;

/**
 * Start Next.js production server in-process using Electron's Node runtime
 */
async function startNextServer(electronApp = null) {
  if (httpServer) {
    console.log('Next.js server already running');
    return `http://127.0.0.1:${PORT}`;
  }

  let appInstance = electronApp;
  if (!appInstance) {
    try {
      const electron = require('electron');
      appInstance = electron.app || (typeof electron === 'object' ? electron : null);
    } catch (e) {}
  }

  const isPackaged = Boolean(
    appInstance?.isPackaged ?? 
    (process.resourcesPath && typeof process.resourcesPath === 'string' && fs.existsSync(process.resourcesPath))
  );
  
  // Determine the directory containing .next
  let appPath = null;
  
  if (isPackaged) {
    const candidatePaths = [
      path.join(process.resourcesPath, 'app'),
      path.join(process.resourcesPath, 'app.asar.unpacked'),
      process.resourcesPath,
      path.dirname(process.execPath),
    ];
    
    for (const cand of candidatePaths) {
      if (fs.existsSync(path.join(cand, '.next', 'BUILD_ID'))) {
        appPath = cand;
        break;
      }
    }
    
    if (!appPath) {
      for (const cand of candidatePaths) {
        if (fs.existsSync(path.join(cand, '.next'))) {
          appPath = cand;
          break;
        }
      }
    }
    
    if (!appPath) {
      appPath = path.join(process.resourcesPath, 'app');
    }
  } else {
    // In dev / unpack test mode
    const electronDesktopDir = path.dirname(__dirname);
    if (fs.existsSync(path.join(electronDesktopDir, '.next'))) {
      appPath = electronDesktopDir;
    } else {
      appPath = path.resolve(electronDesktopDir, '..');
    }
  }

  console.log(`[NextServer] Initializing Next.js in directory: ${appPath}`);
  console.log(`[NextServer] .next exists: ${fs.existsSync(path.join(appPath, '.next'))}`);
  console.log(`[NextServer] BUILD_ID exists: ${fs.existsSync(path.join(appPath, '.next', 'BUILD_ID'))}`);

  // Require next from the app's node_modules or global resolve
  let next;
  try {
    next = require('next');
  } catch (e) {
    const localNext = path.join(appPath, 'node_modules', 'next');
    next = require(localNext);
  }

  process.env.NODE_ENV = 'production';
  process.env.PORT = PORT.toString();

  nextApp = next({
    dev: false,
    hostname: '127.0.0.1',
    port: PORT,
    dir: appPath,
  });

  const handle = nextApp.getRequestHandler();

  console.log('[NextServer] Preparing Next.js application...');
  await nextApp.prepare();
  console.log('[NextServer] Next.js prepared successfully');

  return new Promise((resolve, reject) => {
    httpServer = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[NextServer] Request error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    httpServer.on('error', (err) => {
      console.error('[NextServer] HTTP Server error:', err);
      reject(err);
    });

    httpServer.listen(PORT, '127.0.0.1', () => {
      console.log(`[NextServer] Listening on http://127.0.0.1:${PORT}`);
      resolve(`http://127.0.0.1:${PORT}`);
    });
  });
}

/**
 * Stop Next.js server
 */
function stopNextServer() {
  if (httpServer) {
    console.log('[NextServer] Stopping Next.js server...');
    httpServer.close();
    httpServer = null;
  }
  if (nextApp) {
    try {
      nextApp.close();
    } catch (e) {}
    nextApp = null;
  }
}

module.exports = {
  startNextServer,
  stopNextServer
};
