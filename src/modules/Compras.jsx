/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Compras.jsx
   Módulo: Gestão de Compras / Insumos / Estoque
   Coleções: compras | insumos | movimentacoes | a_receber
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart, Package, BarChart2, Plus, Edit2, Trash2, X,
  Eye, ChevronDown, AlertTriangle, CheckCircle, Clock, XCircle,
  Search, Filter, ArrowDown, ArrowUp, Layers,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, onSnapshot, writeBatch, updateDoc, deleteDoc,
} from "firebase/firestore";

import { useLicenca }            from "../hooks/useLicenca";   // ajuste o path se necessário
import { BannerLimite }          from "./LicencaUI";           // ajuste o path se necessário
import { useComprasData }        from "../hooks/useComprasData";

/* ═══════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════ */
const LIMITE_FREE_INSUMOS = 10;

const UNIDADES = ["kg", "g", "L", "ml", "un", "cx", "m", "cm", "pç", "sc", "fd"];

const METODOS_PAG = [
  { value: "dinheiro",     label: "Dinheiro" },
  { value: "pix",          label: "PIX" },
  { value: "boleto",       label: "Boleto" },
  { value: "cartao",       label: "Cartão" },
  { value: "transferencia",label: "Transferência" },
];

const MOTIVOS_SAIDA = [
  { value: "uso_interno", label: "Uso Interno" },
  { value: "ajuste",      label: "Ajuste de Estoque" },
  { value: "perda",       label: "Perda / Vencimento" },
  { value: "devolucao",   label: "Devolução ao Fornecedor" },
];

const STATUS_COMPRA = [
  { value: "pago",      label: "Pago" },
  { value: "pendente",  label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
];

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const str = typeof d === "string" ? d : d.toDate?.().toISOString().slice(0,10) || String(d);
    const [ano, mes, dia] = str.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  } catch { return String(d); }
};

const hojeISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
};

