// components/NotificacoesSino.jsx
// ASSENT v2.0 — Sino de notificações do topbar do AG
//
// Recebe as props vindas do hook useNotificacoes + setTela para navegar ao Flow.
//
// Uso no topbar do AG:
//   import NotificacoesSino from "./components/NotificacoesSino";
//   import { useNotificacoes } from "./hooks/useNotificacoes";
//
//   // No componente raiz do AG (onde user e tenantUid estão disponíveis):
//   const { notificacoes, naoLidas, marcarLida, initAudio } = useNotificacoes(tenantUid, user);
//
//   // Captura o primeiro clique da sessão para inicializar AudioContext:
//   useEffect(() => {
//     const handler = () => { initAudio(); window.removeEventListener("click", handler); };
//     window.addEventListener("click", handler, { once: true });
//     return () => window.removeEventListener("click", handler);
//   }, [initAudio]);
//
//   // No JSX do topbar:
//   <NotificacoesSino
//     notificacoes={notificacoes}
//     naoLidas={naoLidas}
//     marcarLida={marcarLida}
//     onNavegar={() => setTela("reservas")}  // ou o equivalente de navegação do AG
//   />

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design Tokens (consistentes com o AG) ───────────────────────────────────
const T = {
  ink2:       "#07070D",
  ink3:       "#0C0C14",
  ink5:       "#17171F",
  gold:       "#C09B52",
  goldHi:     "#D9B96E",
  goldLo:     "#856830",
  goldA06:    "rgba(192,155,82,0.06)",
  goldA12:    "rgba(192,155,82,0.12)",
  goldA22:    "rgba(192,155,82,0.22)",
  text100:    "#EEEAE2",
  text65:     "rgba(238,234,226,0.65)",
  text35:     "rgba(238,234,226,0.35)",
  text18:     "rgba(238,234,226,0.18)",
  text08:     "rgba(238,234,226,0.08)",
  line:       "rgba(238,234,226,0.055)",
  lineHi:     "rgba(238,234,226,0.09)",
  red:        "rgba(239,68,68,0.85)",
  redBg:      "rgba(239,68,68,0.90)",
  glass:      "rgba(12,12,20,0.92)",
};

