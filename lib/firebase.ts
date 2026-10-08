import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web configuration is public. Access is enforced by Auth and Firestore rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyAqw85ZVMmqHA_QIt2_7JJEhHZTHeM5QEE',
  authDomain: 'since-tracker-app.firebaseapp.com',
  projectId: 'since-tracker-app',
  storageBucket: 'since-tracker-app.firebasestorage.app',
  messagingSenderId: '740987046347',
  appId: '1:740987046347:web:dc36112d1ebafca942ce4e',
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
