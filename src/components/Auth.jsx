import { useState } from "react";
import { login, register, auth } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Auth({ onLoginSuccess }) {
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
      if (isLogin) {
        await login(email, password);
      } else {
        const userCredential = await register(email, password);
        const uid = userCredential.user.uid;

        // Cria o documento do usuário na nova estrutura
        await setDoc(doc(db, "users", uid), {
          name: nome || email.split("@")[0],
          email: email,
          plan: "pro",
          createdAt: new Date(),
          clienteIdCnt: 0,
        });
      }
      onLoginSuccess?.();
    } catch (err) {
      setError(err.message);
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
        padding: "40px 32px",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "420px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12,
            background: "linear-gradient(135deg, #b8952e, #e0c060)",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "#0a0808",
            fontWeight: 700,
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
                style={{
                  width: "100%", padding: "12px 14px", background: "#141419",
                  border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                  fontSize: 15,
                }}
                placeholder="Seu nome"
                required
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
              style={{
                width: "100%", padding: "12px 14px", background: "#141419",
                border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                fontSize: 15,
              }}
              placeholder="seu@email.com"
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
              style={{
                width: "100%", padding: "12px 14px", background: "#141419",
                border: "1px solid #222", borderRadius: 8, color: "#edeae3",
                fontSize: 15,
              }}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p style={{ color: "#e05252", fontSize: 13, marginBottom: 16 }}>{error}</p>}

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
              cursor: "pointer",
            }}
          >
            {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13 }}>
          {isLogin ? (
            <>
              Não tem conta?{" "}
              <span
                onClick={() => setIsLogin(false)}
                style={{ color: "#c8a55e", cursor: "pointer", fontWeight: 500 }}
              >
                Cadastre-se
              </span>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <span
                onClick={() => setIsLogin(true)}
                style={{ color: "#c8a55e", cursor: "pointer", fontWeight: 500 }}
              >
                Entrar
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}