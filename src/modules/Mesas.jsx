/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Mesas.jsx
   Módulo de Mesas / Comandas para restaurantes

   Estrutura Firestore:
     users/{uid}/mesas/{id}         → configuração de cada mesa
     users/{uid}/comandas/{id}      → comanda ativa de uma mesa
     users/{uid}/vendas/{id}        → venda gerada ao fechar mesa
     users/{uid}/config/geral       → taxas de pagamento

   Permissões: admin, comercial, vendedor podem abrir/fechar mesas
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useContext, useMemo, useCallback } from "react";
import {
  Plus, X, Trash2, UtensilsCrossed, CheckCircle2,
  ChevronDown, Edit3, Printer, Settings, Search,
  Clock, User, DollarSign, ShoppingBag, LayoutGrid,
} from "lucide-react";

import AuthContext from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import {
  collection, doc, setDoc, deleteDoc, updateDoc, getDoc,
  onSnapshot, runTransaction, increment, addDoc, serverTimestamp,
  query, getDocs, where,
} from "firebase/firestore";

/* ─────────────────────────────────────────────────────
   PERMISSÕES
───────────────────────────────────────────────────── */
const PODE_OPERAR = ["admin", "comercial", "vendedor"];
const podeOperar = (cargo) => PODE_OPERAR.includes(cargo);

/* ─────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────── */
const TAXAS_DEFAULT = {
  debito: 1.99, pix: 0,
  credito_1: 2.99, credito_2: 3.19, credito_3: 3.39,
  credito_4: 3.59, credito_5: 3.79, credito_6: 3.99,
  credito_7: 4.19, credito_8: 4.39, credito_9: 4.59,
  credito_10: 4.79, credito_11: 4.99, credito_12: 5.19,
};

const FORMAS_PGTO = ["Em aberto", "Dinheiro", "Pix", "Cartão de Crédito", "Cartão de Débito"];

const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtHora = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const fmtDataHora = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

/* ─────────────────────────────────────────────────────
   RECIBO DE IMPRESSÃO
───────────────────────────────────────────────────── */
function imprimirRecibo(dados) {
  const { mesa, itens, formaPgto, cliente, total, taxaPerc, valorTaxa, vendaId, parcelas } = dados;
  const el = document.getElementById("mesas-recibo-root");
  if (!el) return;

  el.innerHTML = `
    <div class="mesas-recibo-print">
      <div style="text-align:center;font-weight:bold;font-size:15px;margin-bottom:4px;">ASSENT</div>
      <div style="text-align:center;font-size:11px;margin-bottom:12px;">Recibo de Consumo</div>
      ${vendaId ? `<div style="font-size:11px;">Venda: ${vendaId}</div>` : ""}
      <div style="font-size:11px;">Mesa: ${mesa}</div>
      ${cliente ? `<div style="font-size:11px;">Cliente: ${cliente}</div>` : ""}
      <div style="font-size:11px;">Pgto: ${formaPgto}${parcelas > 1 ? ` — ${parcelas}x` : ""}</div>
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${itens.map(i => `
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span>${i.qtd}x ${i.nome}</span>
          <span>${fmtR$((i.preco || 0) * (i.qtd || 1))}</span>
        </div>
      `).join("")}
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${taxaPerc > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#555;"><span>Taxa (${taxaPerc}%)</span><span>${fmtR$(valorTaxa)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;">
        <span>TOTAL</span><span>${fmtR$(total)}</span>
      </div>
      ${parcelas > 1 ? `<div style="font-size:11px;text-align:right;">${parcelas}x de ${fmtR$(total / parcelas)}</div>` : ""}
      <div style="text-align:center;font-size:10px;margin-top:14px;">Obrigado pela preferência!</div>
    </div>
  `;
  window.print();
}

