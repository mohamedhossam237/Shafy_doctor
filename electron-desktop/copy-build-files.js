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

// Check if .next directory exists in root
const nextBuildPath = path.join(rootDir, '.next');
if (!fs.existsSync(nextBuildPath)) {
  console.error('\n❌ ERROR: .next build directory not found!');
  console.error(`Expected location: ${nextBuildPath}`);
  console.error('\nTo fix this:');
  console.error('1. Make sure you are in the project root directory');
  console.error('2. Run: npm run build');
  console.error('3. Then run: cd electron-desktop && npm run prebuild');
  process.exit(1);
}

console.log('✓ Found .next build directory');

// Files/directories to copy
const itemsToCopy = [
  { from: '.next', to: '.next' },
  { from: 'public', to: 'public' },
  { from: 'node_modules/next', to: 'node_modules/next' },
  { from: 'node_modules/react', to: 'node_modules/react' },
  { from: 'node_modules/react-dom', to: 'node_modules/react-dom' },
  { from: 'node_modules/@emotion', to: 'node_modules/@emotion' },
  { from: 'node_modules/@mui', to: 'node_modules/@mui' },
  { from: 'node_modules/dayjs', to: 'node_modules/dayjs' },
  { from: 'node_modules/cookie', to: 'node_modules/cookie' },
  { from: 'node_modules/firebase', to: 'node_modules/firebase' },
  { from: 'node_modules/framer-motion', to: 'node_modules/framer-motion' },
  { from: 'node_modules/recharts', to: 'node_modules/recharts' },
  { from: 'node_modules/bidi-js', to: 'node_modules/bidi-js' },
  { from: 'node_modules/arabic-persian-reshaper', to: 'node_modules/arabic-persian-reshaper' },
  { from: 'node_modules/arabic-reshaper', to: 'node_modules/arabic-reshaper' },
  { from: 'node_modules/next-seo', to: 'node_modules/next-seo' }
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
