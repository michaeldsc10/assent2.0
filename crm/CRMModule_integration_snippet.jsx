// ─────────────────────────────────────────────────────────────────────────────
// ASSENT GESTÃO — Integração Assent CRM como sistema no dropdown
// Arquivo: src/App.jsx (trechos relevantes — não substituir o arquivo inteiro)
// ─────────────────────────────────────────────────────────────────────────────

// 1. IMPORTS — adicionar no topo do App.jsx do AG
// ─────────────────────────────────────────────────────────────────────────────
import CRMModule from "./CRMModule"; // ← novo import


// 2. STATE — dentro do componente principal do AG (ex: function AppShell())
// ─────────────────────────────────────────────────────────────────────────────
const [sistemaAtivo, setSistemaAtivo] = useState("gestao"); // "gestao" | "crm"


// 3. RENDERIZAÇÃO CONDICIONAL — substituir o bloco de conteúdo principal
// Envolve o conteúdo existente do AG num condicional:
// ─────────────────────────────────────────────────────────────────────────────
{sistemaAtivo === "crm" ? (
  <CRMModule
    tenantUid={tenantUid}       // ← do AuthContext
    config={config}             // ← config já carregada no AG
    onVoltar={() => setSistemaAtivo("gestao")}
  />
) : (
  /* Todo o JSX atual do AG fica aqui — sem alterar nada */
  <>{/* ... sidebar, content area, modals ... */}</>
)}


// 4. DROPDOWN — encontre o bloco onde renderiza "Configurações" e "Sair da conta"
// Adicione ANTES do item de Configurações:
// ─────────────────────────────────────────────────────────────────────────────

{/* ── Separador de sistemas ── */}
<div style={{
  margin: "4px 0",
  padding: "6px 14px 4px",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: T.textDim,
  fontFamily: FONT,
}}>
  Sistemas
</div>

{/* ── Item: Assent CRM ── */}
<button
  onClick={() => {
    setSistemaAtivo("crm");
    setDropdownAberto(false); // fechar o dropdown
  }}
  style={{
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 14px",
    background: "none",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: FONT,
    textAlign: "left",
    transition: "background 0.15s",
  }}
  onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
  onMouseLeave={e => e.currentTarget.style.background = "none"}
>
  {/* Ícone do sistema CRM */}
  <span style={{
    width: 28,
    height: 28,
    borderRadius: 7,
    background: T.goldGlow,
    border: `1px solid ${T.goldBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    flexShrink: 0,
  }}>
    ◈
  </span>

  <div style={{ flex: 1 }}>
    <div style={{
      fontSize: 12.5,
      fontWeight: 600,
      color: T.text,
      lineHeight: 1.2,
    }}>
      Assent CRM
    </div>
    <div style={{
      fontSize: 10.5,
      color: T.textMid,
      fontWeight: 300,
    }}>
      Radar, leads e automações
    </div>
  </div>

  {/* Badge "NOVO" — remover após alguns meses */}
  <span style={{
    fontSize: 8.5,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 999,
    background: T.goldGlow,
    color: T.gold,
    border: `1px solid ${T.goldBorder}`,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    flexShrink: 0,
  }}>
    NOVO
  </span>
</button>

{/* ── Separador antes de Configurações ── */}
<div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

{/* ← aqui vem o item de Configurações existente */}
{/* ← aqui vem o item de Sair da conta existente */}


// 5. CRMModule.jsx — o componente recebe onVoltar para o botão "← Gestão"
// No CRMModule.jsx, no header ou sidebar do CRM, adicionar:
// ─────────────────────────────────────────────────────────────────────────────
<button
  onClick={onVoltar}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    color: T.textMid,
    background: "none",
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: FONT,
  }}
>
  ← Assent Gestão
</button>
