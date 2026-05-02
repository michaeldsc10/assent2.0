/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — PDV.jsx
   Ponto de Venda profissional com leitor de código de barras
   Grava em: /users/{tenantUid}/vendas  com origem: "pdv"
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, Trash2, Plus, Minus,
  CheckCircle, X, AlertCircle, Barcode, User,
  CreditCard, Banknote, QrCode, Package, ArrowLeft,
  Receipt, Loader2, ChevronDown, Printer, PlusCircle, Trash2 as TrashIcon,
  Copy, Eye, EyeOff,
} from "lucide-react";

import { auth, db, functions } from "../lib/firebase";
import { fsError, fsSnapshotError } from "../utils/firestoreError";
import { useAuth } from "../contexts/AuthContext";
import {
  collection, query, where, getDocs, runTransaction,
  doc, orderBy, limit, getDoc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import BarcodeInput from "../components/BarcodeInput";
import { useConfiguracoes } from "./Configuracoes";

/* ─── Formata moeda BRL ─── */
const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ─── Sanitiza produto vindo do Firestore ───────────────────────────
   Remove campos Timestamp/Firebase internos — só mantém primitivos.
   Chamado ao adicionar ao carrinho para garantir que nunca cheguem
   a um transaction.set().
──────────────────────────────────────────────────────────────────── */
function sanitizarProduto(produto) {
  return {
    id:           String(produto.id           || ""),
    nome:         String(produto.nome         || ""),
    codigoBarras: String(produto.codigoBarras || produto.codigo || ""),
    precoVenda:   Number(produto.precoVenda   || produto.preco  || 0),
    preco:        Number(produto.preco        || produto.precoVenda || 0),
    estoque:      produto.estoque != null ? Number(produto.estoque) : null,
    categoria:    typeof produto.categoria === "string" ? produto.categoria : "",
    unidade:      typeof produto.unidade    === "string" ? produto.unidade   : "",
    foto:         typeof produto.foto === "string" && produto.foto ? produto.foto : null,
  };
}
const fmtNum = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ══════════════════════════════════════════════════════
   MODAL PAGAMENTO PARCIAL
   ══════════════════════════════════════════════════════ */
function ModalPagamento({ restante, taxas, onConfirm, onClose }) {
  const [forma, setForma]               = useState("dinheiro");
  const [parcelas, setParcelas]         = useState(1);
  const [valorStr, setValorStr]         = useState(
    restante > 0 ? restante.toFixed(2).replace(".", ",") : ""
  );
  const [valorRecebido, setValorRecebido] = useState("");

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  const FORMAS = [
    { key:"dinheiro", label:"Dinheiro",  icone:"💵" },
    { key:"cartao",   label:"Débito",    icone:"💳" },
    { key:"pix",      label:"Pix",       icone:"📱" },
    { key:"credito",  label:"Crédito",   icone:"💳" },
  ];

  const valor = parseFloat((valorStr || "0").replace(",", ".")) || 0;
  const taxa  = (() => {
    switch(forma) {
      case "cartao":  return parseFloat(taxas?.debito || "0");
      case "pix":     return parseFloat(taxas?.pix    || "0");
      case "credito": return parseFloat(taxas?.[`credito_${parcelas}`] || "0");
      default: return 0;
    }
  })();
  const vTaxa   = parseFloat((valor * (taxa / 100)).toFixed(2));
  const liquido = parseFloat((valor - vTaxa).toFixed(2));
  const troco   = forma === "dinheiro" && valorRecebido
    ? parseFloat(valorRecebido.replace(",", ".")) - valor
    : null;

  const labelForma = () => {
    const f = FORMAS.find(x => x.key === forma);
    return forma === "credito" ? `Crédito ${parcelas}x` : (f?.label || forma);
  };

  const handleConfirm = () => {
    if (valor <= 0) return;
    onConfirm({
      id:            Date.now(),
      forma,
      parcelas:      forma === "credito" ? parcelas : 1,
      valor,
      label:         labelForma(),
      valorRecebido: forma === "dinheiro" && valorRecebido
                       ? parseFloat(valorRecebido.replace(",",".")) : null,
      troco:         troco != null && troco >= 0 ? troco : null,
    });
  };

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:9998,
        background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"#16181f", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:14, width:340, padding:"24px 20px",
          boxShadow:"0 24px 64px rgba(0,0,0,0.7)",
          display:"flex", flexDirection:"column", gap:16,
          fontFamily:"'DM Sans','Segoe UI',sans-serif",
          animation:"slideUp .18s ease",
        }}
      >
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:15, fontWeight:700, color:"#e8e8f0" }}>
            Adicionar pagamento
          </span>
          <span role="button" onClick={onClose}
            style={{ color:"#5c5e72", cursor:"pointer", display:"flex", alignItems:"center" }}>
            <X size={16} />
          </span>
        </div>

        {/* Valor */}
        <div>
          <div style={{ fontSize:11, color:"#5c5e72", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>
            Valor
          </div>
          <div style={{ position:"relative" }}>
            <span style={{
              position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
              fontSize:13, color:"#9193a5",
            }}>R$</span>
            <input
              autoFocus
              type="text"
              value={valorStr}
              onChange={e => setValorStr(e.target.value)}
              onFocus={e => e.target.select()}
              style={{
                width:"100%", background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.15)", borderRadius:8,
                padding:"10px 12px 10px 32px", color:"#e8e8f0", fontSize:16,
                fontWeight:700, outline:"none",
              }}
            />
          </div>
          {restante > 0 && Math.abs(valor - restante) > 0.009 && (
            <span
              role="button"
              onClick={() => setValorStr(restante.toFixed(2).replace(".",","))}
              style={{ fontSize:11, color:"var(--pdv-gold,#c8a55e)", cursor:"pointer",
                       marginTop:4, display:"inline-block" }}
            >
              ↩ Usar valor restante ({fmt(restante)})
            </span>
          )}
        </div>

        {/* Forma de pagamento */}
        <div>
          <div style={{ fontSize:11, color:"#5c5e72", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>
            Forma de pagamento
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {FORMAS.map(f => (
              <span
                key={f.key}
                role="button"
                onClick={() => setForma(f.key)}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"9px 8px", borderRadius:8, cursor:"pointer",
                  fontSize:13, fontWeight: forma === f.key ? 600 : 400,
                  border: forma === f.key
                    ? "1px solid rgba(200,165,94,0.8)"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: forma === f.key
                    ? "rgba(200,165,94,0.15)"
                    : "rgba(255,255,255,0.04)",
                  color: forma === f.key ? "#c8a55e" : "#9193a5",
                  userSelect:"none",
                }}
              >
                {f.icone} {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* Parcelas (crédito) */}
        {forma === "credito" && (
          <div>
            <div style={{ fontSize:11, color:"#5c5e72", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>
              Parcelas
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[1,2,3,4,6,12].map(p => (
                <span
                  key={p}
                  role="button"
                  onClick={() => setParcelas(p)}
                  style={{
                    padding:"5px 12px", borderRadius:6, cursor:"pointer",
                    fontSize:12, userSelect:"none",
                    border: parcelas === p ? "1px solid #c8a55e" : "1px solid rgba(255,255,255,0.1)",
                    background: parcelas === p ? "rgba(200,165,94,0.15)" : "rgba(255,255,255,0.04)",
                    color: parcelas === p ? "#c8a55e" : "#9193a5",
                  }}
                >{p}x</span>
              ))}
            </div>
          </div>
        )}

        {/* Dinheiro: valor recebido */}
        {forma === "dinheiro" && (
          <div>
            <div style={{ fontSize:11, color:"#5c5e72", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>
              Valor recebido (opcional)
            </div>
            <input
              type="text"
              value={valorRecebido}
              onChange={e => setValorRecebido(e.target.value)}
              placeholder="0,00"
              style={{
                width:"100%", background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.12)", borderRadius:8,
                padding:"9px 12px", color:"#e8e8f0", fontSize:14, outline:"none",
              }}
            />
            {troco !== null && troco >= 0 && (
              <div style={{ marginTop:6, fontSize:13, color:"#4caf6a", fontWeight:600 }}>
                Troco: {fmt(troco)}
              </div>
            )}
          </div>
        )}

        {/* Taxa info */}
        {taxa > 0 && (
          <div style={{
            background:"rgba(224,85,85,0.08)", border:"1px solid rgba(224,85,85,0.2)",
            borderRadius:7, padding:"8px 12px", fontSize:12, color:"#e05555",
          }}>
            Taxa {taxa.toFixed(2)}% · você recebe {fmt(liquido)} de {fmt(valor)}
          </div>
        )}

        {/* Botão confirmar */}
        <span
          role="button"
          onClick={handleConfirm}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            background: valor > 0
              ? "linear-gradient(135deg,#d4b06a,#c8a55e,#b8943e)"
              : "rgba(255,255,255,0.07)",
            color: valor > 0 ? "#0a0a0a" : "#5c5e72",
            borderRadius:"50px", padding:"13px 20px",
            fontSize:14, fontWeight:800, cursor: valor > 0 ? "pointer" : "not-allowed",
            letterSpacing:".04em", textTransform:"uppercase",
            userSelect:"none",
            transition:"all .15s",
          }}
        >
          Confirmar {fmt(valor)}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL CUPOM TÉRMICO
   ══════════════════════════════════════════════════════ */
function ModalCupom({ venda, troco, empresa, onClose }) {
  const dataHora = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const FORMA_LABEL_CUPOM = {
    dinheiro: "Dinheiro",
    cartao:   "Débito",
    pix:      "Pix",
    credito:  `Crédito ${venda.parcelas}x`,
  };

  const imprimir = () => {
    const vendaParaRecibo = {
      idVenda:    venda.id,
      id:         venda.id,
      total:      venda.total,
      pagamentos: venda.pagamentos,
      parcelas:   venda.parcelas || 1,
      cliente:    venda.cliente,
      operador:   venda.operador,
      itens: (venda.itens || []).map(item => ({
        nome:    item.produto?.nome || item.nome || "—",
        preco:   item.precoUnit || 0,
        qtd:     item.qty || 1,
        desconto: 0,
      })),
      troco: troco,
    };
    if (troco != null && troco > 0) {
      vendaParaRecibo.pagamentos = (venda.pagamentos || []).map((p, i) =>
        i === 0 ? { ...p, label: `${p.label} (troco: ${fmtR$PDV(troco)})` } : p
      );
    }
    imprimirRecibo(vendaParaRecibo, empresa);
  };

  return (
    <div className="cupom-overlay" onClick={onClose}>
      <div className="cupom-modal" onClick={e => e.stopPropagation()}>
        <div className="cupom-modal-header">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Printer size={14} color="var(--pdv-gold)" />
            <span>Cupom #{venda.id}</span>
          </div>
          <button className="cupom-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="cupom-paper">
          {/* Cabeçalho empresa */}
          {empresa?.logo && (
            <div style={{ textAlign:"center", marginBottom:6 }}>
              <img src={empresa.logo} alt="Logo" style={{ maxHeight:52, maxWidth:140, filter:"grayscale(100%)", objectFit:"contain" }} />
            </div>
          )}
          <div className="cupom-empresa">{empresa?.nomeEmpresa || "ASSENT"}</div>
          {empresa?.cnpj    && <div className="cupom-sub">CNPJ: {empresa.cnpj}</div>}
          {empresa?.endereco && <div className="cupom-sub">{empresa.endereco}</div>}
          <div className="cupom-sub" style={{ marginTop:4, marginBottom:2 }}>Recibo de Venda</div>
          <div className="cupom-divider" />

          {/* Meta */}
          <div style={{ fontSize:11 }}><strong>ID:</strong> {venda.id}</div>
          <div style={{ fontSize:11 }}><strong>Data:</strong> {dataHora}</div>
          {venda.cliente   && <div style={{ fontSize:11 }}><strong>Cliente:</strong> {venda.cliente}</div>}
          {venda.operador  && <div style={{ fontSize:11 }}><strong>Operador:</strong> {venda.operador}</div>}
          <div className="cupom-divider" />

          {/* Cabeçalho itens */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"2px 8px", fontSize:10, fontWeight:"bold", marginBottom:4 }}>
            <span>PRODUTO / SERVIÇO</span>
            <span style={{ textAlign:"right" }}>QTD</span>
            <span style={{ textAlign:"right" }}>TOTAL</span>
          </div>

          {/* Itens */}
          {(venda.itens || []).map((item, i) => {
            const nome   = item.produto?.nome || item.nome || "—";
            const preco  = item.precoUnit || 0;
            const qty    = item.qty || 1;
            const total  = preco * qty;
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"1px 8px", fontSize:11, marginBottom:5 }}>
                <span style={{ fontWeight:"bold" }}>{nome}</span>
                <span style={{ textAlign:"right", fontWeight:"bold" }}>{qty}x</span>
                <span style={{ textAlign:"right", fontWeight:"bold" }}>{fmtR$PDV(total)}</span>
                <span style={{ fontSize:10, color:"#555", gridColumn:"1/-1" }}>Unitário: {fmtR$PDV(preco)}</span>
              </div>
            );
          })}

          <div className="cupom-divider" />

          {/* Total */}
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"bold", fontSize:14, marginTop:2 }}>
            <span>TOTAL</span>
            <span>{fmtR$PDV(venda.total)}</span>
          </div>
          {troco != null && troco > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#1a7a3c", fontWeight:600 }}>
              <span>Troco</span><span>{fmtR$PDV(troco)}</span>
            </div>
          )}

          <div className="cupom-divider" />

          {/* Pagamento */}
          <div style={{ fontSize:11, fontWeight:"bold", marginBottom:3 }}>FORMA DE PAGAMENTO</div>
          {(venda.pagamentos || []).map((p, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
              <span>{p.label}</span>
              <span style={{ fontWeight:"bold" }}>{fmtR$PDV(p.valor ?? venda.total)}</span>
            </div>
          ))}

          <div className="cupom-rodape" style={{ marginTop:12 }}>Obrigado!</div>
        </div>

        <div className="cupom-modal-footer">
          <button className="cupom-btn-imprimir" onClick={imprimir}><Printer size={14}/> Imprimir</button>
          <button className="cupom-btn-fechar" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL QR CODE PIX — via Cloud Functions + onSnapshot
   - gerarPixQr      → Cloud Function cria pagamento MP
   - onSnapshot      → Firestore notifica quando pago (webhook MP)
   - consultarPagamento → fallback polling se webhook falhar
   ══════════════════════════════════════════════════════ */
