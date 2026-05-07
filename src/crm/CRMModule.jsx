/* ═══════════════════════════════════════════════════════════════
   ASSENT CRM — CRMModule.jsx
   Sistema de retenção integrado ao ASSENT Gestão v2.0.

   Props:
     tenantUid   — uid do tenant (do AuthContext do AG)
     nomeEmpresa — nome da empresa (do useEmpresa do AG)
     onVoltar    — callback para voltar ao AG
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import {
  useCRM,
  montarPromptMensagem,
  ignorarCliente,
  reativarCliente,
} from "./useCRM";
import LeadsPage          from "./LeadsPage";
import ConfigPage         from "./ConfigPage";
import NotificacoesLeads  from "./NotificacoesLeads";
import { useLeads }       from "./useLeads";

// ── Fontes ────────────────────────────────────────────────────────────────────
if (!document.getElementById("crm-fonts")) {
  const link = document.createElement("link");
  link.id   = "crm-fonts";
  link.rel  = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

const FONT       = "'Inter', system-ui, sans-serif";
const FONT_BRAND = "'Cinzel', serif";
const FONT_MONO  = "'JetBrains Mono', monospace";

// ─── Hook de Breakpoint ───────────────────────────────────────────────────────
function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile:  width < 640,
    isTablet:  width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
}

// ─── Temas ────────────────────────────────────────────────────────────────────
const TEMAS = {
  dark: {
    bg: "#070707",
    surface: "#0f0f12",
    surfaceAlt: "#16161a",
    border: "rgba(255,255,255,0.07)",
    borderAlt: "rgba(255,255,255,0.12)",
    text: "#ffffff",
    textMid: "rgba(255,255,255,0.55)",
    textDim: "rgba(255,255,255,0.28)",
    gold: "#d4af37",
    goldLight: "#f4d77a",
    goldDim: "rgba(212,175,55,0.08)",
    goldGlow: "rgba(212,175,55,0.15)",
    goldBorder: "rgba(212,175,55,0.22)",
    goldGradient: "linear-gradient(135deg,#f4d77a 0%,#d4af37 50%,#a47d1f 100%)",
    red: "#e05252",
    redDim: "rgba(224,82,82,0.08)",
    redBorder: "rgba(224,82,82,0.22)",
    yellow: "#d4903a",
    yellowDim: "rgba(212,144,58,0.08)",
    yellowBorder: "rgba(212,144,58,0.22)",
    green: "#3aad78",
    greenDim: "rgba(58,173,120,0.08)",
    greenBorder: "rgba(58,173,120,0.22)",
    blue: "#4a8fd4",
    blueDim: "rgba(74,143,212,0.08)",
    blueBorder: "rgba(74,143,212,0.22)",
  },
  light: {
    bg: "#f4f4f6",
    surface: "#ffffff",
    surfaceAlt: "#f0f0f4",
    border: "#e4e4ea",
    borderAlt: "#d0d0d8",
    text: "#0f0f12",
    textMid: "#56566a",
    textDim: "#a0a0b8",
    gold: "#a07828",
    goldLight: "#c8982a",
    goldDim: "rgba(160,120,40,0.08)",
    goldGlow: "rgba(160,120,40,0.08)",
    goldBorder: "rgba(160,120,40,0.25)",
    goldGradient: "linear-gradient(135deg,#c8982a 0%,#a07828 50%,#7a5a1a 100%)",
    red: "#c03030",
    redDim: "#fde8e8",
    redBorder: "rgba(192,48,48,0.22)",
    yellow: "#b06010",
    yellowDim: "#fdf0e0",
    yellowBorder: "rgba(176,96,16,0.22)",
    green: "#1e7a50",
    greenDim: "#e0f5ea",
    greenBorder: "rgba(30,122,80,0.22)",
    blue: "#1a5fa0",
    blueDim: "#e0edf8",
    blueBorder: "rgba(26,95,160,0.22)",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function iniciais(nome = "") {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function formatarReal(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

async function chamarIA(system, user) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.9 },
      }),
    }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Erro na IA");
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── Lead Scoring automático ──────────────────────────────────────────────────
export function calcularTemperaturaLead(lead) {
  if (lead.status === "Convertido") return "quente";
  if (lead.status === "Perdido")    return "frio";
  const pStage = { Novo: 0, Contactado: 25, Qualificado: 55 };
  const stageScore = pStage[lead.status] ?? 0;
  let recScore = 0;
  if (lead.criadoEm) {
    const dt   = lead.criadoEm?.toDate ? lead.criadoEm.toDate() : new Date(lead.criadoEm);
    const dias = Math.floor((Date.now() - dt.getTime()) / 86400000);
    recScore   = dias <= 2 ? 25 : dias <= 7 ? 15 : dias <= 14 ? 5 : dias <= 30 ? -5 : -20;
  }
  const engScore    = Math.min((lead.atividades?.length || 0) * 7, 20);
  const manualScore = Math.min(((lead.score || 0) / 100) * 10, 10);
  const total = stageScore + recScore + engScore + manualScore;
  if (total >= 50) return "quente";
  if (total >= 20) return "morno";
  return "frio";
}

// ─── Badge de Risco ───────────────────────────────────────────────────────────
function RiscoBadge({ risco, T }) {
  const map = {
    alto:       { label: "Risco alto",    bg: T.redDim,    color: T.red,    border: T.redBorder    },
    medio:      { label: "Atenção",       bg: T.yellowDim, color: T.yellow, border: T.yellowBorder },
    baixo:      { label: "Fiel",          bg: T.greenDim,  color: T.green,  border: T.greenBorder  },
    indefinido: { label: "Sem histórico", bg: "transparent", color: T.textDim, border: T.border    },
  };
  const s = map[risco] || map.indefinido;
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.10em", textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      fontFamily: FONT,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Card de Métrica ──────────────────────────────────────────────────────────
function MetricCard({ val, label, color, T }) {
  const isGold = !color || color === T.gold;
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${color ? `${color}28` : T.border}`,
      borderRadius: 16, padding: "20px 22px 18px",
      position: "relative", overflow: "hidden",
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}>
      {/* top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color
          ? `linear-gradient(90deg, ${color}, ${color}44)`
          : `linear-gradient(90deg, ${T.goldBorder}, transparent)`,
        borderRadius: "16px 16px 0 0",
      }} />
      {/* subtle glow top-right */}
      {color && (
        <div style={{
          position: "absolute", top: -20, right: -20, width: 80, height: 80,
          borderRadius: "50%", background: `${color}18`, filter: "blur(20px)",
          pointerEvents: "none",
        }} />
      )}
      <div style={{
        fontSize: 28, fontWeight: 600, color: color || T.text,
        fontFamily: FONT_MONO, letterSpacing: "-0.02em", lineHeight: 1,
        marginBottom: 8,
      }}>{val}</div>
      <div style={{
        fontSize: 9, color: T.textDim, textTransform: "uppercase",
        letterSpacing: "0.12em", fontWeight: 600, fontFamily: FONT,
      }}>{label}</div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight, empresaNome, empresaId, T }) {
  const [msg, setMsg]             = useState(null);
  const [gerando, setGerando]     = useState(false);
  const [ignorando, setIgnorando] = useState(false);

  const cores = {
    risco_alto:   { borda: T.red,    badgeBg: T.redDim,    badgeColor: T.red,    border: T.redBorder,    label: "Risco de perda" },
    risco_medio:  { borda: T.yellow, badgeBg: T.yellowDim, badgeColor: T.yellow, border: T.yellowBorder, label: "Atenção"        },
    oportunidade: { borda: T.blue,   badgeBg: T.blueDim,   badgeColor: T.blue,   border: T.blueBorder,   label: "Oportunidade"   },
    fidelizacao:  { borda: T.green,  badgeBg: T.greenDim,  badgeColor: T.green,  border: T.greenBorder,  label: "Fidelização"    },
  };
  const tipoKey = insight.tipo === "risco"
    ? (insight.prioridade === 1 ? "risco_alto" : "risco_medio")
    : insight.tipo;
  const cor      = cores[tipoKey] || cores.risco_alto;
  const telLimpo = (insight.telefone || "").replace(/\D/g, "");

  async function gerarMensagem() {
    setGerando(true); setMsg(null);
    try {
      const { system, user } = montarPromptMensagem(insight, empresaNome);
      setMsg(await chamarIA(system, user));
    } catch { setMsg("Erro ao gerar mensagem. Tente novamente."); }
    finally   { setGerando(false); }
  }

  async function handleIgnorar() {
    if (!empresaId || ignorando) return;
    setIgnorando(true);
    try { await ignorarCliente(empresaId, { id: insight.clienteId, nome: insight.cliente, telefone: insight.telefone }); }
    catch (e) { console.error("Erro ao ignorar cliente:", e); setIgnorando(false); }
  }

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16, marginBottom: 10, overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex" }}>
        {/* left accent bar */}
        <div style={{
          width: 3, flexShrink: 0, background: cor.borda,
          boxShadow: tipoKey === "risco_alto" ? `0 0 16px ${T.red}66` : "none",
        }} />
        <div style={{ flex: 1, padding: "18px 18px 16px 16px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: cor.badgeBg, color: cor.badgeColor,
              border: `1px solid ${cor.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, fontFamily: FONT_MONO,
              letterSpacing: "0.02em",
            }}>
              {insight.cliente ? iniciais(insight.cliente) : "!"}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                <span style={{
                  fontSize: 13.5, fontWeight: 600, color: T.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: "60%", fontFamily: FONT, letterSpacing: "-0.01em",
                }}>
                  {insight.cliente || "Alerta"}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                  background: cor.badgeBg, color: cor.badgeColor, border: `1px solid ${cor.border}`,
                  textTransform: "uppercase", letterSpacing: "0.10em", whiteSpace: "nowrap", fontFamily: FONT,
                }}>{cor.label}</span>
              </div>
              <p style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.7, margin: 0, fontFamily: FONT, fontWeight: 300 }}>
                {insight.descricao}
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                {insight.diasAusente != null && (
                  <span style={{ fontSize: 11, color: T.textDim, fontFamily: FONT }}>
                    ausente há <strong style={{ color: insight.prioridade === 1 ? T.red : T.yellow, fontWeight: 600 }}>{insight.diasAusente}d</strong>
                  </span>
                )}
                {insight.ticketMedio != null && (
                  <span style={{ fontSize: 11, color: T.textDim, fontFamily: FONT }}>
                    ticket <strong style={{ color: T.gold, fontWeight: 600, fontFamily: FONT_MONO }}>{formatarReal(insight.ticketMedio)}</strong>
                  </span>
                )}
                {insight.preco != null && (
                  <span style={{ fontSize: 11, color: T.textDim, fontFamily: FONT }}>
                    potencial <strong style={{ color: T.green, fontWeight: 600, fontFamily: FONT_MONO }}>+{formatarReal(insight.preco)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={gerarMensagem} disabled={gerando} style={{
              fontSize: 11.5, fontWeight: 600, padding: "8px 18px", borderRadius: 9,
              background: gerando ? T.surfaceAlt : T.goldGradient,
              color: gerando ? T.textMid : "#1a1100",
              border: gerando ? `1px solid ${T.border}` : "none",
              cursor: gerando ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", fontFamily: FONT, transition: "all 0.18s",
              boxShadow: gerando ? "none" : "0 4px 18px rgba(212,175,55,0.28)",
            }}>
              {gerando ? "Gerando..." : "✦ Gerar mensagem"}
            </button>
            {insight.telefone && (
              <button onClick={() => window.open(`https://wa.me/55${telLimpo}`, "_blank")} style={{
                fontSize: 11.5, fontWeight: 500, padding: "8px 16px", borderRadius: 9,
                background: "transparent", border: `1px solid ${T.border}`,
                cursor: "pointer", color: T.textMid, letterSpacing: "0.04em", fontFamily: FONT,
                transition: "border-color 0.15s",
              }}>WhatsApp</button>
            )}
            <button onClick={handleIgnorar} disabled={ignorando} title="Ignorar nos alertas futuros" style={{
              fontSize: 11.5, fontWeight: 500, padding: "8px 14px", borderRadius: 9,
              background: "transparent", border: `1px solid ${T.border}`,
              cursor: ignorando ? "not-allowed" : "pointer",
              color: ignorando ? T.textDim : T.textMid,
              letterSpacing: "0.04em", fontFamily: FONT, marginLeft: "auto", transition: "all 0.15s",
            }}>
              {ignorando ? "Ignorando..." : "Ignorar"}
            </button>
          </div>

          {msg && (
            <div style={{
              marginTop: 14, background: T.surfaceAlt, borderRadius: 12,
              padding: "16px 18px", border: `1px solid ${T.borderAlt}`,
            }}>
              <p style={{ fontSize: 13, lineHeight: 1.8, margin: 0, color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: FONT, fontWeight: 300 }}>{msg}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {telLimpo && (
                  <button onClick={() => window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, "_blank")} style={{
                    fontSize: 11.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9,
                    background: T.greenGradient || T.green, color: "#fff", border: "none", cursor: "pointer",
                    letterSpacing: "0.04em", fontFamily: FONT,
                  }}>↗ Enviar no WhatsApp</button>
                )}
                <button onClick={gerarMensagem} style={{
                  fontSize: 11.5, padding: "8px 16px", borderRadius: 9,
                  background: "transparent", border: `1px solid ${T.border}`,
                  cursor: "pointer", color: T.textMid, fontFamily: FONT,
                }}>↺ Regenerar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assistente IA ────────────────────────────────────────────────────────────
function AssistenteIA({ metricas, clientes, empresaNome, T }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState(null);
  const [pensando, setPensando] = useState(false);

  const contexto = metricas
    ? `Empresa: ${empresaNome || "não identificada"}.
Clientes ativos: ${metricas.totalClientes}.
Em risco alto: ${metricas.emRisco}.
Dormentes (+60d): ${metricas.dormentes}.
Fiéis: ${metricas.fieis}.
Ticket médio geral: ${formatarReal(metricas.ticketGeral)}.
Receita em risco: ${formatarReal(metricas.receitaEmRisco)}.
Clientes em risco: ${clientes.filter((c) => c.risco === "alto").map((c) => `${c.nome} (${c.diasAusente}d ausente)`).join(", ") || "nenhum"}.`.trim()
    : "";

  async function perguntar(q) {
    const texto = q || pergunta;
    if (!texto.trim()) return;
    setPensando(true); setResposta(null);
    try {
      const r = await chamarIA(
        `Você é um consultor especialista em retenção de clientes para pequenos negócios brasileiros, trabalhando para "${empresaNome || "esta empresa"}".
Você tem acesso aos dados reais dos clientes e deve dar conselhos práticos, diretos e específicos — nunca genéricos.
Dados atuais do negócio:\n${contexto}
Regras:
- Responda sempre em português brasileiro
- Seja direto e prático, com ações concretas
- Use os dados reais fornecidos nas respostas
- Cite nomes de clientes e valores quando relevante
- Máximo 6 linhas
- Nunca diga "com base nos dados" ou frases introdutórias`,
        texto
      );
      setResposta(r);
    } catch { setResposta("Erro ao conectar com a IA."); }
    finally   { setPensando(false); setPergunta(""); }
  }

  const sugestoes = [
    "Quais clientes tenho risco de perder essa semana?",
    "Como posso aumentar meu ticket médio?",
    "Que campanha posso fazer para recuperar clientes dormentes?",
    "Quem são meus clientes mais valiosos?",
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Input */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 20, marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: T.goldDim, border: `1px solid ${T.goldBorder}`, fontSize: 13, color: T.gold,
          }}>✦</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: FONT }}>
            Assistente IA
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: T.textMid, marginBottom: 14, lineHeight: 1.65, fontFamily: FONT, fontWeight: 300 }}>
          Faça qualquer pergunta sobre seus clientes. A IA analisa os dados em tempo real.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && perguntar()}
            placeholder="Ex: quem devo priorizar hoje?"
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 10, fontSize: 13,
              border: `1px solid ${T.borderAlt}`, outline: "none",
              fontFamily: FONT, background: T.surfaceAlt, color: T.text, minWidth: 0,
              transition: "border-color 0.15s",
            }}
          />
          <button onClick={() => perguntar()} disabled={pensando} style={{
            padding: "11px 20px", borderRadius: 10, fontSize: 11.5, fontWeight: 600,
            background: pensando ? T.surfaceAlt : T.goldGradient,
            color: pensando ? T.textMid : "#1a1100",
            border: pensando ? `1px solid ${T.border}` : "none",
            cursor: pensando ? "not-allowed" : "pointer",
            letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
            flexShrink: 0, fontFamily: FONT, transition: "all 0.18s",
            boxShadow: pensando ? "none" : "0 4px 18px rgba(212,175,55,0.28)",
          }}>
            {pensando ? "..." : "✦ Perguntar"}
          </button>
        </div>
      </div>

      {/* Resposta */}
      {(resposta || pensando) && (
        <div style={{
          background: T.goldDim, border: `1px solid ${T.goldBorder}`,
          borderRadius: 16, padding: 20, marginBottom: 12,
        }}>
          {pensando
            ? <p style={{ fontSize: 13, color: T.textMid, fontFamily: FONT, margin: 0 }}>Analisando dados...</p>
            : <p style={{ fontSize: 13, lineHeight: 1.85, color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: FONT, fontWeight: 300 }}>{resposta}</p>
          }
        </div>
      )}

      {/* Sugestões */}
      <p style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", marginBottom: 10, textTransform: "uppercase", fontFamily: FONT }}>
        Sugestões rápidas
      </p>
      {sugestoes.map((s) => (
        <button key={s} onClick={() => perguntar(s)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", padding: "13px 16px", marginBottom: 8, textAlign: "left",
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          fontSize: 12.5, color: T.textMid, cursor: "pointer", fontFamily: FONT,
          fontWeight: 300, transition: "all 0.15s",
        }}>
          <span style={{ flex: 1, paddingRight: 8 }}>{s}</span>
          <span style={{ color: T.gold, fontSize: 13, flexShrink: 0 }}>→</span>
        </button>
      ))}
    </div>
  );
}

