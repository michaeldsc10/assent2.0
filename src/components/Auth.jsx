/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Auth.jsx
   AuthProvider + useAuth + PrivateRoute
   SEM UI — lógica pura de autenticação
   ═══════════════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

// ─── Contexto ────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Detecta sessão persistida ao montar
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── login ──────────────────────────────────────────
  async function login(email, senha) {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !senha) {
      throw new AuthError("empty-fields", "Preencha e-mail e senha.");
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, senha);
      return credential.user;
    } catch (err) {
      throw mapFirebaseError(err);
    }
  }

  // ── logout ─────────────────────────────────────────
  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }
  return ctx;
}

// ─── PrivateRoute ─────────────────────────────────────
/**
 * Uso: <PrivateRoute onRedirect={() => setView('login')}>
 *        <Dashboard />
 *      </PrivateRoute>
 *
 * Enquanto loading === true, renderiza um placeholder neutro
 * para evitar flash de conteúdo protegido.
 */
export function PrivateRoute({ children, onRedirect, fallback = null }) {
  const { user, loading } = useAuth();

  if (loading) {
    return fallback ?? <LoadingScreen />;
  }

  if (!user) {
    // Chama callback de redirecionamento fornecido pelo App
    onRedirect?.();
    return null;
  }

  return children;
}

// ─── Loading Screen ───────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: "2px solid rgba(212,175,55,0.2)",
          borderTop: "2px solid #D4AF37",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{
          color: "rgba(212,175,55,0.6)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          Verificando sessão...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Utilitário interno: erros tipados ────────────────
class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function mapFirebaseError(err) {
  const map = {
    "auth/user-not-found":     "E-mail não encontrado.",
    "auth/wrong-password":     "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email":      "E-mail inválido.",
    "auth/user-disabled":      "Conta desativada. Contate o suporte.",
    "auth/too-many-requests":  "Muitas tentativas. Aguarde e tente novamente.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  };

  const message = map[err.code] ?? "Ocorreu um erro inesperado. Tente novamente.";
  return new AuthError(err.code ?? "unknown", message);
}
