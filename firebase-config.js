// Paste your Firebase web config here (Project settings > Your apps > Web app).
// Leave apiKey empty to run in demo mode (data stays on this device).
export const firebaseConfig = {
  // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDoK26wsnKN0cB86XXnnGa0LhfFm5kXxhE",
  authDomain: "my-lifts-8572d.firebaseapp.com",
  projectId: "my-lifts-8572d",
  storageBucket: "my-lifts-8572d.firebasestorage.app",
  messagingSenderId: "421336169251",
  appId: "1:421336169251:web:973bd568763264fecbea96"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
};
export const FIREBASE_VERSION = "11.0.2";
