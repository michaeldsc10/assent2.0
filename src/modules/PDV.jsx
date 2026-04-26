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
} from "lucide-react";

import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  collection, query, where, getDocs, runTransaction,
  doc, orderBy, limit, getDoc,
} from "firebase/firestore";
import BarcodeInput from "../components/BarcodeInput";
import { useConfiguracoes } from "./Configuracoes";

/* ─── Formata moeda BRL ─── */
const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ─── Formata número decimal BR ─── */
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
    const win = window.open("", "cupom_pdv", "width=360,height=640,toolbar=0,menubar=0,scrollbars=1");
    if (!win) return;
    const linhaItens = (venda.itens || []).map(item =>
      `<div class="row"><span class="nome">${item.produto?.nome || item.nome || "—"}</span><span class="qtd">${item.qty}x</span><span class="val">${Number(item.subtotal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cupom</title>
<style>@page{size:80mm auto;margin:3mm 4mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;color:#111}.center{text-align:center}.empresa-nome{font-size:14px;font-weight:bold;margin-bottom:2px}.empresa-sub{font-size:10px;color:#555}.divider{border:none;border-top:1px dashed #999;margin:6px 0}.row{display:flex;gap:4px;padding:3px 0;border-bottom:1px dotted #ddd}.row .nome{flex:1}.row .qtd{color:#555;flex-shrink:0}.row .val{flex-shrink:0;text-align:right;font-weight:600}.total-row{display:flex;justify-content:space-between;padding:2px 0}.total-grande{font-size:14px;font-weight:bold;padding:4px 0}.rodape{font-size:9px;color:#777;text-align:center;margin-top:4px}</style>
</head><body>
<div class="center"><div class="empresa-nome">${empresa.nome||"ASSENT"}</div>${empresa.endereco?`<div class="empresa-sub">${empresa.endereco}</div>`:""}</div>
<hr class="divider"><div class="center" style="font-size:10px;color:#777">#${venda.id} · ${dataHora}</div><hr class="divider">
${linhaItens}<hr class="divider">
<div class="total-row"><span>Subtotal</span><span>${Number(venda.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>
<div class="total-row total-grande"><span>TOTAL</span><span>${Number(venda.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>
${troco!=null?`<div class="total-row"><span>Troco</span><span>${Number(troco).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>`:""}
<hr class="divider">
<div class="total-row"><span>Pagamento</span><span>${FORMA_LABEL_CUPOM[venda.formaPag]||"—"}</span></div>
${venda.cliente?`<div class="total-row"><span>Cliente</span><span>${venda.cliente}</span></div>`:""}
<hr class="divider"><div class="rodape">Obrigado pela preferência!</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
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
          <div className="cupom-empresa">{empresa.nome}</div>
          {empresa.endereco && <div className="cupom-sub">{empresa.endereco}</div>}
          <div className="cupom-divider" />
          <div className="cupom-meta">#{venda.id} · {dataHora}</div>
          <div className="cupom-divider" />
          {(venda.itens || []).map((item, i) => (
            <div key={i} className="cupom-item">
              <span className="cupom-item-nome">{item.produto?.nome || item.nome || "—"}</span>
              <span className="cupom-item-qty">{item.qty}x</span>
              <span className="cupom-item-val">{Number(item.subtotal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
            </div>
          ))}
          <div className="cupom-divider" />
          <div className="cupom-total-row"><span>Total</span><span style={{fontWeight:700}}>{Number(venda.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>
          {troco != null && <div className="cupom-total-row"><span>Troco</span><span style={{color:"#1a7a3c",fontWeight:600}}>{Number(troco).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>}
          <div className="cupom-total-row"><span>Pagamento</span><span>{FORMA_LABEL_CUPOM[venda.formaPag]||"—"}</span></div>
          {venda.cliente && <div className="cupom-total-row"><span>Cliente</span><span>{venda.cliente}</span></div>}
          <div className="cupom-divider" />
          <div className="cupom-rodape">Obrigado pela preferência!</div>
        </div>
        <div className="cupom-modal-footer">
          <button className="cupom-btn-imprimir" onClick={imprimir}><Printer size={14}/> Imprimir</button>
          <button className="cupom-btn-fechar" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════ */
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

  /* ── UI states ── */
  const [finalizando, setFinalizando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(null);
  const [showCupom, setShowCupom] = useState(false);
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState(null);
  const [nomeOperador, setNomeOperador] = useState("");

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
        const prod = { id: snap.docs[0].id, ...snap.docs[0].data() };
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
          .map((d) => ({ id: d.id, ...d.data() }))
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
      const novaQty = Math.max(0.001, +(novo[idx].qty + delta).toFixed(3));
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
    setFormaPag("dinheiro");
    setParcelas(1);
    setValorRecebido("");
    setErro("");
    setVendaFinalizada(null);
  };

  /* ══════════════════════════════════
     FINALIZAR VENDA
     ══════════════════════════════════ */
  const finalizarVenda = async () => {
    if (!tenantUid) return;
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um produto ao carrinho.");
      return;
    }
    setFinalizando(true);
    setErro("");

    try {
      const counterRef = doc(db, "users", tenantUid, "config", "contadores");

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const nextNum = (counterSnap.exists() ? counterSnap.data().vendas ?? 0 : 0) + 1;
        const vendaId = `PDV-${String(nextNum).padStart(5, "0")}`;

        const vendaRef = doc(collection(db, "users", tenantUid, "vendas"));

        const itens = carrinho.map((item) => ({
          produtoId: item.produto.id,
          nome: item.produto.nome,
          codigoBarras: item.produto.codigoBarras || "",
          qty: item.qty,
          precoUnit: item.precoUnit,
          subtotal: item.subtotal,
        }));

        const vendaDoc = {
          idVenda:        vendaId,
          itens,
          total,
          pagamentos:     pagamentos,
          // compatibilidade com relatórios (1ª forma de pagamento)
          formaPagamento: pagamentos[0]?.label || "—",
          taxaPct:        0,
          valorTaxa:      0,
          totalLiquido:   total,
          data:           new Date().toISOString().slice(0, 10),
          cliente:        cliente?.nome || null,
          clienteId:      cliente?.id  || null,
          status:         "ativa",
          origem:         "pdv",
          vendedorId:     vendedorId   || null,
          vendedorNome:   nomeOperador || null,
          criadoEm:       new Date(),
        };

        transaction.set(vendaRef, vendaDoc);
        transaction.set(counterRef, { vendas: nextNum }, { merge: true });

        setVendaFinalizada({ id: vendaId, total, pagamentos, itens: carrinho, cliente: cliente?.nome || null });
      });
    } catch (e) {
      console.error(e);
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
            empresa={{ nome: nomeEmpresa, logo: logoEmpresa, endereco: empresa.endereco, telefone: empresa.telefone }}
            onClose={() => setShowCupom(false)}
          />
        )}
      </>
    );
  }

  /* ══════════════════════════════════
     RENDER PRINCIPAL
     ══════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>
      {showPagModal && (
        <ModalPagamento
          restante={restante}
          taxas={taxas}
          onConfirm={(p) => { setPagamentos(ps => [...ps, p]); setShowPagModal(false); }}
          onClose={() => setShowPagModal(false)}
        />
      )}
      <div className="pdv-root">
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

        {/* ── BODY ── */}
        <div className="pdv-body">
          {/* ─── COLUNA ESQUERDA: busca + produto ─── */}
          <section className="pdv-col-left">
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
              )}
            </div>
          </section>

          {/* ─── COLUNA DIREITA: carrinho ─── */}
          <section className="pdv-col-right">
            <div className="pdv-carrinho-header">
              <ShoppingCart size={16} />
              <span>Cupom Fiscal</span>
              <span className="pdv-carrinho-count">{carrinho.length} iten{carrinho.length !== 1 ? "s" : ""}</span>
            </div>

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
                        <Trash2 size={13} />
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
              <button className="pdv-btn-cancelar" onClick={limparVenda}>
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
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  background: var(--pdv-bg);
  color: var(--pdv-text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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
  top: 0;
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
  height: calc(100vh - var(--pdv-header-h));
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
  background: none; border: none; cursor: pointer; color: var(--pdv-text-3);
  display: flex; align-items: center; justify-content: center;
  border-radius: 5px; width: 26px; height: 26px; transition: all .15s;
}
.pdv-item-del:hover { background: rgba(224,85,85,0.1); color: var(--pdv-error); }

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
  border-radius: 14px; width: 320px; max-height: 88vh;
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
`;
