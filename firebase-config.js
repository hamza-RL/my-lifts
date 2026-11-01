import { initializeApp } from "firebase/app";

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

export default app;
