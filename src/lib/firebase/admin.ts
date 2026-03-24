/**
 * Firebase Admin SDK initialization
 * Used server-side only in API routes and Cloud Functions
 * Never expose to browser
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const usingEmulators =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

function createAdminApp() {
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required for Firebase Admin initialization.');
  }

  if (usingEmulators) {
    // Emulator mode does not require a service account private key.
    return initializeApp({ projectId });
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required outside emulator mode.'
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// Prevent re-initialization on hot reload
const app = getApps()[0] ?? createAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export default app;
