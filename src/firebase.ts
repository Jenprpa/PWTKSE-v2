import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC4aOx0I4wcg5QG_MoEZYw9vvEn85jjVSU",
  authDomain: "pwtkse-v2.firebaseapp.com",
  projectId: "pwtkse-v2",
  storageBucket: "pwtkse-v2.firebasestorage.app",
  messagingSenderId: "28155332625",
  appId: "1:28155332625:web:f96aa1ba3c7f1272da09b0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);