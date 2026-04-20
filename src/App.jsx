/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx
   Dois providers empilhados:
   - AuthProviderCargo (contexts/AuthContext) → RotaProtegida + usePermissao
   - AuthProvider (components/Auth)           → LoginForm + AppShell
   ═══════════════════════════════════════════════════ */

import "./App.css";
import { AuthProvider, useAuth }              from "./components/Auth";
import { AuthProvider as AuthProviderCargo }  from "./contexts/AuthContext";
import LoginForm     from "./components/LoginForm";
import BrandAnimation from "./components/BrandAnimation";
import Dashboard     from "./Dashboard";

function AppShell() {
  const { user, loading } = useAuth(); // vem do components/Auth

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
    return <Dashboard />;
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

function App() {
  return (
    <AuthProviderCargo>   {/* fornece cargo/podeVer → RotaProtegida + usePermissao */}
      <AuthProvider>      {/* fornece user/login/logout → LoginForm + AppShell */}
        <AppShell />
      </AuthProvider>
    </AuthProviderCargo>
  );
}

export default App;
