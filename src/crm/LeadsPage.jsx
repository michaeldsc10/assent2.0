// LeadsPage.jsx
// Módulo completo de Leads integrado ao CRM Retenção.
// Recebe T (tema), bp (breakpoint), empresaId e config como props —
// exatamente como as outras seções do App.jsx recebem os dados do useCRM.

import { useState } from "react";
import {
  useLeads,
  adicionarLead,
  atualizarStatusLead,
  registrarEventoLead,
  removerEventoLead,
  salvarAutomacao,
  removerAutomacao,
  removerLead,
  montarPromptLead,
} from "./useLeads";
import { calcularTemperaturaLead } from "./CRMModule";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

const _gerarMensagemIA = httpsCallable(functions, "gerarMensagemIA");

// ─── Helpers locais ───────────────────────────────────────────────────────────
function iniciais(nome = "") {
  return nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function fmtRelativo(iso) {
  if (!iso) return "—";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const horas = Math.floor(diff / 3_600_000);
  const dias  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `há ${mins}min`;
  if (horas < 24) return `há ${horas}h`;
  return `há ${dias}d`;
}

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

async function chamarIA(system, user) {
  const result = await _gerarMensagemIA({ system, user });
  return result.data.texto;
}

// ─── Wrapper de temperatura com normalização de case ─────────────────────────
// O status pode chegar capitalizado do Cloud Function ("Novo") ou em
// minúsculas do select manual ("novo"). Normalizamos antes de pontuar.
function tempLead(lead) {
  if (!lead.status) return "frio";
  const normalizado = lead.status.charAt(0).toUpperCase() + lead.status.slice(1).toLowerCase();
  return calcularTemperaturaLead({ ...lead, status: normalizado });
}

// ─── Temperatura badge ────────────────────────────────────────────────────────
function TempBadge({ temp, T }) {
  const map = {
    quente: { label: "Quente", bg: T.redDim,    color: T.red    },
    morno:  { label: "Morno",  bg: T.yellowDim, color: T.yellow },
    frio:   { label: "Frio",   bg: T.blueDim,   color: T.blue   },
  };
  const s = map[temp] || map.frio;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 4,
      background: s.bg, color: s.color, letterSpacing: "0.06em",
      textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, T }) {
  const color = score >= 30 ? T.red : score >= 15 ? T.yellow : T.blue;
  const bg    = score >= 30 ? T.redDim : score >= 15 ? T.yellowDim : T.blueDim;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 4,
      background: bg, color, letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      ✦ {score ?? 0}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CORES = {
  novo:        { color: "#4a8fd4", bg: "#1a2840" },
  contactado:  { color: "#d4903a", bg: "#3a2810" },
  qualificado: { color: "#4aad7a", bg: "#1a3028" },
  convertido:  { color: "#c9a84c", bg: "#3a2c0a" },
  perdido:     { color: "#8e8e99", bg: "#17171a" },
};

function StatusBadge({ status, T }) {
  const key = (status || "").toLowerCase();
  const s = STATUS_CORES[key] || STATUS_CORES.novo;
  const labels = { novo: "Novo", contactado: "Contactado", qualificado: "Qualificado", convertido: "Convertido", perdido: "Perdido" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 4,
      background: s.bg, color: s.color,
      textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
    }}>
      {labels[key] || status}
    </span>
  );
}

