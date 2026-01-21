// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // This command pulls the value from Cloudflare's settings
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  
  authDomain: "leicester-eye-clinic.firebaseapp.com",
  projectId: "leicester-eye-clinic",
  storageBucket: "leicester-eye-clinic.firebasestorage.app",
  messagingSenderId: "999920746470",
  appId: "1:999920746470:web:b013872c496f4719d7a027",
  measurementId: "G-PGQRC1E6G7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);