// ─── Tabela de Clientes (Desktop) ─────────────────────────────────────────────
function TabelaClientes({ clientes, T, onSelecionar }) {
  const sorted = [...clientes].sort(
    (a, b) =>
      ({ alto: 0, medio: 1, baixo: 2, indefinido: 3 }[a.risco] || 3) -
      ({ alto: 0, medio: 1, baixo: 2, indefinido: 3 }[b.risco] || 3)
  );
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480, fontFamily: FONT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Cliente", "Último serviço", "Ausente", "Ticket médio", "Score"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 9, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.nome} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.surfaceAlt, cursor: "pointer", transition: "background 0.12s" }}
                onClick={() => onSelecionar(c)}>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, fontFamily: FONT_MONO }}>{c.telefone || "—"}</div>
                </td>
                <td style={{ padding: "14px 18px", color: T.textMid, fontSize: 12, whiteSpace: "nowrap" }}>{c.produtoFavorito || "—"}</td>
                <td style={{ padding: "14px 18px", fontWeight: 700, color: c.diasAusente > 30 ? T.red : T.textMid, whiteSpace: "nowrap", fontFamily: FONT_MONO }}>
                  {c.diasAusente != null ? `${c.diasAusente}d` : "—"}
                </td>
                <td style={{ padding: "14px 18px", color: T.gold, fontWeight: 700, whiteSpace: "nowrap", fontFamily: FONT_MONO }}>
                  {c.ticketMedio != null ? formatarReal(c.ticketMedio) : "—"}
                </td>
                <td style={{ padding: "14px 18px" }}><RiscoBadge risco={c.risco} T={T} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cards de Clientes (Mobile) ───────────────────────────────────────────────