// ─── Ícone Sino ───────────────────────────────────────────────────────────────
function IcSino({ size = 18, color = T.text35 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Ícone Calendário ─────────────────────────────────────────────────────────
function IcCal({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

// ─── Formata data/hora a partir de Firestore Timestamp ou string ──────────────
function fmtDataHora(data, hora) {
  if (data && hora) return `${data} às ${hora}`;
  if (data) return data;
  return "—";
}

// ─── Item individual de notificação ──────────────────────────────────────────
function NotifItem({ notif, onClicar, fechando }) {
  const { payload = {} } = notif;

  return (
    <button
      onClick={() => onClicar(notif)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${T.line}`,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "background 0.15s",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.goldA06; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: T.goldHi,
          boxShadow: `0 0 6px ${T.gold}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11.5, fontWeight: 700,
          color: T.goldHi,
          letterSpacing: "0.1px",
        }}>
          Nova reserva recebida
        </span>
      </div>

      {/* Payload */}
      <div style={{ paddingLeft: 13, display: "flex", flexDirection: "column", gap: 4 }}>
        <Row label="Cliente"  value={payload.cliente || "—"} />
        <Row label="Serviço"  value={payload.servico || "—"} />
        <Row
          label="Data"
          value={fmtDataHora(payload.data, payload.hora)}
          icon={<IcCal />}
        />
      </div>
    </button>
  );
}

function Row({ label, value, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontSize: 10, color: T.text18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", minWidth: 44, flexShrink: 0 }}>
        {label}
      </span>
      {icon && <span style={{ color: T.text18, display: "flex", alignItems: "center" }}>{icon}</span>}
      <span style={{ fontSize: 12, color: T.text65, fontWeight: 500, lineHeight: 1.3 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Painel dropdown ──────────────────────────────────────────────────────────
function PainelNotificacoes({ notificacoes, onClicar, onFechar }) {
  const ref = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleOut(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onFechar();
      }
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, [onFechar]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        width: 320,
        maxHeight: 420,
        background: T.glass,
        border: `1px solid ${T.lineHi}`,
        borderRadius: 14,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(192,155,82,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 500,
        animation: "notif-reveal 0.22s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <style>{`
        @keyframes notif-reveal {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "13px 16px",
        borderBottom: `1px solid ${T.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IcSino size={14} color={T.gold} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text100, letterSpacing: "0.1px" }}>
            Notificações
          </span>
          {notificacoes.length > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 800,
              padding: "1px 7px", borderRadius: 20,
              background: "rgba(192,155,82,0.14)",
              border: `1px solid ${T.goldA22}`,
              color: T.goldHi,
              letterSpacing: "0.3px",
            }}>
              {notificacoes.length} nova{notificacoes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={onFechar}
          style={{
            background: "none", border: "none",
            color: T.text35, cursor: "pointer",
            display: "flex", alignItems: "center", padding: 4,
            borderRadius: 6, transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.text100; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.text35; }}
          aria-label="Fechar notificações"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Lista */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {notificacoes.length === 0 ? (
          <div style={{ padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.4 }}>🔔</div>
            <p style={{ fontSize: 12, color: T.text35, lineHeight: 1.6 }}>
              Nenhuma notificação pendente.
            </p>
          </div>
        ) : (
          notificacoes.map((n) => (
            <NotifItem key={n.id} notif={n} onClicar={onClicar} />
          ))
        )}
      </div>

      {/* Footer */}
      {notificacoes.length > 0 && (
        <div style={{
          padding: "10px 16px",
          borderTop: `1px solid ${T.line}`,
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10.5, color: T.text18, textAlign: "center", lineHeight: 1.5 }}>
            Clique em uma notificação para abrir as reservas e marcá-la como lida.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

/**
 * NotificacoesSino
 *
 * Props:
 *   notificacoes  {Array}    — lista vinda do useNotificacoes
 *   naoLidas      {number}   — contagem de não-lidas
 *   marcarLida    {Function} — (notifId: string) => Promise<void>
 *   onNavegar     {Function} — chamado ao clicar em uma notificação (ex: () => setTela("reservas"))
 */
export default function NotificacoesSino({ notificacoes, naoLidas, marcarLida, onNavegar }) {
  const [aberto, setAberto] = useState(false);
  const wrapRef = useRef(null);

  const handleClicar = useCallback(
    async (notif) => {
      setAberto(false);
      // Marca como lida e navega em paralelo — não bloqueia a navegação se o write falhar
      marcarLida(notif.id).catch(() => {});
      if (onNavegar) onNavegar(notif);
    },
    [marcarLida, onNavegar]
  );

  const temNaoLidas = naoLidas > 0;

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {/* Botão sino */}
      <button
        onClick={() => setAberto((o) => !o)}
        aria-label={temNaoLidas ? `${naoLidas} notificação${naoLidas !== 1 ? "ões" : ""} não lida${naoLidas !== 1 ? "s" : ""}` : "Notificações"}
        style={{
          position: "relative",
          background: aberto ? T.goldA06 : "transparent",
          border: `1px solid ${aberto ? T.goldA22 : "transparent"}`,
          borderRadius: 10,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          transition: "all 0.18s cubic-bezier(0.22,1,0.36,1)",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!aberto) {
            e.currentTarget.style.background = T.text08;
            e.currentTarget.style.borderColor = T.lineHi;
          }
        }}
        onMouseLeave={(e) => {
          if (!aberto) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }
        }}
      >
        <IcSino
          size={18}
          color={temNaoLidas ? T.goldHi : (aberto ? T.gold : T.text35)}
        />

        {/* Badge numérico */}
        {temNaoLidas && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: T.redBg,
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              padding: "0 4px",
              boxShadow: "0 0 0 2px #07070D",
              letterSpacing: "0.2px",
              pointerEvents: "none",
              animation: "badge-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <style>{`
              @keyframes badge-pop {
                from { transform: scale(0); opacity: 0; }
                to   { transform: scale(1); opacity: 1; }
              }
            `}</style>
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {/* Painel dropdown */}
      {aberto && (
        <PainelNotificacoes
          notificacoes={notificacoes}
          onClicar={handleClicar}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  );
}
