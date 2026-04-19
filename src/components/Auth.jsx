/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Auth.jsx
   AuthProvider + useAuth + PrivateRoute
   v2.1: verifica licencas/{uid}.ativo antes de liberar
   ═══════════════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function login(email, senha) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !senha) {
      throw new AuthError("empty-fields", "Preencha e-mail e senha.");
    }
    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, senha);

      /* ── Verificação de licença ativo=true ── */
      const uid         = credential.user.uid;
      const licencaSnap = await getDoc(doc(db, "licencas", uid));

      if (!licencaSnap.exists() || licencaSnap.data().ativo !== true) {
        await signOut(auth);
        throw new AuthError(
          "licenca-inativa",
          "Sua licença está inativa. Entre em contato com o suporte."
        );
      }

      return credential.user;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw mapFirebaseError(err);
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  async function resetPassword(email) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new AuthError("empty-email", "Digite seu e-mail para recuperar a senha.");
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (err) {
      throw mapFirebaseError(err);
    }
  }

  const value = { user, loading, login, logout, resetPassword };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

export function PrivateRoute({ children, onRedirect, fallback = null }) {
  const { user, loading } = useAuth();
  if (loading) return fallback ?? <LoadingScreen />;
  if (!user) { onRedirect?.(); return null; }
  return children;
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#050505",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{
        width: 48, height: 48,
        border: "2px solid rgba(212,175,55,0.2)",
        borderTop: "2px solid #D4AF37",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "rgba(212,175,55,0.6)", fontFamily: "sans-serif", fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Verificando sessão...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

class AuthError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function mapFirebaseError(err) {
  const map = {
    "auth/user-not-found":         "E-mail não encontrado.",
    "auth/wrong-password":         "Senha incorreta.",
    "auth/invalid-credential":     "E-mail ou senha incorretos.",
    "auth/invalid-email":          "E-mail inválido.",
    "auth/user-disabled":          "Conta desativada. Contate o suporte.",
    "auth/too-many-requests":      "Muitas tentativas. Aguarde e tente novamente.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  };
  const message = map[err.code] ?? "Ocorreu um erro inesperado. Tente novamente.";
  return new AuthError(err.code ?? "unknown", message);
}
