/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx (merged)
   ═══════════════════════════════════════════════════ */

import "./App.css";
import { AuthProvider, PrivateRoute, useAuth } from "./components/Auth";
import { AuthProvider as AuthProviderCargo } from "./contexts/AuthContext";
import LoginForm from "./components/LoginForm";
import BrandAnimation from "./components/BrandAnimation";
import Dashboard from "./Dashboard";

// ─── Shell: decide o que renderizar com base no auth ─
function AppShell() {
  const { user, loading } = useAuth();

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

  if (user) {
    return (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    );
  }

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
    <AuthProviderCargo>   {/* fornece cargo/permissões para RotaProtegida */}
      <AuthProvider>      {/* fornece user/loading para AppShell */}
        <AppShell />
      </AuthProvider>
    </AuthProviderCargo>
  );
}

export default App;
