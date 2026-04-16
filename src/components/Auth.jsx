/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Auth.jsx
   Login + Cadastro com criação de licença PRO
   ═══════════════════════════════════════════════════ */

import { useState } from "react";
import { login, register, verificarLicencaPro } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let uid;

      if (isLogin) {
        const userCredential = await login(email, password);
        uid = userCredential.user.uid;
      } else {
        const userCredential = await register(email, password);
        uid = userCredential.user.uid;

        // Cria documento do usuário
        await setDoc(doc(db, "users", uid), {
          name: nome.trim() || email.split("@")[0],
          email: email.toLowerCase(),
          createdAt: new Date(),
          clienteIdCnt: 0,
          vendedorIdCnt: 0,
          vendaIdCnt: 0,
          // Removemos o campo "plan" daqui
        });

        // Cria documento de licença (nova estrutura)
        await setDoc(doc(db, "licencas", uid), {
          clienteAG: true,
          pro: true,
          plano: "pro",
          dataInicio: new Date(),
          // Você pode adicionar dataExpiracao no futuro
        });
      }

      // Verifica licença (mesmo no login)
      const temLicencaPro = await verificarLicencaPro(uid);

      if (!temLicencaPro) {
        setError("Sua licença não está ativa. Contate o suporte.");
        return;
      }

      onAuthSuccess?.();
    } catch (err) {
      console.error("Erro de autenticação:", err.code, err.message);

      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está cadastrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090c",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      color: "#edeae3",
    }}>
      <div style={{
        background: "#0f0f13",
        padding: "40px 36px",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "420px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: 68, height: 68, borderRadius: 14,
            background: "linear-gradient(135deg, #c8a55e, #e0c060)",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#0a0808",
          }}>AG</div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 28 }}>Assent Gestão</h1>
          <p style={{ color: "#787480", marginTop: 8 }}>
            {isLogin ? "Entre na sua conta" : "Crie sua conta grátis"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#787480" }}>
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                style={{
                  width: "100%", padding: "12px 14px", background: "#141419",
                  border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                  fontSize: 15,
                }}
                required={!isLogin}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#787480" }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: "100%", padding: "12px 14px", background: "#141419",
                border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                fontSize: 15,
              }}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#787480" }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%", padding: "12px 14px", background: "#141419",
                border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                fontSize: 15,
              }}
              required
            />
          </div>

          {error && <p style={{ color: "#e05252", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: "#c8a55e",
              color: "#0a0808",
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              borderRadius: 9,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Processando..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13 }}>
          {isLogin ? (
            <>Não tem conta? <span onClick={() => { setIsLogin(false); setError(""); }} style={{ color: "#c8a55e", cursor: "pointer" }}>Cadastre-se</span></>
          ) : (
            <>Já tem conta? <span onClick={() => { setIsLogin(true); setError(""); }} style={{ color: "#c8a55e", cursor: "pointer" }}>Entrar</span></>
          )}
        </div>
      </div>
    </div>
  );
}
