# Migration Guide: Web App to Desktop App

This guide helps you migrate from the Shafy Doctor web app (Firebase) to the desktop app (SQLite).

## Prerequisites

1. Firebase credentials from your web app
2. Doctor UID
3. Electron desktop app installed

## Migration Steps

### Option 1: Automated Migration (Recommended)

1. **Set up Firebase configuration**:
   - Copy `.env.example` to `.env`
   - Add your Firebase configuration

2. **Run migration script**:
   ```bash
   cd electron-desktop
   node migrations/migrate-from-firebase.js <your-doctor-uid>
   ```

3. **Verify migration**:
   - Check the database in `app.getPath('userData')/database/shafy-doctor.db`
   - Open the app and verify all data is present

### Option 2: Manual Migration

1. **Export data from Firebase Console**:
   - Go to Firebase Console
   - Export collections: `patients`, `reports`, `articles`, `doctors`

2. **Import to SQLite**:
   - Use the migration script as reference
   - Convert Firebase JSON exports to SQLite inserts

## What Gets Migrated

- ✅ **Patients**: All patient records
- ✅ **Reports**: All medical reports
- ✅ **Articles**: All marketing articles/infographics
- ✅ **Doctor Profile**: Doctor profile information
- ⚠️ **Appointments**: Will be synced via appointment sync service (not migrated)

## Post-Migration

1. **Configure appointment sync**:
   - In app settings, enable appointment sync
   - Appointments will be synced from Firebase automatically

2. **Backup database**:
   - Database is located at: `app.getPath('userData')/database/shafy-doctor.db`
   - Backup this file regularly

3. **Verify data integrity**:
   - Check patient counts
   - Verify report associations
   - Test appointment sync

## Notes

- Appointments are synced separately to keep them in sync with online
- All other data is now stored locally and not synced
- You can still use the web app, but data won't automatically sync (except appointments if configured)
