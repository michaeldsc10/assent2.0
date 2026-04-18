/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — LoginForm.jsx
   Login + recuperação de senha via Firebase
   ═══════════════════════════════════════════════════ */

import { useState } from "react";
import { useAuth } from "./Auth";

const LoginForm = ({ onLoginSuccess }) => {
  const { login, resetPassword } = useAuth();

  // ── estados de login ────────────────────────────────
  const [email,    setEmail]    = useState("");
  const [senha,    setSenha]    = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // ── estados de recuperação ──────────────────────────
  const [showReset,     setShowReset]     = useState(false);
  const [resetEmail,    setResetEmail]    = useState("");
  const [resetMsg,      setResetMsg]      = useState("");   // sucesso
  const [resetError,    setResetError]    = useState("");
  const [resetLoading,  setResetLoading]  = useState(false);

  // ── submit login ────────────────────────────────────
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

  // ── submit recuperação ──────────────────────────────
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

  // ── render ──────────────────────────────────────────
  return (
    <>
      <div className="login-form-card">
        <div className="login-header brand-header">
          <h2 className="brand-title">Assent <span>Gestão</span></h2>
          <p className="brand-subtitle">Quem organiza, cresce.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              placeholder="Seu e-mail profissional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="input-group" style={{ marginTop: "1rem" }}>
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="forgot-password"
              onClick={() => { setShowReset(true); setResetEmail(email); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Esqueceu a senha?
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert" aria-live="polite">
              <span className="login-error-icon">⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            <span>{loading ? "Entrando..." : "Entrar"}</span>
          </button>
        </form>
      </div>

      {/* ── Modal recuperação de senha ─────────────────── */}
      {showReset && (
        <div
          onClick={fecharReset}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111",
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 16,
              padding: "2.5rem 2rem",
              width: "100%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div>
              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 26,
                color: "#F0EDE6",
                fontWeight: 400,
                marginBottom: 6,
              }}>
                Recuperar senha
              </h3>
              <p style={{ color: "#a0a0a0", fontSize: 14 }}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            {/* Feedback de sucesso */}
            {resetMsg && (
              <div style={{
                background: "rgba(52,199,89,0.1)",
                border: "1px solid rgba(52,199,89,0.3)",
                borderRadius: 8, padding: "0.75rem 1rem",
                color: "#4ade80", fontSize: 14,
              }}>
                ✓ {resetMsg}
              </div>
            )}

            {/* Feedback de erro */}
            {resetError && (
              <div style={{
                background: "rgba(224,82,82,0.1)",
                border: "1px solid rgba(224,82,82,0.3)",
                borderRadius: 8, padding: "0.75rem 1rem",
                color: "#e05252", fontSize: 14,
              }}>
                ⚠ {resetError}
              </div>
            )}

            {/* Formulário — some após sucesso */}
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
                  style={{ opacity: resetLoading ? 0.7 : 1, cursor: resetLoading ? "not-allowed" : "pointer" }}
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
                color: "#a0a0a0", fontSize: 13,
                cursor: "pointer", textAlign: "center",
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
