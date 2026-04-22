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
  onAuthStateChanged,
} from "firebase/auth";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

// ⚠️ Todas as chaves são lidas de variáveis de ambiente (.env)
// Nunca commite valores reais neste arquivo.
// Copie .env.example para .env e preencha com suas credenciais.
// O objeto é exportado pois o módulo Usuarios.jsx usa para criar a secondary app.
export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);


/* ── Funções de Autenticação ── */
export const login    = (email, password) =>
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
    const licencaRef  = doc(db, "licencas", uid);
    const licencaSnap = await getDoc(licencaRef);

    if (!licencaSnap.exists()) return false;

    const data = licencaSnap.data();
    return !!(data.clienteAG === true && data.pro === true);
  } catch (error) {
    console.error("Erro ao verificar licença:", error);
    return false;
  }
};