// ─── Seção: Métricas de leads ─────────────────────────────────────────────────
// Recebe `leads` para calcular temperatura dinamicamente (scoring automático).
// O campo `metricas.scoreMedio` vem do hook — os demais são recalculados aqui.
function MetricasLeads({ leads = [], metricas, T, bp }) {
  const quentes = leads.filter(l => tempLead(l) === "quente").length;
  const mornos  = leads.filter(l => tempLead(l) === "morno").length;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: bp.isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
      gap: 10, marginBottom: 20,
    }}>
      {[
        { val: leads.length,          label: "Total de leads",  color: T.blue   },
        { val: quentes,               label: "Leads quentes",   color: T.red    },
        { val: mornos,                label: "Em nurturing",    color: T.yellow },
        { val: metricas?.scoreMedio ?? 0, label: "Score médio", color: T.gold   },
      ].map(m => (
        <div key={m.label} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: "16px 18px",
          borderTop: `2px solid ${m.color}`,
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: m.color, fontFamily: "monospace", letterSpacing: "-0.02em" }}>
            {m.val ?? 0}
          </div>
          <div style={{ fontSize: 10, color: T.textMid, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card de lead (mobile) ────────────────────────────────────────────────────
function LeadCard({ lead, T, onSelect }) {
  return (
    <div
      onClick={() => onSelect(lead)}
      style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.nome}
          </div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{lead.email}</div>
        </div>
        <ScoreBadge score={lead.score} T={T} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Temperatura calculada automaticamente via scoring */}
        <TempBadge temp={tempLead(lead)} T={T} />
        <StatusBadge status={lead.status} T={T} />
        {lead.utmCampanha && (
          <span style={{ fontSize: 10, color: T.textDim }}>📢 {lead.utmCampanha}</span>
        )}
        <span style={{ fontSize: 10, color: T.textDim, marginLeft: "auto" }}>
          {fmtRelativo(lead.ultimaAtividade)}
        </span>
      </div>
    </div>
  );
}

// ─── Tabela de leads (desktop) ────────────────────────────────────────────────
function TabelaLeads({ leads, T, onSelect }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Lead", "Origem", "Temperatura", "Score", "Status", "Última atividade"].map(h => (
                <th key={h} style={{
                  textAlign: "left", padding: "11px 14px",
                  fontSize: 9, fontWeight: 700, color: T.textDim,
                  textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => (
              <tr
                key={l.id || l.email}
                onClick={() => onSelect(l)}
                style={{
                  borderBottom: `1px solid ${T.border}`,
                  background: i % 2 === 0 ? "transparent" : T.surfaceAlt,
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderAlt}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : T.surfaceAlt}
              >
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                      background: T.surfaceAlt, color: T.gold,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700,
                    }}>{iniciais(l.nome)}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: T.text }}>{l.nome}</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{l.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: T.textMid }}>{l.utmSource || "—"}</div>
                  {l.utmCampanha && <div style={{ fontSize: 10, color: T.textDim }}>{l.utmCampanha}</div>}
                </td>
                {/* Temperatura calculada via scoring automático */}
                <td style={{ padding: "12px 14px" }}><TempBadge temp={tempLead(l)} T={T} /></td>
                <td style={{ padding: "12px 14px" }}><ScoreBadge score={l.score} T={T} /></td>
                <td style={{ padding: "12px 14px" }}><StatusBadge status={l.status} T={T} /></td>
                <td style={{ padding: "12px 14px", fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}>
                  {fmtRelativo(l.ultimaAtividade)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Painel de detalhe do lead ─────────────────────────────────────────────────
function DetalheLeadPanel({ lead, empresaId, empresaNome, T, onFechar }) {
  const [status, setStatus]   = useState(lead.status);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg]         = useState(null);
  const [gerandoMsg, setGerandoMsg] = useState(false);
  const [novoEvento, setNovoEvento] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [excluindoEventoId, setExcluindoEventoId] = useState(null);
  const [hoveredEventoId, setHoveredEventoId] = useState(null);

  const telLimpo = (lead.telefone || "").replace(/\D/g, "");

  // Lead com status atualizado localmente (para scoring em tempo real no painel)
  const leadComStatus = { ...lead, status };
  const tempAtual = tempLead(leadComStatus);

  const EVENTO_ICONES = {
    form_submit:   "📋",
    page_view:     "👁",
    email_aberto:  "📧",
    email_clicado: "🔗",
    anotacao:      "📝",
  };

  async function excluirLead() {
    setExcluindo(true);
    try {
      await removerLead(empresaId, lead.id);
      onFechar();
    } finally {
      setExcluindo(false);
    }
  }

  async function salvarStatus(novoStatus) {
    setSalvando(true);
    try {
      await atualizarStatusLead(empresaId, lead, novoStatus);
      setStatus(novoStatus);
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarAnotacao() {
    if (!novoEvento.trim()) return;
    await registrarEventoLead(empresaId, lead, {
      tipo: "anotacao",
      descricao: novoEvento.trim(),
    });
    setNovoEvento("");
  }

  async function excluirEvento(eventoId) {
    setExcluindoEventoId(eventoId);
    try {
      await removerEventoLead(empresaId, lead, eventoId);
    } finally {
      setExcluindoEventoId(null);
    }
  }

  async function gerarMensagem() {
    setGerandoMsg(true); setMsg(null);
    try {
      const { system, user } = montarPromptLead(lead, empresaNome);
      setMsg(await chamarIA(system, user));
    } catch { setMsg("Erro ao gerar mensagem."); }
    finally { setGerandoMsg(false); }
  }

  const breakdown = lead.scoreBreakdown || {};
  const BREAKDOWN_LABELS = {
    form_submit:      "Enviou formulário",
    pagina_preco:     "Visitou página de preços",
    email_aberto:     "Abriu email",
    email_clicado:    "Clicou em email",
    multiplas_paginas:"3+ páginas visitadas",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "flex-end",
      justifyContent: "flex-end",
      zIndex: 80, padding: 0,
    }} onClick={onFechar}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, height: "100vh",
          background: T.surface, borderLeft: `1px solid ${T.border}`,
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header do painel */}
        <div style={{
          padding: "18px 20px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 12,
          position: "sticky", top: 0, background: T.surface, zIndex: 1,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9, flexShrink: 0,
            background: T.surfaceAlt, color: T.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
          }}>{iniciais(lead.nome)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{lead.nome}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{lead.email}</div>
          </div>
          <button
            onClick={() => setConfirmandoExclusao(true)}
            style={{
              background: "none", border: `1px solid ${T.red}55`, color: T.red,
              fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 6,
              cursor: "pointer", flexShrink: 0, fontFamily: "inherit",
            }}
          >Excluir</button>
          <button onClick={onFechar} style={{
            background: "none", border: "none", color: T.textDim,
            fontSize: 18, cursor: "pointer", flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Confirmação de exclusão */}
        {confirmandoExclusao && (
          <div style={{
            margin: "0 20px 0", padding: "12px 14px",
            background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 8,
          }}>
            <p style={{ fontSize: 12, color: T.red, margin: "0 0 10px", lineHeight: 1.6 }}>
              Excluir este lead permanentemente?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={excluirLead}
                disabled={excluindo}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 6,
                  background: excluindo ? T.surfaceAlt : T.red,
                  color: excluindo ? T.textMid : "#fff",
                  border: "none", cursor: excluindo ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >{excluindo ? "Excluindo..." : "Confirmar"}</button>
              <button
                onClick={() => setConfirmandoExclusao(false)}
                style={{
                  fontSize: 11, padding: "6px 14px", borderRadius: 6,
                  background: "none", border: `1px solid ${T.border}`,
                  color: T.textMid, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ padding: "20px", flex: 1 }}>

          {/* Badges — temperatura calculada dinamicamente conforme status atual */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <TempBadge temp={tempAtual} T={T} />
            <ScoreBadge score={lead.score} T={T} />
            <StatusBadge status={status} T={T} />
          </div>

          {/* Infos básicas */}
          <SecaoTitulo T={T}>Dados do lead</SecaoTitulo>
          {[
            { label: "Telefone",  val: lead.telefone  },
            { label: "Empresa",   val: lead.empresa   },
            { label: "Cargo",     val: lead.cargo     },
            { label: "Origem",    val: lead.utmSource },
            { label: "Campanha",  val: lead.utmCampanha },
            { label: "Cadastro",  val: fmtData(lead.criadoEm) },
          ].map(({ label, val }) => val ? (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "7px 0", borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontSize: 11, color: T.textDim }}>{label}</span>
              <span style={{ fontSize: 11, color: T.textMid, maxWidth: "60%", textAlign: "right" }}>{val}</span>
            </div>
          ) : null)}

          {/* Atualizar status */}
          <div style={{ marginTop: 18, marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 6 }}>
              Status {salvando && <span style={{ color: T.gold }}>salvando...</span>}
            </label>
            <select
              value={status}
              onChange={e => salvarStatus(e.target.value)}
              disabled={salvando}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                border: `1px solid ${T.borderAlt}`, outline: "none",
                background: T.surfaceAlt, color: T.text, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              {["novo","contactado","qualificado","convertido","perdido"].map(s => (
                <option key={s} value={s}>
                  {{ novo:"Novo", contactado:"Contactado", qualificado:"Qualificado", convertido:"Convertido", perdido:"Perdido" }[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Score breakdown */}
          {Object.keys(breakdown).length > 0 && (
            <>
              <SecaoTitulo T={T}>Score · {lead.score} pts</SecaoTitulo>
              {Object.entries(breakdown).map(([k, pts]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "6px 0", borderBottom: `1px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 11, color: T.textMid }}>{BREAKDOWN_LABELS[k] || k}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.gold }}>+{pts}</span>
                </div>
              ))}
              <div style={{ height: 16 }} />
            </>
          )}

          {/* Gerar mensagem IA */}
          <SecaoTitulo T={T}>Mensagem de abordagem</SecaoTitulo>
          <button
            onClick={gerarMensagem}
            disabled={gerandoMsg}
            style={{
              fontSize: 11, fontWeight: 600, padding: "8px 16px", borderRadius: 6,
              background: gerandoMsg ? T.surfaceAlt : T.gold,
              color: gerandoMsg ? T.textMid : "#000",
              border: "none", cursor: gerandoMsg ? "not-allowed" : "pointer",
              letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10,
            }}
          >
            {gerandoMsg ? "Gerando..." : "✦ Gerar com IA"}
          </button>

          {msg && (
            <div style={{
              background: T.surfaceAlt, borderRadius: 8, padding: "12px 14px",
              border: `1px solid ${T.borderAlt}`, marginBottom: 14,
            }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: T.text, whiteSpace: "pre-wrap", margin: 0 }}>
                {msg}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {telLimpo && (
                  <button
                    onClick={() => window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, "_blank")}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
                      background: T.green, color: "#fff", border: "none", cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}
                  >↗ Enviar no WhatsApp</button>
                )}
                <button onClick={gerarMensagem} style={{
                  fontSize: 11, padding: "6px 12px", borderRadius: 6,
                  background: "none", border: `1px solid ${T.border}`, cursor: "pointer", color: T.textMid,
                }}>↺ Regenerar</button>
              </div>
            </div>
          )}

          {/* Timeline de eventos */}
          <SecaoTitulo T={T}>Atividade ({(lead.eventos || []).length} eventos)</SecaoTitulo>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{
              position: "absolute", left: 14, top: 8, bottom: 8,
              width: 1, background: T.border,
            }} />
            {(lead.eventos || []).slice().reverse().map((ev, i) => (
              <div
                key={ev.id || i}
                style={{ display: "flex", gap: 12, marginBottom: 12, position: "relative" }}
                onMouseEnter={() => setHoveredEventoId(ev.id || i)}
                onMouseLeave={() => setHoveredEventoId(null)}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, zIndex: 1,
                }}>
                  {EVENTO_ICONES[ev.tipo] || "●"}
                </div>
                <div style={{ flex: 1, paddingTop: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                      {{ form_submit:"Formulário enviado", page_view:"Página visitada", email_aberto:"Email aberto",
                         email_clicado:"Clicou em email", anotacao:"Anotação" }[ev.tipo] || ev.tipo}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: T.textDim }}>{fmtRelativo(ev.criadoEm)}</span>
                      {ev.tipo === "anotacao" && ev.id && (
                        <button
                          onClick={() => excluirEvento(ev.id)}
                          disabled={excluindoEventoId === ev.id}
                          title="Excluir anotação"
                          style={{
                            background: "none",
                            border: `1px solid ${T.red}55`,
                            color: excluindoEventoId === ev.id ? T.textDim : T.red,
                            borderRadius: 4,
                            width: 20, height: 20,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: excluindoEventoId === ev.id ? "not-allowed" : "pointer",
                            fontSize: 10, lineHeight: 1, padding: 0,
                            opacity: hoveredEventoId === (ev.id || i) ? 1 : 0,
                            transition: "opacity 0.15s",
                            flexShrink: 0,
                          }}
                        >
                          {excluindoEventoId === ev.id ? "…" : "✕"}
                        </button>
                      )}
                    </div>
                  </div>
                  {ev.url && <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{ev.url.replace(/https?:\/\/[^/]+/, "")}</div>}
                  {ev.descricao && <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{ev.descricao}</div>}
                  {ev.utm_campaign && (
                    <span style={{
                      display: "inline-block", marginTop: 3,
                      fontSize: 9, color: T.gold, background: "#3a2c0a",
                      padding: "1px 6px", borderRadius: 3,
                    }}>{ev.utm_campaign}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Adicionar anotação manual */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              value={novoEvento}
              onChange={e => setNovoEvento(e.target.value)}
              onKeyDown={e => e.key === "Enter" && adicionarAnotacao()}
              placeholder="Adicionar anotação..."
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 7, fontSize: 12,
                border: `1px solid ${T.borderAlt}`, outline: "none",
                background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
              }}
            />
            <button
              onClick={adicionarAnotacao}
              style={{
                padding: "8px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: T.surfaceAlt, border: `1px solid ${T.border}`,
                color: T.textMid, cursor: "pointer",
              }}
            >+ Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Painel de automações ─────────────────────────────────────────────────────
function AutomacoesPanel({ automacoes, leads = [], empresaId, acoesDisparadas = [], T, bp }) {
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", gatilho: "score_acima", gatilhoValor: 30, acao: "notificar_vendas", acaoDados: { url: "" } });
  const [salvando, setSalvando] = useState(false);

  const GATILHOS = [
    { value: "score_acima",   label: "Score acima de..." },
    { value: "form_submit",   label: "Formulário enviado" },
    { value: "inativo_dias",  label: "Inativo há X dias" },
  ];
  const ACOES = [
    { value: "notificar_vendas", label: "Notificar no CRM" },
    { value: "webhook",          label: "Disparar webhook (Zapier / Make)" },
  ];
  const CORES_GATILHO = { score_acima: "#c9a84c", form_submit: "#4aad7a", inativo_dias: "#d4903a" };
  const CORES_ACAO    = { notificar_vendas: "#e05252", webhook: "#4a8fd4" };

  async function criar(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await salvarAutomacao(empresaId, {
        ...form,
        gatilhoValor: Number(form.gatilhoValor) || null,
      });
      setCriando(false);
      setForm({ nome: "", gatilho: "score_acima", gatilhoValor: 30, acao: "notificar_vendas", acaoDados: { url: "" } });
    } finally { setSalvando(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={() => setCriando(true)}
          style={{
            fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 7,
            background: T.gold, color: "#000", border: "none", cursor: "pointer",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}
        >+ Nova automação</button>
      </div>

      {/* ── Alertas de automações disparadas ── */}
      {acoesDisparadas.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {acoesDisparadas.map(({ automacao, lead }) => (
            <div key={`${automacao.id}-${lead.id}`} style={{
              background: "#1a1a10", border: `1px solid ${T.gold}44`,
              borderLeft: `3px solid ${T.gold}`,
              borderRadius: 8, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 14 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>
                  {automacao.nome}
                </span>
                <span style={{ fontSize: 12, color: T.textMid }}> · </span>
                {/* Temperatura exibida aqui também usa scoring automático */}
                <span style={{ fontSize: 12, color: T.textMid }}>
                  {lead.nome} — {tempLead(lead)}, score {lead.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {automacoes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.textDim, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          Nenhuma automação criada ainda.
        </div>
      ) : automacoes.map(a => (
        <div key={a.id} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${CORES_GATILHO[a.gatilho] || T.border}`,
          borderRadius: 10, padding: "14px 16px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: a.ativa ? T.green : T.textDim,
          }} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.nome}</div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
              criada {fmtData(a.criadoEm)}
            </div>
          </div>
          <Chip color={CORES_GATILHO[a.gatilho]}>
            SE: {GATILHOS.find(g => g.value === a.gatilho)?.label}
            {a.gatilhoValor ? ` ${a.gatilhoValor}` : ""}
          </Chip>
          <Chip color={CORES_ACAO[a.acao]}>
            ENTÃO: {ACOES.find(ac => ac.value === a.acao)?.label}
          </Chip>
          <button
            onClick={() => removerAutomacao(empresaId, a)}
            style={{
              background: "none", border: "none", color: T.textDim,
              cursor: "pointer", fontSize: 13, flexShrink: 0,
            }}
            title="Remover"
          >✕</button>
        </div>
      ))}

      {/* Modal de criação */}
      {criando && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 90, padding: 16,
        }} onClick={() => setCriando(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "24px", width: "100%", maxWidth: 420,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Nova automação</span>
              <button onClick={() => setCriando(false)} style={{ background: "none", border: "none", color: T.textDim, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={criar}>
              {[
                { label: "Nome", field: "nome", type: "text", placeholder: "Ex: Notificar leads quentes" },
              ].map(f => (
                <div key={f.field} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder} required
                    value={form[f.field]}
                    onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                      border: `1px solid ${T.borderAlt}`, outline: "none",
                      background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 5 }}>Gatilho</label>
                <select value={form.gatilho} onChange={e => setForm(p => ({ ...p, gatilho: e.target.value }))} style={{
                  width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                  border: `1px solid ${T.borderAlt}`, outline: "none",
                  background: T.surfaceAlt, color: T.text, fontFamily: "inherit", cursor: "pointer",
                }}>
                  {GATILHOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              {(form.gatilho === "score_acima" || form.gatilho === "inativo_dias") && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 5 }}>
                    {form.gatilho === "score_acima" ? "Score mínimo" : "Dias sem atividade"}
                  </label>
                  <input
                    type="number" min={1}
                    value={form.gatilhoValor}
                    onChange={e => setForm(p => ({ ...p, gatilhoValor: e.target.value }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                      border: `1px solid ${T.borderAlt}`, outline: "none",
                      background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
                    }}
                  />
                </div>
              )}
              <div style={{ marginBottom: form.acao === "webhook" ? 10 : 20 }}>
                <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 5 }}>Ação</label>
                <select
                  value={form.acao}
                  onChange={e => setForm(p => ({ ...p, acao: e.target.value, acaoDados: { url: "" } }))}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                    border: `1px solid ${T.borderAlt}`, outline: "none",
                    background: T.surfaceAlt, color: T.text, fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  {ACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {form.acao === "notificar_vendas" && (
                <div style={{
                  marginBottom: 20, padding: "10px 12px", borderRadius: 7,
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  fontSize: 11, color: T.textDim, lineHeight: 1.6,
                }}>
                  🔔 Um alerta aparecerá no sino do CRM toda vez que o gatilho disparar. Ideal para quem abre o sistema diariamente.
                </div>
              )}

              {form.acao === "webhook" && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 5 }}>
                    URL do webhook
                  </label>
                  <input
                    type="url"
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    required
                    value={form.acaoDados?.url || ""}
                    onChange={e => setForm(p => ({ ...p, acaoDados: { url: e.target.value } }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                      border: `1px solid ${T.borderAlt}`, outline: "none",
                      background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
                    }}
                  />
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 5, lineHeight: 1.6 }}>
                    Cole a URL do Zapier, Make ou n8n. Não sabe como criar? Veja o guia gratuito no site.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCriando(false)} style={{
                  padding: "9px 16px", borderRadius: 7, fontSize: 12,
                  background: "none", border: `1px solid ${T.border}`,
                  color: T.textMid, cursor: "pointer", fontFamily: "inherit",
                }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{
                  padding: "9px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: salvando ? T.surfaceAlt : T.gold,
                  color: salvando ? T.textMid : "#000",
                  border: "none", cursor: salvando ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}>{salvando ? "Salvando..." : "Criar automação"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Funil de Conversão ───────────────────────────────────────────────────────
function FunilLeads({ leads = [], T, bp }) {
  const ETAPAS = [
    { status: "Novo",        label: "Novos",        cor: "#D4AF37" },
    { status: "Contactado",  label: "Contactados",  cor: "#C49920" },
    { status: "Qualificado", label: "Qualificados", cor: "#9E7415" },
    { status: "Convertido",  label: "Convertidos",  cor: "#D4AF37" },
  ];

  const total    = leads.length;
  const perdidos = leads.filter(l => (l.status || "").toLowerCase() === "perdido").length;
  const ativos   = total - perdidos;

  const contagens = ETAPAS.map(e => ({
    ...e,
    n: leads.filter(l => (l.status || "").toLowerCase() === e.status.toLowerCase()).length,
  }));

  const txConv = ativos > 0
    ? Math.round((contagens[3].n / ativos) * 100)
    : 0;

  // Maior queda entre etapas consecutivas = gargalo
  let gargalIdx = 0, maiorQueda = 0;
  for (let i = 0; i < contagens.length - 1; i++) {
    const q = contagens[i].n - contagens[i + 1].n;
    if (q > maiorQueda) { maiorQueda = q; gargalIdx = i; }
  }

  // SVG funnel — trapézios decrescentes
  const CX = 200, SH = 46, GAP = 5;
  const HWS = [175, 128, 84, 50];

  function trapezoid(i) {
    const y  = i * (SH + GAP);
    const tw = HWS[i];
    const bw = i < 3 ? HWS[i + 1] : tw - 18;
    return {
      pts:  `${CX - tw},${y} ${CX + tw},${y} ${CX + bw},${y + SH} ${CX - bw},${y + SH}`,
      midY: y + SH / 2,
    };
  }

  const pct = i => ativos > 0 ? Math.round((contagens[i].n / ativos) * 100) : 0;

  if (total === 0) return (
    <div style={{
      textAlign: "center", padding: "40px 0",
      color: T.textDim, fontSize: 13, fontWeight: 300,
      border: `1px dashed ${T.border}`, borderRadius: 14,
    }}>
      Nenhum lead captado ainda.
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
            Pipeline de conversão
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
            {total} leads
            {perdidos > 0 && <span style={{ fontSize: 12, color: T.textDim, fontWeight: 400 }}> · {perdidos} perdidos</span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{txConv}%</div>
          <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>taxa de conversão</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: bp?.isMobile ? "1fr" : "1fr 200px", gap: 16, alignItems: "start" }}>
        {/* SVG */}
        <svg viewBox="0 0 400 207" style={{ display: "block", width: "100%", overflow: "visible" }}
          role="img" aria-label={`Funil com ${total} leads em ${contagens.filter(c => c.n > 0).length} etapas`}>
          {contagens.map((e, i) => {
            const { pts, midY } = trapezoid(i);
            const tc = i > 0 && i < 3 ? "#F0D890" : "#1A0C00";
            return (
              <g key={e.status}>
                <polygon points={pts} fill={e.cor} opacity={i === 3 ? 1 : 0.92 - i * 0.06} />
                <text x={CX} y={midY - 6} textAnchor="middle" fill={tc} fontSize={10} fontWeight="600"
                  fontFamily="system-ui, sans-serif">{e.label}</text>
                <text x={CX} y={midY + 8} textAnchor="middle" fill={tc} fontSize={9} opacity={0.85}
                  fontFamily="system-ui, sans-serif">{e.n} · {pct(i)}%</text>
              </g>
            );
          })}
        </svg>

        {/* Breakdown + gargalo */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {contagens.map((e, i) => {
            const pctVal = pct(i);
            const isGargalo = i === gargalIdx && maiorQueda > 0;
            return (
              <div key={e.status} style={{
                background: T.surfaceAlt,
                border: `1px solid ${isGargalo ? T.redBorder : T.border}`,
                borderLeft: `3px solid ${isGargalo ? T.red : e.cor}`,
                borderRadius: 9, padding: "8px 11px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: T.textMid }}>{e.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: i === 3 ? T.gold : T.text }}>{e.n}</span>
                </div>
                <div style={{ height: 2, background: T.border, borderRadius: 1 }}>
                  <div style={{ height: "100%", width: `${pctVal}%`, background: e.cor, borderRadius: 1, opacity: i === 3 ? 1 : 0.8 }} />
                </div>
              </div>
            );
          })}

          {maiorQueda > 0 && (
            <div style={{ background: T.redDim, border: `1px solid ${T.redBorder}`, borderRadius: 9, padding: "8px 11px" }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Maior gargalo</div>
              <div style={{ fontSize: 11, color: T.text }}>{contagens[gargalIdx].label} → {contagens[gargalIdx + 1].label}</div>
              <div style={{ fontSize: 10, color: T.red, marginTop: 2 }}>−{maiorQueda} lead{maiorQueda !== 1 ? "s" : ""} caindo aqui</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal do Funil ───────────────────────────────────────────────────────────
function ModalFunil({ leads, T, bp, onFechar }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 95, padding: 16, backdropFilter: "blur(4px)" }}
      onClick={onFechar}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px", width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            ◈ Funil de Leads
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", color: T.textDim, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <FunilLeads leads={leads} T={T} bp={bp} />
      </div>
    </div>
  );
}

// ─── Sub-componentes auxiliares ───────────────────────────────────────────────
function SecaoTitulo({ T, children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: T.textDim,
      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
    }}>{children}</p>
  );
}

function Chip({ color, children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 4,
      background: color + "22", color,
      textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// ─── Componente principal exportado ──────────────────────────────────────────
// Recebe T, bp, empresaId e config — mesma assinatura das outras seções do App.

export default function LeadsPage({ T, bp, empresaId, config }) {
  const { leads, metricas, automacoes, carregando, erro, acoesDisparadas } = useLeads(empresaId);
  const [subAba, setSubAba] = useState("lista");
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [funilAberto, setFunilAberto] = useState(false);

  // Painel sempre sincronizado com o snapshot mais recente do Firestore
  const leadAtualizado = leadSelecionado
    ? (leads.find(l => l.id === leadSelecionado.id) || leadSelecionado)
    : null;

  const [busca, setBusca] = useState("");
  const [filtroTemp, setFiltroTemp] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [criandoLead, setCriandoLead] = useState(false);
  const [formLead, setFormLead] = useState({ nome: "", email: "", telefone: "", empresa: "", cargo: "" });
  const [salvandoLead, setSalvandoLead] = useState(false);

  // Filtros — temperatura filtrada via scoring automático, não pelo campo armazenado
  const leadsFiltrados = leads
    .filter(l => !busca || l.nome?.toLowerCase().includes(busca.toLowerCase()) || l.email?.toLowerCase().includes(busca.toLowerCase()))
    .filter(l => !filtroTemp   || tempLead(l) === filtroTemp)
    .filter(l => !filtroStatus || (l.status || "").toLowerCase() === filtroStatus)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  async function salvarNovoLead(e) {
    e.preventDefault();
    if (!formLead.nome || !formLead.email) return;
    setSalvandoLead(true);
    try {
      await adicionarLead(empresaId, formLead);
      setCriandoLead(false);
      setFormLead({ nome: "", email: "", telefone: "", empresa: "", cargo: "" });
    } finally { setSalvandoLead(false); }
  }

  if (carregando) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: T.textDim, fontSize: 13 }}>
      <span style={{ color: T.gold }}>✦</span> Carregando leads...
    </div>
  );

  if (erro) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: T.red, fontSize: 13 }}>
      {erro}
    </div>
  );

  return (
    <div>
      {/* Sub-navegação */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 12, alignItems: "center" }}>
        {[
          { id: "lista",      label: `Leads${leads.length ? ` (${leads.length})` : ""}` },
          { id: "automacoes", label: `Automações${automacoes.length ? ` (${automacoes.length})` : ""}` },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSubAba(s.id)}
            style={{
              fontSize: 12, fontWeight: subAba === s.id ? 700 : 400,
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: subAba === s.id ? T.surfaceAlt : "transparent",
              color: subAba === s.id ? T.text : T.textMid,
              fontFamily: "inherit",
            }}
          >{s.label}</button>
        ))}
        {/* Botão funil — sempre visível, abre modal */}
        <button
          onClick={() => setFunilAberto(true)}
          style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 600,
            padding: "6px 14px", borderRadius: 6, cursor: "pointer",
            background: "transparent",
            border: `1px solid ${T.goldBorder}`,
            color: T.gold, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>◈</span> Ver funil
        </button>
      </div>

      {/* ── Aba Lista ── */}
      {subAba === "lista" && (
        <>
          {/* Métricas de leads */}
          <MetricasLeads leads={leads} metricas={metricas} T={T} bp={bp} />

          {/* Barra de filtros + tabela */}
          <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  style={{
                    flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 7, fontSize: 12,
                    border: `1px solid ${T.borderAlt}`, outline: "none",
                    background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
                  }}
                />
                {[
                  { val: filtroTemp,   set: setFiltroTemp,   options: [["","Temperatura"],["quente","Quente"],["morno","Morno"],["frio","Frio"]] },
                  { val: filtroStatus, set: setFiltroStatus, options: [["","Status"],["novo","Novo"],["contactado","Contactado"],["qualificado","Qualificado"],["convertido","Convertido"],["perdido","Perdido"]] },
                ].map((f, i) => (
                  <select key={i} value={f.val} onChange={e => f.set(e.target.value)} style={{
                    padding: "8px 10px", borderRadius: 7, fontSize: 12,
                    border: `1px solid ${T.borderAlt}`, outline: "none",
                    background: T.surfaceAlt, color: T.text, fontFamily: "inherit", cursor: "pointer",
                  }}>
                    {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <button
                  onClick={() => setCriandoLead(true)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "8px 14px", borderRadius: 7,
                    background: T.gold, color: "#000", border: "none", cursor: "pointer",
                    letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
                  }}
                >+ Lead</button>
              </div>

              {leadsFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: T.textDim, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
                  {leads.length === 0 ? "Nenhum lead ainda. Adicione o primeiro!" : "Nenhum lead encontrado com esses filtros."}
                </div>
              ) : bp.isMobile ? (
                leadsFiltrados.map(l => <LeadCard key={l.id || l.email} lead={l} T={T} onSelect={setLeadSelecionado} />)
              ) : (
                <TabelaLeads leads={leadsFiltrados} T={T} onSelect={setLeadSelecionado} />
              )}
          </>
        </>
      )}

      {/* ── Aba Automações ── */}
      {subAba === "automacoes" && (
        <AutomacoesPanel
          automacoes={automacoes}
          leads={leads}
          empresaId={empresaId}
          acoesDisparadas={acoesDisparadas}
          T={T}
          bp={bp}
        />
      )}

      {/* Painel lateral de detalhe */}
      {leadAtualizado && (
        <DetalheLeadPanel
          lead={leadAtualizado}
          empresaId={empresaId}
          empresaNome={config?.empresaNome}
          T={T}
          onFechar={() => setLeadSelecionado(null)}
        />
      )}

      {/* Modal Funil de Conversão */}
      {funilAberto && (
        <ModalFunil
          leads={leads}
          T={T}
          bp={bp}
          onFechar={() => setFunilAberto(false)}
        />
      )}

      {/* Modal de novo lead manual */}
      {criandoLead && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 90, padding: 16,
        }} onClick={() => setCriandoLead(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "24px", width: "100%", maxWidth: 400,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Novo lead</span>
              <button onClick={() => setCriandoLead(false)} style={{ background: "none", border: "none", color: T.textDim, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={salvarNovoLead}>
              {[
                { field: "nome",     label: "Nome *",    type: "text",  placeholder: "Nome completo",      required: true  },
                { field: "email",    label: "Email *",   type: "email", placeholder: "email@exemplo.com",  required: true  },
                { field: "telefone", label: "Telefone",  type: "tel",   placeholder: "(11) 99999-9999",    required: false },
                { field: "empresa",  label: "Empresa",   type: "text",  placeholder: "Nome da empresa",    required: false },
                { field: "cargo",    label: "Cargo",     type: "text",  placeholder: "Ex: Gerente",        required: false },
              ].map(f => (
                <div key={f.field} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: T.textMid, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder} required={f.required}
                    value={formLead[f.field]}
                    onChange={e => setFormLead(p => ({ ...p, [f.field]: e.target.value }))}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 12,
                      border: `1px solid ${T.borderAlt}`, outline: "none",
                      background: T.surfaceAlt, color: T.text, fontFamily: "inherit",
                    }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" onClick={() => setCriandoLead(false)} style={{
                  padding: "9px 16px", borderRadius: 7, fontSize: 12,
                  background: "none", border: `1px solid ${T.border}`,
                  color: T.textMid, cursor: "pointer", fontFamily: "inherit",
                }}>Cancelar</button>
                <button type="submit" disabled={salvandoLead} style={{
                  padding: "9px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: salvandoLead ? T.surfaceAlt : T.gold,
                  color: salvandoLead ? T.textMid : "#000",
                  border: "none", cursor: salvandoLead ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}>{salvandoLead ? "Salvando..." : "Criar lead"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
