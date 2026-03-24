import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (!_auth) {
    const app = getApp();
    if (!app) return null;
    _auth = getAuth(app);
  }
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  if (!isFirebaseConfigured) return null;
  if (!_db) {
    const app = getApp();
    if (!app) return null;
    _db = getFirestore(app);
  }
  return _db;
}

export const googleProvider = new GoogleAuthProvider();
