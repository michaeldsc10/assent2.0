// src/flow/AssFlow.jsx
// ASSENT Flow — Módulo de Agendamento Online
// Convenções AG v2.0: guard tenantUid, paths /users/{tenantUid}/..., serverTimestamp()
// Props: tenantUid, plano, theme, onToggleTheme, onVoltar

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx"; // ajuste o caminho conforme seu projeto
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";

const db = getFirestore();

// ─── Paleta e estilos inline (herda CSS vars do AG) ──────────────────────────
const S = {
  root: {
    display: "flex",
    height: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--font, 'Montserrat', sans-serif)",
    overflow: "hidden",
  },
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "var(--s1)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    padding: "0 0 16px 0",
    gap: 0,
  },
  sidebarHeader: {
    padding: "24px 20px 20px",
    borderBottom: "1px solid var(--border)",
    marginBottom: 8,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: "linear-gradient(135deg, var(--gold) 0%, #1a3a5c 100%)",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: 0.5,
  },
  logoText: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--gold)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  logoSub: {
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    cursor: "pointer",
    borderRadius: 0,
    background: active ? "var(--gold-alpha, rgba(212,175,55,0.12))" : "transparent",
    borderLeft: active ? "3px solid var(--gold)" : "3px solid transparent",
    color: active ? "var(--gold)" : "var(--text-muted)",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: "all 0.15s",
    userSelect: "none",
  }),
  sidebarFooter: {
    marginTop: "auto",
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  btnSecondary: {
    padding: "8px 14px",
    background: "var(--s2, rgba(255,255,255,0.05))",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-muted)",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
    width: "100%",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topbar: {
    height: 56,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    padding: "0 24px",
    gap: 12,
    background: "var(--s1)",
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    flex: 1,
  },
  badge: (color) => ({
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: color === "green"
      ? "rgba(34,197,94,0.15)"
      : color === "yellow"
      ? "rgba(234,179,8,0.15)"
      : color === "red"
      ? "rgba(239,68,68,0.15)"
      : "rgba(156,163,175,0.15)",
    color: color === "green"
      ? "#22c55e"
      : color === "yellow"
      ? "#eab308"
      : color === "red"
      ? "#ef4444"
      : "#9ca3af",
    border: `1px solid ${
      color === "green"
        ? "rgba(34,197,94,0.3)"
        : color === "yellow"
        ? "rgba(234,179,8,0.3)"
        : color === "red"
        ? "rgba(239,68,68,0.3)"
        : "rgba(156,163,175,0.3)"
    }`,
  }),
  content: {
    flex: 1,
    overflow: "auto",
    padding: 24,
  },
  card: {
    background: "var(--s1)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
  },
  statCard: {
    background: "var(--s1)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--gold)",
    lineHeight: 1,
  },
  statSub: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottom: "1px solid var(--border)",
    fontWeight: 600,
  },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  },
  btnPrimary: {
    padding: "8px 18px",
    background: "var(--gold)",
    border: "none",
    borderRadius: 8,
    color: "#000",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "opacity 0.15s",
  },
  btnGhost: {
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-muted)",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  btnDanger: {
    padding: "6px 12px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6,
    color: "#ef4444",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  btnSuccess: {
    padding: "6px 12px",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    background: "var(--s2, rgba(255,255,255,0.05))",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    background: "var(--s2, rgba(255,255,255,0.05))",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  label: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontWeight: 500,
  },
  formRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
  },
  divider: {
    height: 1,
    background: "var(--border)",
    margin: "20px 0",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 24px",
    color: "var(--text-muted)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  upgradeWall: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 12,
    textAlign: "center",
    padding: 40,
  },
};

// ─── Ícones SVG inline ────────────────────────────────────────────────────────
const Icon = {
  calendar: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  list: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  sun: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  moon: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  back: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  plus: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  ),
  copy: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  star: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  ),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DIAS_SEMANA = [
  { key: "dom", label: "Dom" },
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
];

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status) {
  if (status === "confirmado") return "green";
  if (status === "pendente") return "yellow";
  if (status === "cancelado") return "red";
  return "gray";
}

function statusLabel(status) {
  if (status === "confirmado") return "Confirmado";
  if (status === "pendente") return "Pendente";
  if (status === "cancelado") return "Cancelado";
  return status;
}

