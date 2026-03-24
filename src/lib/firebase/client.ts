/**
 * Firebase Client SDK initialization
 * Used in browser and Next.js client-side code
 * Read-only access: all writes go through API routes
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Prevent re-initialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Connect to emulator in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST) {
    try {
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    } catch (e) {
      // Already connected or error connecting
    }
  }
}

export default app;