function CardsClientes({ clientes, T, onSelecionar }) {
  const sorted = [...clientes].sort(
    (a, b) =>
      ({ alto: 0, medio: 1, baixo: 2, indefinido: 3 }[a.risco] || 3) -
      ({ alto: 0, medio: 1, baixo: 2, indefinido: 3 }[b.risco] || 3)
  );
  return (
    <div>
      {sorted.map((c) => (
        <div key={c.nome} onClick={() => onSelecionar(c)} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: "16px 18px", marginBottom: 8,
          cursor: "pointer", fontFamily: FONT, transition: "border-color 0.15s",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{c.nome}</div>
              {c.telefone && <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, fontFamily: FONT_MONO }}>{c.telefone}</div>}
            </div>
            <RiscoBadge risco={c.risco} T={T} />
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {c.produtoFavorito && (
              <div>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 3 }}>Último serviço</div>
                <div style={{ fontSize: 12, color: T.textMid, fontWeight: 300 }}>{c.produtoFavorito}</div>
              </div>
            )}
            {c.diasAusente != null && (
              <div>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 3 }}>Ausente</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.diasAusente > 30 ? T.red : T.textMid, fontFamily: FONT_MONO }}>{c.diasAusente}d</div>
              </div>
            )}
            {c.ticketMedio != null && (
              <div>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 3 }}>Ticket médio</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: FONT_MONO }}>{formatarReal(c.ticketMedio)}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Modal Histórico CRM ──────────────────────────────────────────────────────
