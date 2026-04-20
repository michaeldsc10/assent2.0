/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx
   Usa apenas AuthContext.jsx (contexts/) como fonte única de auth.
   Remove dependência de ./components/Auth para evitar conflito de contextos.
   ═══════════════════════════════════════════════════ */

import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginForm from "./components/LoginForm";
import BrandAnimation from "./components/BrandAnimation";
import Dashboard from "./Dashboard";

// ─── Shell: decide o que renderizar com base no auth ─────────────────────────
function AppShell() {
  const { user, loadingAuth } = useAuth(); // loadingAuth vem do AuthContext novo

  if (loadingAuth) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#09090c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#787480",
        fontSize: "15px",
      }}>
        Carregando...
      </div>
    );
  }

  // Autenticado → Dashboard (RotaProtegida cuida do controle por módulo)
  if (user) {
    return <Dashboard />;
  }

  // Não autenticado → tela de login
  return (
    <div className="login-container">
      <div className="login-left">
        <BrandAnimation />
      </div>
      <div className="login-right">
        <LoginForm />
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
