/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — firebase.js
   Configuração Firebase + Auth + Verificação de Licença
   ═══════════════════════════════════════════════════ */

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged   // ← Adicionado aqui!
} from "firebase/auth";

import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyB9HEWiHFc8YEuj_Ab-7TxGKqdQkSRQAio",
  authDomain:        "assent-2b945.firebaseapp.com",
  projectId:         "assent-2b945",
  storageBucket:     "assent-2b945.firebasestorage.app",
  messagingSenderId: "851051401705",
  appId:             "1:851051401705:web:fa6ebb1cc6ee5d3a737b78",
  measurementId:     "G-K7F0F7PZ8M",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const firebaseConfig = { apiKey: "...", authDomain: "...", ... };

/* ── Funções de Autenticação ── */
export const login = (email, password) => 
  signInWithEmailAndPassword(auth, email, password);

export const register = (email, password) => 
  createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

/* ── Listener de Estado de Autenticação (usado no App.jsx / Dashboard) ── */
export { onAuthStateChanged };

/* ── Nova função: Verificar Licença PRO ── */
export const verificarLicencaPro = async (uid) => {
  if (!uid) return false;

  try {
    const licencaRef = doc(db, "licencas", uid);
    const licencaSnap = await getDoc(licencaRef);

    if (!licencaSnap.exists()) return false;

    const data = licencaSnap.data();
    return !!(data.clienteAG === true && data.pro === true);
  } catch (error) {
    console.error("Erro ao verificar licença:", error);
    return false;
  }
};
