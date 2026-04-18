/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — LoginForm.jsx
   UI de login conectada ao useAuth()
   ═══════════════════════════════════════════════════ */

import { useState } from "react";
import { useAuth } from "./Auth";

const LoginForm = ({ onLoginSuccess }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
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
          <a href="#" className="forgot-password">Esqueceu a senha?</a>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="login-error" role="alert" aria-live="polite">
            <span className="login-error-icon">⚠</span>
            {error}
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
  );
};

export default LoginForm;