function ModalHistoricoCRM({ cliente, vendas, T, onClose }) {
  if (!cliente) return null;
  function toDate(val) { return val?.toDate ? val.toDate() : new Date(val); }
  function matchNome(a = "", b = "") {
    const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
    return x === y || y.startsWith(x) || x.startsWith(y);
  }
  const historico = vendas.filter((v) => matchNome(v.cliente, cliente.nome)).sort((a, b) => toDate(b.data) - toDate(a.data));
  const faturamentoTotal = historico.reduce((acc, v) => acc + (v.total || 0), 0);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 999, padding: "20px", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: "#0f0f12", width: "100%", maxWidth: "550px", borderRadius: 20,
        border: `1px solid rgba(255,255,255,0.09)`,
        display: "flex", flexDirection: "column", maxHeight: "90vh",
        boxShadow: "0 30px 80px rgba(0,0,0,0.8)", fontFamily: FONT,
        overflow: "hidden",
      }}>
        {/* Header do modal */}
        <div style={{
          padding: "24px 28px", borderBottom: `1px solid rgba(255,255,255,0.07)`,
          position: "relative", background: "rgba(212,175,55,0.04)",
        }}>
          <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 8, fontFamily: FONT }}>
            Ficha do Cliente
          </div>
          <h2 style={{ margin: 0, fontSize: 22, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT, fontWeight: 600 }}>{cliente.nome}</h2>
          <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: T.textMid }}>
              LTV: <b style={{ color: T.green, fontWeight: 700, fontFamily: FONT_MONO }}>{formatarReal(faturamentoTotal)}</b>
            </span>
            <span style={{ fontSize: 12, color: T.textMid }}>
              Serviços: <b style={{ fontWeight: 700, fontFamily: FONT_MONO }}>{historico.length}</b>
            </span>
          </div>
          <button onClick={onClose} style={{
            position: "absolute", top: 24, right: 24,
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.09)`,
            color: T.textDim, cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, textTransform: "uppercase", marginBottom: 16, letterSpacing: "0.14em" }}>
            Histórico de Vendas (via Assent Gestão)
          </div>
          {historico.map((v, i) => (
            <div key={i} style={{
              padding: "14px 18px", background: T.surfaceAlt, borderRadius: 12,
              marginBottom: 8, border: `1px solid ${T.borderAlt}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.textDim }}>{new Date(v.data).toLocaleDateString("pt-BR")}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.gold, fontFamily: FONT_MONO }}>{formatarReal(v.total)}</span>
              </div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
                {v.itens?.map((item) => item.nome || item.produto).join(", ") || "Serviço"}
              </div>
            </div>
          ))}
          {historico.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: T.textDim, border: `1px dashed ${T.border}`, borderRadius: 12, fontSize: 13 }}>
              Nenhum faturamento registrado no Assent Gestão.
            </div>
          )}
        </div>

        <div style={{ padding: "18px 28px", borderTop: `1px solid rgba(255,255,255,0.07)` }}>
          <button style={{
            width: "100%", padding: "13px", borderRadius: 10,
            background: T.goldGradient, color: "#1a1100", border: "none",
            fontWeight: 600, cursor: "pointer", fontSize: 12,
            textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: FONT,
            boxShadow: "0 4px 18px rgba(212,175,55,0.28)",
          }}>
            + Registrar Contato Manual
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Módulo: Clientes Ignorados ───────────────────────────────────────────────
function ClientesIgnorados({ ignorados, empresaId, T }) {
  const [reativando, setReativando] = useState(null);

  async function handleReativar(ig) {
    setReativando(ig._docId || ig.nome);
    try { await reativarCliente(empresaId, ig); }
    catch (e) { console.error("Erro ao reativar:", e); }
    finally   { setReativando(null); }
  }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Clientes ignorados ({ignorados.length})
        </span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      {ignorados.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "36px 0",
          color: T.textDim, fontSize: 13, border: `1px dashed ${T.border}`,
          borderRadius: 14, fontWeight: 300,
        }}>
          Nenhum cliente ignorado. Use o botão "Ignorar" nos alertas do Radar.
        </div>
      ) : (
        ignorados.map((ig) => {
          const key = ig._docId || ig.nome;
          const isReativando = reativando === key;
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "14px 18px", marginBottom: 8,
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
              transition: "border-color 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: T.surfaceAlt, color: T.textDim,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, fontFamily: FONT_MONO,
                }}>
                  {(ig.nome || "?").split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{ig.nome}</div>
                  {ig.telefone && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, fontFamily: FONT_MONO }}>{ig.telefone}</div>}
                  {ig.ignoradoEm && (
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                      Ignorado em {ig.ignoradoEm?.toDate
                        ? ig.ignoradoEm.toDate().toLocaleDateString("pt-BR")
                        : new Date(ig.ignoradoEm).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => handleReativar(ig)} disabled={isReativando} style={{
                fontSize: 11.5, fontWeight: 600, padding: "7px 16px", borderRadius: 9,
                background: isReativando ? T.surfaceAlt : "transparent",
                border: `1px solid ${isReativando ? T.border : T.greenBorder}`,
                cursor: isReativando ? "not-allowed" : "pointer",
                color: isReativando ? T.textDim : T.green,
                letterSpacing: "0.04em", fontFamily: FONT,
              }}>
                {isReativando ? "Reativando..." : "↩ Reativar"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}


// ─── Aba Crescimento ──────────────────────────────────────────────────────────
const FASES_LABEL = {
  base_vazia:       { label: "Base em construção",    cor: "#4a8fd4" },
  construcao:       { label: "Fase de construção",    cor: "#4a8fd4" },
  crescendo:        { label: "Em crescimento",        cor: "#3aad78" },
  retencao_critica: { label: "Atenção: retenção",     cor: "#e05252" },
  estagnado:        { label: "Atividade baixa",       cor: "#d4903a" },
  escalonando:      { label: "Escalonando",           cor: "#d4af37" },
};

const CAT_COR = {
  "Captação":    "#4a8fd4",
  "Retenção":    "#e05252",
  "Fidelização": "#3aad78",
  "Receita":     "#d4af37",
  "Ativação":    "#d4903a",
  "Operacional": "rgba(255,255,255,0.4)",
};

function InsightCrescimentoCard({ insight, idx, T }) {
  const [expandido, setExpandido] = useState(false);
  const catCor = CAT_COR[insight.categoria] || T.gold;

  return (
    <div
      onClick={() => setExpandido(v => !v)}
      style={{
        background: T.surface,
        border: `1px solid ${expandido ? `${catCor}40` : T.border}`,
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.2s", fontFamily: FONT,
      }}
    >
      <div style={{ height: 2, background: catCor, opacity: 0.9 }} />

      <div style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: catCor,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            {insight.categoria}
          </span>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 22, fontWeight: 700, color: catCor,
              fontFamily: FONT_MONO, lineHeight: 1, letterSpacing: "-0.02em",
            }}>
              {insight.metrica.valor}
            </div>
            <div style={{ fontSize: 9, color: T.textDim, marginTop: 2, letterSpacing: "0.04em" }}>
              {insight.metrica.label}
            </div>
          </div>
        </div>

        {/* Título */}
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.text,
          lineHeight: 1.35, marginBottom: 10,
          letterSpacing: "-0.01em",
        }}>
          {insight.titulo}
        </div>

        <p style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.65, margin: 0, fontWeight: 300 }}>
          {insight.diagnostico}
        </p>

        <div style={{ maxHeight: expandido ? 200 : 0, overflow: "hidden", transition: "max-height 0.25s ease" }}>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Próximo passo
            </div>
            <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.7, margin: "0 0 16px", fontWeight: 300 }}>
              {insight.recomendacao}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <span style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.08em" }}>
            {expandido ? "RECOLHER" : "VER RECOMENDAÇÃO"}
          </span>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>
      </div>
    </div>
  );
}

