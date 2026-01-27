const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let nextServerProcess = null;
const PORT = 3001; // Use a different port to avoid conflicts with other Next.js apps
const MAX_RETRIES = 10;
const RETRY_DELAY = 1000;

/**
 * Check if a port is available
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

/**
 * Wait for server to be ready
 */
function waitForServer(url, retries = MAX_RETRIES) {
  return new Promise((resolve, reject) => {
    if (retries === 0) {
      return reject(new Error('Server failed to start'));
    }

    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve();
        } else {
          setTimeout(check, RETRY_DELAY);
        }
      }).on('error', () => {
        setTimeout(() => waitForServer(url, retries - 1).then(resolve).catch(reject), RETRY_DELAY);
      });
    };

    check();
  });
}

/**
 * Start Next.js production server
 */
async function startNextServer() {
  if (nextServerProcess) {
    console.log('Next.js server already running');
    return `http://localhost:${PORT}`;
  }

  const { app } = require('electron');
  const fs = require('fs');
  const isPackaged = app.isPackaged;
  
  // Store app reference for path checks
  const electronApp = app;
  
  // Determine the correct paths
  let appPath, nextPath;
  
  if (isPackaged) {
    // In packaged app, files are in resources/app.asar.unpacked
    // Check multiple possible locations for .next
    const possiblePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked'), // Unpacked files
      path.join(process.resourcesPath, 'app'), // Packed in asar
      path.dirname(__dirname), // electron-desktop directory (after copy)
    ];
    
    // Find which path has .next
    let foundPath = null;
    for (const testPath of possiblePaths) {
      const testNextPath = path.join(testPath, '.next');
      if (fs.existsSync(testNextPath)) {
        foundPath = testPath;
        break;
      }
    }
    
    if (foundPath) {
      appPath = foundPath;
    } else {
      // Default to app.asar.unpacked
      appPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    }
    nextPath = path.join(appPath, '.next');
  } else {
    // In development, check if .next exists in electron-desktop (after copy) or parent
    const electronDesktopPath = path.dirname(__dirname);
    const electronDesktopNext = path.join(electronDesktopPath, '.next');
    const parentNext = path.join(electronDesktopPath, '..', '.next');
    
    if (fs.existsSync(electronDesktopNext)) {
      appPath = electronDesktopPath;
      nextPath = electronDesktopNext;
    } else {
      // Fallback to parent directory (project root)
      appPath = path.resolve(__dirname, '../..');
      nextPath = path.join(appPath, '.next');
    }
  }

  // Check if .next directory exists
  
  console.log('Checking paths:');
  console.log('  isPackaged:', isPackaged);
  console.log('  appPath:', appPath);
  console.log('  nextPath:', nextPath);
  console.log('  __dirname:', __dirname);
  
  if (!fs.existsSync(nextPath)) {
    // Try alternative paths (more comprehensive search)
    const altPaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', '.next'),
      path.join(process.resourcesPath, 'app.asar.unpacked', '..', '.next'), // Parent of unpacked
      path.join(process.resourcesPath, 'app', '.next'),
      path.join(process.resourcesPath, '.next'), // Root of resources
      path.join(__dirname, '..', '.next'), // Same level as electron-desktop
      path.join(__dirname, '../..', '.next'), // Project root
      path.join(electronApp.getAppPath(), '.next'), // Electron app path
      path.join(electronApp.getAppPath(), '..', '.next'), // Parent of app path
    ];
    
    let foundPath = null;
    for (const altPath of altPaths) {
      try {
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          appPath = path.dirname(altPath);
          nextPath = altPath;
          console.log('Found .next at alternative path:', nextPath);
          break;
        }
      } catch (e) {
        // Skip invalid paths
      }
    }
    
    if (!foundPath) {
      const allPaths = [...altPaths, nextPath];
      throw new Error(`Next.js build not found. Checked:\n${allPaths.join('\n')}\n\nPlease run 'npm run build' first.\n\nCurrent app path: ${electronApp.getAppPath()}\nResources path: ${process.resourcesPath}`);
    }
  }
  
  // Verify this is the correct project by checking package.json
  const packageJsonPath = path.join(appPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('Project name:', packageJson.name);
    if (packageJson.name !== 'shafy_doctor') {
      console.warn(`Warning: Expected project 'shafy_doctor' but found '${packageJson.name}'`);
    }
  }

  // Set NODE_ENV to production
  process.env.NODE_ENV = 'production';
  process.env.PORT = PORT.toString();

  // Change to the app directory
  const originalCwd = process.cwd();
  process.chdir(appPath);

  try {
    // Check if port is available
    const portAvailable = await checkPort(PORT);
    if (!portAvailable) {
      console.warn(`Port ${PORT} is already in use! This might load a different Next.js app.`);
      console.warn('Please close any other Next.js servers running on this port.');
      // Don't use existing server - it might be the wrong project
      throw new Error(`Port ${PORT} is already in use by another application. Please close it first.`);
    }

    console.log('Starting Next.js production server...');
    console.log(`App path: ${appPath}`);
    console.log(`Next path: ${nextPath}`);
    
    // Find next executable - try multiple locations
    const electronDesktopPath = path.dirname(__dirname);
    const possibleNextBins = [
      // Packaged app locations (unpacked)
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'next', 'dist', 'bin', 'next'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', 'next'),
      // Packaged app locations (in app)
      path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next'),
      path.join(appPath, 'node_modules', '.bin', 'next'),
      // Development locations
      path.join(electronDesktopPath, 'node_modules', 'next', 'dist', 'bin', 'next'),
      path.join(electronDesktopPath, 'node_modules', '.bin', 'next'),
      path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next'),
    ];
    
    let nextBin = null;
    let useNpx = false;
    
    for (const testBin of possibleNextBins) {
      if (fs.existsSync(testBin)) {
        nextBin = testBin;
        console.log('Found Next.js executable at:', nextBin);
        break;
      }
      // Try .cmd on Windows
      if (process.platform === 'win32') {
        const testBinCmd = testBin + '.cmd';
        if (fs.existsSync(testBinCmd)) {
          nextBin = testBinCmd;
          console.log('Found Next.js executable at:', nextBin);
          break;
        }
      }
    }
    
    // If still not found, use npx as fallback
    if (!nextBin) {
      console.warn('Next.js executable not found in node_modules, using npx as fallback...');
      useNpx = true;
    }

    // Start Next.js server
    let spawnCommand, spawnArgs;
    
    if (useNpx) {
      // Use npx to run next
      spawnCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      spawnArgs = ['next', 'start', '-p', PORT.toString()];
    } else {
      // Use node to run next executable directly
      spawnCommand = 'node';
      spawnArgs = [nextBin, 'start', '-p', PORT.toString()];
    }
    
    console.log(`Starting Next.js server with: ${spawnCommand} ${spawnArgs.join(' ')}`);
    console.log(`Working directory: ${appPath}`);
    
    nextServerProcess = spawn(spawnCommand, spawnArgs, {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: PORT.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32' // Use shell on Windows for npx
    });

    // Log server output
    nextServerProcess.stdout.on('data', (data) => {
      console.log(`Next.js: ${data.toString()}`);
    });

    nextServerProcess.stderr.on('data', (data) => {
      console.error(`Next.js Error: ${data.toString()}`);
    });

    nextServerProcess.on('exit', (code) => {
      console.log(`Next.js server exited with code ${code}`);
      nextServerProcess = null;
    });

    // Wait for server to be ready
    const serverUrl = `http://localhost:${PORT}`;
    await waitForServer(serverUrl);
    
    console.log('Next.js server started successfully');
    return serverUrl;
  } catch (error) {
    console.error('Failed to start Next.js server:', error);
    throw error;
  } finally {
    // Restore original working directory
    process.chdir(originalCwd);
  }
}

/**
 * Stop Next.js server
 */
function stopNextServer() {
  if (nextServerProcess) {
    console.log('Stopping Next.js server...');
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

module.exports = {
  startNextServer,
  stopNextServer
};
