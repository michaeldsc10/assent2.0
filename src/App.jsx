/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx (merged)
   ─ Remove: onAuthStateChanged local (AuthProvider já faz isso)
   ─ Remove: estado user/loading local (vem de useAuth agora)
   ─ Mantém: Dashboard, estilo do loading, layout do login
   ═══════════════════════════════════════════════════ */

import "./App.css";
import { AuthProvider, PrivateRoute, useAuth } from "./components/Auth";
import LoginForm from "./components/LoginForm";
import BrandAnimation from "./components/BrandAnimation"; // mantém se você usa a animação
import Dashboard from "./Dashboard";

// ─── Shell: decide o que renderizar com base no auth ─
function AppShell() {
  const { user, loading } = useAuth();

  // Mantém exatamente o estilo do seu loading original
  if (loading) {
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

  // Autenticado → Dashboard protegido
  if (user) {
    return (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    );
  }

  // Não autenticado → tela de login
  // Se não usa BrandAnimation, substitua pelo layout simples abaixo:
  //   return <LoginForm />;
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

// ─── Root ─────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