function CrescimentoPage({ crescimento, T, bp }) {
  const { momento, ativos } = crescimento || { momento: null, ativos: [] };
  const fase = FASES_LABEL[momento?.fase] || { label: "Analisando...", cor: T.textDim };

  if (!momento) return (
    <div style={{
      textAlign: "center", padding: "60px 0",
      color: T.textDim, fontSize: 13, fontFamily: FONT, fontWeight: 300,
      border: `1px dashed ${T.border}`, borderRadius: 14,
    }}>
      Carregando diagnóstico do negócio...
    </div>
  );

  if (ativos.length === 0) return (
    <div style={{
      textAlign: "center", padding: "60px 0",
      color: T.textDim, fontSize: 13, fontFamily: FONT, fontWeight: 300,
      border: `1px dashed ${T.border}`, borderRadius: 14,
    }}>
      Nenhum insight disponível para o momento atual. Cadastre mais clientes e vendas no Assent Gestão.
    </div>
  );

  const categorias = [...new Set(ativos.map(a => a.categoria))];

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Diagnóstico do momento */}
      <div style={{
        background: T.surface,
        border: `1px solid ${fase.cor}28`,
        borderLeft: `3px solid ${fase.cor}`,
        borderRadius: 14, padding: "20px 24px", marginBottom: 28,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30, width: 100, height: 100,
          borderRadius: "50%", background: `${fase.cor}12`, filter: "blur(30px)",
          pointerEvents: "none",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
              Momento do negócio
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: fase.cor, letterSpacing: "-0.01em" }}>
              {fase.label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { val: momento.totalClientes, label: "Clientes" },
              { val: momento.fieis,         label: "Fiéis" },
              { val: momento.emRisco,       label: "Em risco" },
            ].map(m => (
              <div key={m.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: FONT_MONO, lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 9, color: T.textDim, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {categorias.map(cat => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: CAT_COR[cat] || T.gold, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: CAT_COR[cat] || T.textDim, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {cat}
            </span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontSize: 9, color: T.textDim }}>{ativos.filter(a => a.categoria === cat).length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ativos.filter(a => a.categoria === cat).map((ins, i) => (
              <InsightCrescimentoCard key={ins.id} insight={ins} idx={i} T={T} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CRMModule — componente principal
// ═══════════════════════════════════════════════════════════════
export default function CRMModule({ tenantUid, nomeEmpresa, onVoltar, theme, onToggleTheme }) {
  const [aba,           setAba]          = useState("radar");
  const [busca,         setBusca]        = useState("");
  const tema = theme || "dark";
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [clienteAtivo,  setClienteAtivo] = useState(null);
  const [funilAberto,   setFunilAberto]  = useState(false);

  const T  = TEMAS[tema];
  const bp = useBreakpoint();

  useEffect(() => {
    if (bp.isMobile) setSidebarAberta(false);
    else setSidebarAberta(true);
  }, [bp.isMobile]);

  const { clientes, insights, crescimento, metricas, dadosBrutos, ignorados } = useCRM(tenantUid);
  const leadsData = useLeads(tenantUid);

  const clientesFiltrados = clientes.filter((c) => {
    const nomeLimpo  = (c.nome || "").toLowerCase();
    const buscaLimpa = busca.toLowerCase();
    const telefone   = c.telefone || "";
    return nomeLimpo.includes(buscaLimpa) || telefone.includes(buscaLimpa);
  });

  const abas = [
    { id: "radar",       icon: "◈", label: "Radar",       labelFull: "Radar do dia",    badge: insights.length || null },
    { id: "clientes",    icon: "◉", label: "Clientes",    labelFull: "Clientes",         badge: null },
    { id: "crescimento", icon: "✶", label: "Crescimento", labelFull: "Crescimento",      badge: crescimento?.ativos?.length || null },
    { id: "ia",          icon: "✦", label: "IA",           labelFull: "Assistente IA",   badge: null },
    { id: "painel",      icon: "▦", label: "Painel",       labelFull: "Painel",           badge: null },
    { id: "leads",       icon: "◎", label: "Leads",        labelFull: "Gestão de Leads", badge: null },
    { id: "config",      icon: "⚙", label: "Config",       labelFull: "Configurações",   badge: null },
  ];

  const sidebarWidth = bp.isMobile ? 0 : sidebarAberta ? 240 : 60;
  const isDark = tema === "dark";

  return (
    <div style={{
      display: "flex", height: "100%", fontFamily: FONT,
      background: T.bg, color: T.text, position: "relative", overflow: "hidden",
    }}>
      {/* Global keyframes + hover states */}
      <style>{`
        @keyframes crm-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        .crm-nav-item:hover { background: rgba(212,175,55,0.05) !important; border-color: ${T.goldBorder} !important; }
        .crm-nav-item:hover span { color: rgba(255,255,255,0.85) !important; }
        .crm-card:hover { border-color: ${T.goldBorder} !important; }
        .crm-suggestion-btn:hover { background: ${T.goldDim} !important; border-color: ${T.goldBorder} !important; }
        .crm-secondary-btn:hover { border-color: rgba(255,255,255,0.20) !important; color: ${T.text} !important; }
        .crm-table-row:hover { background: ${T.goldDim} !important; }
      `}</style>

      {/* Dark mode background grid */}
      {isDark && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 70%)",
        }} />
      )}

      {/* Gold radial glow */}
      {isDark && (
        <div style={{
          position: "absolute", top: "-15%", left: "30%",
          width: "600px", height: "500px",
          background: "radial-gradient(50% 50% at 50% 50%, rgba(212,175,55,0.10), transparent 70%)",
          filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
        }} />
      )}

      {/* Overlay mobile */}
      {bp.isMobile && sidebarAberta && (
        <div onClick={() => setSidebarAberta(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.70)",
          zIndex: 40, backdropFilter: "blur(3px)",
        }} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: bp.isMobile ? "fixed" : "relative",
        top: 0, left: 0, bottom: 0,
        width: bp.isMobile ? 250 : sidebarWidth,
        zIndex: bp.isMobile ? 50 : 1,
        background: isDark ? "rgba(5,5,5,0.96)" : T.surface,
        backdropFilter: isDark ? "blur(20px)" : "none",
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        transition: "width 0.22s ease, transform 0.22s ease",
        transform: bp.isMobile ? (sidebarAberta ? "translateX(0)" : "translateX(-100%)") : "none",
        overflow: "hidden", flexShrink: 0, position: "relative",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 64,
        }}>
          <div style={{ overflow: "hidden", opacity: sidebarAberta || bp.isMobile ? 1 : 0, transition: "opacity 0.15s ease", whiteSpace: "nowrap" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: T.gold,
              textTransform: "uppercase", fontFamily: FONT_BRAND,
              background: isDark ? T.goldGradient : "none",
              WebkitBackgroundClip: isDark ? "text" : "none",
              WebkitTextFillColor: isDark ? "transparent" : T.gold,
              backgroundClip: isDark ? "text" : "none",
            }}>
              Assent CRM
            </div>
            <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 3, letterSpacing: "0.06em" }}>via Assent Gestão</div>
          </div>
          {!bp.isMobile && (
            <button
              onClick={() => setSidebarAberta((v) => !v)}
              title={sidebarAberta ? "Recolher menu" : "Expandir menu"}
              style={{
                width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.border}`,
                background: "transparent", cursor: "pointer", fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMid, flexShrink: 0, marginLeft: sidebarAberta ? 8 : "auto",
                transition: "border-color 0.15s",
              }}
            >
              {sidebarAberta ? "←" : "→"}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          {abas.map((a) => {
            const ativo        = aba === a.id;
            const mostrarLabel = sidebarAberta || bp.isMobile;
            return (
              <button
                key={a.id}
                className="crm-nav-item"
                onClick={() => { setAba(a.id); if (bp.isMobile) setSidebarAberta(false); }}
                title={!mostrarLabel ? a.labelFull : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: mostrarLabel ? 10 : 0,
                  justifyContent: mostrarLabel ? "flex-start" : "center",
                  width: "100%", padding: mostrarLabel ? "10px 12px" : "10px",
                  borderRadius: 10, marginBottom: 2,
                  border: `1px solid ${ativo ? T.goldBorder : "transparent"}`,
                  background: ativo
                    ? "linear-gradient(140deg, rgba(212,175,55,0.12), rgba(212,175,55,0.03))"
                    : "transparent",
                  color: ativo ? T.text : T.textMid,
                  fontSize: 12.5, cursor: "pointer", fontFamily: FONT,
                  fontWeight: ativo ? 500 : 400, transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {/* left indicator */}
                {ativo && (
                  <div style={{
                    position: "absolute", left: 0, top: "20%", height: "60%",
                    width: 2.5, background: T.gold, borderRadius: "0 2px 2px 0",
                    boxShadow: `0 0 8px ${T.gold}88`,
                  }} />
                )}
                {/* Icon box */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ativo ? T.goldDim : "transparent",
                  border: `1px solid ${ativo ? T.goldBorder : "transparent"}`,
                  fontSize: 13, color: ativo ? T.goldLight : T.textDim,
                  transition: "all 0.15s",
                }}>
                  {a.icon}
                </div>
                {mostrarLabel && (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {a.labelFull}
                  </span>
                )}
                {a.badge && mostrarLabel ? (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, background: T.red, color: "#fff",
                    borderRadius: 999, padding: "1px 7px", flexShrink: 0,
                  }}>{a.badge}</span>
                ) : a.badge && !mostrarLabel ? (
                  <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: T.red }} />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: "14px 14px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {sidebarAberta || bp.isMobile ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: FONT_MONO,
                }}>
                  {(nomeEmpresa || "E")[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                    {nomeEmpresa || "Empresa"}
                  </div>
                  <div style={{ fontSize: 9.5, color: T.textDim }}>Assent CRM</div>
                </div>
              </div>
              <button
                onClick={onVoltar}
                style={{
                  fontSize: 11, color: T.textDim,
                  background: "transparent", border: `1px solid ${T.border}`,
                  cursor: "pointer", padding: "7px 12px", borderRadius: 8,
                  fontFamily: FONT, alignSelf: "flex-start", letterSpacing: "0.03em",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                ← Assent Gestão
              </button>
            </>
          ) : (
            <button
              onClick={onVoltar}
              title="Voltar ao Assent Gestão"
              style={{
                width: 36, height: 36, borderRadius: 9, border: `1px solid ${T.border}`,
                background: "transparent", cursor: "pointer", color: T.textMid,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, margin: "0 auto", transition: "border-color 0.15s",
              }}
            >←</button>
          )}
        </div>
      </div>

      {/* ── Área principal ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{
          padding: bp.isMobile ? "12px 16px" : "14px 28px",
          borderBottom: `1px solid ${T.border}`,
          background: isDark ? "rgba(7,7,7,0.88)" : T.surface,
          backdropFilter: isDark ? "blur(20px)" : "none",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {bp.isMobile && (
              <button
                onClick={() => setSidebarAberta((v) => !v)}
                style={{
                  width: 36, height: 36, borderRadius: 9, border: `1px solid ${T.border}`,
                  background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.textMid, fontSize: 16, flexShrink: 0,
                }}
              >☰</button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: bp.isMobile ? 14 : 18, fontWeight: 600, color: T.text,
                letterSpacing: "-0.02em", fontFamily: FONT,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {abas.find((a) => a.id === aba)?.labelFull}
              </div>
              {!bp.isMobile && (
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, fontFamily: FONT, fontWeight: 300, textTransform: "capitalize" }}>
                  {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
            </div>
          </div>

          {/* Direita do header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <NotificacoesLeads
              acoesDisparadas={leadsData.acoesDisparadas}
              leads={leadsData.leads}
              T={T} bp={bp}
              onVerLead={() => {}}
            />
            <button
              onClick={onToggleTheme}
              title={tema === "dark" ? "Modo claro" : "Modo escuro"}
              style={{
                width: 36, height: 36, borderRadius: 9,
                border: `1px solid ${T.border}`, background: "transparent",
                cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center", color: T.textMid,
                transition: "border-color 0.15s",
              }}
            >
              {tema === "dark" ? "☀" : "🌙"}
            </button>
            {!bp.isMobile && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, color: T.green, fontFamily: FONT, fontWeight: 600,
                background: T.greenDim, border: `1px solid ${T.greenBorder}`,
                borderRadius: 999, padding: "5px 14px",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block", animation: "crm-pulse 2.2s ease-in-out infinite" }} />
                sincronizado
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo das abas */}
        <div style={{ flex: 1, overflowY: "auto", padding: bp.isMobile ? "16px 14px" : "28px 28px", paddingBottom: bp.isMobile ? "80px" : "28px" }}>

          {/* ── Radar ── */}
          {aba === "radar" && (
            <>
              {/* Label de seção estilo aplicativos */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 999,
                  background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, display: "inline-block", animation: "crm-pulse 2.2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: T.gold }}>
                    Alertas ativos
                  </span>
                </div>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                {!bp.isMobile && metricas && (
                  <span style={{ fontSize: 11, color: T.textDim }}>
                    {insights.length} {insights.length === 1 ? "cliente" : "clientes"} precisam de atenção
                  </span>
                )}
              </div>

              {/* Métricas */}
              {metricas && (
                <div style={{ display: "grid", gridTemplateColumns: bp.isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
                  <MetricCard val={metricas.totalClientes}     label="Clientes ativos" color={null}   T={T} />
                  <MetricCard val={metricas.emRisco}           label="Em risco"        color={T.red}  T={T} />
                  <MetricCard val={metricas.dormentes}         label="Dormentes 60d+"  color={T.yellow} T={T} />
                  <MetricCard val={metricas.fieis}             label="Clientes fiéis"  color={T.green} T={T} />
                </div>
              )}

              {/* Insights */}
              {insights.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "60px 0",
                  color: T.textDim, fontSize: 13, fontFamily: FONT, fontWeight: 300,
                  border: `1px dashed ${T.border}`, borderRadius: 16,
                }}>
                  {clientes.length === 0
                    ? "Nenhum cliente importado ainda. Registre vendas no Assent Gestão para ativar o radar."
                    : "✦ Tudo certo — sem alertas no radar hoje."}
                </div>
              ) : (
                insights.map((ins, i) => (
                  <InsightCard key={ins.clienteId || i} insight={ins} empresaNome={nomeEmpresa} empresaId={tenantUid} T={T} />
                ))
              )}
            </>
          )}

          {/* ── Clientes ── */}
          {aba === "clientes" && (
            <>
              {/* Label + busca */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {clientesFiltrados.length} {clientesFiltrados.length === 1 ? "cliente" : "clientes"}
                  </span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou telefone..."
                  style={{
                    width: "100%", maxWidth: 420, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                    border: `1px solid ${T.border}`, outline: "none",
                    fontFamily: FONT, background: T.surface, color: T.text,
                    boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                />
              </div>

              {clientesFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: T.textDim, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
                  Nenhum cliente encontrado.
                </div>
              ) : bp.isDesktop ? (
                <TabelaClientes clientes={clientesFiltrados} T={T} onSelecionar={setClienteAtivo} />
              ) : (
                <CardsClientes clientes={clientesFiltrados} T={T} onSelecionar={setClienteAtivo} />
              )}
            </>
          )}

          {/* ── IA ── */}
          {aba === "ia" && (
            <AssistenteIA metricas={metricas} clientes={clientes} empresaNome={nomeEmpresa} T={T} />
          )}

          {/* ── Crescimento ── */}
          {aba === "crescimento" && (
            <CrescimentoPage crescimento={crescimento} T={T} bp={bp} />
          )}

          {/* ── Painel ── */}
          {aba === "painel" && (
            <>
              {/* Label */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", textTransform: "uppercase" }}>Visão geral</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>

              {metricas && (
                <div style={{ display: "grid", gridTemplateColumns: bp.isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                  <MetricCard val={metricas.totalClientes}           label="Total clientes"   color={null}     T={T} />
                  <MetricCard val={`${Math.round((metricas.fieis / Math.max(metricas.totalClientes,1))*100)}%`} label="Taxa de fidelidade" color={T.green} T={T} />
                  <MetricCard val={metricas.emRisco}                 label="Em risco"         color={T.red}    T={T} />
                  <MetricCard val={formatarReal(metricas.ticketGeral)} label="Ticket médio"   color={T.gold}   T={T} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: bp.isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                {/* Segmentos */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.textDim, marginBottom: 18, letterSpacing: "0.14em", textTransform: "uppercase" }}>Segmentos automáticos</p>
                  {[
                    { label: "Fiéis",            val: metricas?.fieis || 0,     cor: T.green   },
                    { label: "Em risco",         val: metricas?.emRisco || 0,   cor: T.red     },
                    { label: "Dormentes (+60d)", val: metricas?.dormentes || 0, cor: T.yellow  },
                    { label: "Alto valor",       val: clientes.filter((c) => (c.ticketMedio || 0) > 500).length, cor: T.gold },
                    { label: "Novos (1 compra)", val: metricas?.novos || 0,     cor: T.textMid },
                  ].map((s) => (
                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 12.5, color: T.textMid, fontFamily: FONT, fontWeight: 300 }}>{s.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: s.cor, fontFamily: FONT_MONO }}>{s.val}</span>
                    </div>
                  ))}
                </div>

                {/* Financeiro */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.textDim, marginBottom: 18, letterSpacing: "0.14em", textTransform: "uppercase" }}>Resumo financeiro</p>
                  {[
                    { label: "Ticket médio geral",  val: formatarReal(metricas?.ticketGeral),    color: T.gold  },
                    { label: "Receita em risco",    val: formatarReal(metricas?.receitaEmRisco), color: T.red   },
                    { label: "Receita últimos 30d", val: formatarReal(metricas?.receitaRecente), color: T.green },
                  ].map((s) => (
                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 12.5, color: T.textMid, fontFamily: FONT, fontWeight: 300 }}>{s.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: FONT_MONO }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Leads ── */}
          {aba === "leads" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                <button
                  onClick={() => setFunilAberto(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 20px", borderRadius: 10,
                    background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                    color: T.gold, cursor: "pointer",
                    fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
                    fontFamily: FONT, transition: "all 0.16s",
                    boxShadow: "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.goldGradient; e.currentTarget.style.color = "#1a1100"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(212,175,55,0.28)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = T.goldDim; e.currentTarget.style.color = T.gold; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: 14 }}>◎</span>
                  Funil de leads
                </button>
              </div>

              <LeadsPage T={T} bp={bp} empresaId={tenantUid} config={null} funilOculto={true} />

              {funilAberto && (
                <div
                  onClick={(e) => { if (e.target === e.currentTarget) setFunilAberto(false); }}
                  style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 999, padding: bp.isMobile ? "12px" : "28px",
                  }}
                >
                  <div style={{
                    background: "#0f0f12", border: `1px solid rgba(255,255,255,0.09)`,
                    borderRadius: 20, width: "100%", maxWidth: 860, maxHeight: "90vh",
                    display: "flex", flexDirection: "column",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.8)",
                    fontFamily: FONT, overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "20px 26px", borderBottom: `1px solid rgba(255,255,255,0.07)`,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(212,175,55,0.04)",
                    }}>
                      <div>
                        <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 5 }}>
                          Gestão de Leads
                        </div>
                        <h2 style={{ margin: 0, fontSize: 20, color: T.text, fontFamily: FONT, fontWeight: 600, letterSpacing: "-0.02em" }}>
                          Funil de Leads
                        </h2>
                      </div>
                      <button
                        onClick={() => setFunilAberto(false)}
                        style={{
                          width: 34, height: 34, borderRadius: 9,
                          border: `1px solid rgba(255,255,255,0.09)`, background: "rgba(255,255,255,0.04)",
                          cursor: "pointer", fontSize: 15, color: T.textMid,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: bp.isMobile ? "16px" : "24px 26px" }}>
                      <LeadsPage T={T} bp={bp} empresaId={tenantUid} config={null} apenasFlnil={true} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Configurações ── */}
          {aba === "config" && (
            <div>
              <ConfigPage T={T} bp={bp} empresaId={tenantUid} config={null} />
              <div style={{ marginTop: 32 }}>
                <ClientesIgnorados ignorados={ignorados} empresaId={tenantUid} T={T} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Nav mobile */}
      {bp.isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: isDark ? "rgba(5,5,5,0.96)" : T.surface,
          backdropFilter: "blur(16px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex", zIndex: 30, paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {abas.map((a) => {
            const ativo = aba === a.id;
            return (
              <button key={a.id} onClick={() => setAba(a.id)} style={{
                flex: 1, padding: "10px 4px 8px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", fontFamily: FONT, position: "relative",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ativo ? T.goldDim : "transparent",
                  border: `1px solid ${ativo ? T.goldBorder : "transparent"}`,
                  fontSize: 14, color: ativo ? T.goldLight : T.textDim,
                  transition: "all 0.15s",
                }}>{a.icon}</div>
                <span style={{ fontSize: 9, fontWeight: ativo ? 600 : 400, color: ativo ? T.text : T.textDim, letterSpacing: "0.04em", textTransform: "uppercase" }}>{a.label}</span>
                {a.badge ? <span style={{ position: "absolute", top: 6, right: "calc(50% - 18px)", width: 6, height: 6, borderRadius: "50%", background: T.red }} /> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal Histórico */}
      {clienteAtivo && (
        <ModalHistoricoCRM
          cliente={clienteAtivo}
          vendas={dadosBrutos?.vendas || []}
          T={T}
          onClose={() => setClienteAtivo(null)}
        />
      )}
    </div>
  );
}
