/**
 * Script to copy Next.js build files and required node_modules
 * into electron-desktop directory before building
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const electronDir = __dirname;

console.log('Copying build files...');
console.log('Root directory:', rootDir);
console.log('Electron directory:', electronDir);

// Files/directories to copy
// Note: We don't copy package.json because it would overwrite the Electron package.json
const itemsToCopy = [
  { from: '.next', to: '.next' },
  { from: 'public', to: 'public' },
  { from: 'node_modules/next', to: 'node_modules/next' },
  { from: 'node_modules/react', to: 'node_modules/react' },
  { from: 'node_modules/react-dom', to: 'node_modules/react-dom' },
  { from: 'node_modules/@emotion', to: 'node_modules/@emotion' },
  { from: 'node_modules/@mui', to: 'node_modules/@mui' }
];

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Copy each item
itemsToCopy.forEach(({ from, to }) => {
  const srcPath = path.join(rootDir, from);
  const destPath = path.join(electronDir, to);

  if (!fs.existsSync(srcPath)) {
    console.warn(`Warning: ${from} does not exist, skipping...`);
    return;
  }

  console.log(`Copying ${from} -> ${to}`);
  
  // Remove destination if it exists
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }

  copyRecursive(srcPath, destPath);
  console.log(`✓ Copied ${from}`);
});

console.log('\n✓ All files copied successfully!');