/** Adiciona N meses a uma data YYYY-MM-DD, respeitando fim de mês */
const addMeses = (dateISO, meses) => {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const parseBRL = (s) => parseFloat(String(s).replace(",", ".")) || 0;

/* ═══════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════ */
const CSS = `
  /* ── Tabs ── */
  .cp-tabs { display:flex; gap:4px; padding:14px 22px 0; background:var(--s1); border-bottom:1px solid var(--border); }
  .cp-tab {
    display:flex; align-items:center; gap:7px;
    padding:9px 18px; border-radius:8px 8px 0 0; cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500;
    color:var(--text-3); background:transparent; border:1px solid transparent;
    border-bottom:none; transition:all .15s; margin-bottom:-1px;
  }
  .cp-tab:hover { color:var(--text-2); background:var(--s2); }
  .cp-tab.active { color:var(--gold); background:var(--s2); border-color:var(--border); border-bottom-color:var(--s2); }
  .cp-tab-badge {
    font-size:10px; background:var(--s3); color:var(--text-3);
    padding:1px 7px; border-radius:20px; font-weight:600;
  }
  .cp-tab.active .cp-tab-badge { background:rgba(200,165,94,0.15); color:var(--gold); }

  /* ── Topbar ── */
  .cp-topbar {
    padding:12px 22px; background:var(--s1); border-bottom:1px solid var(--border);
    display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex-shrink:0;
  }
  .cp-topbar-title h2 { font-family:'Sora',sans-serif; font-size:15px; font-weight:600; color:var(--text); }
  .cp-topbar-title p  { font-size:11px; color:var(--text-2); margin-top:2px; }

  .cp-search {
    display:flex; align-items:center; gap:8px;
    background:var(--s2); border:1px solid var(--border);
    border-radius:8px; padding:7px 12px; width:220px;
  }
  .cp-search input {
    background:transparent; border:none; outline:none;
    color:var(--text); font-size:12px; width:100%;
    font-family:'DM Sans',sans-serif;
  }
  .cp-filter-group { display:flex; align-items:center; gap:6px; }
  .cp-filter-btn {
    padding:5px 11px; border-radius:6px; font-size:11px; font-weight:500;
    background:var(--s3); border:1px solid var(--border);
    color:var(--text-2); cursor:pointer; transition:all .13s;
    font-family:'DM Sans',sans-serif;
  }
  .cp-filter-btn:hover  { background:var(--s2); color:var(--text); }
  .cp-filter-btn.active { background:rgba(200,165,94,0.15); border-color:var(--gold); color:var(--gold); }

  .cp-btn-new {
    display:flex; align-items:center; gap:7px;
    padding:8px 16px; border-radius:9px;
    background:var(--gold); color:#0a0808;
    border:none; cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
    white-space:nowrap; transition:opacity .13s, transform .1s; margin-left:auto;
  }
  .cp-btn-new:hover  { opacity:.88; }
  .cp-btn-new:active { transform:scale(.97); }

  /* ── Tabela genérica ── */
  .cp-table-wrap {
    background:var(--s1); border:1px solid var(--border);
    border-radius:12px; overflow:hidden; margin-bottom:20px;
  }
  .cp-table-hdr {
    padding:12px 18px; border-bottom:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between;
  }
  .cp-table-hdr-title {
    font-family:'Sora',sans-serif; font-size:13px;
    font-weight:600; color:var(--text);
  }
  .cp-count-badge {
    font-size:11px; font-weight:600; font-family:'Sora',sans-serif;
    background:var(--s3); border:1px solid var(--border-h);
    color:var(--text-2); padding:2px 10px; border-radius:20px;
  }

  /* Compras table */
  .cp-row-compra {
    display:grid;
    grid-template-columns:100px 160px 1fr 120px 110px 100px 90px;
    padding:10px 18px; gap:8px; border-bottom:1px solid var(--border);
    align-items:center; font-size:12px; color:var(--text-2);
  }
  .cp-row-compra:last-child { border-bottom:none; }
  .cp-row-compra:not(.cp-row-head):hover { background:rgba(255,255,255,.02); }
  .cp-row-head { background:var(--s2); }
  .cp-row-head span { font-size:10px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--text-3); }

  /* Insumos table */
  .cp-row-insumo {
    display:grid;
    grid-template-columns:1fr 80px 120px 100px 80px 90px;
    padding:10px 18px; gap:8px; border-bottom:1px solid var(--border);
    align-items:center; font-size:12px; color:var(--text-2);
  }
  .cp-row-insumo:last-child { border-bottom:none; }
  .cp-row-insumo:not(.cp-row-head):hover { background:rgba(255,255,255,.02); }

  /* Movimentacoes table */
  .cp-row-mov {
    display:grid;
    grid-template-columns:90px 1fr 80px 70px 120px 120px;
    padding:10px 18px; gap:8px; border-bottom:1px solid var(--border);
    align-items:center; font-size:12px; color:var(--text-2);
  }
  .cp-row-mov:last-child { border-bottom:none; }
  .cp-row-mov:not(.cp-row-head):hover { background:rgba(255,255,255,.02); }

  .cp-empty, .cp-loading {
    padding:48px 20px; text-align:center; color:var(--text-3); font-size:13px;
  }

  /* ── Estoque cards ── */
  .cp-estoque-grid {
    display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-bottom:20px;
  }
  .cp-estoque-card {
    background:var(--s1); border:1px solid var(--border);
    border-radius:12px; padding:16px 18px;
    transition:border-color .15s;
  }
  .cp-estoque-card.alerta { border-color:rgba(224,82,82,.4); }
  .cp-estoque-card.ok     { border-color:rgba(72,199,142,.25); }
  .cp-estoque-nome {
    font-family:'Sora',sans-serif; font-size:13px; font-weight:600;
    color:var(--text); margin-bottom:6px; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis;
  }
  .cp-estoque-val {
    font-family:'Sora',sans-serif; font-size:22px; font-weight:700;
    color:var(--text);
  }
  .cp-estoque-val.alerta { color:var(--red); }
  .cp-estoque-val.ok     { color:var(--green); }
  .cp-estoque-unid { font-size:12px; color:var(--text-3); margin-left:4px; }
  .cp-estoque-min  { font-size:11px; color:var(--text-3); margin-top:4px; }
  .cp-estoque-alert-tag {
    display:inline-flex; align-items:center; gap:4px;
    font-size:10px; font-weight:600; letter-spacing:.04em; text-transform:uppercase;
    background:var(--red-d); color:var(--red);
    border:1px solid rgba(224,82,82,.25); border-radius:20px;
    padding:2px 8px; margin-top:6px;
  }

  /* ── Modal ── */
  .modal-overlay {
    position:fixed; inset:0; z-index:1000;
    background:rgba(0,0,0,.78); backdrop-filter:blur(5px);
    display:flex; align-items:center; justify-content:center;
    padding:20px; animation:cpFadeIn .15s ease;
  }
  @keyframes cpFadeIn { from{opacity:0} to{opacity:1} }
  @keyframes cpSlideUp {
    from{opacity:0;transform:translateY(14px)}
    to  {opacity:1;transform:translateY(0)}
  }
  .modal-box {
    background:var(--s1); border:1px solid var(--border-h);
    border-radius:16px; width:100%; max-width:560px;
    max-height:92vh; overflow-y:auto;
    box-shadow:0 28px 72px rgba(0,0,0,.65);
    animation:cpSlideUp .18s ease;
  }
  .modal-box-lg  { max-width:720px; }
  .modal-box-sm  { max-width:400px; }
  .modal-box::-webkit-scrollbar { width:3px; }
  .modal-box::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }
  .modal-header {
    padding:18px 22px 14px; border-bottom:1px solid var(--border);
    display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
  }
  .modal-title  { font-family:'Sora',sans-serif; font-size:15px; font-weight:600; color:var(--text); }
  .modal-sub    { font-size:12px; color:var(--text-2); margin-top:3px; }
  .modal-close  {
    width:30px; height:30px; border-radius:8px; flex-shrink:0;
    background:var(--s3); border:1px solid var(--border);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; margin-top:2px; transition:background .13s;
  }
  .modal-close:hover { background:var(--s2); border-color:var(--border-h); }
  .modal-body   { padding:18px 22px; }
  .modal-footer {
    padding:13px 22px; border-top:1px solid var(--border);
    display:flex; justify-content:flex-end; gap:10px;
  }

  /* Form */
  .form-group   { margin-bottom:14px; }
  .form-label   {
    display:block; font-size:10px; font-weight:600;
    letter-spacing:.07em; text-transform:uppercase;
    color:var(--text-2); margin-bottom:6px;
  }
  .form-label-req { color:var(--gold); margin-left:2px; }
  .form-input {
    width:100%; background:var(--s2); border:1px solid var(--border);
    border-radius:9px; padding:9px 12px; color:var(--text); font-size:13px;
    font-family:'DM Sans',sans-serif; outline:none;
    transition:border-color .15s,box-shadow .15s; box-sizing:border-box;
  }
  .form-input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(200,165,94,.1); }
  .form-input.err   { border-color:var(--red); }
  .form-error { font-size:11px; color:var(--red); margin-top:4px; }
  .form-row   { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .form-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .form-textarea {
    width:100%; background:var(--s2); border:1px solid var(--border);
    border-radius:9px; padding:9px 12px; color:var(--text); font-size:13px;
    font-family:'DM Sans',sans-serif; outline:none;
    transition:border-color .15s,box-shadow .15s; resize:vertical; min-height:64px;
    box-sizing:border-box;
  }
  .form-textarea:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(200,165,94,.1); }

  .form-check-row {
    display:flex; align-items:center; gap:10px;
    padding:10px 14px; background:var(--s2); border:1px solid var(--border);
    border-radius:9px; cursor:pointer;
  }
  .form-check-row input[type=checkbox] { accent-color:var(--gold); width:15px; height:15px; cursor:pointer; }
  .form-check-label { font-size:13px; color:var(--text-2); cursor:pointer; }

  /* Buttons */
  .btn-primary {
    padding:9px 20px; border-radius:9px;
    background:var(--gold); color:#0a0808;
    border:none; cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
    transition:opacity .13s,transform .1s;
  }
  .btn-primary:hover    { opacity:.88; }
  .btn-primary:active   { transform:scale(.97); }
  .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
  .btn-secondary {
    padding:9px 20px; border-radius:9px;
    background:var(--s3); color:var(--text-2);
    border:1px solid var(--border); cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px;
    transition:background .13s,color .13s;
  }
  .btn-secondary:hover { background:var(--s2); color:var(--text); }
  .btn-danger {
    padding:9px 20px; border-radius:9px;
    background:var(--red-d); color:var(--red);
    border:1px solid rgba(224,82,82,.25); cursor:pointer;
    font-family:'DM Sans',sans-serif; font-size:13px;
    transition:background .13s;
  }
  .btn-danger:hover { background:rgba(224,82,82,.18); }
  .btn-icon {
    width:29px; height:29px; border-radius:7px;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; border:1px solid transparent;
    background:transparent; transition:all .13s; flex-shrink:0;
  }
  .btn-icon-edit { color:var(--blue); }
  .btn-icon-edit:hover { background:var(--blue-d); border-color:rgba(91,142,240,.2); }
  .btn-icon-del  { color:var(--red); }
  .btn-icon-del:hover  { background:var(--red-d); border-color:rgba(224,82,82,.2); }
  .btn-icon-view { color:var(--text-2); }
  .btn-icon-view:hover { background:var(--s3); border-color:var(--border); }
  .cp-row-actions { display:flex; align-items:center; gap:4px; justify-content:flex-end; }

  /* ── Itens da compra ── */
  .cp-itens-hdr {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:10px;
  }
  .cp-itens-label {
    font-size:10px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
    color:var(--text-2);
  }
  .cp-btn-add-item {
    display:flex; align-items:center; gap:5px;
    padding:5px 12px; border-radius:7px;
    background:var(--s3); border:1px solid var(--border);
    color:var(--text-2); cursor:pointer; font-size:11px; font-weight:500;
    font-family:'DM Sans',sans-serif; transition:all .13s;
  }
  .cp-btn-add-item:hover { background:var(--s2); color:var(--text); border-color:var(--border-h); }
  .cp-item-row {
    display:grid; grid-template-columns:1fr 70px 70px 90px 28px;
    gap:8px; align-items:start; margin-bottom:8px;
  }
  .cp-item-subtotal {
    font-family:'Sora',sans-serif; font-size:12px; font-weight:600;
    color:var(--gold); padding:9px 0 9px 4px; white-space:nowrap;
  }
  .cp-btn-rem-item {
    width:28px; height:36px; border-radius:7px; margin-top:0;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; background:var(--red-d);
    border:1px solid rgba(224,82,82,.25); color:var(--red);
    transition:background .13s; flex-shrink:0;
  }
  .cp-btn-rem-item:hover { background:rgba(224,82,82,.2); }
  .cp-total-row {
    display:flex; justify-content:flex-end; align-items:center;
    gap:10px; padding:10px 0 0; border-top:1px solid var(--border); margin-top:4px;
  }
  .cp-total-label { font-size:12px; color:var(--text-2); }
  .cp-total-val { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:var(--gold); }

  /* ── Status badges ── */
  .sb {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:20px;
    font-size:10px; font-weight:600; letter-spacing:.04em;
    text-transform:uppercase; white-space:nowrap;
  }
  .sb-pendente  { background:rgba(200,165,94,.12); border:1px solid rgba(200,165,94,.3); color:var(--gold); }
  .sb-pago      { background:rgba(72,199,142,.10); border:1px solid rgba(72,199,142,.25); color:var(--green); }
  .sb-cancelado { background:var(--s3); border:1px solid var(--border); color:var(--text-3); }
  .sb-entrada   { background:rgba(72,199,142,.10); border:1px solid rgba(72,199,142,.25); color:var(--green); }
  .sb-saida     { background:var(--red-d); border:1px solid rgba(224,82,82,.25); color:var(--red); }

  /* ── Modal detalhe compra ── */
  .cp-detalhe-section { margin-bottom:16px; }
  .cp-detalhe-title {
    font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.07em;
    color:var(--text-3); margin-bottom:8px;
  }
  .cp-detalhe-row {
    display:flex; justify-content:space-between; align-items:center;
    font-size:12px; color:var(--text-2); padding:5px 0;
    border-bottom:1px solid rgba(255,255,255,.04);
  }
  .cp-detalhe-row:last-child { border-bottom:none; }
  .cp-detalhe-row strong { color:var(--text); }
  .cp-itens-det-row {
    display:grid; grid-template-columns:1fr 60px 80px 80px;
    font-size:12px; color:var(--text-2); padding:7px 10px;
    background:var(--s2); border-radius:6px; margin-bottom:4px;
    gap:8px; align-items:center;
  }
  .cp-itens-det-head { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); }

  /* Toggle ativo */
  .cp-toggle {
    position:relative; width:36px; height:20px; cursor:pointer;
  }
  .cp-toggle input { opacity:0; width:0; height:0; }
  .cp-toggle-slider {
    position:absolute; inset:0; border-radius:20px;
    background:var(--s3); border:1px solid var(--border);
    transition:background .2s;
  }
  .cp-toggle-slider:before {
    content:""; position:absolute; width:14px; height:14px;
    border-radius:50%; background:var(--text-3);
    top:2px; left:2px; transition:transform .2s, background .2s;
  }
  .cp-toggle input:checked + .cp-toggle-slider { background:rgba(72,199,142,.2); border-color:rgba(72,199,142,.4); }
  .cp-toggle input:checked + .cp-toggle-slider:before { transform:translateX(16px); background:var(--green); }

  /* Confirm */
  .confirm-body { padding:26px 22px; text-align:center; font-size:13px; color:var(--text-2); line-height:1.6; }
  .confirm-icon { font-size:32px; margin-bottom:12px; }
  .confirm-body strong { color:var(--text); }

  /* Parcelamento info */
  .cp-parcel-info {
    background:rgba(200,165,94,.06); border:1px solid rgba(200,165,94,.2);
    border-radius:9px; padding:10px 14px; margin-top:10px;
    font-size:12px; color:var(--text-2);
  }
  .cp-parcel-info strong { color:var(--gold); }
`;

/* ═══════════════════════════════════════════════════
   COMPONENTES AUXILIARES
   ═══════════════════════════════════════════════════ */
function StatusBadgeCompra({ status }) {
  const cfg = {
    pago:      { cls:"sb-pago",      icon:<CheckCircle size={9}/>,   label:"Pago"      },
    pendente:  { cls:"sb-pendente",  icon:<Clock       size={9}/>,   label:"Pendente"  },
    cancelado: { cls:"sb-cancelado", icon:<XCircle     size={9}/>,   label:"Cancelado" },
  }[status] || { cls:"sb-pendente", icon:null, label: status };
  return <span className={`sb ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
}

function Toggle({ checked, onChange }) {
  return (
    <label className="cp-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cp-toggle-slider" />
    </label>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Nova / Editar Compra
   ═══════════════════════════════════════════════════ */
function ModalNovaCompra({ compra, fornecedores, insumos, uid, onClose, onSaved }) {
  const isEdit = !!compra;

  const [form, setForm] = useState({
    fornecedorId:    compra?.fornecedorId    || "",
    data:            compra?.data            || hojeISO(),
    status:          compra?.status          || "pago",
    metodoPagamento: compra?.metodoPagamento || "pix",
    parcelado:       compra?.parcelado       || false,
    numParcelas:     compra?.numParcelas     || 2,
    vencimento:      compra?.vencimento      || "",
    observacao:      compra?.observacao      || "",
  });

  const [itens, setItens] = useState(
    compra?.itens?.length > 0
      ? compra.itens.map(i => ({ ...i, insumoId: i.insumoId, quantidade: String(i.quantidade), valorUnitario: String(i.valorUnitario) }))
      : [{ insumoId: "", insumoNome: "", unidade: "", quantidade: "", valorUnitario: "" }]
  );

  const [erros,    setErros]    = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = useCallback((campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => ({ ...e, [campo]: "" }));
  }, []);

  const setItem = useCallback((idx, campo, valor) => {
    setItens(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      // Se mudou insumo, preenche nome e unidade
      if (campo === "insumoId") {
        const ins = insumos.find(i => i.id === valor);
        copia[idx].insumoNome = ins?.nome || "";
        copia[idx].unidade    = ins?.unidade || "";
      }
      return copia;
    });
  }, [insumos]);

  const addItem = () =>
    setItens(prev => [...prev, { insumoId:"", insumoNome:"", unidade:"", quantidade:"", valorUnitario:"" }]);

  const remItem = (idx) =>
    setItens(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const calcSubtotal = (item) => {
    const q = parseBRL(item.quantidade);
    const v = parseBRL(item.valorUnitario);
    return isNaN(q) || isNaN(v) ? 0 : q * v;
  };

  const valorTotal = itens.reduce((s, it) => s + calcSubtotal(it), 0);

  const precisaVencimento = form.status === "pendente" || form.parcelado;

  const validar = () => {
    const e = {};
    if (!form.fornecedorId)    e.fornecedorId = "Selecione o fornecedor.";
    if (!form.data)            e.data         = "Data é obrigatória.";
    if (!form.metodoPagamento) e.metodoPagamento = "Selecione o método.";
    if (precisaVencimento && !form.vencimento) e.vencimento = "Informe o vencimento.";
    if (form.parcelado && (isNaN(form.numParcelas) || form.numParcelas < 2))
      e.numParcelas = "Mínimo 2 parcelas.";

    itens.forEach((it, i) => {
      if (!it.insumoId)        e[`item_ins_${i}`] = "Selecione o insumo.";
      if (parseBRL(it.quantidade) <= 0) e[`item_qtd_${i}`] = "Qtd inválida.";
      if (parseBRL(it.valorUnitario) <= 0) e[`item_val_${i}`] = "Valor inválido.";
    });

    if (valorTotal <= 0) e.itens = "Adicione ao menos um item com valor.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);

    try {
      const forn      = fornecedores.find(f => f.id === form.fornecedorId);
      const now       = new Date().toISOString();
      const itensFinais = itens.map(it => ({
        insumoId:     it.insumoId,
        insumoNome:   it.insumoNome,
        quantidade:   parseBRL(it.quantidade),
        unidade:      it.unidade || "",
        valorUnitario: parseBRL(it.valorUnitario),
        subtotal:     calcSubtotal(it),
      }));

      const compraData = {
        fornecedorId:    form.fornecedorId,
        fornecedorNome:  forn?.nome || "",
        data:            form.data,
        itens:           itensFinais,
        valorTotal,
        status:          form.status,
        metodoPagamento: form.metodoPagamento,
        parcelado:       form.parcelado,
        numParcelas:     form.parcelado ? Number(form.numParcelas) : 1,
        vencimento:      precisaVencimento ? form.vencimento : null,
        observacao:      form.observacao.trim(),
        criadoEm:        isEdit ? (compra.criadoEm || now) : now,
        atualizadoEm:    now,
      };

      if (isEdit) {
        /* Edição: atualiza apenas a doc de compra (sem recriar movimentações) */
        await updateDoc(doc(collection(db, "users", uid, "compras"), compra.id), compraData);
      } else {
        /* Criação: writeBatch atômico */
        const batch = writeBatch(db);

        /* 1 — Compra */
        const compraRef = doc(collection(db, "users", uid, "compras"));
        const compraId  = compraRef.id;
        batch.set(compraRef, compraData);

        /* 2 — Movimentacoes (entrada por item) */
        itensFinais.forEach(it => {
          const movRef = doc(collection(db, "users", uid, "movimentacoes"));
          batch.set(movRef, {
            insumoId:     it.insumoId,
            insumoNome:   it.insumoNome,
            tipo:         "entrada",
            quantidade:   it.quantidade,
            unidade:      it.unidade,
            motivo:       "compra",
            compraId,
            fornecedorId: form.fornecedorId,
            valorUnitario: it.valorUnitario,
            data:         form.data,
            observacao:   form.observacao.trim(),
            criadoEm:     now,
          });
        });

        /* 3 — Lançamentos em a_receber (se pendente ou parcelado)
           Nota: registra como contas a PAGAR usando clienteNome = fornecedor.
           Integre com módulo A Pagar quando disponível. */
        if (form.status === "pendente" && !form.parcelado) {
          const arRef = doc(collection(db, "users", uid, "a_receber"));
          batch.set(arRef, {
            clienteNome:     forn?.nome || "Fornecedor",
            descricao:       `Compra — ${forn?.nome || "Fornecedor"}`,
            valorTotal,
            valorPago:       0,
            valorRestante:   valorTotal,
            dataVencimento:  form.vencimento,
            observacoes:     form.observacao.trim(),
            status:          "pendente",
            origem:          "compra",
            referenciaId:    compraId,
            dataCriacao:     now,
            dataAtualizacao: now,
          });
        } else if (form.parcelado && Number(form.numParcelas) >= 2) {
          const nParc      = Number(form.numParcelas);
          const vlParcela  = Number((valorTotal / nParc).toFixed(2));

          for (let i = 0; i < nParc; i++) {
            const arRef = doc(collection(db, "users", uid, "a_receber"));
            batch.set(arRef, {
              clienteNome:     forn?.nome || "Fornecedor",
              descricao:       `Compra ${forn?.nome || ""} — parcela ${i+1}/${nParc}`,
              valorTotal:      vlParcela,
              valorPago:       0,
              valorRestante:   vlParcela,
              dataVencimento:  addMeses(form.vencimento, i),
              observacoes:     form.observacao.trim(),
              status:          "pendente",
              origem:          "compra",
              referenciaId:    compraId,
              dataCriacao:     now,
              dataAtualizacao: now,
            });
          }
        }

        await batch.commit();
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("[Compras] Erro ao salvar compra:", err);
      alert("Erro ao salvar compra. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Compra" : "Nova Compra"}</div>
            <div className="modal-sub">Preencha os dados e os insumos recebidos</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>

        <div className="modal-body">
          {/* Fornecedor + Data */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fornecedor <span className="form-label-req">*</span></label>
              <select className={`form-input${erros.fornecedorId?" err":""}`}
                value={form.fornecedorId} onChange={e => set("fornecedorId", e.target.value)}>
                <option value="">Selecione...</option>
                {fornecedores.filter(f => f.status !== "inativo").map(f =>
                  <option key={f.id} value={f.id}>{f.nome}</option>
                )}
              </select>
              {erros.fornecedorId && <div className="form-error">{erros.fornecedorId}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Data da Compra <span className="form-label-req">*</span></label>
              <input type="date" className={`form-input${erros.data?" err":""}`}
                value={form.data} onChange={e => set("data", e.target.value)} />
              {erros.data && <div className="form-error">{erros.data}</div>}
            </div>
          </div>

          {/* Status + Método */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status do Pagamento <span className="form-label-req">*</span></label>
              <select className="form-input" value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUS_COMPRA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pagamento <span className="form-label-req">*</span></label>
              <select className={`form-input${erros.metodoPagamento?" err":""}`}
                value={form.metodoPagamento} onChange={e => set("metodoPagamento", e.target.value)}>
                {METODOS_PAG.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {erros.metodoPagamento && <div className="form-error">{erros.metodoPagamento}</div>}
            </div>
          </div>

          {/* Parcelamento (só se não for pago ou cancelado) */}
          {form.status === "pendente" && (
            <div className="form-group">
              <label className="form-check-row" style={{marginBottom:0}}>
                <input type="checkbox" checked={form.parcelado}
                  onChange={e => set("parcelado", e.target.checked)} />
                <span className="form-check-label">Compra parcelada</span>
              </label>
            </div>
          )}

          {/* Vencimento + Parcelas */}
          {precisaVencimento && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  {form.parcelado ? "Vencimento da 1ª parcela" : "Vencimento"}<span className="form-label-req"> *</span>
                </label>
                <input type="date" className={`form-input${erros.vencimento?" err":""}`}
                  value={form.vencimento} onChange={e => set("vencimento", e.target.value)} />
                {erros.vencimento && <div className="form-error">{erros.vencimento}</div>}
              </div>
              {form.parcelado && (
                <div className="form-group">
                  <label className="form-label">Nº de Parcelas <span className="form-label-req">*</span></label>
                  <input type="number" min="2" max="60" className={`form-input${erros.numParcelas?" err":""}`}
                    value={form.numParcelas}
                    onChange={e => { set("numParcelas", Number(e.target.value)); }} />
                  {erros.numParcelas && <div className="form-error">{erros.numParcelas}</div>}
                </div>
              )}
            </div>
          )}

          {/* Preview parcelamento */}
          {form.parcelado && form.vencimento && form.numParcelas >= 2 && valorTotal > 0 && (
            <div className="cp-parcel-info">
              <strong>{form.numParcelas}×</strong> de{" "}
              <strong>{fmtR$(valorTotal / form.numParcelas)}</strong>
              {" "}— 1ª em {fmtData(form.vencimento)}, última em {fmtData(addMeses(form.vencimento, form.numParcelas - 1))}
            </div>
          )}

          {/* Itens */}
          <div style={{marginTop:16}}>
            <div className="cp-itens-hdr">
              <span className="cp-itens-label">Insumos Recebidos <span style={{color:"var(--gold)"}}>*</span></span>
              <button className="cp-btn-add-item" onClick={addItem}>
                <Plus size={11}/> Adicionar Item
              </button>
            </div>
            {erros.itens && <div className="form-error" style={{marginBottom:8}}>{erros.itens}</div>}

            {itens.map((it, idx) => (
              <div key={idx} className="cp-item-row">
                {/* Insumo */}
                <div>
                  <select className={`form-input${erros[`item_ins_${idx}`]?" err":""}`}
                    value={it.insumoId} onChange={e => setItem(idx, "insumoId", e.target.value)}>
                    <option value="">Insumo...</option>
                    {insumos.filter(i => i.ativo !== false).map(i =>
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                    )}
                  </select>
                  {erros[`item_ins_${idx}`] && <div className="form-error">{erros[`item_ins_${idx}`]}</div>}
                </div>
                {/* Quantidade */}
                <div>
                  <input className={`form-input${erros[`item_qtd_${idx}`]?" err":""}`}
                    placeholder="Qtd" inputMode="decimal" value={it.quantidade}
                    onChange={e => setItem(idx, "quantidade", e.target.value)} />
                </div>
                {/* Valor Unit. */}
                <div>
                  <input className={`form-input${erros[`item_val_${idx}`]?" err":""}`}
                    placeholder="R$ unit." inputMode="decimal" value={it.valorUnitario}
                    onChange={e => setItem(idx, "valorUnitario", e.target.value)} />
                </div>
                {/* Subtotal */}
                <div className="cp-item-subtotal">{fmtR$(calcSubtotal(it))}</div>
                {/* Remover */}
                <button className="cp-btn-rem-item" onClick={() => remItem(idx)}>
                  <X size={11}/>
                </button>
              </div>
            ))}

            <div className="cp-total-row">
              <span className="cp-total-label">Total da Compra:</span>
              <span className="cp-total-val">{fmtR$(valorTotal)}</span>
            </div>
          </div>

          {/* Observação */}
          <div className="form-group" style={{marginTop:14,marginBottom:0}}>
            <label className="form-label">Observação</label>
            <textarea className="form-textarea" placeholder="Informações adicionais..."
              value={form.observacao} onChange={e => set("observacao", e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Registrar Compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Detalhes da Compra
   ═══════════════════════════════════════════════════ */
function ModalDetalheCompra({ compra, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalhes da Compra</div>
            <div className="modal-sub">{compra.fornecedorNome} — {fmtData(compra.data)}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>
        <div className="modal-body">
          <div className="cp-detalhe-section">
            <div className="cp-detalhe-title">Informações</div>
            <div className="cp-detalhe-row"><span>Fornecedor</span><strong>{compra.fornecedorNome}</strong></div>
            <div className="cp-detalhe-row"><span>Data</span><strong>{fmtData(compra.data)}</strong></div>
            <div className="cp-detalhe-row"><span>Status</span><StatusBadgeCompra status={compra.status}/></div>
            <div className="cp-detalhe-row"><span>Método</span><strong>{METODOS_PAG.find(m=>m.value===compra.metodoPagamento)?.label || compra.metodoPagamento}</strong></div>
            {compra.parcelado && <div className="cp-detalhe-row"><span>Parcelas</span><strong>{compra.numParcelas}×</strong></div>}
            {compra.vencimento && <div className="cp-detalhe-row"><span>Vencimento</span><strong>{fmtData(compra.vencimento)}</strong></div>}
            {compra.observacao && <div className="cp-detalhe-row"><span>Obs.</span><span style={{textAlign:"right",maxWidth:"60%"}}>{compra.observacao}</span></div>}
          </div>

          <div className="cp-detalhe-section">
            <div className="cp-detalhe-title">Insumos</div>
            <div className="cp-itens-det-row cp-itens-det-head">
              <span>Insumo</span><span>Qtd</span><span>Unit.</span><span>Subtotal</span>
            </div>
            {(compra.itens || []).map((it, i) => (
              <div key={i} className="cp-itens-det-row">
                <span style={{color:"var(--text)"}}>{it.insumoNome}</span>
                <span>{it.quantidade} {it.unidade}</span>
                <span>{fmtR$(it.valorUnitario)}</span>
                <span style={{color:"var(--gold)",fontWeight:600}}>{fmtR$(it.subtotal)}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",justifyContent:"flex-end",borderTop:"1px solid var(--border)",paddingTop:12}}>
            <span style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:"var(--gold)"}}>
              {fmtR$(compra.valorTotal)}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Novo / Editar Insumo
   ═══════════════════════════════════════════════════ */
function ModalInsumo({ insumo, uid, onClose, onSaved }) {
  const isEdit = !!insumo;

  const [form, setForm] = useState({
    nome:          insumo?.nome          || "",
    unidade:       insumo?.unidade       || "un",
    categoria:     insumo?.categoria     || "",
    estoqueMinimo: insumo?.estoqueMinimo != null ? String(insumo.estoqueMinimo) : "0",
    ativo:         insumo?.ativo !== false,
  });
  const [erros,    setErros]    = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim())  e.nome    = "Nome é obrigatório.";
    if (!form.unidade)      e.unidade = "Selecione a unidade.";
    if (parseBRL(form.estoqueMinimo) < 0) e.estoqueMinimo = "Não pode ser negativo.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const now  = new Date().toISOString();
      const dados = {
        nome:          form.nome.trim(),
        unidade:       form.unidade,
        categoria:     form.categoria.trim(),
        estoqueMinimo: parseBRL(form.estoqueMinimo),
        ativo:         form.ativo,
        atualizadoEm:  now,
      };
      if (isEdit) {
        await updateDoc(doc(collection(db, "users", uid, "insumos"), insumo.id), dados);
      } else {
        const ref = doc(collection(db, "users", uid, "insumos"));
        const batch = writeBatch(db);
        batch.set(ref, { ...dados, criadoEm: now });
        await batch.commit();
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("[Compras] Erro ao salvar insumo:", err);
      alert("Erro ao salvar insumo. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Insumo" : "Novo Insumo"}</div>
            <div className="modal-sub">Materiais e ingredientes utilizados</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nome <span className="form-label-req">*</span></label>
            <input className={`form-input${erros.nome?" err":""}`} placeholder="Ex: Farinha de trigo"
              value={form.nome} onChange={e => set("nome", e.target.value)} />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unidade <span className="form-label-req">*</span></label>
              <select className={`form-input${erros.unidade?" err":""}`}
                value={form.unidade} onChange={e => set("unidade", e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {erros.unidade && <div className="form-error">{erros.unidade}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Estoque Mínimo</label>
              <input className={`form-input${erros.estoqueMinimo?" err":""}`}
                placeholder="0" inputMode="decimal"
                value={form.estoqueMinimo} onChange={e => set("estoqueMinimo", e.target.value)} />
              {erros.estoqueMinimo && <div className="form-error">{erros.estoqueMinimo}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Categoria</label>
            <input className="form-input" placeholder="Ex: Matéria-prima, Embalagem..."
              value={form.categoria} onChange={e => set("categoria", e.target.value)} />
          </div>

          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Status</label>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <Toggle checked={form.ativo} onChange={v => set("ativo", v)}/>
              <span style={{fontSize:13,color:form.ativo?"var(--green)":"var(--text-3)"}}>
                {form.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Insumo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Nova Movimentação Manual
   ═══════════════════════════════════════════════════ */
function ModalMovimentacao({ insumos, uid, onClose, onSaved }) {
  const [form, setForm] = useState({
    insumoId:   "",
    tipo:       "saida",
    quantidade: "",
    motivo:     "uso_interno",
    data:       hojeISO(),
    observacao: "",
  });
  const [erros,    setErros]    = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.insumoId)                 e.insumoId   = "Selecione o insumo.";
    if (parseBRL(form.quantidade) <= 0) e.quantidade = "Quantidade inválida.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const ins = insumos.find(i => i.id === form.insumoId);
      const now = new Date().toISOString();
      const ref = doc(collection(db, "users", uid, "movimentacoes"));
      const batch = writeBatch(db);
      batch.set(ref, {
        insumoId:   form.insumoId,
        insumoNome: ins?.nome || "",
        tipo:       form.tipo,
        quantidade: parseBRL(form.quantidade),
        unidade:    ins?.unidade || "",
        motivo:     form.motivo,
        data:       form.data,
        observacao: form.observacao.trim(),
        criadoEm:   now,
      });
      await batch.commit();
      onSaved();
      onClose();
    } catch (err) {
      console.error("[Compras] Erro ao registrar movimentação:", err);
      alert("Erro ao registrar movimentação. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Movimentação</div>
            <div className="modal-sub">Saída, ajuste ou perda de estoque</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Insumo <span className="form-label-req">*</span></label>
            <select className={`form-input${erros.insumoId?" err":""}`}
              value={form.insumoId} onChange={e => set("insumoId", e.target.value)}>
              <option value="">Selecione...</option>
              {insumos.filter(i => i.ativo !== false).map(i =>
                <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
              )}
            </select>
            {erros.insumoId && <div className="form-error">{erros.insumoId}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo}
                onChange={e => set("tipo", e.target.value)}>
                <option value="saida">Saída</option>
                <option value="entrada">Entrada (ajuste)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantidade <span className="form-label-req">*</span></label>
              <input className={`form-input${erros.quantidade?" err":""}`}
                placeholder="0" inputMode="decimal"
                value={form.quantidade} onChange={e => set("quantidade", e.target.value)} />
              {erros.quantidade && <div className="form-error">{erros.quantidade}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo</label>
            <select className="form-input" value={form.motivo}
              onChange={e => set("motivo", e.target.value)}>
              {MOTIVOS_SAIDA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              <option value="ajuste">Ajuste de Inventário</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Data</label>
            <input type="date" className="form-input"
              value={form.data} onChange={e => set("data", e.target.value)} />
          </div>

          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Observação</label>
            <textarea className="form-textarea" placeholder="Detalhe opcional..."
              value={form.observacao} onChange={e => set("observacao", e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Confirmar Exclusão genérico
   ═══════════════════════════════════════════════════ */
function ModalConfirmDelete({ titulo, subtitulo, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);
  const handle = async () => { setExcluindo(true); await onConfirm(); setExcluindo(false); };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div className="modal-title">Confirmar Exclusão</div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🗑️</div>
          <p><strong>{titulo}</strong></p>
          {subtitulo && <p style={{fontSize:12,marginTop:6}}>{subtitulo}</p>}
          <p style={{marginTop:8}}>Esta ação não pode ser desfeita.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handle} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB: Compras
   ═══════════════════════════════════════════════════ */
function TabCompras({ uid, compras, fornecedores, insumos }) {
  const [search,       setSearch]       = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [modalNova,    setModalNova]    = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [detalhes,     setDetalhes]     = useState(null);
  const [deletando,    setDeletando]    = useState(null);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return compras.filter(c => {
      const passaStatus = filtroStatus === "Todos" || c.status === filtroStatus;
      const passaBusca  = !q || c.fornecedorNome?.toLowerCase().includes(q);
      return passaStatus && passaBusca;
    }).sort((a,b) => String(b.data).localeCompare(String(a.data)));
  }, [compras, search, filtroStatus]);

  const handleDeletar = async () => {
    if (!deletando) return;
    await deleteDoc(doc(collection(db, "users", uid, "compras"), deletando.id));
    setDeletando(null);
  };

  return (
    <>
      {/* Topbar */}
      <div className="cp-topbar">
        <div className="cp-topbar-title">
          <h2>Compras</h2>
          <p>Histórico de compras e pagamentos</p>
        </div>
        <div className="cp-search">
          <Search size={12} color="var(--text-3)"/>
          <input placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="cp-filter-group">
          {["Todos","pago","pendente","cancelado"].map(f => (
            <button key={f} className={`cp-filter-btn${filtroStatus===f?" active":""}`}
              onClick={() => setFiltroStatus(f)}>
              {f === "Todos" ? "Todos" : STATUS_COMPRA.find(s=>s.value===f)?.label || f}
            </button>
          ))}
        </div>
        <button className="cp-btn-new" onClick={() => setModalNova(true)}>
          <Plus size={14}/> Nova Compra
        </button>
      </div>

      <div className="ag-content">
        <div className="cp-table-wrap">
          <div className="cp-table-hdr">
            <span className="cp-table-hdr-title">Compras Registradas</span>
            <span className="cp-count-badge">{filtradas.length}</span>
          </div>

          {/* Cabeçalho */}
          <div className="cp-row-compra cp-row-head">
            <span>Data</span><span>Fornecedor</span><span>Itens</span>
            <span>Total</span><span>Status</span><span>Método</span>
            <span style={{textAlign:"right"}}>Ações</span>
          </div>

          {filtradas.length === 0 ? (
            <div className="cp-empty">
              {compras.length === 0 ? "Nenhuma compra registrada ainda." : "Nenhum resultado para o filtro."}
            </div>
          ) : filtradas.map(c => (
            <div key={c.id} className="cp-row-compra">
              <span>{fmtData(c.data)}</span>
              <span style={{color:"var(--text)",fontWeight:500}}>{c.fornecedorNome}</span>
              <span style={{color:"var(--text-3)"}}>{c.itens?.length || 0} item{c.itens?.length !== 1 ? "s":""}</span>
              <span style={{fontFamily:"'Sora',sans-serif",fontWeight:600,color:"var(--gold)"}}>{fmtR$(c.valorTotal)}</span>
              <StatusBadgeCompra status={c.status}/>
              <span style={{color:"var(--text-3)"}}>{METODOS_PAG.find(m=>m.value===c.metodoPagamento)?.label || c.metodoPagamento}</span>
              <div className="cp-row-actions">
                <button className="btn-icon btn-icon-view" title="Detalhes" onClick={() => setDetalhes(c)}><Eye size={12}/></button>
                <button className="btn-icon btn-icon-edit" title="Editar"   onClick={() => setEditando(c)}><Edit2 size={12}/></button>
                <button className="btn-icon btn-icon-del"  title="Excluir"  onClick={() => setDeletando(c)}><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {modalNova && <ModalNovaCompra uid={uid} fornecedores={fornecedores} insumos={insumos}
        onClose={() => setModalNova(false)} onSaved={() => {}} />}
      {editando && <ModalNovaCompra uid={uid} compra={editando} fornecedores={fornecedores} insumos={insumos}
        onClose={() => setEditando(null)} onSaved={() => {}} />}
      {detalhes && <ModalDetalheCompra compra={detalhes} onClose={() => setDetalhes(null)} />}
      {deletando && <ModalConfirmDelete
        titulo={`Excluir compra de ${deletando.fornecedorNome}`}
        subtitulo="As movimentações de estoque desta compra NÃO serão revertidas automaticamente."
        onConfirm={handleDeletar} onClose={() => setDeletando(null)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB: Insumos
   ═══════════════════════════════════════════════════ */
function TabInsumos({ uid, insumos, isPro }) {
  const [search,    setSearch]    = useState("");
  const [modalNovo, setModalNovo] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [deletando, setDeletando] = useState(null);

  const atingiuLimite = !isPro && insumos.length >= LIMITE_FREE_INSUMOS;

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return insumos.filter(i => !q || i.nome?.toLowerCase().includes(q) || i.categoria?.toLowerCase().includes(q));
  }, [insumos, search]);

  const handleDeletar = async () => {
    if (!deletando) return;
    await deleteDoc(doc(collection(db, "users", uid, "insumos"), deletando.id));
    setDeletando(null);
  };

  const handleToggleAtivo = async (insumo) => {
    await updateDoc(doc(collection(db, "users", uid, "insumos"), insumo.id), {
      ativo: !insumo.ativo, atualizadoEm: new Date().toISOString()
    });
  };

  return (
    <>
      <div className="cp-topbar">
        <div className="cp-topbar-title">
          <h2>Insumos</h2>
          <p>Materiais e ingredientes cadastrados</p>
        </div>
        <div className="cp-search">
          <Search size={12} color="var(--text-3)"/>
          <input placeholder="Buscar insumo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="cp-btn-new" disabled={atingiuLimite}
          onClick={() => !atingiuLimite && setModalNovo(true)}>
          <Plus size={14}/> Novo Insumo
        </button>
      </div>

      <div className="ag-content">
        {/* Banner Free limit */}
        {!isPro && (
          <BannerLimite
            atual={insumos.length}
            limite={LIMITE_FREE_INSUMOS}
            label="insumos"
          />
        )}

        <div className="cp-table-wrap">
          <div className="cp-table-hdr">
            <span className="cp-table-hdr-title">Insumos Cadastrados</span>
            <span className="cp-count-badge">{insumos.length}/{isPro ? "∞" : LIMITE_FREE_INSUMOS}</span>
          </div>

          <div className="cp-row-insumo cp-row-head">
            <span>Nome</span><span>Unidade</span><span>Categoria</span>
            <span>Est. Mínimo</span><span>Status</span>
            <span style={{textAlign:"right"}}>Ações</span>
          </div>

          {filtrados.length === 0 ? (
            <div className="cp-empty">
              {insumos.length === 0 ? "Nenhum insumo cadastrado ainda." : "Nenhum resultado para a busca."}
            </div>
          ) : filtrados.map(ins => (
            <div key={ins.id} className="cp-row-insumo">
              <span style={{color:"var(--text)",fontWeight:500}}>{ins.nome}</span>
              <span>{ins.unidade}</span>
              <span style={{color:"var(--text-3)"}}>{ins.categoria || "—"}</span>
              <span>{ins.estoqueMinimo || 0} {ins.unidade}</span>
              <Toggle checked={ins.ativo !== false} onChange={() => handleToggleAtivo(ins)} />
              <div className="cp-row-actions">
                <button className="btn-icon btn-icon-edit" onClick={() => setEditando(ins)}><Edit2 size={12}/></button>
                <button className="btn-icon btn-icon-del"  onClick={() => setDeletando(ins)}><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalNovo && <ModalInsumo uid={uid} onClose={() => setModalNovo(false)} onSaved={() => {}} />}
      {editando  && <ModalInsumo uid={uid} insumo={editando} onClose={() => setEditando(null)} onSaved={() => {}} />}
      {deletando && <ModalConfirmDelete
        titulo={`Excluir insumo "${deletando.nome}"`}
        subtitulo="O histórico de movimentações deste insumo será mantido, mas o insumo não poderá ser selecionado em novas compras."
        onConfirm={handleDeletar} onClose={() => setDeletando(null)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   TAB: Estoque
   ═══════════════════════════════════════════════════ */
function TabEstoque({ uid, insumos, movimentacoes, estoquePorInsumo }) {
  const [filtroInsumo, setFiltroInsumo] = useState("");
  const [modalMov,     setModalMov]     = useState(false);

  const movFiltradas = useMemo(() => {
    return [...movimentacoes]
      .filter(m => !filtroInsumo || m.insumoId === filtroInsumo)
      .sort((a, b) => String(b.data || b.criadoEm).localeCompare(String(a.data || a.criadoEm)))
      .slice(0, 100);
  }, [movimentacoes, filtroInsumo]);

  const alertas = estoquePorInsumo.filter(e => e.alerta && e.ativo);

  return (
    <>
      <div className="cp-topbar">
        <div className="cp-topbar-title">
          <h2>Estoque</h2>
          <p>Saldo atual calculado pelas movimentações</p>
        </div>
        {alertas.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:6,
            background:"var(--red-d)",border:"1px solid rgba(224,82,82,.25)",
            borderRadius:8,padding:"6px 12px"}}>
            <AlertTriangle size={13} color="var(--red)"/>
            <span style={{fontSize:12,color:"var(--red)",fontWeight:600}}>
              {alertas.length} insumo{alertas.length>1?"s":""} abaixo do mínimo
            </span>
          </div>
        )}
        <button className="cp-btn-new" onClick={() => setModalMov(true)}>
          <Plus size={14}/> Registrar Movimentação
        </button>
      </div>

      <div className="ag-content">
        {/* Cards de estoque */}
        {estoquePorInsumo.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:"var(--text-3)",fontSize:13}}>
            Cadastre insumos e registre compras para visualizar o estoque.
          </div>
        ) : (
          <div className="cp-estoque-grid">
            {estoquePorInsumo.filter(e => e.ativo).map(e => (
              <div key={e.insumoId} className={`cp-estoque-card${e.alerta?" alerta":" ok"}`}>
                {e.alerta && (
                  <div className="cp-estoque-alert-tag">
                    <AlertTriangle size={9}/> Baixo
                  </div>
                )}
                <div className="cp-estoque-nome" title={e.nome}>{e.nome}</div>
                <div>
                  <span className={`cp-estoque-val${e.alerta?" alerta":" ok"}`}>{e.atual}</span>
                  <span className="cp-estoque-unid">{e.unidade}</span>
                </div>
                <div className="cp-estoque-min">Mínimo: {e.minimo} {e.unidade}</div>
                {e.categoria && <div style={{fontSize:10,color:"var(--text-3)",marginTop:4}}>{e.categoria}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Histórico de movimentações */}
        <div className="cp-table-wrap">
          <div className="cp-table-hdr">
            <span className="cp-table-hdr-title">Histórico de Movimentações</span>
            <select className="form-input" style={{width:"auto",padding:"4px 10px",fontSize:11}}
              value={filtroInsumo} onChange={e => setFiltroInsumo(e.target.value)}>
              <option value="">Todos os insumos</option>
              {insumos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>

          <div className="cp-row-mov cp-row-head">
            <span>Data</span><span>Insumo</span><span>Tipo</span>
            <span>Qtd</span><span>Motivo</span><span>Observação</span>
          </div>

          {movFiltradas.length === 0 ? (
            <div className="cp-empty">Nenhuma movimentação encontrada.</div>
          ) : movFiltradas.map(m => (
            <div key={m.id} className="cp-row-mov">
              <span>{fmtData(m.data)}</span>
              <span style={{color:"var(--text)",fontWeight:500}}>{m.insumoNome}</span>
              <span>
                {m.tipo === "entrada"
                  ? <span className="sb sb-entrada"><ArrowDown size={9}/> Entrada</span>
                  : <span className="sb sb-saida"><ArrowUp size={9}/> Saída</span>
                }
              </span>
              <span style={{fontWeight:600,color:"var(--text)"}}>{m.quantidade} {m.unidade}</span>
              <span style={{color:"var(--text-3)"}}>{MOTIVOS_SAIDA.find(mt=>mt.value===m.motivo)?.label || m.motivo || "compra"}</span>
              <span style={{color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.observacao || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {modalMov && <ModalMovimentacao uid={uid} insumos={insumos}
        onClose={() => setModalMov(false)} onSaved={() => {}} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Compras
   ═══════════════════════════════════════════════════ */
export default function Compras() {
  const [uid,  setUid]  = useState(null);
  const [tab,  setTab]  = useState("compras");

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUid(user?.uid || null));
    return unsub;
  }, []);

  /* ── Licença ── */
  const { isPro, ativo: licAtivo, loadingLicenca } = useLicenca(uid);

  /* ── Dados reativos ── */
  const { compras, insumos, movimentacoes, loading, estoquePorInsumo, insumosAbaixoMinimo } = useComprasData(uid);

  /* ── Fornecedores (lidos direto — já existem no app) ── */
  const [fornecedores, setFornecedores] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "fornecedores"),
      snap => setFornecedores(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error("[Compras] fornecedores:", err)
    );
    return unsub;
  }, [uid]);

  /* ── Guard ── */
  if (!uid || loadingLicenca) return <div className="cp-loading">Carregando...</div>;
  if (loading)                return <div className="cp-loading">Carregando módulo de compras...</div>;

  const TABS = [
    { id:"compras",  label:"Compras",  icon:<ShoppingCart size={14}/>, count: compras.length },
    { id:"insumos",  label:"Insumos",  icon:<Package      size={14}/>, count: insumos.length },
    { id:"estoque",  label:"Estoque",  icon:<Layers       size={14}/>, count: insumosAbaixoMinimo > 0 ? `${insumosAbaixoMinimo} ⚠` : null },
  ];

  return (
    <>
      <style>{CSS}</style>

      {/* Tabs */}
      <div className="cp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`cp-tab${tab===t.id?" active":""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {t.count != null && <span className="cp-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo por aba */}
      {tab === "compras" && (
        <TabCompras uid={uid} compras={compras} fornecedores={fornecedores} insumos={insumos} />
      )}
      {tab === "insumos" && (
        <TabInsumos uid={uid} insumos={insumos} isPro={isPro && licAtivo} />
      )}
      {tab === "estoque" && (
        <TabEstoque uid={uid} insumos={insumos} movimentacoes={movimentacoes} estoquePorInsumo={estoquePorInsumo} />
      )}
    </>
  );
}
