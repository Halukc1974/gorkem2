import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Lazy initializer for Firebase Admin. This avoids throwing at import time when
 * the environment variables are not yet provided (useful for cPanel deployments
 * where envs are configured after upload).
 */
export function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();

  console.log('🔧 [DEBUG] Initializing Firebase Admin...');
  console.log('🔧 [DEBUG] Available env vars:', {
    hasGoogleCreds: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    hasBase64: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasIndividualKeys: !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID)
  });

  // Priority: GOOGLE_APPLICATION_CREDENTIALS file -> FIREBASE_SERVICE_ACCOUNT_BASE64 -> FIREBASE_SERVICE_ACCOUNT (JSON string) -> individual envs
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('🔧 [DEBUG] Using GOOGLE_APPLICATION_CREDENTIALS');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    return admin.app();
  }

  // Fallback: look for a credentials file inside dist/credentials
  try {
    const fallbackDir = path.resolve(process.cwd(), 'dist', 'credentials');
    if (fs.existsSync(fallbackDir)) {
      const files = fs.readdirSync(fallbackDir).filter(f => f.endsWith('.json'));
      if (files.length > 0) {
        const filePath = path.join(fallbackDir, files[0]);
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        admin.initializeApp({
          credential: admin.credential.cert(parsed as any),
        });
        return admin.app();
      }
    }
  } catch (err) {
    // ignore and continue to other options
    // console.warn('Firebase fallback credential read failed', err);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log('🔧 [DEBUG] Using FIREBASE_SERVICE_ACCOUNT_BASE64');
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(parsed as any),
    });
    return admin.app();
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('🔧 [DEBUG] Using FIREBASE_SERVICE_ACCOUNT');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    try {
      const parsed = JSON.parse(raw as string);
      admin.initializeApp({
        credential: admin.credential.cert(parsed as any),
      });
      return admin.app();
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT must be a valid JSON string');
    }
  }

  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    console.log('🔧 [DEBUG] Using individual Firebase env vars');
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      } as any),
    });
    return admin.app();
  }

  // Development fallback: Use project ID only with application default credentials
  // This will work if you're authenticated with gcloud or in environments with ambient credentials
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 [DEBUG] Development mode - trying application default with project gorkemapp');
    try {
      admin.initializeApp({
        projectId: 'gorkemapp',
      });
      console.log('✅ [DEBUG] Firebase Admin initialized with project ID only');
      return admin.app();
    } catch (err) {
      console.warn('⚠️ [DEBUG] Application default credentials failed:', err.message);
    }
  }

  // If none of the credential options are present, throw when the caller
  // actually tries to use Firebase Admin (this function is intentionally
  // lazy to allow the server to start in environments where creds are set
  // later via the hosting UI).
  throw new Error('Firebase admin credentials not found in environment. Provide GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT, or the individual FIREBASE_* vars.');
}

// Keep default export only; `getFirebaseAdmin` is already exported at its declaration
export default admin;