/* ─────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────── */
const CSS = `
  /* ── Print ── */
  @media print {
    body { visibility: hidden !important; }
    #mesas-recibo-root {
      visibility: visible !important; display: block !important;
      position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
    }
    #mesas-recibo-root * { visibility: visible !important; }
    .mesas-recibo-print {
      font-family: 'Courier New', monospace;
      width: 80mm; margin: 0 auto; padding: 8mm;
      font-size: 12px; color: #000 !important; background: #fff;
    }
    .mesas-recibo-print * { color: #000 !important; }
  }
  #mesas-recibo-root { display: none; }

  /* ── Layout geral ── */
  .mesas-page {
    padding: 24px;
    min-height: 100%;
  }
  .mesas-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
  }
  .mesas-title {
    font-family: 'Sora', sans-serif;
    font-size: 22px; font-weight: 700; color: var(--text);
    display: flex; align-items: center; gap: 10px;
  }
  .mesas-subtitle { font-size: 13px; color: var(--text-3); margin-top: 3px; }

  .mesas-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  /* ── Grid de mesas ── */
  .mesas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  /* ── Bloco de mesa ── */
  .mesa-card {
    background: var(--s1);
    border: 2px solid var(--border);
    border-radius: 16px;
    padding: 18px 16px 14px;
    cursor: pointer;
    transition: border-color .18s, box-shadow .18s, transform .12s;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    position: relative;
    min-height: 130px;
    user-select: none;
  }
  .mesa-card:hover {
    border-color: var(--border-h);
    box-shadow: 0 8px 28px rgba(0,0,0,0.28);
    transform: translateY(-2px);
  }
  .mesa-card.ocupada {
    border-color: var(--gold);
    background: rgba(200,165,94,.07);
  }
  .mesa-card.ocupada:hover {
    box-shadow: 0 8px 28px rgba(200,165,94,.18);
  }

  .mesa-numero {
    font-family: 'Sora', sans-serif;
    font-size: 26px; font-weight: 800;
    color: var(--text); line-height: 1;
  }
  .mesa-card.ocupada .mesa-numero { color: var(--gold); }

  .mesa-status-badge {
    font-size: 10px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; padding: 3px 10px;
    border-radius: 20px; 
  }
  .badge-livre {
    background: rgba(100,200,140,.12);
    color: #5ecb8a;
  }
  .badge-ocupada {
    background: rgba(200,165,94,.18);
    color: var(--gold);
  }

  .mesa-info {
    font-size: 11px; color: var(--text-3);
    text-align: center; line-height: 1.5;
  }
  .mesa-total {
    font-family: 'Sora', sans-serif;
    font-size: 14px; font-weight: 700;
    color: var(--gold); margin-top: 2px;
  }
  .mesa-hora {
    font-size: 10px; color: var(--text-3);
    display: flex; align-items: center; gap: 4px;
  }

  .mesa-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 300px; color: var(--text-3);
    font-size: 14px; gap: 12px; text-align: center;
  }

  /* ── Modal base ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px; animation: mfadeIn .15s ease;
  }
  @keyframes mfadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes mslideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 540px;
    max-height: 93vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: mslideUp .18s ease;
  }
  .modal-box-lg { max-width: 680px; }
  .modal-box-sm { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }
  .modal-header {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
    position: sticky; top: 0; background: var(--s1); z-index: 2;
  }
  .modal-title { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text); }
  .modal-sub   { font-size: 12px; color: var(--text-2); margin-top: 3px; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .13s;
  }
  .modal-close:hover { background: var(--s2); border-color: var(--border-h); }
  .modal-body   { padding: 18px 20px; }
  .modal-footer {
    padding: 14px 20px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: var(--s1); z-index: 2;
  }

  /* ── Buttons ── */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .45; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    display: flex; align-items: center; gap: 6px;
    transition: background .13s;
  }
  .btn-danger:hover { background: rgba(224,82,82,.18); }
  .btn-danger:disabled { opacity: .45; cursor: not-allowed; }

  .btn-success {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(94,203,138,.12); color: #5ecb8a;
    border: 1px solid rgba(94,203,138,.3); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
    transition: background .13s;
  }
  .btn-success:hover { background: rgba(94,203,138,.2); }
  .btn-success:disabled { opacity: .45; cursor: not-allowed; }

  .btn-icon {
    width: 34px; height: 34px; border-radius: 9px;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .13s;
    color: var(--text-2);
  }
  .btn-icon:hover { background: var(--s2); color: var(--text); }

  /* ── Formulário ── */
  .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .form-row   { display: flex; gap: 12px; margin-bottom: 14px; }
  .form-label { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--text-2); }
  .form-label-req { color: var(--gold); }
  .form-input {
    padding: 9px 12px; border-radius: 9px;
    background: var(--s2); border: 1px solid var(--border);
    color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13px;
    outline: none; transition: border-color .13s;
    width: 100%;
  }
  .form-input:focus { border-color: var(--gold); }
  .form-input.err   { border-color: var(--red); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 3px; }

  /* ── Itens da comanda ── */
  .cmd-items-wrap {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; margin-bottom: 14px;
  }
  .cmd-items-header {
    display: grid; grid-template-columns: 1fr 72px 100px 36px;
    padding: 8px 12px; background: var(--s3);
    border-bottom: 1px solid var(--border); gap: 8px;
  }
  .cmd-items-header span {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .cmd-item-row {
    display: grid; grid-template-columns: 1fr 72px 100px 36px;
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    gap: 8px; align-items: center;
  }
  .cmd-item-row:last-child { border-bottom: none; }
  .cmd-item-nome { font-size: 13px; color: var(--text); font-weight: 500; }
  .cmd-item-sub  { font-size: 11px; color: var(--text-3); margin-top: 1px; }
  .cmd-item-qtd  {
    display: flex; align-items: center; gap: 5px;
  }
  .cmd-qtd-btn {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--s3);
    color: var(--text-2); font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all .12s; flex-shrink: 0;
  }
  .cmd-qtd-btn:hover { background: var(--s2); border-color: var(--border-h); }
  .cmd-qtd-num {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700;
    color: var(--text); min-width: 20px; text-align: center;
  }
  .cmd-item-total {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text);
  }
  .cmd-item-remove {
    width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent; background: transparent;
    color: var(--red); transition: all .13s;
  }
  .cmd-item-remove:hover { background: var(--red-d); border-color: rgba(224,82,82,.2); }
  .cmd-empty-items {
    padding: 18px; text-align: center;
    font-size: 13px; color: var(--text-3);
  }

  /* ── Adicionar item ── */
  .cmd-add-bar {
    display: flex; gap: 8px; margin-bottom: 14px; position: relative;
  }
  .cmd-ac-list {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 9px; max-height: 220px; overflow-y: auto;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5); margin-top: 3px;
  }
  .cmd-ac-item {
    padding: 9px 13px; cursor: pointer; font-size: 13px; color: var(--text);
    transition: background .1s; display: flex; justify-content: space-between; align-items: center;
  }
  .cmd-ac-item:hover { background: var(--s2); }
  .cmd-ac-item-right { font-size: 12px; color: var(--text-3); text-align: right; }
  .cmd-ac-empty { padding: 10px 13px; font-size: 12px; color: var(--text-3); text-align: center; }

  /* ── Totais ── */
  .cmd-totals {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .cmd-total-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: var(--text-2);
  }
  .cmd-total-row.destaque {
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
    color: var(--text); padding-top: 6px; border-top: 1px solid var(--border);
    margin-top: 4px;
  }
  .cmd-total-row.destaque span:last-child { color: var(--gold); }

  /* ── Pagamento ── */
  .pgto-tabs {
    display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;
  }
  .pgto-tab {
    padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
    white-space: nowrap;
  }
  .pgto-tab:hover { background: var(--s3); color: var(--text); }
  .pgto-tab.active {
    background: rgba(200,165,94,.15); border-color: var(--gold); color: var(--gold);
  }
  .pgto-tab.aberto.active {
    background: rgba(91,142,240,.12); border-color: rgba(91,142,240,.5); color: #5B8EF0;
  }
  .parcelas-wrap { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .parcela-btn {
    padding: 5px 11px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .parcela-btn:hover { background: var(--s3); }
  .parcela-btn.active { background: rgba(200,165,94,.15); border-color: var(--gold); color: var(--gold); }
  .taxa-info { font-size: 11px; color: var(--text-3); margin-top: 6px; }
  .taxa-info strong { color: var(--text-2); }

  /* ── Seção separador ── */
  .sec-sep { height: 1px; background: var(--border); margin: 16px 0; }

  /* ── Config mesas modal ── */
  .cfg-mesa-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; margin-bottom: 8px;
  }
  .cfg-mesa-num {
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
    color: var(--text); min-width: 34px;
  }
  .cfg-mesa-label { font-size: 12px; color: var(--text-2); flex: 1; }

  /* ── Badge sem permissão ── */
  .sem-perm-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px;
    background: var(--s3); border: 1px solid var(--border);
    font-size: 12px; color: var(--text-3);
  }

  /* ── Legenda ── */
  .mesas-legenda {
    display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .legenda-item {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: var(--text-3);
  }
  .legenda-dot {
    width: 10px; height: 10px; border-radius: 3px;
  }
  .legenda-dot.livre   { background: rgba(100,200,140,.4); border: 1px solid rgba(94,203,138,.5); }
  .legenda-dot.ocupada { background: rgba(200,165,94,.4);  border: 1px solid rgba(200,165,94,.5); }

  /* ── Tabs ── */
  .mesas-tabs {
    display: flex; gap: 4px; background: var(--s2);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 4px;
  }
  .mesas-tab {
    padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; background: transparent; color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s; white-space: nowrap;
    display: flex; align-items: center; gap: 6px;
  }
  .mesas-tab:hover { color: var(--text); }
  .mesas-tab.active { background: var(--s1); color: var(--text); box-shadow: 0 2px 8px rgba(0,0,0,.2); }

  /* ── Contador badge ── */
  .count-badge {
    background: var(--gold); color: #0a0808;
    font-size: 10px; font-weight: 700;
    padding: 1px 6px; border-radius: 10px; line-height: 1.4;
  }

  /* ── Responsivo ── */
  @media (max-width: 600px) {
    .mesas-page { padding: 14px; }
    .mesas-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
    .cmd-items-header,
    .cmd-item-row { grid-template-columns: 1fr 56px 84px 28px; }
    .form-row { flex-direction: column; }
  }
`;

