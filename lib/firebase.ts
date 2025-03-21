import { initializeApp, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Initialize Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB3RC-nn54hwzlM6ZUUFryWqLnR4tOctB0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "descript-15fab.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "descript-15fab",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "descript-15fab.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "619700216448",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:619700216448:web:0dadd2cc00bd80b8b2bc65"
};

// Check if we're running on the client side
const isClient = typeof window !== 'undefined';

// Initialize Firebase app
let app: FirebaseApp;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}

// Initialize and export auth
export const auth = getAuth(app);

// Set auth persistence
if (isClient) {
  setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
}

// Initialize and export Google provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

// Initialize and export Firestore
export const db = getFirestore(app);

// Initialize and export Storage
export const storage = getStorage(app);

// Initialize and export Analytics (only in production and on client)
export let analytics: Analytics | null = null;
if (isClient && process.env.NODE_ENV === 'production') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization skipped:', error);
  }
}

// For backward compatibility
export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseDb(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

export function getGoogleProvider(): GoogleAuthProvider {
  return googleProvider;
}