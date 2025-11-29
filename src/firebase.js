// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCuWA8sRGPo6ZIx3SQ3vKI2AAam2jCJJWo",
  authDomain: "hackthon-def00.firebaseapp.com",
  projectId: "hackthon-def00",
  storageBucket: "hackthon-def00.firebasestorage.app",
  messagingSenderId: "496499762070",
  appId: "1:496499762070:web:2427c8584841814af0f3b7",
  measurementId: "G-TWVL2W0G59",
  databaseURL: "https://hackthon-def00-default-rtdb.firebaseio.com"
};

// Initialize Firebase
let app;
try {
  const apps = getApps();
  app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
} catch (error) {
  // Fallback initialization
  app = initializeApp(firebaseConfig);
}

// Initialize Analytics only if in browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    // Analytics might already be initialized
    console.warn('Analytics initialization:', error.message);
  }
}

// Initialize Auth, Firestore, and Realtime Database
const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDb = getDatabase(app);

export { auth, analytics, db, realtimeDb };
export default app;

