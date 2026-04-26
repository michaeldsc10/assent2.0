/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — LoginForm.jsx
   Login + recuperação de senha via Firebase
   ═══════════════════════════════════════════════════ */

import { useState } from "react";
import { useAuth } from "./Auth";

// ── Ícones SVG inline ────────────────────────────────
const IconEyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const LoginForm = ({ onLoginSuccess }) => {
  const { login, resetPassword } = useAuth();

  // ── estados de login ─────────────────────────────
  const [email,     setEmail]     = useState("");
  const [senha,     setSenha]     = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  // ── estados de recuperação ───────────────────────
  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetMsg,     setResetMsg]     = useState("");
  const [resetError,   setResetError]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // ── submit login ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, senha);
      onLoginSuccess?.();
    } catch (err) {
      setError(err.message ?? "Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // ── submit recuperação ───────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetMsg("E-mail enviado! Verifique sua caixa de entrada.");
    } catch (err) {
      setResetError(err.message ?? "Erro ao enviar e-mail.");
    } finally {
      setResetLoading(false);
    }
  };

  const fecharReset = () => {
    setShowReset(false);
    setResetEmail("");
    setResetMsg("");
    setResetError("");
  };

  // ── render ───────────────────────────────────────
  return (
    <>
      <div className="login-card-wrap">
        <div className="login-card-border" />

        <div className="login-form-card">
          <div className="card-light" />

          {/* Logo */}
          <div className="logo-area">
            <div className="logo-text">
              <span className="logo-assent">Assent</span>{" "}
              <span className="logo-gestao">Gestão</span>
            </div>
            <div className="logo-sub">Quem organiza, cresce!</div>
            <div className="logo-divider" />
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showSenha ? "text" : "password"}
                  id="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowSenha((v) => !v)}
                  disabled={loading}
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSenha ? <IconEyeOff /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <span className="login-error-icon">⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-login"
              disabled={loading}
            >
              <span>{loading ? "Entrando..." : "Entrar no sistema"}</span>
            </button>
          </form>

          <div className="footer-link">
            Esqueceu a senha?{" "}
            <button
              type="button"
              className="forgot-link"
              onClick={() => { setShowReset(true); setResetEmail(email); }}
            >
              Recuperar acesso
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal recuperação de senha ──────────────── */}
      {showReset && (
        <div
          onClick={fecharReset}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(6,6,6,0.96)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "2.5rem 2rem",
              width: "100%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              boxShadow: "0 40px 80px rgba(0,0,0,0.85)",
            }}
          >
            <div>
              <h3 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 22,
                color: "#F0EDE6",
                fontWeight: 400,
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}>
                Recuperar senha
              </h3>
              <p style={{
                color: "rgba(255,255,255,0.3)", fontSize: 13,
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300,
              }}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            {resetMsg && (
              <div style={{
                background: "rgba(52,199,89,0.08)",
                border: "1px solid rgba(52,199,89,0.25)",
                borderRadius: 8, padding: "0.75rem 1rem",
                color: "#4ade80", fontSize: 13,
                fontFamily: "'Montserrat', sans-serif",
              }}>
                ✓ {resetMsg}
              </div>
            )}

            {resetError && (
              <div style={{
                background: "rgba(224,82,82,0.08)",
                border: "1px solid rgba(224,82,82,0.25)",
                borderRadius: 8, padding: "0.75rem 1rem",
                color: "#e05252", fontSize: 13,
                fontFamily: "'Montserrat', sans-serif",
              }}>
                ⚠ {resetError}
              </div>
            )}

            {!resetMsg && (
              <form onSubmit={handleReset} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="input-group">
                  <label htmlFor="reset-email">E-mail</label>
                  <input
                    type="email"
                    id="reset-email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={resetLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={resetLoading}
                  style={{ opacity: resetLoading ? 0.6 : 1, cursor: resetLoading ? "not-allowed" : "pointer" }}
                >
                  <span>{resetLoading ? "Enviando..." : "Enviar link de recuperação"}</span>
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={fecharReset}
              style={{
                background: "none", border: "none",
                color: "rgba(255,255,255,0.25)", fontSize: 12,
                cursor: "pointer", textAlign: "center",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {resetMsg ? "Fechar" : "Cancelar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginForm;