/* ═══════════════════════════════════════════════════
   MODAL: COMANDA DA MESA
   ═══════════════════════════════════════════════════ */
function ModalMesa({ mesa, comanda, produtos, servicos, taxas, uid, vendaIdCnt, cargo, nomeUsuario, onClose, onVendaSalva }) {
  const isOcupada = !!comanda;

  /* Itens da comanda */
  const [itens, setItens] = useState(comanda?.itens || []);
  const [clienteNome, setClienteNome] = useState(comanda?.clienteNome || "");
  const [formaPgto, setFormaPgto] = useState(comanda?.formaPgto || "Em aberto");
  const [parcelas, setParcelas] = useState(1);
  const [busca, setBusca] = useState("");
  const [showAC, setShowAC] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [confirmFechar, setConfirmFechar] = useState(false);

  /* Catálogo unificado */
  const catalogo = useMemo(() => {
    const prods = (produtos || []).map(p => ({ ...p, _tipo: "produto" }));
    const servs = (servicos || []).map(s => ({ ...s, _tipo: "servico" }));
    return [...prods, ...servs];
  }, [produtos, servicos]);

  const catalogoFiltrado = useMemo(() => {
    if (!busca.trim()) return catalogo.slice(0, 10);
    const q = busca.toLowerCase();
    return catalogo.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 10);
  }, [catalogo, busca]);

  /* Cálculos */
  const subtotal = useMemo(
    () => itens.reduce((s, i) => s + (i.preco || 0) * (i.qtd || 1), 0),
    [itens]
  );

  const taxaInfo = useMemo(() => {
    if (formaPgto === "Pix") {
      const perc = parseFloat(taxas?.pix ?? 0) || 0;
      if (perc === 0) return { perc: 0, valor: 0, exibe: false };
      return { perc, valor: +(subtotal * perc / 100).toFixed(2), exibe: true };
    }
    if (formaPgto === "Cartão de Crédito") {
      const chave = `credito_${parcelas || 1}`;
      const perc = parseFloat(taxas?.[chave] ?? TAXAS_DEFAULT[chave] ?? 0) || 0;
      return { perc, valor: +(subtotal * perc / 100).toFixed(2), exibe: perc > 0 };
    }
    if (formaPgto === "Cartão de Débito") {
      const perc = parseFloat(taxas?.debito ?? TAXAS_DEFAULT.debito ?? 0) || 0;
      return { perc, valor: +(subtotal * perc / 100).toFixed(2), exibe: perc > 0 };
    }
    return { perc: 0, valor: 0, exibe: false };
  }, [formaPgto, parcelas, subtotal, taxas]);

  const total = subtotal + taxaInfo.valor;

  /* Adicionar item */
  const adicionarItem = (prod) => {
    setItens(prev => {
      const idx = prev.findIndex(i => i.produtoId === prod.id && i._tipo === prod._tipo);
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], qtd: novo[idx].qtd + 1 };
        return novo;
      }
      return [...prev, {
        produtoId: prod.id,
        nome: prod.nome,
        preco: prod.preco || 0,
        qtd: 1,
        _tipo: prod._tipo,
      }];
    });
    setBusca("");
    setShowAC(false);
  };

  const alterarQtd = (idx, delta) => {
    setItens(prev => {
      const novo = [...prev];
      const novaQtd = (novo[idx].qtd || 1) + delta;
      if (novaQtd <= 0) return novo.filter((_, i) => i !== idx);
      novo[idx] = { ...novo[idx], qtd: novaQtd };
      return novo;
    });
  };

  const removerItem = (idx) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  /* Salvar comanda (manter aberta) */
  const salvarComanda = async () => {
    setSalvando(true);
    try {
      const ref = doc(db, "users", uid, "comandas", mesa.id);
      await setDoc(ref, {
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        clienteNome: clienteNome.trim(),
        formaPgto,
        itens,
        subtotal,
        total,
        abertaEm: comanda?.abertaEm || new Date().toISOString(),
        atualizadaEm: new Date().toISOString(),
        operadorNome: nomeUsuario,
        operadorCargo: cargo,
      }, { merge: true });
    } catch (err) {
      console.error("[Mesas] Erro ao salvar comanda:", err);
      alert("Erro ao salvar comanda. Tente novamente.");
    }
    setSalvando(false);
  };

  /* Fechar mesa */
  const fecharMesa = async () => {
    setFechando(true);
    try {
      const cmdRef = doc(db, "users", uid, "comandas", mesa.id);

      /* Se não há itens, apenas fechar sem gerar venda */
      if (itens.length === 0) {
        await deleteDoc(cmdRef);
        onVendaSalva(null);
        onClose();
        return;
      }

      /* Gerar ID de venda */
      const gerarId = (cnt) => `V${String(cnt + 1).padStart(4, "0")}`;
      const novoId = gerarId(vendaIdCnt);

      const payload = {
        cliente: clienteNome.trim() || `Mesa ${mesa.numero}`,
        data: new Date(),
        vendedor: nomeUsuario,
        formaPagamento: formaPgto === "Em aberto" ? "Dinheiro" : formaPgto,
        observacao: `Mesa ${mesa.numero}`,
        tipo: "produto",
        total,
        subtotal,
        descontos: 0,
        custoTotal: 0,
        lucroEstimado: total,
        parcelas: formaPgto === "Cartão de Crédito" ? parcelas : null,
        taxaPercentual: taxaInfo.perc,
        valorTaxa: taxaInfo.valor,
        valorPago: null,
        valorRestante: null,
        dataVencSinal: null,
        statusPagamento: "recebido",
        valorRecebido: total,
        origem: "mesa",
        mesaNumero: mesa.numero,
        itens: itens.map(i => ({
          produtoId: i.produtoId || null,
          nome: i.nome,
          qtd: i.qtd || 1,
          preco: i.preco || 0,
          custo: 0,
          desconto: 0,
          tipo: i._tipo || "produto",
        })),
        criadoEm: new Date().toISOString(),
      };

      await runTransaction(db, async (tx) => {
        /* Descontar estoque de produtos */
        for (const item of itens) {
          if (item.produtoId && item._tipo === "produto") {
            const ref = doc(db, "users", uid, "produtos", item.produtoId);
            tx.update(ref, { estoque: increment(-(item.qtd || 1)) });
          }
        }
        /* Criar venda */
        tx.set(doc(db, "users", uid, "vendas", novoId), payload);
        /* Incrementar contador */
        tx.set(doc(db, "users", uid), { vendaIdCnt: vendaIdCnt + 1 }, { merge: true });
        /* Remover comanda */
        tx.delete(cmdRef);
      });

      /* Lançar no caixa */
      try {
        await addDoc(collection(db, "users", uid, "caixa"), {
          tipo: "entrada", origem: "venda", referenciaId: novoId,
          valor: total,
          descricao: `Venda ${novoId} — Mesa ${mesa.numero}${clienteNome ? ` (${clienteNome})` : ""}`,
          formaPagamento: payload.formaPagamento,
          data: new Date().toISOString(),
          criadoEm: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[Mesas] Erro ao lançar no caixa:", err);
      }

      onVendaSalva({
        id: novoId,
        mesa: mesa.numero,
        itens,
        formaPgto: payload.formaPagamento,
        cliente: payload.cliente,
        total,
        taxaPerc: taxaInfo.perc,
        valorTaxa: taxaInfo.valor,
        parcelas: formaPgto === "Cartão de Crédito" ? parcelas : 1,
      });
      onClose();
    } catch (err) {
      console.error("[Mesas] Erro ao fechar mesa:", err);
      alert("Erro ao fechar mesa. Tente novamente.");
    }
    setFechando(false);
  };

  const podeFechar = podeOperar(cargo);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">

        {/* HEADER */}
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UtensilsCrossed size={16} color="var(--gold)" />
              Mesa {mesa.numero}
              {mesa.nome ? ` — ${mesa.nome}` : ""}
            </div>
            <div className="modal-sub">
              {isOcupada
                ? `Aberta às ${fmtHora(comanda?.abertaEm)} · ${itens.length} item(s)`
                : "Mesa livre — adicione itens para abrir"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Cliente (opcional) */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><User size={11} style={{ display: "inline" }} /> Nome do cliente (opcional)</label>
              <input
                className="form-input"
                placeholder="Nome do cliente..."
                value={clienteNome}
                onChange={e => setClienteNome(e.target.value)}
              />
            </div>
          </div>

          {/* Adicionar item */}
          <div style={{ marginBottom: 4 }}>
            <div className="form-label" style={{ marginBottom: 6 }}>Adicionar item</div>
            <div className="cmd-add-bar">
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  className="form-input"
                  placeholder="Buscar produto ou serviço..."
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setShowAC(true); }}
                  onFocus={() => setShowAC(true)}
                  onBlur={() => setTimeout(() => setShowAC(false), 180)}
                  autoComplete="off"
                />
                {showAC && (
                  <div className="cmd-ac-list">
                    {catalogoFiltrado.length === 0
                      ? <div className="cmd-ac-empty">Nenhum item encontrado</div>
                      : catalogoFiltrado.map(p => (
                          <div key={`${p._tipo}-${p.id}`} className="cmd-ac-item"
                               onMouseDown={() => adicionarItem(p)}>
                            <div>
                              <div style={{ fontSize: 13, color: "var(--text)" }}>{p.nome}</div>
                              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                                {p._tipo === "produto" ? "Produto" : "Serviço"}
                              </div>
                            </div>
                            <div className="cmd-ac-item-right">{fmtR$(p.preco)}</div>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="cmd-items-wrap">
            <div className="cmd-items-header">
              <span>Item</span>
              <span>Qtd</span>
              <span>Total</span>
              <span></span>
            </div>
            {itens.length === 0
              ? <div className="cmd-empty-items">Nenhum item adicionado</div>
              : itens.map((item, idx) => (
                  <div key={idx} className="cmd-item-row">
                    <div>
                      <div className="cmd-item-nome">{item.nome}</div>
                      <div className="cmd-item-sub">{fmtR$(item.preco)} /un</div>
                    </div>
                    <div className="cmd-item-qtd">
                      <button className="cmd-qtd-btn" onClick={() => alterarQtd(idx, -1)}>−</button>
                      <span className="cmd-qtd-num">{item.qtd}</span>
                      <button className="cmd-qtd-btn" onClick={() => alterarQtd(idx, +1)}>+</button>
                    </div>
                    <div className="cmd-item-total">{fmtR$((item.preco || 0) * (item.qtd || 1))}</div>
                    <button className="cmd-item-remove" onClick={() => removerItem(idx)}>
                      <X size={13} />
                    </button>
                  </div>
                ))
            }
          </div>

          {/* Pagamento */}
          <div className="form-label" style={{ marginBottom: 8 }}>Forma de pagamento</div>
          <div className="pgto-tabs">
            {FORMAS_PGTO.map(f => (
              <button
                key={f}
                className={`pgto-tab ${formaPgto === f ? "active" : ""} ${f === "Em aberto" ? "aberto" : ""}`}
                onClick={() => { setFormaPgto(f); setParcelas(1); }}
              >
                {f}
              </button>
            ))}
          </div>

          {formaPgto === "Cartão de Crédito" && (
            <div style={{ marginBottom: 14 }}>
              <div className="form-label" style={{ marginBottom: 6 }}>Parcelas</div>
              <div className="parcelas-wrap">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                  const chave = `credito_${n}`;
                  const perc = parseFloat(taxas?.[chave] ?? TAXAS_DEFAULT[chave] ?? 0) || 0;
                  return (
                    <button
                      key={n}
                      className={`parcela-btn ${parcelas === n ? "active" : ""}`}
                      onClick={() => setParcelas(n)}
                    >
                      {n}x{perc > 0 ? ` (${perc}%)` : ""}
                    </button>
                  );
                })}
              </div>
              {taxaInfo.exibe && (
                <div className="taxa-info">
                  Taxa: <strong>{taxaInfo.perc}%</strong> = {fmtR$(taxaInfo.valor)}
                </div>
              )}
            </div>
          )}

          {(formaPgto === "Pix" || formaPgto === "Cartão de Débito") && taxaInfo.exibe && (
            <div className="taxa-info" style={{ marginBottom: 14 }}>
              Taxa: <strong>{taxaInfo.perc}%</strong> = {fmtR$(taxaInfo.valor)}
            </div>
          )}

          {/* Totais */}
          {itens.length > 0 && (
            <div className="cmd-totals">
              <div className="cmd-total-row">
                <span>Subtotal</span>
                <span>{fmtR$(subtotal)}</span>
              </div>
              {taxaInfo.exibe && (
                <div className="cmd-total-row">
                  <span>Taxa ({taxaInfo.perc}%)</span>
                  <span>{fmtR$(taxaInfo.valor)}</span>
                </div>
              )}
              <div className="cmd-total-row destaque">
                <span>Total</span>
                <span>{fmtR$(total)}</span>
              </div>
            </div>
          )}

          {/* Aviso mesa em aberto */}
          {formaPgto === "Em aberto" && itens.length > 0 && (
            <div style={{
              padding: "10px 14px", borderRadius: 9,
              background: "rgba(91,142,240,.07)", border: "1px solid rgba(91,142,240,.2)",
              fontSize: 12, color: "#5B8EF0", marginBottom: 4,
            }}>
              Mesa ficará como <strong>Ocupada</strong> — você pode fechar depois.
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>

          {/* Salvar comanda aberta */}
          {(itens.length > 0 || isOcupada) && podeFechar && (
            <button className="btn-secondary" onClick={salvarComanda} disabled={salvando}>
              {salvando ? "Salvando..." : "💾 Salvar"}
            </button>
          )}

          {/* Fechar mesa */}
          {podeFechar && (
            <button
              className={itens.length > 0 ? "btn-success" : "btn-secondary"}
              onClick={() => itens.length > 0 && formaPgto !== "Em aberto"
                ? setConfirmFechar(true)
                : itens.length === 0
                  ? fecharMesa()
                  : salvarComanda()
              }
              disabled={fechando}
              title={itens.length === 0 ? "Fechar mesa vazia" : formaPgto === "Em aberto" ? "Salvar comanda em aberto" : "Fechar mesa e gerar venda"}
            >
              {fechando ? "Fechando..." :
               itens.length === 0 ? <><CheckCircle2 size={14} /> Fechar Mesa</> :
               formaPgto === "Em aberto" ? "💾 Salvar em aberto" :
               <><CheckCircle2 size={14} /> Fechar Mesa</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Confirmação fechar */}
      {confirmFechar && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-box modal-box-sm">
            <div className="modal-header">
              <div>
                <div className="modal-title">Fechar Mesa {mesa.numero}</div>
                <div className="modal-sub">Isso irá gerar uma venda e liberar a mesa</div>
              </div>
              <button className="modal-close" onClick={() => setConfirmFechar(false)}>
                <X size={14} color="var(--text-2)" />
              </button>
            </div>
            <div style={{ padding: "20px 20px 10px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
              <div style={{ fontSize: 24, marginBottom: 10, textAlign: "center" }}>🧾</div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                {clienteNome
                  ? `Cliente: <strong>${clienteNome}</strong>`
                  : `Será salvo como Mesa ${mesa.numero}`}
              </div>
              <div className="cmd-totals">
                <div className="cmd-total-row">
                  <span>{itens.length} item(s)</span>
                  <span>{fmtR$(subtotal)}</span>
                </div>
                {taxaInfo.exibe && (
                  <div className="cmd-total-row">
                    <span>Taxa</span>
                    <span>{fmtR$(taxaInfo.valor)}</span>
                  </div>
                )}
                <div className="cmd-total-row destaque">
                  <span>Total</span>
                  <span>{fmtR$(total)}</span>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                Pagamento: <strong style={{ color: "var(--text-2)" }}>{formaPgto}{parcelas > 1 ? ` — ${parcelas}x` : ""}</strong>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmFechar(false)}>Voltar</button>
              <button className="btn-success" onClick={fecharMesa} disabled={fechando}>
                {fechando ? "Fechando..." : <><CheckCircle2 size={14} /> Confirmar e Fechar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: CONFIGURAR MESAS
   ═══════════════════════════════════════════════════ */
function ModalConfigMesas({ uid, mesas, onClose }) {
  const [qtd, setQtd] = useState(String(mesas.length || 1));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSalvar = async () => {
    const n = parseInt(qtd);
    if (!n || n < 1 || n > 100) {
      setErro("Informe entre 1 e 100 mesas.");
      return;
    }
    setSalvando(true);
    try {
      const col = collection(db, "users", uid, "mesas");

      /* Mesas existentes */
      const existentes = mesas.map(m => m.id);

      /* Criar mesas faltantes */
      for (let i = 1; i <= n; i++) {
        const id = `mesa_${i}`;
        if (!existentes.includes(id)) {
          await setDoc(doc(db, "users", uid, "mesas", id), {
            numero: i,
            nome: "",
            capacidade: 4,
            ativa: true,
            criadaEm: new Date().toISOString(),
          });
        }
      }

      /* Desativar mesas extras */
      for (const m of mesas) {
        if (m.numero > n) {
          await deleteDoc(doc(db, "users", uid, "mesas", m.id));
        }
      }

      onClose();
    } catch (err) {
      console.error("[Mesas] Erro ao configurar:", err);
      setErro("Erro ao salvar. Tente novamente.");
    }
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title"><Settings size={15} style={{ display: "inline", marginRight: 6 }} />Configurar Mesas</div>
            <div className="modal-sub">Defina quantas mesas o estabelecimento possui</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Número de mesas <span className="form-label-req">*</span></label>
            <input
              type="number"
              className={`form-input ${erro ? "err" : ""}`}
              value={qtd}
              min={1} max={100}
              onChange={e => { setQtd(e.target.value); setErro(""); }}
            />
            {erro && <div className="form-error">{erro}</div>}
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
              Mesas com comandas abertas não serão removidas.
            </div>
          </div>

          {mesas.length > 0 && (
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Mesas cadastradas ({mesas.length})</div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {mesas.map(m => (
                  <div key={m.id} className="cfg-mesa-row">
                    <div className="cfg-mesa-num">{m.numero}</div>
                    <div className="cfg-mesa-label">Mesa {m.numero}{m.nome ? ` — ${m.nome}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : <><Settings size={13} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: RECIBO PÓS-VENDA
   ═══════════════════════════════════════════════════ */
function ModalRecibo({ dados, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">✅ Mesa {dados.mesa} fechada</div>
            <div className="modal-sub">Venda {dados.id} gerada com sucesso</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="modal-body">
          <div style={{
            textAlign: "center", padding: "10px 0 16px",
            fontSize: 13, color: "var(--text-2)", lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
            <div>Cliente: <strong style={{ color: "var(--text)" }}>{dados.cliente}</strong></div>
            <div>Pagamento: <strong style={{ color: "var(--text)" }}>{dados.formaPgto}{dados.parcelas > 1 ? ` — ${dados.parcelas}x` : ""}</strong></div>
            <div style={{ marginTop: 12, fontSize: 20, fontFamily: "'Sora', sans-serif", fontWeight: 700, color: "var(--gold)" }}>
              {fmtR$(dados.total)}
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => imprimirRecibo(dados)}
          >
            <Printer size={14} /> Imprimir Recibo
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            <CheckCircle2 size={14} /> Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════ */
export default function Mesas() {
  const { user, cargo, tenantUid, nomeUsuario } = useContext(AuthContext);
  const uid = tenantUid;

  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState({});  // { mesaId: comanda }
  const [produtos, setProdutos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [taxas, setTaxas] = useState(TAXAS_DEFAULT);
  const [vendaIdCnt, setVendaIdCnt] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mesaModal, setMesaModal] = useState(null);      // mesa selecionada
  const [configModal, setConfigModal] = useState(false);
  const [reciboModal, setReciboModal] = useState(null);

  const podeCfg = cargo === "admin";
  const podeAbrirFechar = podeOperar(cargo);

  /* ── Firestore listeners ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const userRef = doc(db, "users", uid);
    const mesasCol = collection(db, "users", uid, "mesas");
    const comandasCol = collection(db, "users", uid, "comandas");
    const produtosCol = collection(db, "users", uid, "produtos");
    const servicosCol = collection(db, "users", uid, "servicos");

    const u1 = onSnapshot(userRef, snap => {
      if (snap.exists()) setVendaIdCnt(snap.data().vendaIdCnt || 0);
    });

    const u2 = onSnapshot(mesasCol, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      setMesas(arr);
      setLoading(false);
    });

    const u3 = onSnapshot(comandasCol, snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setComandas(map);
    });

    const u4 = onSnapshot(produtosCol, snap =>
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const u5 = onSnapshot(servicosCol, snap =>
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    getDoc(doc(db, "users", uid, "config", "geral")).then(snap => {
      if (snap.exists() && snap.data().taxas) {
        setTaxas(prev => ({ ...TAXAS_DEFAULT, ...snap.data().taxas }));
      }
    }).catch(() => {});

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [uid]);

  /* ── Stats ── */
  const { mesasOcupadas, mesasLivres } = useMemo(() => {
    const ocupadas = mesas.filter(m => !!comandas[m.id]).length;
    return { mesasOcupadas: ocupadas, mesasLivres: mesas.length - ocupadas };
  }, [mesas, comandas]);

  /* ── Callback após fechar mesa ── */
  const handleVendaSalva = useCallback((dados) => {
    if (dados) setReciboModal(dados);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--text-3)", fontSize: 14 }}>
        Carregando mesas...
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div id="mesas-recibo-root" />

      <div className="mesas-page">

        {/* HEADER */}
        <div className="mesas-header">
          <div>
            <div className="mesas-title">
              <UtensilsCrossed size={22} color="var(--gold)" />
              Mesas
            </div>
            <div className="mesas-subtitle">
              {mesas.length > 0
                ? `${mesasOcupadas} ocupada(s) · ${mesasLivres} livre(s) · ${mesas.length} total`
                : "Nenhuma mesa cadastrada"}
            </div>
          </div>

          <div className="mesas-actions">
            {!podeAbrirFechar && (
              <span className="sem-perm-badge">
                🔒 Sem permissão para operar mesas
              </span>
            )}
            {podeCfg && (
              <button className="btn-secondary" onClick={() => setConfigModal(true)}>
                <Settings size={14} /> Configurar Mesas
              </button>
            )}
          </div>
        </div>

        {/* LEGENDA */}
        {mesas.length > 0 && (
          <div className="mesas-legenda">
            <div className="legenda-item">
              <div className="legenda-dot livre" />
              Livre
            </div>
            <div className="legenda-item">
              <div className="legenda-dot ocupada" />
              Ocupada
            </div>
          </div>
        )}

        {/* GRID */}
        {mesas.length === 0 ? (
          <div className="mesa-empty">
            <UtensilsCrossed size={40} strokeWidth={1.2} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
                Nenhuma mesa cadastrada
              </div>
              {podeCfg
                ? <div>Clique em <strong>"Configurar Mesas"</strong> para adicionar.</div>
                : <div>Solicite ao administrador que configure as mesas.</div>
              }
            </div>
          </div>
        ) : (
          <div className="mesas-grid">
            {mesas.map(mesa => {
              const comanda = comandas[mesa.id];
              const ocupada = !!comanda;
              return (
                <div
                  key={mesa.id}
                  className={`mesa-card ${ocupada ? "ocupada" : ""}`}
                  onClick={() => podeAbrirFechar && setMesaModal({ mesa, comanda: comanda || null })}
                  style={!podeAbrirFechar ? { cursor: "default", opacity: 0.7 } : {}}
                >
                  <div className="mesa-numero">{mesa.numero}</div>
                  <div className={`mesa-status-badge ${ocupada ? "badge-ocupada" : "badge-livre"}`}>
                    {ocupada ? "Ocupada" : "Livre"}
                  </div>
                  {ocupada && comanda ? (
                    <>
                      {comanda.clienteNome && (
                        <div className="mesa-info">{comanda.clienteNome}</div>
                      )}
                      <div className="mesa-hora">
                        <Clock size={10} />
                        {fmtHora(comanda.abertaEm)}
                      </div>
                      <div className="mesa-total">{fmtR$(comanda.total || 0)}</div>
                      <div className="mesa-info">
                        {(comanda.itens?.length || 0)} item(s)
                      </div>
                    </>
                  ) : (
                    <div className="mesa-info" style={{ fontSize: 10, marginTop: 4 }}>
                      {mesa.nome || `Capacidade ${mesa.capacidade || 4}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL COMANDA */}
      {mesaModal && (
        <ModalMesa
          mesa={mesaModal.mesa}
          comanda={mesaModal.comanda}
          produtos={produtos}
          servicos={servicos}
          taxas={taxas}
          uid={uid}
          vendaIdCnt={vendaIdCnt}
          cargo={cargo}
          nomeUsuario={nomeUsuario}
          onClose={() => setMesaModal(null)}
          onVendaSalva={handleVendaSalva}
        />
      )}

      {/* MODAL CONFIG */}
      {configModal && (
        <ModalConfigMesas
          uid={uid}
          mesas={mesas}
          onClose={() => setConfigModal(false)}
        />
      )}

      {/* MODAL RECIBO */}
      {reciboModal && (
        <ModalRecibo
          dados={reciboModal}
          onClose={() => setReciboModal(null)}
        />
      )}
    </>
  );
}