function ModalQrPix({ valor, descricao, tenantUid, onPago, onClose }) {
  const [fase,     setFase]     = useState("gerando"); // gerando | aguardando | confirmado | erro
  const [qrBase64, setQrBase64] = useState("");
  const [qrCode,   setQrCode]   = useState("");
  const [errMsg,   setErrMsg]   = useState("");
  const [copiado,  setCopiado]  = useState(false);
  const [segundos, setSegundos] = useState(0);

  const unsubRef    = useRef(null); // onSnapshot unsubscribe
  const pollingRef  = useRef(null); // fallback polling interval
  const countRef    = useRef(null); // contador de segundos
  const mountedRef  = useRef(true);
  const confirmadoRef = useRef(false); // evita dupla confirmação

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  /* ── Limpa todos os listeners ao desmontar ── */
  useEffect(() => {
    mountedRef.current  = true;
    confirmadoRef.current = false;
    gerarQr();
    return () => {
      mountedRef.current = false;
      unsubRef.current?.();
      clearInterval(pollingRef.current);
      clearInterval(countRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Confirma pagamento (chamado pelo onSnapshot ou polling) ── */
  const confirmarPagamento = () => {
    if (confirmadoRef.current) return; // garante execução única
    confirmadoRef.current = true;
    unsubRef.current?.();
    clearInterval(pollingRef.current);
    clearInterval(countRef.current);
    if (mountedRef.current) {
      setFase("confirmado");
      setTimeout(() => onPago && onPago(valor), 1200);
    }
  };

  const CF_BASE = "https://us-central1-assent-2b945.cloudfunctions.net";

  /* Helper — chama Cloud Function via fetch com token Firebase Auth */
  const callCF = async (nome, body) => {
    const token = await getIdToken(auth.currentUser);
    const res   = await fetch(`${CF_BASE}/${nome}`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
    return data;
  };

  /* ── Gera QR via Cloud Function ── */
  const gerarQr = async () => {
    setFase("gerando");
    setErrMsg("");
    try {
      const result = await callCF("gerarPixQr", { tenantUid, valor, descricao });
      const { paymentId, qrCodeBase64, qrCode: qrText } = result;

      if (!mountedRef.current) return;
      setQrBase64(qrCodeBase64);
      setQrCode(qrText);
      setFase("aguardando");
      setSegundos(0);

      /* ── onSnapshot: escuta o documento no Firestore ──
         Atualizado pelo webhook do MP em tempo real       */
      const payRef  = doc(db, "users", tenantUid, "pagamentosQr", String(paymentId));
      unsubRef.current = onSnapshot(payRef, (snap) => {
        if (!snap.exists()) return;
        const status = snap.data()?.status;
        if (status === "approved") confirmarPagamento();
        if (status === "rejected" || status === "cancelled") {
          unsubRef.current?.();
          if (mountedRef.current) {
            setErrMsg("Pagamento recusado ou cancelado pelo Mercado Pago.");
            setFase("erro");
          }
        }
      }, fsSnapshotError("PDV:pagamentoQr"));

      /* ── Fallback polling a cada 8s ──
         Garante confirmação mesmo se o webhook falhar */
      pollingRef.current = setInterval(async () => {
        if (!mountedRef.current || confirmadoRef.current) return;
        try {
          const res = await callCF("consultarPagamento", { tenantUid, paymentId });
          if (res?.status === "approved") confirmarPagamento();
        } catch { /* polling silencioso */ }
      }, 8000);

      /* ── Contador de segundos ── */
      countRef.current = setInterval(() => {
        if (mountedRef.current) setSegundos(s => s + 1);
      }, 1000);

    } catch (e) {
      if (!mountedRef.current) return;
      setErrMsg(e?.message || "Erro ao gerar QR Code. Verifique as configurações.");
      setFase("erro");
    }
  };

  const copiarCodigo = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const formatarTempo = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const handleCancelar = () => {
    unsubRef.current?.();
    clearInterval(pollingRef.current);
    clearInterval(countRef.current);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        animation: "fadeIn .15s ease",
      }}
      onClick={fase === "aguardando" ? undefined : onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#13151d",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(200,165,94,0.12)",
          overflow: "hidden",
          animation: "slideUp .2s ease",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "rgba(200,165,94,0.12)", border: "1px solid rgba(200,165,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <QrCode size={16} color="#c8a55e" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e8f0" }}>Pagar com PIX</div>
              <div style={{ fontSize: 11, color: "#5c5e72" }}>Mercado Pago · pagamento instantâneo</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#5c5e72", display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Valor */}
        <div style={{
          textAlign: "center", padding: "16px 20px 8px",
          background: "linear-gradient(180deg, rgba(200,165,94,0.06), transparent)",
        }}>
          <div style={{ fontSize: 11, color: "#5c5e72", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".07em" }}>
            Valor a receber
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#c8a55e", letterSpacing: "-.01em" }}>
            {fmt(valor)}
          </div>
        </div>

        {/* Corpo principal */}
        <div style={{ padding: "12px 20px 20px" }}>

          {/* GERANDO */}
          {fase === "gerando" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: "3px solid rgba(200,165,94,0.2)",
                borderTopColor: "#c8a55e",
                animation: "spin .8s linear infinite",
              }} />
              <div style={{ fontSize: 13, color: "#7a7c96", textAlign: "center" }}>
                Gerando QR Code via Mercado Pago...
              </div>
            </div>
          )}

          {/* AGUARDANDO PAGAMENTO */}
          {fase === "aguardando" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              {/* QR Image */}
              <div style={{
                background: "#fff", borderRadius: 14, padding: 12,
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                border: "3px solid rgba(200,165,94,0.4)",
              }}>
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code PIX"
                  style={{ width: 200, height: 200, display: "block" }}
                />
              </div>

              {/* Indicador pulsando */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#c8a55e",
                  boxShadow: "0 0 0 0 rgba(200,165,94,0.4)",
                  animation: "pulsar 2s infinite",
                }} />
                <span style={{ fontSize: 12, color: "#7a7c96" }}>
                  Aguardando pagamento · {formatarTempo(segundos)}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#5c5e72", textAlign: "center", lineHeight: 1.6 }}>
                Escaneie o QR Code com o app do banco ou Mercado Pago.<br/>
                A venda será finalizada automaticamente.
              </div>

              {/* Copia e cola */}
              <div style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden",
              }}>
                <div style={{ fontSize: 10, color: "#5c5e72", padding: "8px 12px 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Pix Copia e Cola
                </div>
                <div style={{ padding: "0 12px 4px", fontSize: 10, color: "#7a7c96", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {qrCode.slice(0, 60)}...
                </div>
                <button
                  onClick={copiarCodigo}
                  style={{
                    width: "100%", padding: "9px 12px",
                    background: copiado ? "rgba(72,187,120,0.12)" : "rgba(255,255,255,0.04)",
                    border: "none", borderTop: "1px solid rgba(255,255,255,0.07)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    color: copiado ? "#48bb78" : "#9193a5",
                    fontSize: 12, fontWeight: 600,
                    fontFamily: "'DM Sans',sans-serif",
                    transition: "all .15s",
                  }}
                >
                  <Copy size={12} />
                  {copiado ? "Código copiado!" : "Copiar código"}
                </button>
              </div>

              {/* Cancelar */}
              <button
                onClick={handleCancelar}
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "7px 16px",
                  color: "#5c5e72", fontSize: 12, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", transition: "all .13s",
                }}
              >
                Cancelar pagamento
              </button>
            </div>
          )}

          {/* CONFIRMADO */}
          {fase === "confirmado" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(72,187,120,0.12)", border: "2px solid rgba(72,187,120,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "popIn .3s ease",
              }}>
                <CheckCircle size={32} color="#48bb78" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#48bb78" }}>Pagamento Confirmado!</div>
              <div style={{ fontSize: 12, color: "#5c5e72", textAlign: "center" }}>
                {fmt(valor)} recebido via PIX<br/>Finalizando venda automaticamente...
              </div>
            </div>
          )}

          {/* ERRO */}
          {fase === "erro" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "16px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(224,82,82,0.12)", border: "2px solid rgba(224,82,82,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertCircle size={24} color="#e05252" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e05252" }}>Erro ao gerar QR Code</div>
              <div style={{
                background: "rgba(224,82,82,0.07)", border: "1px solid rgba(224,82,82,0.2)",
                borderRadius: 9, padding: "10px 14px",
                fontSize: 12, color: "#c07070", lineHeight: 1.6, textAlign: "center", width: "100%",
              }}>
                {errMsg}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={gerarQr}
                  style={{
                    padding: "9px 18px", borderRadius: 9,
                    background: "linear-gradient(135deg,#d4b06a,#c8a55e)",
                    color: "#0a0a0a", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Tentar novamente
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "9px 18px", borderRadius: 9,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#9193a5", cursor: "pointer",
                    fontSize: 13, fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulsar {
          0%   { box-shadow: 0 0 0 0 rgba(200,165,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(200,165,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(200,165,94,0); }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL SENHA CANCELAMENTO PDV
   ══════════════════════════════════════════════════════ */
function ModalSenhaCancelar({ senhaCadastrada, onConfirm, onClose }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro]   = useState("");
  const [show, setShow]   = useState(false);
  const inputRef          = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const confirmar = () => {
    /* Se admin não cadastrou senha — libera sem bloqueio */
    if (!senhaCadastrada) { onConfirm(); return; }
    if (senha !== senhaCadastrada) {
      setErro("Senha incorreta.");
      setSenha("");
      inputRef.current?.focus();
      return;
    }
    onConfirm();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        animation: "fadeIn .15s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#16181f",
          border: "1px solid rgba(224,82,82,0.3)",
          borderRadius: 16, width: 320, padding: "24px 22px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.75)",
          display: "flex", flexDirection: "column", gap: 18,
          animation: "slideUp .18s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} color="#e05555" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e8f0" }}>Cancelar Venda</div>
              <div style={{ fontSize: 11, color: "#7a7c96" }}>Senha de autorização obrigatória</div>
            </div>
          </div>
          <span role="button" onClick={onClose}
            style={{ color: "#5c5e72", cursor: "pointer", display: "flex" }}>
            <X size={15} />
          </span>
        </div>

        {/* Input senha */}
        <div>
          <div style={{ fontSize: 11, color: "#5c5e72", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: ".05em" }}>
            Senha de Cancelamento
          </div>
          <div style={{ position: "relative" }}>
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro(""); }}
              onKeyDown={e => e.key === "Enter" && confirmar()}
              placeholder="••••••••"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${erro ? "rgba(224,82,82,0.6)" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 9, padding: "11px 40px 11px 14px",
                color: "#e8e8f0", fontSize: 15, outline: "none",
                fontFamily: "'DM Sans',sans-serif",
                transition: "border-color .15s",
              }}
            />
            <span role="button" onClick={() => setShow(s => !s)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                cursor: "pointer", color: "#5c5e72", display: "flex",
              }}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </span>
          </div>
          {erro && <div style={{ fontSize: 11, color: "#e05555", marginTop: 5 }}>{erro}</div>}
        </div>

        {/* Ações */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px", borderRadius: 9,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#9193a5", fontSize: 13, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >Voltar</button>
          <button
            onClick={confirmar}
            style={{
              flex: 2, padding: "10px", borderRadius: 9,
              background: "rgba(224,82,82,0.15)",
              border: "1px solid rgba(224,82,82,0.4)",
              color: "#e05555", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <X size={13} /> Confirmar Cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════ */

/* ── Recibo de impressão — mesmo modelo de Vendas.jsx ── */
const fmtR$PDV = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function imprimirRecibo(venda, empresa) {
  const el = document.getElementById("recibo-print-root");
  if (!el) return;
  const itens = venda.itens || [];
  const descontos = itens.reduce((s, i) => s + (i.desconto || 0), 0);

  const temTaxa = venda.valorTaxa > 0;
  const temParc = venda.parcelas > 1;

  const pagamentos = venda.pagamentos && venda.pagamentos.length > 0
    ? venda.pagamentos
    : [{ label: venda.formaPagamento || "—", valor: venda.total }];

  const pgtoLinhas = pagamentos.map(p => {
    const label = temParc && pagamentos.length === 1
      ? `${p.label} — ${venda.parcelas}x de ${fmtR$PDV(venda.total / venda.parcelas)}`
      : p.label;
    return `
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <span>${label}</span>
        <span style="font-weight:bold;">${fmtR$PDV(p.valor ?? venda.total)}</span>
      </div>`;
  }).join("");

  const logoHtml = empresa?.logo
    ? `<div style="text-align:center;margin-bottom:6px;">
         <img src="${empresa.logo}" alt="Logo" style="max-height:60px;max-width:180px;filter:grayscale(100%);object-fit:contain;" />
       </div>`
    : "";
  const nomeEmpresaHtml = empresa?.nomeEmpresa
    ? `<div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:3px;">${empresa.nomeEmpresa}</div>`
    : `<div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:3px;">ASSENT</div>`;
  const cnpjHtml = empresa?.cnpj
    ? `<div style="text-align:center;font-size:10px;margin-bottom:2px;">CNPJ: ${empresa.cnpj}</div>`
    : "";
  const enderecoHtml = empresa?.endereco
    ? `<div style="text-align:center;font-size:10px;margin-bottom:2px;">${empresa.endereco}</div>`
    : "";

  el.innerHTML = `
    <div class="recibo-print">
      ${logoHtml}
      ${nomeEmpresaHtml}
      ${cnpjHtml}
      ${enderecoHtml}
      <div style="text-align:center;font-size:11px;margin:6px 0 10px;">Recibo de Venda</div>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div style="font-size:12px;"><strong>ID:</strong> ${venda.idVenda || venda.id}</div>
      <div style="font-size:12px;"><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}</div>
      ${venda.cliente ? `<div style="font-size:12px;"><strong>Cliente:</strong> ${venda.cliente}</div>` : ""}
      ${venda.operador ? `<div style="font-size:12px;"><strong>Operador:</strong> ${venda.operador}</div>` : ""}

      <div style="border-top:1px dashed #000;margin:8px 0;"></div>

      <div style="display:grid;grid-template-columns:1fr auto auto;gap:2px 8px;font-size:11px;font-weight:bold;margin-bottom:4px;">
        <span>PRODUTO / SERVIÇO</span>
        <span style="text-align:right;">QTD</span>
        <span style="text-align:right;">TOTAL</span>
      </div>
      ${itens.map(i => {
        const totalItem = (i.preco || 0) * (i.qtd || 1) - (i.desconto || 0);
        return `
          <div style="display:grid;grid-template-columns:1fr auto auto;gap:1px 8px;font-size:11px;margin-bottom:5px;">
            <span style="font-weight:bold;">${i.nome || "Item livre"}</span>
            <span style="text-align:right;font-weight:bold;">${i.qtd}x</span>
            <span style="text-align:right;font-weight:bold;">${fmtR$PDV(totalItem)}</span>
            <span style="font-size:10px;color:#444;grid-column:1/-1;">Unitário: ${fmtR$PDV(i.preco)}</span>
            ${i.desconto > 0 ? `<span style="font-size:10px;color:#444;grid-column:1/-1;">Desconto: -${fmtR$PDV(i.desconto)}</span>` : ""}
          </div>`;
      }).join("")}

      <div style="border-top:1px dashed #000;margin:8px 0;"></div>

      ${descontos > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span>Descontos</span><span>-${fmtR$PDV(descontos)}</span>
        </div>` : ""}
      ${temTaxa ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#444;">
          <span>Taxa cartão (${venda.taxaPercentual}%)</span><span>${fmtR$PDV(venda.valorTaxa)}</span>
        </div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;">
        <span>TOTAL</span><span>${fmtR$PDV(venda.total)}</span>
      </div>

      <div style="border-top:1px dashed #000;margin:8px 0;"></div>

      <div style="font-size:12px;font-weight:bold;margin-bottom:4px;">FORMA DE PAGAMENTO</div>
      ${pgtoLinhas}

      <div style="text-align:center;font-size:10px;margin-top:14px;">Obrigado!</div>
    </div>
  `;
  window.print();
}

export default function PDV({ onVoltar }) {
  const { tenantUid, vendedorNome, vendedorId, cargo, user } = useAuth();
  const { config, loading: cfgLoading } = useConfiguracoes(tenantUid);

  /* ── Dados da empresa (logo + nome) ── */
  const empresa = config?.empresa || {};
  const nomeEmpresa = empresa.nomeEmpresa || config?.nomeEmpresa || "ASSENT Gestão";
  const logoEmpresa = empresa.logo || config?.logo || "";

  /* ── Estado do carrinho ── */
  const [carrinho, setCarrinho] = useState([]); // [{produto, qty, precoUnit, subtotal}]
  const [cliente, setCliente] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesFiltrados, setClientesFiltrados] = useState([]);
  const [showClientes, setShowClientes] = useState(false);

  /* ── Estado de busca de produto ── */
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  /* ── Pagamento dividido ── */
  const [pagamentos, setPagamentos] = useState([]); // [{id, forma, parcelas, valor, label}]
  const [showPagModal, setShowPagModal] = useState(false);

  /* ── Pix QR Code (Mercado Pago) ── */
  const [showQrPix, setShowQrPix] = useState(false);

  /* ── Senha de cancelamento ── */
  const [showSenhaCancelar, setShowSenhaCancelar] = useState(false);

  /* ── UI states ── */
  const [finalizando, setFinalizando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(null);
  const [showCupom, setShowCupom] = useState(false);
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState(null);
  const [nomeOperador, setNomeOperador] = useState("");

  /* ── Mobile: aba ativa ── */
  const [mobileTab, setMobileTab] = useState("produtos"); // "produtos" | "carrinho"

  /* ── Modal busca de produto (F8) ── */
  const [showBuscaModal, setShowBuscaModal] = useState(false);
  const [buscaModalQuery, setBuscaModalQuery] = useState("");
  const [buscaModalResultados, setBuscaModalResultados] = useState([]);
  const [buscaModalLoading, setBuscaModalLoading] = useState(false);
  const buscaModalInputRef = useRef(null);

  const buscaRef = useRef(null);

  /* ─── Busca nome do operador em licencas/{tenantUid} ─── */
  useEffect(() => {
    if (!tenantUid) return;
    getDoc(doc(db, "licencas", tenantUid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() || {};
          const name = d.name || d.nome || d.nomeCompleto || d.displayName || "";
          setNomeOperador(name);
        }
      })
      .catch(() => {});
  }, [tenantUid]);

  const operadorDisplay = nomeOperador || vendedorNome || user?.displayName || user?.email?.split("@")[0] || "Operador";

  /* ── Busca no modal F8 ── */
  useEffect(() => {
    const buscar = async () => {
      if (!tenantUid || buscaModalQuery.trim().length < 2) {
        setBuscaModalResultados([]);
        return;
      }
      setBuscaModalLoading(true);
      try {
        const ref = collection(db, "users", tenantUid, "produtos");
        const q = query(ref, orderBy("nome"), limit(30));
        const snap = await getDocs(q);
        const termo = buscaModalQuery.toLowerCase();
        setBuscaModalResultados(
          snap.docs
            .map(d => sanitizarProduto({ id: d.id, ...d.data() }))
            .filter(p => p.nome.toLowerCase().includes(termo) || p.codigoBarras.includes(termo))
            .slice(0, 12)
        );
      } catch { setBuscaModalResultados([]); }
      finally { setBuscaModalLoading(false); }
    };
    const timer = setTimeout(buscar, 280);
    return () => clearTimeout(timer);
  }, [buscaModalQuery, tenantUid]);

  /* ── Foco no input do modal ao abrir ── */
  useEffect(() => {
    if (showBuscaModal) {
      setTimeout(() => buscaModalInputRef.current?.focus(), 60);
    } else {
      setBuscaModalQuery("");
      setBuscaModalResultados([]);
    }
  }, [showBuscaModal]);

  /* ── Atalhos de teclado globais ── */
  useEffect(() => {
    const handleKey = (e) => {
      // Não dispara atalhos se estiver digitando em inputs (exceto os próprios modais)
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "F8") {
        e.preventDefault();
        setShowBuscaModal(s => !s);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        if (!finalizando && vencido && carrinho.length > 0) finalizarVenda();
        return;
      }
      if (e.key === "Escape") {
        if (showBuscaModal) { setShowBuscaModal(false); return; }
        if (showPagModal)   { setShowPagModal(false);   return; }
        if (showQrPix)      { setShowQrPix(false);      return; }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [finalizando, vencido, carrinho, showBuscaModal, showPagModal, showQrPix]);

  /* ─── Mapeamento forma → label ─── */
  const FORMA_LABEL = {
    dinheiro: "Dinheiro",
    cartao:   "Cartão de Débito",
    pix:      "Pix",
    credito:  "Cartão de Crédito",
  };

  /* ─── Total do carrinho ─── */
  const total    = carrinho.reduce((acc, item) => acc + item.subtotal, 0);
  const pago     = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const restante = parseFloat((total - pago).toFixed(2));
  const vencido  = restante <= 0.009; // considera quitado

  /* ─── Taxas ─── */
  const taxas = config?.taxas || {};
  const calcTaxa = (forma, parcelas) => {
    switch (forma) {
      case "cartao":  return parseFloat(taxas.debito || "0");
      case "pix":     return parseFloat(taxas.pix    || "0");
      case "credito": return parseFloat(taxas[`credito_${parcelas}`] || "0");
      default:        return 0;
    }
  };

  /* ══════════════════════════════════
     BUSCA POR CÓDIGO DE BARRAS
     ══════════════════════════════════ */
  const buscarPorCodigo = useCallback(
    async (codigo) => {
      if (!tenantUid || !codigo) return;
      setBuscando(true);
      setErro("");
      try {
        const ref = collection(db, "users", tenantUid, "produtos");
        const q = query(ref, where("codigoBarras", "==", codigo), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          setErro(`Produto não encontrado: "${codigo}"`);
          return;
        }
        const prod = sanitizarProduto({ id: snap.docs[0].id, ...snap.docs[0].data() });
        adicionarAoCarrinho(prod);
      } catch (e) {
        setErro("Erro ao buscar produto.");
      } finally {
        setBuscando(false);
      }
    },
    [tenantUid]
  );

  /* ══════════════════════════════════
     BUSCA TEXTUAL DE PRODUTO
     ══════════════════════════════════ */
  useEffect(() => {
    const buscar = async () => {
      if (!tenantUid || buscaProduto.trim().length < 2) {
        setProdutosFiltrados([]);
        return;
      }
      setBuscando(true);
      try {
        const ref = collection(db, "users", tenantUid, "produtos");
        const q = query(ref, orderBy("nome"), limit(30));
        const snap = await getDocs(q);
        const termo = buscaProduto.toLowerCase();
        const resultados = snap.docs
          .map((d) => sanitizarProduto({ id: d.id, ...d.data() }))
          .filter(
            (p) =>
              p.nome?.toLowerCase().includes(termo) ||
              p.codigoBarras?.includes(termo) ||
              p.codigo?.includes(termo)
          )
          .slice(0, 8);
        setProdutosFiltrados(resultados);
      } catch {
        setProdutosFiltrados([]);
      } finally {
        setBuscando(false);
      }
    };

    const timer = setTimeout(buscar, 300);
    return () => clearTimeout(timer);
  }, [buscaProduto, tenantUid]);

  /* ══════════════════════════════════
     BUSCA DE CLIENTES
     ══════════════════════════════════ */
  useEffect(() => {
    const buscar = async () => {
      if (!tenantUid || buscaCliente.trim().length < 2) {
        setClientesFiltrados([]);
        return;
      }
      try {
        const ref = collection(db, "users", tenantUid, "clientes");
        const q = query(ref, orderBy("nome"), limit(20));
        const snap = await getDocs(q);
        const termo = buscaCliente.toLowerCase();
        setClientesFiltrados(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => c.nome?.toLowerCase().includes(termo))
            .slice(0, 6)
        );
      } catch {
        setClientesFiltrados([]);
      }
    };

    const timer = setTimeout(buscar, 350);
    return () => clearTimeout(timer);
  }, [buscaCliente, tenantUid]);

  /* ══════════════════════════════════
     CARRINHO
     ══════════════════════════════════ */
  const adicionarAoCarrinho = useCallback((produto) => {
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.produto.id === produto.id);
      if (idx >= 0) {
        // Já existe — incrementa qty
        const novo = [...prev];
        novo[idx] = {
          ...novo[idx],
          qty: novo[idx].qty + 1,
          subtotal: (novo[idx].qty + 1) * novo[idx].precoUnit,
        };
        return novo;
      }
      // Novo item
      const precoUnit = parseFloat(produto.precoVenda || produto.preco || 0);
      return [
        ...prev,
        { produto, qty: 1, precoUnit, subtotal: precoUnit },
      ];
    });
    setBuscaProduto("");
    setProdutosFiltrados([]);
    setErro("");
  }, []);

  const alterarQty = useCallback((idx, delta) => {
    setCarrinho((prev) => {
      const novo = [...prev];
      const novaQty = +(novo[idx].qty + delta).toFixed(3);
      if (novaQty <= 0) return prev.filter((_, i) => i !== idx);
      novo[idx] = { ...novo[idx], qty: novaQty, subtotal: novaQty * novo[idx].precoUnit };
      return novo;
    });
  }, []);

  const setQtyManual = useCallback((idx, valor) => {
    const qty = parseFloat(String(valor).replace(",", "."));
    if (isNaN(qty) || qty <= 0) return;
    setCarrinho((prev) => {
      const novo = [...prev];
      novo[idx] = { ...novo[idx], qty, subtotal: parseFloat((qty * novo[idx].precoUnit).toFixed(2)) };
      return novo;
    });
  }, []);

  const removerItem = useCallback((idx) => {
    setCarrinho((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const limparVenda = () => {
    setCarrinho([]);
    setCliente(null);
    setBuscaCliente("");
    setPagamentos([]);
    setErro("");
    setVendaFinalizada(null);
  };

  /* ══════════════════════════════════
     FINALIZAR VENDA
     ══════════════════════════════════ */
  const finalizarVenda = async (extraPagamento = null) => {
    if (!tenantUid) return;
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um produto ao carrinho.");
      return;
    }
    setFinalizando(true);
    setErro("");

    const todosPagamentos = extraPagamento
      ? [...pagamentos, extraPagamento]
      : pagamentos;

    // Sanitiza pagamentos — garante apenas primitivos no Firestore
    const pagamentosLimpos = todosPagamentos.map((p) => ({
      id:            Number(p.id)         || 0,
      forma:         String(p.forma)      || "",
      parcelas:      Number(p.parcelas)   || 1,
      valor:         Number(p.valor)      || 0,
      label:         String(p.label)      || "",
      valorRecebido: p.valorRecebido != null ? Number(p.valorRecebido) : null,
      troco:         p.troco         != null ? Number(p.troco)         : null,
    }));

    try {
      const counterRef = doc(db, "users", tenantUid, "config", "contadores");

      // Variáveis capturadas fora da transaction para uso pós-commit
      let vendaIdFinal;

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const nextNum = (counterSnap.exists() ? counterSnap.data().vendas ?? 0 : 0) + 1;
        vendaIdFinal  = `PDV-${String(nextNum).padStart(5, "0")}`;

        const vendaRef = doc(collection(db, "users", tenantUid, "vendas"));

        // Apenas campos primitivos — sem objetos Firebase internos
        const itens = carrinho.map((item) => ({
          produtoId:    String(item.produto.id           || ""),
          nome:         String(item.produto.nome         || ""),
          codigoBarras: String(item.produto.codigoBarras || ""),
          qty:          Number(item.qty)                 || 1,
          precoUnit:    Number(item.precoUnit)           || 0,
          subtotal:     Number(item.subtotal)            || 0,
        }));

        const vendaDoc = {
          idVenda:        vendaIdFinal,
          itens,
          total:          Number(total)       || 0,
          pagamentos:     pagamentosLimpos,
          formaPagamento: pagamentosLimpos[0]?.label || "—",
          taxaPct:        0,
          valorTaxa:      0,
          totalLiquido:   Number(total)       || 0,
          data:           (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T00:00:00`; })(),
          cliente:        cliente?.nome  || null,
          clienteId:      cliente?.id   || null,
          status:         "ativa",
          origem:         "pdv",
          vendedorId:     vendedorId    || null,
          vendedorNome:   nomeOperador  || null,
          criadoEm:       serverTimestamp(), // servidor — fora do client
        };

        transaction.set(vendaRef, vendaDoc);
        transaction.set(counterRef, { vendas: nextNum }, { merge: true });
      });

      // ✅ State update APÓS o commit — fora da transaction
      setVendaFinalizada({
        id:       vendaIdFinal,
        total,
        pagamentos: pagamentosLimpos,
        itens:      carrinho,
        cliente:    cliente?.nome || null,
        operador:   operadorDisplay || null,
      });

    } catch (e) {
      fsError(e, "PDV:finalizarVenda");
      setErro("Erro ao finalizar venda. Tente novamente.");
    } finally {
      setFinalizando(false);
    }
  };

  /* ══════════════════════════════════
     RENDER — VENDA FINALIZADA
     ══════════════════════════════════ */
  if (vendaFinalizada) {
    return (
      <>
        <style>{CSS}</style>
        <div id="recibo-print-root" />
        <div className="pdv-root">
          <div className="pdv-success-screen">
            <div className="pdv-success-card">
              <CheckCircle size={64} className="pdv-success-icon" />
              <h2>Venda Finalizada!</h2>
              <p className="pdv-success-id">#{vendaFinalizada.id}</p>
              <p className="pdv-success-total">{fmt(vendaFinalizada.total)}</p>
              {(() => {
                const trocoTotal = (vendaFinalizada.pagamentos || [])
                  .reduce((s, p) => s + (p.troco || 0), 0);
                return trocoTotal > 0 ? (
                  <div className="pdv-success-troco">
                    Troco: <strong>{fmt(trocoTotal)}</strong>
                  </div>
                ) : null;
              })()}
              <div className="pdv-success-actions">
                <button className="pdv-btn-nova" onClick={limparVenda}>
                  <Plus size={18} /> Nova Venda
                </button>
                <button className="pdv-btn-cupom" onClick={() => setShowCupom(true)}>
                  <Printer size={15} /> Imprimir Cupom
                </button>
                {onVoltar && (
                  <button className="pdv-btn-voltar-ghost" onClick={onVoltar}>
                    <ArrowLeft size={16} /> Voltar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {showCupom && (
          <ModalCupom
            venda={vendaFinalizada}
            troco={(() => {
              const t = (vendaFinalizada.pagamentos || []).reduce((s,p)=>s+(p.troco||0),0);
              return t > 0 ? t : null;
            })()}
          empresa={empresa}
            onClose={() => setShowCupom(false)}
          />
        )}
      </>
    );
  }

  /* ══════════════════════════════════
     RENDER PRINCIPAL
     ══════════════════════════════════ */
  /* ── Estilo reutilizável para <kbd> ── */
  const kbdStyle = {
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)",
    borderRadius:5, padding:"2px 6px", fontSize:10, fontFamily:"monospace",
    color:"#9193a5", lineHeight:1.4, letterSpacing:".04em",
  };

  return (
    <>
      <style>{CSS}</style>
      <div id="recibo-print-root" />

      {/* ── MODAL BUSCA DE PRODUTO (F8) ── */}
      {showBuscaModal && (
        <div
          style={{
            position:"fixed", inset:0, zIndex:10001,
            background:"rgba(0,0,0,0.72)", backdropFilter:"blur(6px)",
            display:"flex", alignItems:"flex-start", justifyContent:"center",
            paddingTop:"8vh",
            fontFamily:"'DM Sans','Segoe UI',sans-serif",
            animation:"fadeIn .15s ease",
          }}
          onClick={() => setShowBuscaModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:"#16181f",
              border:"1px solid rgba(200,165,94,0.3)",
              borderRadius:16, width:"min(580px, 95vw)",
              boxShadow:"0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(200,165,94,0.08)",
              overflow:"hidden",
              animation:"slideUp .18s ease",
            }}
          >
            {/* Search input */}
            <div style={{
              display:"flex", alignItems:"center", gap:12,
              padding:"16px 20px",
              borderBottom:"1px solid rgba(255,255,255,0.07)",
            }}>
              <Search size={18} color="#c8a55e" style={{ flexShrink:0 }} />
              <input
                ref={buscaModalInputRef}
                type="text"
                value={buscaModalQuery}
                onChange={e => setBuscaModalQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") setShowBuscaModal(false);
                  if (e.key === "Enter" && buscaModalResultados.length === 1) {
                    adicionarAoCarrinho(buscaModalResultados[0]);
                    setShowBuscaModal(false);
                  }
                }}
                placeholder="Digite o nome ou código do produto..."
                autoComplete="off"
                style={{
                  flex:1, background:"transparent", border:"none", outline:"none",
                  color:"#e8e8f0", fontSize:16, fontWeight:500,
                }}
              />
              {buscaModalLoading && <Loader2 size={15} color="#c8a55e" style={{ animation:"spin .7s linear infinite", flexShrink:0 }} />}
              <span
                role="button"
                onClick={() => setShowBuscaModal(false)}
                style={{
                  background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:6, padding:"3px 8px", fontSize:11, color:"#5c5e72",
                  cursor:"pointer", flexShrink:0, userSelect:"none",
                }}
              >ESC</span>
            </div>

            {/* Resultados */}
            <div style={{ maxHeight:380, overflowY:"auto" }}>
              {buscaModalResultados.length === 0 && buscaModalQuery.length >= 2 && !buscaModalLoading && (
                <div style={{ padding:"28px 20px", textAlign:"center", color:"#5c5e72", fontSize:13 }}>
                  Nenhum produto encontrado para &ldquo;{buscaModalQuery}&rdquo;
                </div>
              )}
              {buscaModalResultados.length === 0 && buscaModalQuery.length < 2 && (
                <div style={{ padding:"28px 20px", textAlign:"center", color:"#5c5e72", fontSize:13 }}>
                  Digite pelo menos 2 caracteres para buscar
                </div>
              )}
              {buscaModalResultados.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => { adicionarAoCarrinho(p); setShowBuscaModal(false); }}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:14,
                    padding:"12px 20px", background:"transparent",
                    border:"none", borderBottom:"1px solid rgba(255,255,255,0.05)",
                    cursor:"pointer", textAlign:"left",
                    transition:"background .12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(200,165,94,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                >
                  <div style={{
                    width:36, height:36, borderRadius:8, flexShrink:0,
                    background:"rgba(200,165,94,0.1)", border:"1px solid rgba(200,165,94,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    overflow:"hidden",
                  }}>
                    {p.foto
                      ? <img src={p.foto} alt={p.nome} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <Package size={16} color="#c8a55e" />
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#e8e8f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {p.nome}
                    </div>
                    {p.codigoBarras && (
                      <div style={{ fontSize:11, color:"#5c5e72", fontFamily:"monospace" }}>{p.codigoBarras}</div>
                    )}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#c8a55e", flexShrink:0 }}>
                    {fmt(p.precoVenda || p.preco || 0)}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div style={{
              padding:"10px 20px",
              borderTop:"1px solid rgba(255,255,255,0.06)",
              display:"flex", gap:16, alignItems:"center",
              fontSize:11, color:"#5c5e72",
            }}>
              <span><kbd style={kbdStyle}>↵ Enter</kbd> adicionar único resultado</span>
              <span><kbd style={kbdStyle}>Esc</kbd> fechar</span>
              <span style={{ marginLeft:"auto" }}>{buscaModalResultados.length > 0 ? `${buscaModalResultados.length} produto(s)` : ""}</span>
            </div>
          </div>
        </div>
      )}

      {showPagModal && (
        <ModalPagamento
          restante={restante}
          taxas={taxas}
          onConfirm={(p) => { setPagamentos(ps => [...ps, p]); setShowPagModal(false); }}
          onClose={() => setShowPagModal(false)}
        />
      )}

      {showSenhaCancelar && (
        <ModalSenhaCancelar
          senhaCadastrada={config?.senhaCancelamento || ""}
          onConfirm={() => { setShowSenhaCancelar(false); limparVenda(); }}
          onClose={() => setShowSenhaCancelar(false)}
        />
      )}

      {/* Modal QR Code PIX */}
      {showQrPix && (
        <ModalQrPix
          valor={restante}
          descricao={`Venda PDV — ${carrinho.length} item(ns)`}
          tenantUid={tenantUid}
          onPago={(valorPago) => {
            const pixPagamento = {
              id:            Date.now(),
              forma:         "pix",
              parcelas:      1,
              valor:         valorPago,
              label:         "Pix QR Code",
              valorRecebido: null,
              troco:         null,
            };
            setPagamentos(ps => [...ps, pixPagamento]);
            setShowQrPix(false);
            finalizarVenda(pixPagamento);
          }}
          onClose={() => setShowQrPix(false)}
        />
      )}
      <div className="pdv-root">
        {/* ── BARRA DE ATALHOS ── */}
        <div className="pdv-shortcut-bar">
          <button
            className="pdv-shortcut-btn"
            onClick={() => setShowBuscaModal(true)}
            title="Pesquisar produtos (F8)"
          >
            <kbd className="pdv-shortcut-key">F8</kbd>
            <Search size={12} />
            <span>Pesquisar Produto</span>
          </button>
          <div className="pdv-shortcut-divider" />
          <button
            className={"pdv-shortcut-btn pdv-shortcut-btn--finalizar" + (!vencido || carrinho.length === 0 ? " pdv-shortcut-btn--disabled" : "")}
            onClick={!finalizando && vencido && carrinho.length > 0 ? finalizarVenda : undefined}
            title={vencido && carrinho.length > 0 ? "Finalizar venda (F9)" : "Adicione pagamento antes de finalizar"}
          >
            <kbd className="pdv-shortcut-key pdv-shortcut-key--gold">F9</kbd>
            <Receipt size={12} />
            <span>Finalizar Venda</span>
            {vencido && carrinho.length > 0 && (
              <span className="pdv-shortcut-badge">{fmt(total)}</span>
            )}
          </button>
          <div className="pdv-shortcut-divider" />
          <div className="pdv-shortcut-hint">
            <kbd className="pdv-shortcut-key">Esc</kbd>
            <span>Fechar modal</span>
          </div>
        </div>

        {/* ── HEADER ── */}
        <header className="pdv-header">
          <div className="pdv-header-brand">
            {logoEmpresa ? (
              <img src={logoEmpresa} alt={nomeEmpresa} className="pdv-logo" />
            ) : (
              <div className="pdv-logo-placeholder">
                <Package size={22} />
              </div>
            )}
            <div className="pdv-brand-info">
              <span className="pdv-brand-name">{nomeEmpresa}</span>
              <span className="pdv-brand-sub">Frente de Caixa</span>
            </div>
          </div>

          <div className="pdv-header-center">
            <div className="pdv-barcode-wrapper">
              <Barcode size={16} className="pdv-barcode-icon" />
              <BarcodeInput
                onScan={buscarPorCodigo}
                autoFocus={true}
                placeholder="Leia o código ou busque o produto..."
                className="pdv-barcode-field"
              />
              {buscando && <Loader2 size={15} className="pdv-spinner" />}
            </div>
          </div>

          <div className="pdv-header-right">
            <div className="pdv-operador">
              <span className="pdv-operador-label">Operador</span>
              <span className="pdv-operador-nome">{operadorDisplay}</span>
            </div>
            {onVoltar && (
              <span
                role="button"
                tabIndex={0}
                onClick={onVoltar}
                title="Voltar ao menu"
                onKeyDown={e => e.key === "Enter" && onVoltar()}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.28)",
                  borderRadius: 9, width: 36, height: 36,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0,
                  userSelect: "none",
                }}
              >
                <ArrowLeft size={16} color="#d0d2e8" strokeWidth={2.5} />
              </span>
            )}
          </div>
        </header>

        {/* ── MOBILE TAB NAV ── */}
        <div className="pdv-mobile-tabs">
          <button
            className={"pdv-mobile-tab" + (mobileTab === "produtos" ? " active" : "")}
            onClick={() => setMobileTab("produtos")}
          >
            <Search size={16} />
            <span>Produtos</span>
          </button>
          <button
            className={"pdv-mobile-tab" + (mobileTab === "carrinho" ? " active" : "")}
            onClick={() => setMobileTab("carrinho")}
          >
            <ShoppingCart size={16} />
            <span>Carrinho</span>
            {carrinho.length > 0 && (
              <span className="pdv-mobile-tab-badge">{carrinho.length}</span>
            )}
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="pdv-body">
          {/* ─── COLUNA ESQUERDA: busca + produto ─── */}
          <section className={"pdv-col-left" + (mobileTab === "carrinho" ? " pdv-hidden-mobile" : "")}>
            {/* Busca textual */}
            <div className="pdv-search-box">
              <Search size={15} className="pdv-search-icon" />
              <input
                ref={buscaRef}
                type="text"
                className="pdv-search-input"
                placeholder="Buscar produto por nome..."
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                autoComplete="off"
              />
              {buscaProduto && (
                <button
                  className="pdv-search-clear"
                  onClick={() => { setBuscaProduto(""); setProdutosFiltrados([]); }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Resultado da busca */}
            {produtosFiltrados.length > 0 && (
              <div className="pdv-produto-lista">
                {produtosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    className="pdv-produto-item"
                    onClick={() => adicionarAoCarrinho(p)}
                  >
                    <div className="pdv-produto-info">
                      <span className="pdv-produto-nome">{p.nome}</span>
                      {p.codigoBarras && (
                        <span className="pdv-produto-codigo">{p.codigoBarras}</span>
                      )}
                    </div>
                    <span className="pdv-produto-preco">
                      {fmt(p.precoVenda || p.preco || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Erro */}
            {erro && (
              <div className="pdv-erro">
                <AlertCircle size={15} /> {erro}
              </div>
            )}

            {/* ─── Cliente (opcional) ─── */}
            <div className="pdv-cliente-section">
              <label className="pdv-section-label">
                <User size={14} /> Cliente <span className="pdv-optional">(opcional)</span>
              </label>
              {cliente ? (
                <div className="pdv-cliente-selecionado">
                  <span>{cliente.nome}</span>
                  <button onClick={() => { setCliente(null); setBuscaCliente(""); }}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="pdv-cliente-busca-wrapper">
                  <input
                    type="text"
                    className="pdv-cliente-input"
                    placeholder="Buscar cliente..."
                    value={buscaCliente}
                    onChange={(e) => { setBuscaCliente(e.target.value); setShowClientes(true); }}
                    onFocus={() => setShowClientes(true)}
                    autoComplete="off"
                  />
                  {showClientes && clientesFiltrados.length > 0 && (
                    <div className="pdv-cliente-dropdown">
                      {clientesFiltrados.map((c) => (
                        <button
                          key={c.id}
                          className="pdv-cliente-option"
                          onClick={() => {
                            setCliente(c);
                            setBuscaCliente(c.nome);
                            setShowClientes(false);
                          }}
                        >
                          {c.nome}
                          {c.telefone && <span className="pdv-cliente-tel">{c.telefone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── Pagamento Dividido ─── */}
            <div className="pdv-pagamento-section">
              <label className="pdv-section-label">
                <CreditCard size={14} /> Pagamento
              </label>

              {/* Lista de pagamentos já adicionados */}
              {pagamentos.length > 0 && (
                <div className="pdv-pag-lista">
                  {pagamentos.map((p) => {
                    const taxa = calcTaxa(p.forma, p.parcelas);
                    const vTaxa = parseFloat((p.valor * (taxa / 100)).toFixed(2));
                    return (
                      <div key={p.id} className="pdv-pag-item">
                        <div className="pdv-pag-item-info">
                          <span className="pdv-pag-item-label">{p.label}</span>
                          {taxa > 0 && (
                            <span className="pdv-pag-item-taxa">
                              taxa {taxa.toFixed(2)}% · líq. {fmt(p.valor - vTaxa)}
                            </span>
                          )}
                          {p.forma === "dinheiro" && p.valorRecebido && (
                            <span className="pdv-pag-item-taxa">
                              recebido {fmt(p.valorRecebido)} · troco {fmt(p.troco)}
                            </span>
                          )}
                        </div>
                        <span className="pdv-pag-item-valor">{fmt(p.valor)}</span>
                        <span
                          role="button"
                          onClick={() => setPagamentos(ps => ps.filter(x => x.id !== p.id))}
                          style={{ cursor:"pointer", color:"var(--pdv-error)", display:"flex",
                                   alignItems:"center", padding:"0 4px", flexShrink:0 }}
                        >
                          <X size={13} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Restante a pagar */}
              {carrinho.length > 0 && (
                <div className="pdv-pag-restante" style={{
                  color: vencido ? "var(--pdv-success)" : "var(--pdv-gold)",
                  fontWeight: 700, fontSize: 13, marginBottom: 6,
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span>{vencido ? "✓ Quitado" : "Restante"}</span>
                  <span>{vencido ? fmt(0) : fmt(restante)}</span>
                </div>
              )}

              {/* Botão adicionar pagamento */}
              {!vencido && carrinho.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    role="button"
                    onClick={() => setShowPagModal(true)}
                    style={{
                      display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      padding:"9px 12px", borderRadius:8, cursor:"pointer",
                      background:"rgba(200,165,94,0.1)", border:"1px solid rgba(200,165,94,0.35)",
                      color:"var(--pdv-gold)", fontSize:13, fontWeight:600,
                      userSelect:"none",
                    }}
                  >
                    <PlusCircle size={14} color="var(--pdv-gold)" />
                    {pagamentos.length === 0 ? "Adicionar pagamento" : `Adicionar mais (restam ${fmt(restante)})`}
                  </span>

                  {/* Botão QR PIX — visível somente se MP configurado e ativo */}
                  {config?.pagamentos?.mercadopago?.ativo && (
                    <span
                      role="button"
                      onClick={() => setShowQrPix(true)}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                        padding:"9px 12px", borderRadius:8, cursor:"pointer",
                        background:"rgba(0,158,227,0.1)", border:"1px dashed rgba(0,158,227,0.4)",
                        color:"#5ab4e0", fontSize:13, fontWeight:600,
                        userSelect:"none",
                      }}
                    >
                      <QrCode size={14} color="#5ab4e0" />
                      Pagar com Pix QR Code
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ─── COLUNA DIREITA: carrinho ─── */}
          <section className={"pdv-col-right" + (mobileTab === "produtos" ? " pdv-hidden-mobile" : "")}>
            <div className="pdv-carrinho-header">
              <ShoppingCart size={16} />
              <span>Cupom Fiscal</span>
              <span className="pdv-carrinho-count">{carrinho.length} iten{carrinho.length !== 1 ? "s" : ""}</span>
            </div>

            {/* ── Último produto adicionado — card vertical ── */}
            {carrinho.length > 0 && (() => {
              const ultimo = carrinho[carrinho.length - 1];
              const foto = ultimo?.produto?.foto || null;
              return (
                <div className="pdv-ultimo-produto">
                  {/* Fundo desfocado com a própria foto */}
                  {foto ? (
                    <div
                      className="pdv-ultimo-produto-bg"
                      style={{ backgroundImage: `url(${foto})` }}
                    />
                  ) : (
                    <div
                      className="pdv-ultimo-produto-bg"
                      style={{ background: "linear-gradient(135deg,#1a1c28,#0d0e14)" }}
                    />
                  )}
                  <div className="pdv-ultimo-produto-grad" />
                  <span className="pdv-ultimo-produto-qty">×{ultimo.qty}</span>
                  {/* Conteúdo vertical: foto grande centralizada + nome + preço */}
                  <div className="pdv-ultimo-produto-content">
                    <div className="pdv-ultimo-produto-foto">
                      {foto ? (
                        <img src={foto} alt={ultimo.produto.nome} draggable={false} />
                      ) : (
                        <div className="pdv-ultimo-produto-foto-placeholder">
                          <Package size={36} />
                        </div>
                      )}
                    </div>
                    <div className="pdv-ultimo-produto-info">
                      <span className="pdv-ultimo-produto-label">Último adicionado</span>
                      <span className="pdv-ultimo-produto-nome" title={ultimo.produto.nome}>
                        {ultimo.produto.nome}
                      </span>
                      <span className="pdv-ultimo-produto-preco">
                        {fmt(ultimo.precoUnit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tabela de itens */}
            <div className="pdv-carrinho-body">
              {carrinho.length === 0 ? (
                <div className="pdv-carrinho-vazio">
                  <ShoppingCart size={36} />
                  <p>Carrinho vazio</p>
                  <span>Escaneie ou busque um produto</span>
                </div>
              ) : (
                <>
                  <div className="pdv-carrinho-thead">
                    <span>Produto</span>
                    <span>Qtd</span>
                    <span>Unit.</span>
                    <span>Total</span>
                    <span></span>
                  </div>
                  {carrinho.map((item, idx) => (
                    <div key={item.produto.id + idx} className="pdv-carrinho-row">
                      <div className="pdv-item-nome">
                        <span>{item.produto.nome}</span>
                        {item.produto.codigoBarras && (
                          <span className="pdv-item-barcode">{item.produto.codigoBarras}</span>
                        )}
                      </div>
                      <div className="pdv-item-qty">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => alterarQty(idx, -1)}
                          style={{
                            background:"rgba(255,255,255,0.1)",
                            border:"1.5px solid rgba(255,255,255,0.22)",
                            borderRadius:6, width:24, height:24,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            cursor:"pointer", flexShrink:0,
                            color:"#c0c2d8", fontSize:16, fontWeight:300,
                            lineHeight:1, userSelect:"none",
                          }}
                        >−</span>
                        <input
                          className="pdv-qty-input"
                          type="number"
                          min="0.01"
                          step="1"
                          value={item.qty}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) setQtyManual(idx, String(v));
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => alterarQty(idx, 1)}
                          style={{
                            background:"rgba(255,255,255,0.1)",
                            border:"1.5px solid rgba(255,255,255,0.22)",
                            borderRadius:6, width:24, height:24,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            cursor:"pointer", flexShrink:0,
                            color:"#c0c2d8", fontSize:16, fontWeight:300,
                            lineHeight:1, userSelect:"none",
                          }}
                        >+</span>
                      </div>
                      <span className="pdv-item-unit">{fmt(item.precoUnit)}</span>
                      <span className="pdv-item-sub">{fmt(item.subtotal)}</span>
                      <button className="pdv-item-del" onClick={() => removerItem(idx)}>
                        <X size={13} color="var(--pdv-text-2)" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Totalizador */}
            <div className="pdv-total-section">
              <div className="pdv-total-row">
                <span>Subtotal</span>
                <span>{fmt(total)}</span>
              </div>
              {pago > 0 && (
                <div className="pdv-total-row" style={{ color:"var(--pdv-success)", fontSize:12 }}>
                  <span>Pago</span>
                  <span>{fmt(pago)}</span>
                </div>
              )}
              <div className="pdv-total-row pdv-total-grande">
                <span>{vencido ? "✓ Quitado" : "Total a Pagar"}</span>
                <span style={{ color: vencido ? "var(--pdv-success)" : "var(--pdv-gold)" }}>
                  {fmt(vencido ? total : restante)}
                </span>
              </div>
            </div>

            {/* Botão finalizar */}
            <span
              role="button"
              tabIndex={!vencido ? -1 : 0}
              onClick={!finalizando && vencido ? finalizarVenda : undefined}
              onKeyDown={e => e.key === "Enter" && !finalizando && vencido && finalizarVenda()}
              style={{
                margin: "12px 16px 4px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: "linear-gradient(135deg, #d4b06a 0%, #c8a55e 60%, #b8943e 100%)",
                color: "#0a0a0a",
                border: "none",
                borderRadius: "50px",
                padding: "15px 20px",
                fontSize: 15,
                fontWeight: 900,
                cursor: finalizando || !vencido ? "not-allowed" : "pointer",
                letterSpacing: ".05em",
                textTransform: "uppercase",
                opacity: finalizando || !vencido ? 0.38 : 1,
                boxShadow: "0 4px 24px rgba(200,165,94,0.4), 0 1px 0 rgba(255,255,255,0.15) inset",
                width: "calc(100% - 32px)",
                fontFamily: "'DM Sans','Segoe UI',sans-serif",
                userSelect: "none",
                transition: "box-shadow .2s, opacity .2s",
              }}
            >
              {finalizando ? (
                <><Loader2 size={18} color="#0a0a0a" /> Finalizando...</>
              ) : (
                <><Receipt size={18} color="#0a0a0a" /> {vencido ? `Finalizar Venda — ${fmt(total)}` : `Adicione pagamento — falta ${fmt(restante)}`}</>
              )}
            </span>

            {carrinho.length > 0 && (
              <button className="pdv-btn-cancelar" onClick={() => setShowSenhaCancelar(true)}>
                <X size={14} /> Cancelar venda
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════ */
const CSS = `
/* ── Variáveis (herdam do tema ASSENT se existirem) ── */
.pdv-root {
  --pdv-bg:        #0f1117;
  --pdv-surface:   #1a1d27;
  --pdv-border:    rgba(255,255,255,0.07);
  --pdv-gold:      #c8a55e;
  --pdv-gold-dim:  rgba(200,165,94,0.15);
  --pdv-text:      #e8e8f0;
  --pdv-text-2:    #9193a5;
  --pdv-text-3:    #5c5e72;
  --pdv-success:   #4caf6a;
  --pdv-error:     #e05555;
  --pdv-radius:    10px;
  --pdv-header-h:  62px;
  --pdv-shortcut-h: 32px;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  background: var(--pdv-bg);
  color: var(--pdv-text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── BARRA DE ATALHOS ── */
.pdv-shortcut-bar {
  height: var(--pdv-shortcut-h);
  background: rgba(10,10,16,0.95);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 2px;
  position: sticky;
  top: 0;
  z-index: 11;
  backdrop-filter: blur(8px);
}
.pdv-shortcut-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 5px;
  background: none; border: none; cursor: pointer;
  color: var(--pdv-text-3); font-size: 11px; font-weight: 500;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  transition: color .15s, background .15s;
  white-space: nowrap;
  user-select: none;
}
.pdv-shortcut-btn:hover {
  color: var(--pdv-text-2);
  background: rgba(255,255,255,0.05);
}
.pdv-shortcut-btn--finalizar:not(.pdv-shortcut-btn--disabled):hover {
  color: var(--pdv-gold);
  background: var(--pdv-gold-dim);
}
.pdv-shortcut-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pdv-shortcut-key {
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14);
  border-bottom: 2px solid rgba(255,255,255,0.18);
  border-radius: 4px; padding: 1px 5px;
  font-size: 10px; font-family: monospace;
  color: var(--pdv-text-3); line-height: 1.5;
  letter-spacing: .04em; font-weight: 700;
  transition: color .15s, border-color .15s;
}
.pdv-shortcut-key--gold {
  color: var(--pdv-gold);
  border-color: rgba(200,165,94,0.3);
  border-bottom-color: rgba(200,165,94,0.5);
  background: rgba(200,165,94,0.08);
}
.pdv-shortcut-badge {
  background: var(--pdv-gold);
  color: #0a0a0a;
  font-size: 10px; font-weight: 800;
  border-radius: 4px; padding: 1px 6px;
  letter-spacing: .02em;
  animation: fadeIn .2s ease;
}
.pdv-shortcut-divider {
  width: 1px; height: 14px;
  background: rgba(255,255,255,0.08);
  margin: 0 4px;
  flex-shrink: 0;
}
.pdv-shortcut-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  color: var(--pdv-text-3); font-size: 11px;
  opacity: 0.6;
  white-space: nowrap;
}
@media (max-width: 700px) {
  .pdv-shortcut-bar { display: none; }
  .pdv-root { --pdv-shortcut-h: 0px; }
}

/* ── HEADER ── */
.pdv-header {
  height: var(--pdv-header-h);
  background: var(--pdv-surface);
  border-bottom: 1px solid var(--pdv-border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  position: sticky;
  top: var(--pdv-shortcut-h);
  z-index: 10;
}
.pdv-header-brand { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.pdv-logo { height: 36px; object-fit: contain; border-radius: 6px; }
.pdv-logo-placeholder {
  width: 36px; height: 36px; background: var(--pdv-gold-dim);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  color: var(--pdv-gold);
}
.pdv-brand-name { font-size: 14px; font-weight: 600; color: var(--pdv-text); display: block; }
.pdv-brand-sub  { font-size: 11px; color: var(--pdv-gold); display: block; }

.pdv-header-center { flex: 1; }
.pdv-barcode-wrapper {
  display: flex; align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--pdv-border);
  border-radius: 8px;
  padding: 0 12px;
  gap: 8px;
  height: 40px;
  max-width: 500px;
  margin: 0 auto;
  transition: border-color .2s;
}
.pdv-barcode-wrapper:focus-within { border-color: var(--pdv-gold); }
.pdv-barcode-icon { color: var(--pdv-gold); flex-shrink: 0; }
.pdv-barcode-field {
  background: transparent; border: none; outline: none;
  color: var(--pdv-text); font-size: 14px; flex: 1; min-width: 0;
}
.pdv-barcode-field::placeholder { color: var(--pdv-text-3); }
@keyframes spin { to { transform: rotate(360deg); } }
.pdv-spinner { animation: spin .7s linear infinite; color: var(--pdv-gold); }

.pdv-header-right { display: flex; align-items: center; gap: 12px; min-width: 160px; justify-content: flex-end; }
.pdv-operador { text-align: right; }
.pdv-operador-label { font-size: 10px; color: var(--pdv-text-3); display: block; }
.pdv-operador-nome  { font-size: 13px; color: var(--pdv-text-2); display: block; font-weight: 500; }
.pdv-btn-voltar {
  background: rgba(255,255,255,0.09);
  border: 1.5px solid rgba(255,255,255,0.22);
  border-radius: 9px; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .2s; flex-shrink: 0;
}
.pdv-btn-voltar:hover { background: var(--pdv-gold-dim); border-color: var(--pdv-gold); }

/* ── BODY ── */
.pdv-body {
  flex: 1; display: flex;
  gap: 0;
  overflow: hidden;
  height: calc(100vh - var(--pdv-header-h) - var(--pdv-shortcut-h));
}

/* ── COL ESQUERDA ── */
.pdv-col-left {
  width: 360px;
  flex-shrink: 0;
  border-right: 1px solid var(--pdv-border);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Search */
.pdv-search-box {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--pdv-border);
  border-radius: 8px; padding: 0 10px; height: 38px;
  transition: border-color .2s;
}
.pdv-search-box:focus-within { border-color: var(--pdv-gold); }
.pdv-search-icon { color: var(--pdv-text-3); flex-shrink: 0; }
.pdv-search-input {
  background: transparent; border: none; outline: none;
  color: var(--pdv-text); font-size: 13.5px; flex: 1;
}
.pdv-search-input::placeholder { color: var(--pdv-text-3); }
.pdv-search-clear {
  background: none; border: none; cursor: pointer;
  color: var(--pdv-text-3); display: flex; align-items: center;
  padding: 0;
}
.pdv-search-clear:hover { color: var(--pdv-error); }

/* Produto lista */
.pdv-produto-lista {
  border: 1px solid var(--pdv-border);
  border-radius: var(--pdv-radius);
  overflow: hidden;
}
.pdv-produto-item {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: var(--pdv-surface);
  border: none; border-bottom: 1px solid var(--pdv-border);
  cursor: pointer; transition: background .15s; gap: 8px;
  text-align: left;
}
.pdv-produto-item:last-child { border-bottom: none; }
.pdv-produto-item:hover { background: var(--pdv-gold-dim); }
.pdv-produto-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.pdv-produto-nome { font-size: 13px; color: var(--pdv-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pdv-produto-codigo { font-size: 10px; color: var(--pdv-text-3); font-family: monospace; }
.pdv-produto-preco { font-size: 13px; color: var(--pdv-gold); font-weight: 600; flex-shrink: 0; }

/* Erro */
.pdv-erro {
  display: flex; align-items: center; gap: 8px;
  background: rgba(224,85,85,0.1); border: 1px solid rgba(224,85,85,0.25);
  color: var(--pdv-error); border-radius: 8px; padding: 10px 12px; font-size: 13px;
}

/* Section labels */
.pdv-section-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--pdv-text-3); font-weight: 600; margin-bottom: 8px;
}
.pdv-optional { text-transform: none; font-weight: 400; color: var(--pdv-text-3); font-size: 10px; }

/* Cliente */
.pdv-cliente-section { display: flex; flex-direction: column; }
.pdv-cliente-selecionado {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--pdv-gold-dim); border: 1px solid rgba(200,165,94,0.3);
  border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--pdv-gold);
}
.pdv-cliente-selecionado button {
  background: none; border: none; cursor: pointer; color: var(--pdv-gold); display: flex;
}
.pdv-cliente-busca-wrapper { position: relative; }
.pdv-cliente-input {
  width: 100%; background: rgba(255,255,255,0.04);
  border: 1px solid var(--pdv-border); border-radius: 8px;
  padding: 8px 12px; color: var(--pdv-text); font-size: 13px; outline: none;
  transition: border-color .2s;
}
.pdv-cliente-input:focus { border-color: var(--pdv-gold); }
.pdv-cliente-input::placeholder { color: var(--pdv-text-3); }
.pdv-cliente-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--pdv-surface); border: 1px solid var(--pdv-border);
  border-radius: 8px; overflow: hidden; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.pdv-cliente-option {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 9px 12px; background: none; border: none; border-bottom: 1px solid var(--pdv-border);
  cursor: pointer; text-align: left; color: var(--pdv-text); font-size: 13px; transition: background .15s;
}
.pdv-cliente-option:last-child { border-bottom: none; }
.pdv-cliente-option:hover { background: var(--pdv-gold-dim); }
.pdv-cliente-tel { font-size: 11px; color: var(--pdv-text-3); }

/* Pagamento */
.pdv-pagamento-section { display: flex; flex-direction: column; }
.pdv-pag-opcoes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pdv-pag-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border-radius: 8px; border: 1px solid var(--pdv-border);
  background: rgba(255,255,255,0.03); color: var(--pdv-text-2);
  font-size: 12.5px; cursor: pointer; transition: all .2s;
}
.pdv-pag-btn:hover { border-color: var(--pdv-gold); color: var(--pdv-gold); }
.pdv-pag-btn.active {
  background: var(--pdv-gold-dim); border-color: var(--pdv-gold);
  color: var(--pdv-gold); font-weight: 600;
}
.pdv-pag-detalhe { margin-top: 10px; }
.pdv-pag-detalhe label { font-size: 11px; color: var(--pdv-text-3); display: block; margin-bottom: 6px; }
.pdv-pag-input {
  width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--pdv-border);
  border-radius: 8px; padding: 8px 12px; color: var(--pdv-text); font-size: 14px; outline: none;
  transition: border-color .2s;
}
.pdv-pag-input:focus { border-color: var(--pdv-gold); }
.pdv-troco { margin-top: 6px; font-size: 13px; color: var(--pdv-text-2); }
.pdv-troco strong { color: var(--pdv-success); }
.pdv-parcelas-grid { display: flex; gap: 6px; flex-wrap: wrap; }
.pdv-parcela-btn {
  padding: 5px 12px; border-radius: 6px; border: 1px solid var(--pdv-border);
  background: rgba(255,255,255,0.03); color: var(--pdv-text-2);
  font-size: 12px; cursor: pointer; transition: all .15s;
}
.pdv-parcela-btn.active { background: var(--pdv-gold-dim); border-color: var(--pdv-gold); color: var(--pdv-gold); }
.pdv-taxa-badge {
  margin-top: 8px; padding: 7px 11px; border-radius: 7px;
  background: rgba(224,85,85,0.08); border: 1px solid rgba(224,85,85,0.2);
  color: var(--pdv-error); font-size: 11.5px; font-weight: 500;
}
.pdv-btn-cupom {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; border: 1px solid rgba(200,165,94,0.35);
  color: var(--pdv-gold); border-radius: 8px; padding: 10px;
  font-size: 13px; cursor: pointer; transition: all .15s;
  font-family: 'DM Sans', sans-serif;
}
.pdv-btn-cupom:hover { background: var(--pdv-gold-dim); border-color: var(--pdv-gold); }

/* ── COL DIREITA ── */
.pdv-col-right {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden;
}
.pdv-carrinho-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--pdv-border);
  font-size: 13px; font-weight: 600; color: var(--pdv-text);
  background: var(--pdv-surface);
}
.pdv-carrinho-count {
  margin-left: auto; font-size: 11px; color: var(--pdv-text-3); font-weight: 400;
}
.pdv-carrinho-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.pdv-carrinho-vazio {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 200px; color: var(--pdv-text-3);
}
.pdv-carrinho-vazio svg { opacity: .3; }
.pdv-carrinho-vazio p { font-size: 15px; font-weight: 500; margin: 0; }
.pdv-carrinho-vazio span { font-size: 12px; }

.pdv-carrinho-thead {
  display: grid; grid-template-columns: 1fr 100px 90px 90px 32px;
  padding: 4px 20px 8px;
  font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--pdv-text-3); border-bottom: 1px solid var(--pdv-border);
}
.pdv-carrinho-row {
  display: grid; grid-template-columns: 1fr 100px 90px 90px 32px;
  padding: 10px 20px; align-items: center;
  border-bottom: 1px solid var(--pdv-border);
  transition: background .15s;
}
.pdv-carrinho-row:hover { background: rgba(255,255,255,0.02); }
.pdv-item-nome { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pdv-item-nome span:first-child { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pdv-item-barcode { font-size: 10px; color: var(--pdv-text-3); font-family: monospace; }
.pdv-item-qty {
  display: flex; align-items: center; gap: 4px;
}
.pdv-item-qty button {
  background: rgba(255,255,255,0.08);
  border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 6px; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.pdv-item-qty button:hover { background: var(--pdv-gold-dim); border-color: var(--pdv-gold); }
.pdv-item-qty button svg { stroke: #b0b2c8; }
.pdv-item-qty button:hover svg { stroke: var(--pdv-gold); }
.pdv-qty-input {
  width: 52px; background: rgba(255,255,255,0.06);
  border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 6px; padding: 3px 6px;
  font-size: 13px; font-weight: 600; color: var(--pdv-text);
  text-align: center; outline: none;
  -moz-appearance: textfield;
  transition: border-color .15s;
}
.pdv-qty-input::-webkit-outer-spin-button,
.pdv-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.pdv-qty-input:focus { border-color: var(--pdv-gold); background: rgba(200,165,94,0.08); }
.pdv-item-unit { font-size: 12px; color: var(--pdv-text-3); }
.pdv-item-sub  { font-size: 13px; font-weight: 600; color: var(--pdv-text); }
.pdv-item-del {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border: 1px solid var(--pdv-border);
  background: rgba(255,255,255,0.06); color: var(--pdv-text-2);
  transition: all .13s; padding: 0;
}
.pdv-item-del:hover { background: rgba(224,82,82,0.12); border-color: rgba(224,82,82,0.3); color: var(--pdv-error); }

/* Total */
.pdv-total-section {
  border-top: 1px solid var(--pdv-border);
  padding: 14px 20px;
  background: var(--pdv-surface);
  display: flex; flex-direction: column; gap: 6px;
}
.pdv-total-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--pdv-text-2);
}
.pdv-total-grande {
  font-size: 22px; font-weight: 700; color: var(--pdv-text);
  margin-top: 4px;
}
.pdv-total-grande span:last-child { color: var(--pdv-gold); }
.pdv-troco-row { color: var(--pdv-success); font-weight: 600; }

/* Botões finais */
.pdv-btn-finalizar {
  margin: 12px 16px 4px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: linear-gradient(135deg, #d4b06a 0%, #c8a55e 60%, #b8943e 100%);
  color: #0a0a0a;
  border: none; border-radius: 50px; padding: 15px 20px;
  font-size: 15px; font-weight: 900; cursor: pointer;
  letter-spacing: .04em; text-transform: uppercase;
  transition: all .2s;
  box-shadow: 0 4px 20px rgba(200,165,94,0.35), 0 1px 0 rgba(255,255,255,0.15) inset;
}
.pdv-btn-finalizar:hover:not(:disabled) {
  box-shadow: 0 6px 28px rgba(200,165,94,0.55), 0 1px 0 rgba(255,255,255,0.15) inset;
  transform: translateY(-2px);
}
.pdv-btn-finalizar:active:not(:disabled) { transform: translateY(0); }
.pdv-btn-finalizar:disabled { opacity: .38; cursor: not-allowed; transform: none; box-shadow: none; }
.pdv-btn-cancelar {
  margin: 0 16px 16px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; border: 1px solid var(--pdv-border);
  color: var(--pdv-text-3); border-radius: 8px; padding: 9px;
  font-size: 13px; cursor: pointer; transition: all .15s;
}
.pdv-btn-cancelar:hover { border-color: var(--pdv-error); color: var(--pdv-error); }

/* ── SUCCESS SCREEN ── */
.pdv-success-screen {
  flex: 1; display: flex; align-items: center; justify-content: center;
}
.pdv-success-card {
  background: var(--pdv-surface); border: 1px solid var(--pdv-border);
  border-radius: 16px; padding: 48px 56px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.pdv-success-icon { color: var(--pdv-success); margin-bottom: 8px; }
.pdv-success-card h2 { font-size: 24px; color: var(--pdv-text); margin: 0; }
.pdv-success-id { font-size: 14px; color: var(--pdv-text-3); margin: 0; font-family: monospace; }
.pdv-success-total { font-size: 40px; font-weight: 700; color: var(--pdv-gold); margin: 8px 0; }
.pdv-success-troco {
  background: rgba(76,175,106,0.1); border: 1px solid rgba(76,175,106,0.25);
  color: var(--pdv-success); border-radius: 8px; padding: 8px 20px; font-size: 14px;
}
.pdv-success-troco strong { font-weight: 700; }
.pdv-success-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 16px; }
.pdv-btn-nova {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--pdv-gold); color: #0f1117;
  border: none; border-radius: 10px; padding: 13px 32px;
  font-size: 15px; font-weight: 700; cursor: pointer; transition: all .2s;
}
.pdv-btn-nova:hover { filter: brightness(1.1); }
.pdv-btn-voltar-ghost {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; border: 1px solid var(--pdv-border);
  color: var(--pdv-text-3); border-radius: 8px; padding: 10px;
  font-size: 13px; cursor: pointer; transition: all .15s;
}
.pdv-btn-voltar-ghost:hover { border-color: var(--pdv-text-2); color: var(--pdv-text); }

/* Scrollbar */
.pdv-col-left::-webkit-scrollbar,
.pdv-carrinho-body::-webkit-scrollbar { width: 4px; }
.pdv-col-left::-webkit-scrollbar-track,
.pdv-carrinho-body::-webkit-scrollbar-track { background: transparent; }
.pdv-col-left::-webkit-scrollbar-thumb,
.pdv-carrinho-body::-webkit-scrollbar-thumb { background: var(--pdv-border); border-radius: 2px; }

/* ── MODAL CUPOM ── */
.cupom-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .15s ease;
}
.cupom-modal {
  background: #16181f; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px; width: 400px; max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7);
  animation: slideUp .18s ease; overflow: hidden;
}
.cupom-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
  font-size: 13px; font-weight: 600; color: #e8e8f0; flex-shrink: 0;
}
.cupom-close {
  background: none; border: none; cursor: pointer; color: #5c5e72;
  display: flex; align-items: center; padding: 2px; border-radius: 5px;
  transition: color .13s;
}
.cupom-close:hover { color: #e05555; }
.cupom-paper {
  background: #fafaf8; color: #111;
  font-family: 'Courier New', monospace; font-size: 11.5px;
  padding: 16px 14px; overflow-y: auto; flex: 1; line-height: 1.5;
}
.cupom-paper::-webkit-scrollbar { width: 3px; }
.cupom-paper::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
.cupom-empresa { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 2px; }
.cupom-sub { font-size: 10px; color: #666; text-align: center; }
/* ═══════════════════════════════════
   ÚLTIMO PRODUTO ADICIONADO — card vertical
   ═══════════════════════════════════ */
.pdv-ultimo-produto {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 100%;
  height: 260px;
  display: flex;
  align-items: flex-end;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: #0d0e14;
}
.pdv-ultimo-produto-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(22px) brightness(0.45) saturate(1.3);
  transform: scale(1.12);
  transition: background-image .35s ease;
}
.pdv-ultimo-produto-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10,10,18,0.05) 0%,
    rgba(10,10,18,0.4) 45%,
    rgba(10,10,18,0.95) 100%
  );
}
.pdv-ultimo-produto-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 14px;
  width: 100%;
  animation: pdvUltimoIn .25s ease;
}
.pdv-ultimo-produto-foto {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.18);
  box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.1) inset;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pdv-ultimo-produto-foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pdv-ultimo-produto-foto-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255,255,255,0.2);
}
.pdv-ultimo-produto-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}
.pdv-ultimo-produto-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--pdv-gold, #c8a55e);
  opacity: 0.75;
}
.pdv-ultimo-produto-nome {
  font-size: 15px;
  font-weight: 700;
  color: #f0f0fa;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-shadow: 0 1px 8px rgba(0,0,0,0.8);
}
.pdv-ultimo-produto-preco {
  font-size: 16px;
  font-weight: 800;
  color: var(--pdv-gold, #c8a55e);
  letter-spacing: -.01em;
  text-shadow: 0 1px 10px rgba(0,0,0,0.8);
}
.pdv-ultimo-produto-qty {
  position: absolute;
  top: 10px;
  right: 12px;
  background: var(--pdv-gold, #c8a55e);
  color: #0a0a0a;
  font-size: 10px;
  font-weight: 800;
  border-radius: 20px;
  padding: 2px 8px;
  letter-spacing: .03em;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  z-index: 3;
}
@keyframes pdvUltimoIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cupom-meta { font-size: 10px; color: #777; text-align: center; }
.cupom-divider { border: none; border-top: 1px dashed #bbb; margin: 7px 0; }
.cupom-item { display: flex; align-items: baseline; gap: 4px; padding: 2px 0; border-bottom: 1px dotted #ddd; }
.cupom-item-nome { flex: 1; color: #222; font-size: 11px; }
.cupom-item-qty  { color: #888; flex-shrink: 0; font-size: 10px; }
.cupom-item-val  { flex-shrink: 0; text-align: right; font-weight: 600; font-size: 11px; min-width: 64px; }
.cupom-total-row { display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0; color: #333; }
.cupom-rodape { text-align: center; font-size: 10px; color: #888; margin-top: 4px; }
.cupom-modal-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
}
.cupom-btn-imprimir {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  background: var(--pdv-gold, #c8a55e); color: #0a0808;
  border: none; border-radius: 8px; padding: 9px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  font-family: 'DM Sans', sans-serif; transition: opacity .15s;
}
.cupom-btn-imprimir:hover { opacity: .88; }
.cupom-btn-fechar {
  padding: 9px 16px; border-radius: 8px;
  background: transparent; border: 1px solid rgba(255,255,255,0.1);
  color: #9193a5; font-size: 13px; cursor: pointer;
  font-family: 'DM Sans', sans-serif; transition: all .13s;
}
.cupom-btn-fechar:hover { background: rgba(255,255,255,0.05); color: #e8e8f0; }
@keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }

/* ═══════════════════════════════════
   MOBILE TAB NAV (sempre renderizado, visível só em mobile)
   ═══════════════════════════════════ */
.pdv-mobile-tabs {
  display: none;
}

/* ═══════════════════════════════════
   RESPONSIVIDADE MOBILE (≤ 700px)
   ═══════════════════════════════════ */
@media (max-width: 700px) {

  /* ── Header compacto ── */
  .pdv-root {
    --pdv-header-h: 112px;
  }
  .pdv-header {
    flex-wrap: wrap;
    height: auto;
    padding: 10px 14px;
    gap: 8px;
    row-gap: 8px;
  }
  .pdv-header-brand {
    min-width: unset;
    flex: 1;
  }
  .pdv-header-right {
    min-width: unset;
    gap: 8px;
  }
  .pdv-operador-label { display: none; }
  .pdv-operador-nome  { font-size: 12px; }
  .pdv-header-center {
    order: 3;
    flex: 0 0 100%;
  }
  .pdv-barcode-wrapper {
    max-width: 100%;
    margin: 0;
  }

  /* ── Tab nav ── */
  .pdv-mobile-tabs {
    display: flex;
    background: var(--pdv-surface);
    border-bottom: 1px solid var(--pdv-border);
    position: sticky;
    top: var(--pdv-header-h);
    z-index: 9;
    flex-shrink: 0;
  }
  .pdv-mobile-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 8px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--pdv-text-3);
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: color .15s, border-color .15s;
    position: relative;
  }
  .pdv-mobile-tab.active {
    color: var(--pdv-gold);
    border-bottom-color: var(--pdv-gold);
  }
  .pdv-mobile-tab-badge {
    background: var(--pdv-gold);
    color: #0a0a0a;
    font-size: 10px;
    font-weight: 800;
    border-radius: 50px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
    line-height: 16px;
  }

  /* ── Body: empilhado, scroll vertical ── */
  .pdv-body {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: unset;
    flex: 1;
  }

  /* ── Colunas: full width, sem border lateral ── */
  .pdv-col-left {
    width: 100%;
    border-right: none;
    border-bottom: none;
    flex-shrink: unset;
    overflow-y: unset;
  }
  .pdv-col-right {
    flex: unset;
    overflow: unset;
    width: 100%;
  }

  /* ── Ocultar coluna inativa no mobile ── */
  .pdv-hidden-mobile {
    display: none !important;
  }

  /* ── Carrinho: linha simplificada sem colunas fixas ── */
  .pdv-carrinho-thead {
    display: none;
  }
  .pdv-carrinho-row {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 6px 0;
    padding: 10px 14px;
  }
  .pdv-item-nome {
    grid-column: 1;
    grid-row: 1;
  }
  .pdv-item-sub {
    grid-column: 2;
    grid-row: 1;
    font-size: 14px;
    font-weight: 700;
    color: var(--pdv-gold);
    text-align: right;
    align-self: center;
  }
  .pdv-item-qty {
    grid-column: 1;
    grid-row: 2;
  }
  .pdv-item-unit {
    grid-column: 2;
    grid-row: 2;
    font-size: 11px;
    color: var(--pdv-text-3);
    text-align: right;
    align-self: center;
  }
  .pdv-item-del {
    position: absolute;
    right: 14px;
    top: 10px;
  }
  .pdv-carrinho-row { position: relative; }

  /* ── Botões de qty maiores para touch ── */
  .pdv-item-qty span[role="button"] {
    width: 30px !important;
    height: 30px !important;
    font-size: 18px !important;
  }
  .pdv-qty-input {
    width: 44px !important;
    font-size: 15px !important;
  }

  /* ── Total section compacta ── */
  .pdv-total-section {
    padding: 12px 14px;
  }
  .pdv-total-grande {
    font-size: 20px;
  }

  /* ── Botão finalizar full-width e mais alto ── */
  .pdv-btn-finalizar,
  span.pdv-btn-finalizar-inline {
    margin: 10px 14px 4px !important;
    width: calc(100% - 28px) !important;
    padding: 16px 14px !important;
    font-size: 14px !important;
  }
  .pdv-btn-cancelar {
    margin: 0 14px 14px !important;
  }

  /* ── Success card ── */
  .pdv-success-card {
    padding: 32px 24px;
    margin: 16px;
  }
  .pdv-success-total {
    font-size: 32px;
  }
}

/* ── LISTA PAGAMENTOS DIVIDIDOS ── */
.pdv-pag-lista {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;
}
.pdv-pag-item {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 8px 10px;
}
.pdv-pag-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.pdv-pag-item-label { font-size: 12px; font-weight: 600; color: var(--pdv-text); }
.pdv-pag-item-taxa  { font-size: 10px; color: var(--pdv-text-3); }
.pdv-pag-item-valor { font-size: 13px; font-weight: 700; color: var(--pdv-gold); flex-shrink: 0; }

/* ── Print — Recibo ── */
@media print {
  body { visibility: hidden !important; }
  #recibo-print-root {
    visibility: visible !important; display: block !important;
    position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
  }
  #recibo-print-root * { visibility: visible !important; }
  .recibo-print {
    font-family: 'Courier New', monospace;
    width: 80mm; margin: 0 auto; padding: 8mm;
    font-size: 12px; color: #000 !important; background: #fff;
  }
  .recibo-print * { color: #000 !important; }
}
#recibo-print-root { display: none; }
`;
