import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the databaseId specified in firebase-applet-config.json
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Initialize Firestore
export const db = initializeFirestore(app, {}, databaseId);

export { app };
