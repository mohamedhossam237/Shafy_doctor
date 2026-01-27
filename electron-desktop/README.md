# Shafy Doctor Desktop Application

Desktop version of Shafy Doctor built with Electron, React, and SQLite.

## Features

- **Local Data Storage**: All data (patients, reports, articles, doctor profile) stored locally in SQLite
- **Appointment Sync**: Appointments can be synced to/from Firebase (online)
- **Offline First**: Works completely offline except for appointment syncing
- **Fast & Secure**: SQLite provides fast local queries and data privacy

## Architecture

- **Main Process**: Electron main process (`main.js`) handles database operations and IPC
- **Renderer Process**: React app (Next.js) runs in renderer process
- **Database**: SQLite database stored in user data directory
- **Sync**: Firebase used only for appointment synchronization (optional)

## Setup

1. Install dependencies:
```bash
cd electron-desktop
npm install
```

2. Install React dependencies (in root directory):
```bash
cd ..
npm install
```

3. Configure Firebase (optional, for appointment sync):
   - Copy `.env.example` to `.env`
   - Add your Firebase configuration

4. Run in development:
```bash
cd electron-desktop
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Database Schema

- **patients**: Patient information
- **reports**: Medical reports
- **appointments_local**: Local appointments (can sync to Firebase)
- **articles**: Marketing articles/infographics
- **doctor_profile**: Doctor profile information
- **settings**: Application settings

## IPC API

The renderer process can communicate with the main process using `window.electronAPI`:

```javascript
// Get patients
const result = await window.electronAPI.db.getPatients();

// Create patient
await window.electronAPI.db.createPatient(patientData);

// Sync appointments from online
await window.electronAPI.appointments.syncFromOnline(doctorUID);

// Sync appointments to online
await window.electronAPI.appointments.syncToOnline(doctorUID);
```

## Migration from Web Version

To migrate existing Firebase data:

1. Export data from Firebase
2. Use migration scripts (to be created) to import into SQLite
3. Configure appointment sync to keep appointments synced

## Building

- Windows: `npm run dist` (creates installer and portable)
- macOS: `npm run dist` (creates DMG and ZIP)
- Linux: `npm run dist` (creates AppImage and DEB)

## Notes

- Database is stored in app user data directory
- Appointments can optionally sync to Firebase
- All other data stays local for privacy and performance
- Backup database regularly (stored in `app.getPath('userData')/database/`)
