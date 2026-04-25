/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx
   Dois providers empilhados:
   - AuthProviderCargo (contexts/AuthContext) → RotaProtegida + usePermissao
   - AuthProvider (components/Auth)           → LoginForm + AppShell
   ═══════════════════════════════════════════════════ */
import "./App.css";
import { AuthProvider, useAuth }              from "./components/Auth";
import { AuthProvider as AuthProviderCargo }  from "./contexts/AuthContext";
import { useAuth as useAuthCargo }            from "./contexts/AuthContext"; // expõe cargo/pro
import LoginForm        from "./components/LoginForm";
import BrandAnimation   from "./components/BrandAnimation";
import Dashboard        from "./Dashboard";
import AnnouncementModal from "./components/AnnouncementModal"; // ← NOVO

/* ─────────────────────────────────────────
   Shell do app — decide o que renderizar
   e injeta o modal de anúncio
───────────────────────────────────────── */
function AppShell() {
  const { user, loading } = useAuth(); // components/Auth → autenticação
  const { cargo }         = useAuthCargo(); // contexts/AuthContext → cargo/plano

  /* Determina o plano do usuário para filtrar destinatários do anúncio.
     Ajuste a lógica conforme o campo que indica PRO no seu AuthContext.
     Exemplos: cargo === "pro", licencas?.pro === true, etc. */
  const userPlan = cargo === "pro" ? "pro" : "free";

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#09090c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#787480",
          fontSize: "15px",
        }}
      >
        Carregando...
      </div>
    );
  }

  if (user) {
    return (
      <>
        <Dashboard />
        {/* Modal de anúncio: aparece logo após o login, uma vez por sessão */}
        <AnnouncementModal userPlan={userPlan} />
      </>
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

/* ─────────────────────────────────────────
   Root — providers empilhados
───────────────────────────────────────── */
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
