import { initializeApp } from "firebase/app"
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getFunctions, httpsCallable } from "firebase/functions"

const firebaseConfig = {
  apiKey: "AIzaSyDzPJI6OzB4KFpRgXv1uv3jNUEK7dr8oMQ",
  authDomain: "washlevel-c16d9.firebaseapp.com",
  projectId: "washlevel-c16d9",
  storageBucket: "washlevel-c16d9.firebasestorage.app",
  messagingSenderId: "756159059921",
  appId: "1:756159059921:web:9c9f2948e4bdd21945b2f0",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)
export { httpsCallable }
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged }
