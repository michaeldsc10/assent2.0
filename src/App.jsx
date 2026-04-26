/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — App.jsx
   Dois providers empilhados:
   - AuthProviderCargo (contexts/AuthContext) → RotaProtegida + usePermissao
   - AuthProvider (components/Auth)           → LoginForm (login/resetPassword)

   GATE DE RENDER: usa tenantUid + loadingAuth do AuthContext (application-level),
   NÃO user/loading do Auth (Firebase-level). Isso evita o flash de dashboard
   para usuários autenticados no Firebase mas sem registro no Firestore.
   ═══════════════════════════════════════════════════ */
import "./App.css";
import { AuthProvider, useAuth }             from "./components/Auth";
import { AuthProvider as AuthProviderCargo } from "./contexts/AuthContext";
import { useAuth as useAuthCargo }           from "./contexts/AuthContext";
import LoginForm         from "./components/LoginForm";
import BrandAnimation    from "./components/BrandAnimation";
import Dashboard         from "./Dashboard";
import AnnouncementModal from "./components/AnnouncementModal";

/* ─────────────────────────────────────────
   Shell do app — decide o que renderizar
───────────────────────────────────────── */
function AppShell() {
  // components/Auth: só usamos `loading` para saber se o Firebase Auth
  // já inicializou. Não usamos `user` para o gate de render.
  const { loading } = useAuth();

  // contexts/AuthContext: source of truth para autenticação no nível de aplicação.
  // tenantUid só é preenchido após carregarPerfil validar o usuário no Firestore.
  const { tenantUid, loadingAuth, cargo } = useAuthCargo();

  // Plano do usuário para filtrar destinatários do AnnouncementModal
  const userPlan = cargo === "pro" ? "pro" : "free";

  // ── Aguarda AMBOS os sistemas resolverem antes de qualquer decisão ──
  // loadingAuth cobre o caso principal (carregarPerfil em andamento).
  // loading cobre o instante inicial em que o Firebase Auth ainda não disparou.
  if (loading || loadingAuth) {
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

  // ── Gate em tenantUid, não em user ──────────────────────────────────
  // tenantUid só existe quando o Firestore confirmou que o usuário tem
  // perfil válido (admin/licença/convidado ativo). Isso elimina o flash
  // de dashboard para usuários com conta Firebase mas sem registro.
  if (tenantUid) {
    return (
      <>
        <Dashboard />
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
    <AuthProviderCargo>   {/* fornece tenantUid/cargo/loadingAuth → gate de render */}
      <AuthProvider>      {/* fornece login/resetPassword → LoginForm */}
        <AppShell />
      </AuthProvider>
    </AuthProviderCargo>
  );
}

export default App;