// ─── Config padrão ───────────────────────────────────────────────────────────
const CONFIG_DEFAULT = {
  servicos: [],
  diasAtivos: ["seg", "ter", "qua", "qui", "sex"],
  horaInicio: "08:00",
  horaFim: "18:00",
  intervaloMinutos: 60,
  nomeEmpresa: "",
  descricao: "",
  atualizadoEm: null,
};

// ─── Tela: Visão Geral ────────────────────────────────────────────────────────
function TelaVisaoGeral({ tenantUid }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantUid) return;
    const ref = collection(db, "users", tenantUid, "agendamento_reservas");
    const q = query(ref, orderBy("criadoEm", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReservas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantUid]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const semanaFim = new Date(hoje);
  semanaFim.setDate(semanaFim.getDate() + 7);

  const total = reservas.length;
  const confirmadas = reservas.filter((r) => r.status === "confirmado").length;
  const pendentes = reservas.filter((r) => r.status === "pendente").length;
  const canceladas = reservas.filter((r) => r.status === "cancelado").length;

  const hojeReservas = reservas.filter((r) => {
    if (!r.data_hora_inicio) return false;
    const d = r.data_hora_inicio.toDate ? r.data_hora_inicio.toDate() : new Date(r.data_hora_inicio);
    return d >= hoje && d < amanha;
  });

  const semanaReservas = reservas.filter((r) => {
    if (!r.data_hora_inicio) return false;
    const d = r.data_hora_inicio.toDate ? r.data_hora_inicio.toDate() : new Date(r.data_hora_inicio);
    return d >= hoje && d < semanaFim;
  });

  // Próximas 5 reservas confirmadas/pendentes
  const proximas = reservas
    .filter((r) => {
      if (!r.data_hora_inicio) return false;
      if (r.status === "cancelado") return false;
      const d = r.data_hora_inicio.toDate ? r.data_hora_inicio.toDate() : new Date(r.data_hora_inicio);
      return d >= hoje;
    })
    .sort((a, b) => {
      const da = a.data_hora_inicio.toDate ? a.data_hora_inicio.toDate() : new Date(a.data_hora_inicio);
      const db2 = b.data_hora_inicio.toDate ? b.data_hora_inicio.toDate() : new Date(b.data_hora_inicio);
      return da - db2;
    })
    .slice(0, 5);

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <div style={S.grid4}>
        <StatCard label="Total de Reservas" value={total} sub="todas as reservas" icon="📋" />
        <StatCard label="Hoje" value={hojeReservas.length} sub="agendamentos do dia" icon="📅" />
        <StatCard label="Esta Semana" value={semanaReservas.length} sub="próximos 7 dias" icon="📆" />
        <StatCard label="Pendentes" value={pendentes} sub="aguardando confirmação" icon="⏳" color="yellow" />
      </div>

      {/* Status breakdown */}
      <div style={S.grid2}>
        <div style={S.card}>
          <p style={S.sectionTitle}>Status das Reservas</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <StatusBar label="Confirmadas" value={confirmadas} total={total} color="#22c55e" />
            <StatusBar label="Pendentes" value={pendentes} total={total} color="#eab308" />
            <StatusBar label="Canceladas" value={canceladas} total={total} color="#ef4444" />
          </div>
        </div>

        <div style={S.card}>
          <p style={S.sectionTitle}>Próximos Agendamentos</p>
          {proximas.length === 0 ? (
            <div style={S.emptyState}>
              <p style={{ fontSize: 13 }}>Nenhum agendamento futuro</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proximas.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "var(--s2, rgba(255,255,255,0.03))",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                      {r.cliente_nome || "Cliente"}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {r.servico_nome || "Serviço"} · {formatDateShort(r.data_hora_inicio)}
                    </p>
                  </div>
                  <span style={S.badge(statusColor(r.status))}>{statusLabel(r.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div style={S.statCard}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <p style={{ ...S.statValue, color: color === "yellow" ? "#eab308" : "var(--gold)" }}>{value}</p>
      <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{label}</p>
      <p style={S.statSub}>{sub}</p>
    </div>
  );
}

function StatusBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {value} ({pct}%)
        </span>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Tela: Reservas ───────────────────────────────────────────────────────────
function TelaReservas({ tenantUid, podeEditar }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroData, setFiltroData] = useState("");
  const [atualizando, setAtualizando] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!tenantUid) return;
    const ref = collection(db, "users", tenantUid, "agendamento_reservas");
    const q = query(ref, orderBy("data_hora_inicio", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReservas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantUid]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const atualizarStatus = async (id, novoStatus) => {
    if (!podeEditar) return;
    setAtualizando(id);
    try {
      const ref = doc(db, "users", tenantUid, "agendamento_reservas", id);
      await updateDoc(ref, {
        status: novoStatus,
        atualizadoEm: serverTimestamp(),
      });
      showToast(
        novoStatus === "confirmado"
          ? "Reserva confirmada com sucesso!"
          : "Reserva cancelada.",
        novoStatus === "confirmado" ? "success" : "error"
      );
    } catch (e) {
      showToast("Erro ao atualizar reserva.", "error");
    }
    setAtualizando(null);
  };

  // Filtros
  let filtradas = reservas;
  if (filtroStatus !== "todos") {
    filtradas = filtradas.filter((r) => r.status === filtroStatus);
  }
  if (filtroData) {
    const dia = new Date(filtroData + "T00:00:00");
    const diaFim = new Date(filtroData + "T23:59:59");
    filtradas = filtradas.filter((r) => {
      if (!r.data_hora_inicio) return false;
      const d = r.data_hora_inicio.toDate ? r.data_hora_inicio.toDate() : new Date(r.data_hora_inicio);
      return d >= dia && d <= diaFim;
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ position: "relative" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: 13,
            fontWeight: 600,
            zIndex: 999,
            backdropFilter: "blur(8px)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {["todos", "pendente", "confirmado", "cancelado"].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: filtroStatus === s ? "1px solid var(--gold)" : "1px solid var(--border)",
                background: filtroStatus === s ? "var(--gold-alpha, rgba(212,175,55,0.12))" : "transparent",
                color: filtroStatus === s ? "var(--gold)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: filtroStatus === s ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {s === "todos" ? "Todos" : statusLabel(s)}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)}
          style={{ ...S.input, width: 160 }}
        />
        {filtroData && (
          <button onClick={() => setFiltroData("")} style={S.btnGhost}>
            Limpar
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
          {filtradas.length} reserva{filtradas.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {filtradas.length === 0 ? (
          <div style={S.emptyState}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>📭</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Nenhuma reserva encontrada
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Ajuste os filtros ou aguarde novos agendamentos.
            </p>
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Cliente</th>
                <th style={S.th}>Serviço</th>
                <th style={S.th}>Data/Hora</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Criado em</th>
                {podeEditar && <th style={S.th}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id} style={{ transition: "background 0.1s" }}>
                  <td style={S.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>
                        {r.cliente_nome || "—"}
                      </span>
                      {r.cliente_email && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {r.cliente_email}
                        </span>
                      )}
                      {r.cliente_telefone && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {r.cliente_telefone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>
                      {r.servico_nome || "—"}
                    </span>
                    {r.servico_duracao_min && (
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                        {r.servico_duracao_min} min
                      </span>
                    )}
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>
                      {formatDate(r.data_hora_inicio)}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(statusColor(r.status))}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {formatDate(r.criadoEm)}
                    </span>
                  </td>
                  {podeEditar && (
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.status === "pendente" && (
                          <>
                            <button
                              onClick={() => atualizarStatus(r.id, "confirmado")}
                              disabled={atualizando === r.id}
                              style={S.btnSuccess}
                            >
                              ✓ Confirmar
                            </button>
                            <button
                              onClick={() => atualizarStatus(r.id, "cancelado")}
                              disabled={atualizando === r.id}
                              style={S.btnDanger}
                            >
                              ✕ Cancelar
                            </button>
                          </>
                        )}
                        {r.status === "confirmado" && (
                          <button
                            onClick={() => atualizarStatus(r.id, "cancelado")}
                            disabled={atualizando === r.id}
                            style={S.btnDanger}
                          >
                            ✕ Cancelar
                          </button>
                        )}
                        {r.status === "cancelado" && (
                          <button
                            onClick={() => atualizarStatus(r.id, "pendente")}
                            disabled={atualizando === r.id}
                            style={S.btnGhost}
                          >
                            ↺ Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tela: Configurações ──────────────────────────────────────────────────────
function TelaConfiguracoes({ tenantUid, isAdmin }) {
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // Novo serviço
  const [novoServico, setNovoServico] = useState({
    nome: "",
    duracao: 60,
    preco: "",
    descricao: "",
  });

  useEffect(() => {
    if (!tenantUid) return;
    const ref = doc(db, "users", tenantUid, "agendamento_configuracoes", "config");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setConfig({ ...CONFIG_DEFAULT, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tenantUid]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const salvarConfig = async () => {
    if (!isAdmin) return;
    setSalvando(true);
    try {
      const ref = doc(db, "users", tenantUid, "agendamento_configuracoes", "config");
      await setDoc(
        ref,
        {
          ...config,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Configurações salvas com sucesso!");
    } catch (e) {
      showToast("Erro ao salvar configurações.", "error");
    }
    setSalvando(false);
  };

  const adicionarServico = () => {
    if (!novoServico.nome.trim()) return;
    const servico = {
      id: Date.now().toString(),
      nome: novoServico.nome.trim(),
      duracao_min: parseInt(novoServico.duracao) || 60,
      preco: parseFloat(novoServico.preco) || 0,
      descricao: novoServico.descricao.trim(),
      ativo: true,
    };
    setConfig((prev) => ({
      ...prev,
      servicos: [...(prev.servicos || []), servico],
    }));
    setNovoServico({ nome: "", duracao: 60, preco: "", descricao: "" });
  };

  const removerServico = (id) => {
    setConfig((prev) => ({
      ...prev,
      servicos: prev.servicos.filter((s) => s.id !== id),
    }));
  };

  const toggleDia = (key) => {
    setConfig((prev) => ({
      ...prev,
      diasAtivos: prev.diasAtivos.includes(key)
        ? prev.diasAtivos.filter((d) => d !== key)
        : [...prev.diasAtivos, key],
    }));
  };

  if (loading) return <LoadingSpinner />;

  if (!isAdmin) {
    return (
      <div style={S.emptyState}>
        <p style={{ fontSize: 24, marginBottom: 8 }}>🔒</p>
        <p style={{ fontSize: 13, color: "var(--text)" }}>
          Apenas administradores podem acessar as configurações.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: 13,
            fontWeight: 600,
            zIndex: 999,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Dados da Empresa */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Dados da Empresa</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={S.label}>Nome da Empresa</label>
            <input
              style={S.input}
              value={config.nomeEmpresa || ""}
              onChange={(e) => setConfig((p) => ({ ...p, nomeEmpresa: e.target.value }))}
              placeholder="Ex: Studio Fotografia Silva"
            />
          </div>
          <div>
            <label style={S.label}>Descrição curta</label>
            <input
              style={S.input}
              value={config.descricao || ""}
              onChange={(e) => setConfig((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Fotografia profissional para famílias"
            />
          </div>
        </div>
      </div>

      {/* Horários */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Horários de Funcionamento</p>

        {/* Dias da semana */}
        <label style={S.label}>Dias de Atendimento</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {DIAS_SEMANA.map((d) => {
            const ativo = (config.diasAtivos || []).includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggleDia(d.key)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: ativo ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: ativo ? "var(--gold-alpha, rgba(212,175,55,0.15))" : "transparent",
                  color: ativo ? "var(--gold)" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: ativo ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Horário início/fim e intervalo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={S.label}>Início do Expediente</label>
            <input
              type="time"
              style={S.input}
              value={config.horaInicio || "08:00"}
              onChange={(e) => setConfig((p) => ({ ...p, horaInicio: e.target.value }))}
            />
          </div>
          <div>
            <label style={S.label}>Fim do Expediente</label>
            <input
              type="time"
              style={S.input}
              value={config.horaFim || "18:00"}
              onChange={(e) => setConfig((p) => ({ ...p, horaFim: e.target.value }))}
            />
          </div>
          <div>
            <label style={S.label}>Duração dos Slots (min)</label>
            <select
              style={S.select}
              value={config.intervaloMinutos || 60}
              onChange={(e) =>
                setConfig((p) => ({ ...p, intervaloMinutos: parseInt(e.target.value) }))
              }
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1h30</option>
              <option value={120}>2 horas</option>
              <option value={180}>3 horas</option>
              <option value={240}>4 horas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Serviços */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Serviços Oferecidos</p>

        {/* Lista de serviços */}
        {(config.servicos || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Nome</th>
                  <th style={S.th}>Duração</th>
                  <th style={S.th}>Preço</th>
                  <th style={S.th}>Descrição</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {config.servicos.map((s) => (
                  <tr key={s.id}>
                    <td style={S.td}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{s.nome}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ color: "var(--text-muted)" }}>{s.duracao_min} min</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ color: "var(--gold)" }}>
                        {s.preco > 0
                          ? `R$ ${Number(s.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "Gratuito"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {s.descricao || "—"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => removerServico(s.id)}
                        style={S.btnDanger}
                      >
                        {Icon.trash}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Adicionar serviço */}
        <div
          style={{
            background: "var(--s2, rgba(255,255,255,0.03))",
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <p style={{ ...S.label, marginBottom: 12, color: "var(--text)", fontSize: 13, fontWeight: 600 }}>
            + Novo Serviço
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.label}>Nome do Serviço *</label>
              <input
                style={S.input}
                value={novoServico.nome}
                onChange={(e) => setNovoServico((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Ensaio Fotográfico"
                onKeyDown={(e) => e.key === "Enter" && adicionarServico()}
              />
            </div>
            <div>
              <label style={S.label}>Duração (min)</label>
              <select
                style={S.select}
                value={novoServico.duracao}
                onChange={(e) => setNovoServico((p) => ({ ...p, duracao: e.target.value }))}
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h30</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Preço (R$)</label>
              <input
                style={S.input}
                type="number"
                min="0"
                step="0.01"
                value={novoServico.preco}
                onChange={(e) => setNovoServico((p) => ({ ...p, preco: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={S.label}>Descrição (opcional)</label>
              <input
                style={S.input}
                value={novoServico.descricao}
                onChange={(e) => setNovoServico((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Breve descrição do serviço"
              />
            </div>
            <button
              onClick={adicionarServico}
              disabled={!novoServico.nome.trim()}
              style={{
                ...S.btnPrimary,
                opacity: novoServico.nome.trim() ? 1 : 0.4,
                height: 38,
              }}
            >
              {Icon.plus} Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Salvar */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={salvarConfig}
          disabled={salvando}
          style={{ ...S.btnPrimary, padding: "10px 28px", fontSize: 14 }}
        >
          {salvando ? "Salvando…" : "💾 Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}

// ─── Tela: Link Público ───────────────────────────────────────────────────────
function TelaLinkPublico({ tenantUid }) {
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!tenantUid) return;
    const ref = doc(db, "users", tenantUid, "agendamento_configuracoes", "config");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => unsub();
  }, [tenantUid]);

  // URL base — troca pelo domínio real quando a página pública for criada
  const BASE_URL = "https://flow.assentagencia.com.br";
  const linkPublico = `${BASE_URL}?tenant=${tenantUid}`;

  const copiarLink = () => {
    navigator.clipboard.writeText(linkPublico);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const temServicos = config?.servicos?.length > 0;
  const temHorarios = config?.diasAtivos?.length > 0;
  const pronto = temServicos && temHorarios;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 680 }}>
      {/* Status de configuração */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Status da Configuração</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <CheckItem
            ok={temHorarios}
            label="Horários de atendimento configurados"
            hint="Configure dias e horários na aba Configurações"
          />
          <CheckItem
            ok={temServicos}
            label="Pelo menos um serviço cadastrado"
            hint="Adicione serviços na aba Configurações"
          />
          <CheckItem
            ok={!!config?.nomeEmpresa}
            label="Nome da empresa preenchido"
            hint="Preencha o nome na aba Configurações"
          />
        </div>
      </div>

      {/* Link */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Link de Agendamento</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
          Compartilhe este link com seus clientes. Eles poderão visualizar seus serviços
          e horários disponíveis e fazer um agendamento sem precisar criar conta.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            background: "var(--s2, rgba(255,255,255,0.03))",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text)", flex: 1, wordBreak: "break-all" }}>
            {linkPublico}
          </span>
          <button
            onClick={copiarLink}
            style={{
              ...S.btnPrimary,
              background: copied ? "rgba(34,197,94,0.15)" : "var(--gold)",
              color: copied ? "#22c55e" : "#000",
              border: copied ? "1px solid rgba(34,197,94,0.4)" : "none",
              flexShrink: 0,
            }}
          >
            {copied ? <>{Icon.check} Copiado!</> : <>{Icon.copy} Copiar</>}
          </button>
        </div>

        {!pronto && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.25)",
              borderRadius: 8,
              fontSize: 12,
              color: "#eab308",
            }}
          >
            ⚠️ Configure serviços e horários antes de compartilhar o link para garantir
            que os clientes encontrem horários disponíveis.
          </div>
        )}
      </div>

      {/* QR Code placeholder */}
      <div style={S.card}>
        <p style={S.sectionTitle}>QR Code</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Use o QR Code abaixo em materiais impressos, cartões de visita e redes sociais.
        </p>
        <div
          style={{
            width: 160,
            height: 160,
            background: "var(--s2, rgba(255,255,255,0.05))",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* QR Code será gerado pela página pública — placeholder visual */}
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="0" y="0" width="34" height="34" rx="4" fill="var(--gold)" opacity="0.3" />
            <rect x="5" y="5" width="24" height="24" rx="2" fill="var(--gold)" opacity="0.5" />
            <rect x="10" y="10" width="14" height="14" rx="1" fill="var(--gold)" />
            <rect x="46" y="0" width="34" height="34" rx="4" fill="var(--gold)" opacity="0.3" />
            <rect x="51" y="5" width="24" height="24" rx="2" fill="var(--gold)" opacity="0.5" />
            <rect x="56" y="10" width="14" height="14" rx="1" fill="var(--gold)" />
            <rect x="0" y="46" width="34" height="34" rx="4" fill="var(--gold)" opacity="0.3" />
            <rect x="5" y="51" width="24" height="24" rx="2" fill="var(--gold)" opacity="0.5" />
            <rect x="10" y="56" width="14" height="14" rx="1" fill="var(--gold)" />
            <rect x="46" y="46" width="8" height="8" rx="1" fill="var(--gold)" opacity="0.6" />
            <rect x="58" y="46" width="8" height="8" rx="1" fill="var(--gold)" opacity="0.6" />
            <rect x="46" y="58" width="8" height="8" rx="1" fill="var(--gold)" opacity="0.6" />
            <rect x="58" y="58" width="8" height="8" rx="1" fill="var(--gold)" opacity="0.6" />
            <rect x="70" y="46" width="10" height="4" rx="1" fill="var(--gold)" opacity="0.4" />
            <rect x="46" y="70" width="10" height="4" rx="1" fill="var(--gold)" opacity="0.4" />
            <rect x="66" y="68" width="14" height="4" rx="1" fill="var(--gold)" opacity="0.4" />
          </svg>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Disponível em breve</span>
        </div>
      </div>

      {/* Instruções de integração */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Como Usar</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { n: 1, text: "Configure seus serviços e horários na aba Configurações" },
            { n: 2, text: "Copie o link acima e compartilhe nas redes sociais, WhatsApp ou e-mail" },
            { n: 3, text: "O cliente acessa, escolhe o serviço e o horário disponível" },
            { n: 4, text: "A reserva aparece aqui na aba Reservas com status Pendente" },
            { n: 5, text: 'Confirme ou cancele a reserva clicando em "Confirmar" na aba Reservas' },
          ].map((item) => (
            <div key={item.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--gold-alpha, rgba(212,175,55,0.15))",
                  border: "1px solid var(--gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--gold)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {item.n}
              </div>
              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckItem({ ok, label, hint }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: ok ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.1)",
          border: `1px solid ${ok ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 11,
          color: ok ? "#22c55e" : "var(--text-muted)",
        }}
      >
        {ok ? "✓" : "○"}
      </div>
      <div>
        <span style={{ fontSize: 13, color: ok ? "var(--text)" : "var(--text-muted)", fontWeight: ok ? 500 : 400 }}>
          {label}
        </span>
        {!ok && hint && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>{hint}</span>
        )}
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 200,
        gap: 10,
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        style={{ animation: "spin 0.8s linear infinite" }}
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
      Carregando…
    </div>
  );
}

// ─── Tela de Upgrade ──────────────────────────────────────────────────────────
function TelaUpgrade({ onVoltar }) {
  return (
    <div style={S.upgradeWall}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "linear-gradient(135deg, var(--gold) 0%, #1a3a5c 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          marginBottom: 8,
        }}
      >
        {Icon.star}
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: -0.5,
          marginBottom: 8,
        }}
      >
        Assent Flow
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
        O módulo de agendamento online está disponível no plano{" "}
        <strong style={{ color: "var(--gold)" }}>Profissional</strong>. Faça upgrade para
        habilitar a página pública de booking e gerenciar reservas.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          style={{ ...S.btnPrimary, padding: "10px 24px" }}
          onClick={() => window.open("mailto:contato@assentagencia.com.br?subject=Upgrade Profissional", "_blank")}
        >
          ⭐ Fazer Upgrade
        </button>
        <button onClick={onVoltar} style={S.btnGhost}>
          Voltar
        </button>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function AssFlow({ tenantUid, plano, theme, onToggleTheme, onVoltar }) {
  // ── HOOKS primeiro — Rules of Hooks: nunca chame hooks após early return ──
  const { isAdmin, podeVer, podeEditar } = useAuth();
  const [tela, setTela] = useState("overview");

  // Guard de tenant — convenção AG v2.0
  if (!tenantUid) return null;

  // Guard de plano
  const isPro = plano === "profissional";

  // Guard de permissão: sem acesso ao módulo → tela de bloqueio
  if (!podeVer("agendamento")) {
    return (
      <div style={{ ...S.root, alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Acesso Restrito
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Seu perfil não possui permissão para acessar o módulo de Agendamentos.
          </p>
          <button onClick={onVoltar} style={S.btnGhost}>← Voltar ao Gestão</button>
        </div>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div style={S.root}>
        <TelaUpgrade onVoltar={onVoltar} />
      </div>
    );
  }

  const TELAS = [
    { key: "overview", label: "Visão Geral", icon: Icon.calendar },
    { key: "reservas", label: "Reservas", icon: Icon.list },
    { key: "configuracoes", label: "Configurações", icon: Icon.settings },
    { key: "link", label: "Link Público", icon: Icon.link },
  ];

  const titulos = {
    overview: "Visão Geral",
    reservas: "Reservas",
    configuracoes: "Configurações",
    link: "Link Público",
  };

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.logoRow}>
            <div style={S.logoIcon}>F</div>
            <div>
              <div style={S.logoText}>Flow</div>
              <div style={S.logoSub}>Agendamentos</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {TELAS.map((t) => (
            <div key={t.key} style={S.navItem(tela === t.key)} onClick={() => setTela(t.key)}>
              {t.icon}
              {t.label}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={S.sidebarFooter}>
          <button style={S.btnSecondary} onClick={onToggleTheme}>
            {theme === "dark" ? Icon.sun : Icon.moon}
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>
          <button style={S.btnSecondary} onClick={onVoltar}>
            {Icon.back}
            Voltar ao Gestão
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {/* Topbar */}
        <header style={S.topbar}>
          <span style={S.topbarTitle}>{titulos[tela]}</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "var(--gold-alpha, rgba(212,175,55,0.08))",
              color: "var(--gold)",
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            ★ Profissional
          </span>
        </header>

        {/* Conteúdo da tela */}
        <div style={S.content}>
          {tela === "overview" && <TelaVisaoGeral tenantUid={tenantUid} />}
          {tela === "reservas" && (
            <TelaReservas
              tenantUid={tenantUid}
              podeEditar={podeEditar("agendamento")}
            />
          )}
          {tela === "configuracoes" && (
            <TelaConfiguracoes
              tenantUid={tenantUid}
              isAdmin={isAdmin}
            />
          )}
          {tela === "link" && <TelaLinkPublico tenantUid={tenantUid} />}
        </div>
      </main>
    </div>
  );
}
