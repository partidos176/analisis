import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child,
  serverTimestamp
} from "firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB3JFhrBA8NhUKa0cwchGQeusjMn9ZelwM",
  authDomain: "juanantonioelanalistaconia.firebaseapp.com",
  databaseURL: "https://juanantonioelanalistaconia-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "juanantonioelanalistaconia",
  storageBucket: "juanantonioelanalistaconia.firebasestorage.app",
  messagingSenderId: "1027750229416",
  appId: "1:1027750229416:web:6091bf003b55527552d99d",
  measurementId: "G-665N3XYC4Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

export {
  app,
  db,
  auth,
  storage,
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child, 
  serverTimestamp,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
};
export default db;
