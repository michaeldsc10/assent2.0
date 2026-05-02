/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Mesas.jsx
   Módulo de Mesas / Comandas para restaurantes

   Estrutura Firestore:
     users/{uid}/mesas/{id}         → configuração de cada mesa
     users/{uid}/comandas/{id}      → comanda ativa de uma mesa
     users/{uid}/vendas/{id}        → venda gerada ao fechar mesa
     users/{uid}/config/geral       → taxas de pagamento

   Permissões: admin, comercial, vendedor podem abrir/fechar mesas

   [v2.1] Ticket de Cozinha:
     - Gerado a cada "Salvar" da comanda
     - Imprime apenas itens NOVOS ou quantidades aumentadas (delta)
     - Impressão via Web Bluetooth (impressora térmica BT, Chrome/Android)
     - Fallback automático para window.print() (impressora WiFi/USB)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import {
  Plus, X, Trash2, UtensilsCrossed, CheckCircle2,
  ChevronDown, Edit3, Printer, Settings, Search,
  Clock, User, DollarSign, ShoppingBag, LayoutGrid,
  Bluetooth, BluetoothConnected, BluetoothOff, QrCode, Copy,
} from "lucide-react";

import AuthContext from "../contexts/AuthContext";
import { logAction, LOG_ACAO, LOG_MODULO } from "../lib/logAction";
import { db, auth } from "../lib/firebase";
import { fsError, fsSnapshotError } from "../utils/firestoreError";
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
   UTILITÁRIOS ESC/POS
───────────────────────────────────────────────────── */

/** Remove acentos para compatibilidade com impressoras térmicas básicas */
function removerAcentos(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Centraliza texto em largura fixa (padrão 32 colunas para 58mm / 48 para 80mm) */
function centrar(texto, cols = 32) {
  const t = removerAcentos(String(texto));
  if (t.length >= cols) return t.slice(0, cols);
  const pad = Math.floor((cols - t.length) / 2);
  return " ".repeat(pad) + t;
}

/** Linha com texto à esquerda e direita (32 colunas) */
function linhaDupla(esq, dir, cols = 32) {
  const e = removerAcentos(String(esq));
  const d = removerAcentos(String(dir));
  const espaco = cols - e.length - d.length;
  if (espaco <= 0) return (e + " " + d).slice(0, cols);
  return e + " ".repeat(espaco) + d;
}

/**
 * Gera array de bytes ESC/POS para o ticket de cozinha.
 * Compatível com a maioria das impressoras térmicas BT (XPrinter, Elgin, Bematech, etc.)
 */
function gerarESCPOS({ mesa, itens, clienteNome, isAdicional = false, horario }) {
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;

  const bytes = [];

  const add = (...b) => bytes.push(...b);
  const txt = (s) => {
    const clean = removerAcentos(s);
    for (let i = 0; i < clean.length; i++) bytes.push(clean.charCodeAt(i) & 0xFF);
  };
  const nl  = (n = 1) => { for (let i = 0; i < n; i++) bytes.push(LF); };

  // Inicializar
  add(ESC, 0x40);

  // Código de página Latin-1 (para acentos em printers que suportam)
  add(ESC, 0x74, 0x13);

  // === CABEÇALHO ===
  // Tamanho duplo + bold + centralizado
  add(ESC, 0x61, 0x01);         // centro
  add(ESC, 0x21, 0x30);         // duplo H+W
  add(ESC, 0x45, 0x01);         // bold on
  txt(isAdicional ? "*** ADICIONAL ***" : "*** COZINHA ***");
  nl();
  add(ESC, 0x21, 0x00);         // normal
  add(ESC, 0x45, 0x00);         // bold off

  // Mesa grande
  add(ESC, 0x21, 0x10);         // duplo height
  add(ESC, 0x45, 0x01);
  txt(`MESA ${mesa}`);
  nl();
  add(ESC, 0x21, 0x00);
  add(ESC, 0x45, 0x00);

  // Hora
  txt(horario || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  nl();

  if (clienteNome) {
    txt(`Cliente: ${clienteNome}`);
    nl();
  }

  // Separador
  add(ESC, 0x61, 0x00);         // alinha esquerda
  txt("--------------------------------");
  nl();

  // === ITENS ===
  add(ESC, 0x21, 0x10);         // double height para itens
  for (const item of itens) {
    const prefixo = item._adicional ? "[+] " : "";
    const linha = `${prefixo}${item.qtd}x ${item.nome}`;
    // Quebrar linhas longas
    const limpa = removerAcentos(linha);
    if (limpa.length <= 32) {
      txt(limpa);
    } else {
      txt(limpa.slice(0, 32));
      nl();
      txt("    " + limpa.slice(32, 60));
    }
    nl();
  }
  add(ESC, 0x21, 0x00);         // normal

  // Separador final
  txt("--------------------------------");
  nl(2);

  // Corte de papel (full cut)
  add(GS, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

/* ─────────────────────────────────────────────────────
   RECIBO DE VENDA — mesmo modelo de Vendas.jsx
   Assinatura: imprimirRecibo(venda, empresa)
───────────────────────────────────────────────────── */
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
      ? `${p.label} — ${venda.parcelas}x de ${fmtR$(venda.total / venda.parcelas)}`
      : p.label;
    return `
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <span>${label}</span>
        <span style="font-weight:bold;">${fmtR$(p.valor ?? venda.total)}</span>
      </div>`;
  }).join("");

  const logoHtml = empresa?.logo
    ? `<div style="text-align:center;margin-bottom:6px;">
         <img src="${empresa.logo}" alt="Logo" style="max-height:60px;max-width:180px;filter:grayscale(100%);object-fit:contain;" />
       </div>`
    : "";
  const nomeEmpresa = empresa?.nomeEmpresa
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
      ${nomeEmpresa}
      ${cnpjHtml}
      ${enderecoHtml}
      <div style="text-align:center;font-size:11px;margin:6px 0 10px;">Recibo de Consumo</div>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div style="font-size:12px;"><strong>ID:</strong> ${venda.idVenda || venda.id}</div>
      <div style="font-size:12px;"><strong>Data:</strong> ${venda.data ? new Date(venda.data).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")}</div>
      ${venda.mesa ? `<div style="font-size:12px;"><strong>Mesa:</strong> ${venda.mesa}</div>` : ""}
      ${venda.cliente ? `<div style="font-size:12px;"><strong>Cliente:</strong> ${venda.cliente}</div>` : ""}
      ${venda.vendedor ? `<div style="font-size:12px;"><strong>Operador:</strong> ${venda.vendedor}</div>` : ""}

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
            <span style="text-align:right;font-weight:bold;">${fmtR$(totalItem)}</span>
            <span style="font-size:10px;color:#444;grid-column:1/-1;">Unitário: ${fmtR$(i.preco)}</span>
            ${i.desconto > 0 ? `<span style="font-size:10px;color:#444;grid-column:1/-1;">Desconto: -${fmtR$(i.desconto)}</span>` : ""}
          </div>`;
      }).join("")}

      <div style="border-top:1px dashed #000;margin:8px 0;"></div>

      ${descontos > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span>Descontos</span><span>-${fmtR$(descontos)}</span>
        </div>` : ""}
      ${temTaxa ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#444;">
          <span>Taxa cartão (${venda.taxaPercentual}%)</span><span>${fmtR$(venda.valorTaxa)}</span>
        </div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;">
        <span>TOTAL</span><span>${fmtR$(venda.total)}</span>
      </div>

      <div style="border-top:1px dashed #000;margin:8px 0;"></div>

      <div style="font-size:12px;font-weight:bold;margin-bottom:4px;">FORMA DE PAGAMENTO</div>
      ${pgtoLinhas}

      ${venda.observacao ? `
        <div style="border-top:1px dashed #000;margin:8px 0;"></div>
        <div style="font-size:11px;"><strong>Obs:</strong> ${venda.observacao}</div>` : ""}

      <div style="text-align:center;font-size:10px;margin-top:14px;">Obrigado!</div>
    </div>
  `;
  window.print();
}

/* ─────────────────────────────────────────────────────
   TICKET DE COZINHA — fallback window.print
───────────────────────────────────────────────────── */
function imprimirTicketCozinhaFallback({ mesa, itens, clienteNome, isAdicional }) {
  const el = document.getElementById("coz-ticket-root");
  if (!el) return;

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  el.innerHTML = `
    <div class="coz-ticket-print">
      <div class="coz-topo">${isAdicional ? "*** ADICIONAL ***" : "*** COZINHA ***"}</div>
      <div class="coz-mesa">MESA ${mesa}</div>
      <div class="coz-hora">${hora}</div>
      ${clienteNome ? `<div class="coz-cliente">Cliente: ${clienteNome}</div>` : ""}
      <div class="coz-sep">--------------------------------</div>
      <div class="coz-itens">
        ${itens.map(i => `
          <div class="coz-item">
            <span class="coz-qtd">${i._adicional ? "[+] " : ""}${i.qtd}x</span>
            <span class="coz-nome">${i.nome}</span>
          </div>
        `).join("")}
      </div>
      <div class="coz-sep">--------------------------------</div>
    </div>
  `;
  window.print();
}

/* ─────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────── */
const CSS = `
  /* ── Print — Recibo de venda ── */
  @media print {
    body { visibility: hidden !important; }

    /* Recibo de venda */
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

    /* Ticket de cozinha */
    #coz-ticket-root {
      visibility: visible !important; display: block !important;
      position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
    }
    #coz-ticket-root * { visibility: visible !important; }
    .coz-ticket-print {
      font-family: 'Courier New', monospace;
      width: 80mm; margin: 0 auto; padding: 6mm 8mm;
      font-size: 13px; color: #000 !important; background: #fff;
      letter-spacing: 0.02em;
    }
    .coz-ticket-print * { color: #000 !important; }
    .coz-topo {
      text-align: center; font-size: 13px; font-weight: bold;
      margin-bottom: 4px; letter-spacing: 0.06em;
    }
    .coz-mesa {
      text-align: center; font-size: 28px; font-weight: 900;
      line-height: 1.1; margin: 4px 0;
    }
    .coz-hora {
      text-align: center; font-size: 12px; margin-bottom: 2px;
    }
    .coz-cliente {
      text-align: center; font-size: 11px; margin-bottom: 4px;
    }
    .coz-sep {
      font-size: 11px; margin: 6px 0;
    }
    .coz-item {
      display: flex; gap: 8px; font-size: 16px;
      font-weight: bold; margin: 4px 0; line-height: 1.3;
    }
    .coz-qtd { flex-shrink: 0; }
    .coz-nome { flex: 1; }
  }

  #recibo-print-root { display: none; }
  #coz-ticket-root   { display: none; }

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
    flex-wrap: wrap;
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

  /* ── Botão Bluetooth ── */
  .btn-bt {
    padding: 9px 14px; border-radius: 9px; font-size: 12px;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-3); cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    display: flex; align-items: center; gap: 6px;
    transition: all .15s; white-space: nowrap;
  }
  .btn-bt:hover { background: var(--s2); border-color: var(--border-h); color: var(--text-2); }
  .btn-bt.bt-conectado {
    background: rgba(94,203,138,.08);
    border-color: rgba(94,203,138,.35);
    color: #5ecb8a;
  }
  .btn-bt.bt-conectando {
    background: rgba(200,165,94,.08);
    border-color: rgba(200,165,94,.35);
    color: var(--gold);
    animation: btPulse 1s ease-in-out infinite;
  }
  @keyframes btPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .btn-bt:disabled { opacity: .45; cursor: not-allowed; }

  /* ── Banner de status da impressora ── */
  .printer-banner {
    margin-bottom: 14px; padding: 9px 14px; border-radius: 9px;
    font-size: 12px; display: flex; align-items: center; gap: 8px;
    border: 1px solid;
  }
  .printer-banner.conectada {
    background: rgba(94,203,138,.07);
    border-color: rgba(94,203,138,.25);
    color: #5ecb8a;
  }
  .printer-banner.desconectada {
    background: rgba(200,165,94,.06);
    border-color: rgba(200,165,94,.2);
    color: var(--text-3);
  }

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
    border-radius: 12px; margin-bottom: 14px;
  }
  .cmd-items-header {
    display: flex; align-items: center;
    padding: 8px 12px; background: var(--s3);
    border-bottom: 1px solid var(--border); gap: 8px;
    border-radius: 12px 12px 0 0;
  }
  .cmd-items-header span {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .cmd-h-item   { flex: 1; }
  .cmd-h-qtd    { width: 90px; text-align: center; flex-shrink: 0; }
  .cmd-h-total  { width: 90px; text-align: right;  flex-shrink: 0; }
  .cmd-h-del    { width: 28px; flex-shrink: 0; }

  .cmd-item-row {
    display: flex; align-items: center;
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    gap: 8px;
  }
  .cmd-item-row:last-child { border-bottom: none; border-radius: 0 0 12px 12px; }
  .cmd-item-cell-nome { flex: 1; min-width: 0; }
  .cmd-item-nome { font-size: 13px; color: var(--text); font-weight: 500; }
  .cmd-item-sub  { font-size: 11px; color: var(--text-3); margin-top: 1px; }
  .cmd-item-qtd  {
    display: flex; align-items: center; gap: 5px;
    width: 90px; flex-shrink: 0; justify-content: center;
  }
  .cmd-qtd-btn {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--s3);
    color: var(--text-2); font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all .12s; flex-shrink: 0;
  }
  .cmd-qtd-btn:hover { background: var(--s2); border-color: var(--border-h); }
  .cmd-qtd-input {
    width: 34px; background: transparent;
    border: 1px solid var(--border); border-radius: 5px;
    color: var(--text); font-family: 'Sora', sans-serif;
    font-size: 13px; font-weight: 700; text-align: center;
    padding: 2px 0; outline: none; transition: border-color .13s;
    flex-shrink: 0;
  }
  .cmd-qtd-input:focus { border-color: var(--gold); }
  .cmd-qtd-input::-webkit-inner-spin-button,
  .cmd-qtd-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .cmd-qtd-input[type=number] { -moz-appearance: textfield; }
  .cmd-item-total {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text); width: 90px; text-align: right; flex-shrink: 0;
  }
  .cmd-item-remove {
    width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid var(--border); background: var(--s3);
    color: var(--text-2); transition: all .13s; padding: 0;
  }
  .cmd-item-remove:hover { background: var(--red-d); border-color: rgba(224,82,82,.3); }
  .cmd-empty-items {
    padding: 18px; text-align: center;
    font-size: 13px; color: var(--text-3);
    border-radius: 0 0 12px 12px;
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

  /* ── Histórico de cancelamentos ── */
  .hist-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .hist-header {
    display: grid; grid-template-columns: 60px 90px 1fr 1fr 120px;
    padding: 8px 14px; background: var(--s3);
    border-bottom: 1px solid var(--border); gap: 10px;
  }
  .hist-header span {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .hist-row {
    display: grid; grid-template-columns: 60px 90px 1fr 1fr 120px;
    padding: 11px 14px; border-bottom: 1px solid var(--border);
    gap: 10px; align-items: center; font-size: 13px;
    transition: background .1s;
  }
  .hist-row:last-child { border-bottom: none; }
  .hist-row:hover { background: var(--s2); }
  .hist-mesa {
    font-family: 'Sora', sans-serif; font-weight: 700;
    color: var(--gold); font-size: 14px;
  }
  .hist-data { font-size: 11px; color: var(--text-3); }
  .hist-motivo { color: var(--text-2); font-size: 12px; }
  .hist-itens { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hist-badge-cancelado {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); white-space: nowrap;
  }
  .hist-empty {
    padding: 32px; text-align: center;
    font-size: 13px; color: var(--text-3);
  }
  @media (max-width: 640px) {
    .hist-header, .hist-row { grid-template-columns: 48px 80px 1fr; }
    .hist-header span:nth-child(4),
    .hist-header span:nth-child(5),
    .hist-row > *:nth-child(4),
    .hist-row > *:nth-child(5) { display: none; }
  }

  /* ── Responsivo ── */
  @media (max-width: 600px) {
    .mesas-page { padding: 14px; }
    .mesas-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
    .form-row { flex-direction: column; }
    .modal-footer { gap: 8px; }
  }
`;

/* ═══════════════════════════════════════════════════
   HOOK: WEB BLUETOOTH para impressora térmica
   ═══════════════════════════════════════════════════ */

/**
 * UUIDs de serviço/característica comuns em impressoras térmicas Bluetooth.
 * Ordem de tentativa: mais comuns primeiro.
 *
 * Compatível com: XPrinter, Elgin i9, i7, Bematech MP-4200 TH BT,
 * Daruma DR700, e a maioria dos clones chineses.
 */
const BT_SERVICES = [
  {
    service:        "000018f0-0000-1000-8000-00805f9b34fb",
    characteristic: "00002af1-0000-1000-8000-00805f9b34fb",
  },
  {
    service:        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3",
  },
  {
    service:        "0000ff00-0000-1000-8000-00805f9b34fb",
    characteristic: "0000ff02-0000-1000-8000-00805f9b34fb",
  },
];

function useBluetooth() {
  const [btDevice,    setBtDevice]    = useState(null);
  const [btChar,      setBtChar]      = useState(null);
  const [btStatus,    setBtStatus]    = useState("desconectado"); // desconectado | conectando | conectado
  const [btNome,      setBtNome]      = useState("");
  const [btSuportado, setBtSuportado] = useState(false);

  useEffect(() => {
    setBtSuportado(!!navigator.bluetooth);
  }, []);

  const conectar = useCallback(async () => {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth não suportado neste navegador.\nUse Chrome no Android ou Chrome Desktop.");
      return false;
    }

    setBtStatus("conectando");
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_SERVICES.map(s => s.service),
      });

      device.addEventListener("gattserverdisconnected", () => {
        setBtStatus("desconectado");
        setBtChar(null);
        setBtDevice(null);
        setBtNome("");
      });

      const server = await device.gatt.connect();

      // Testar cada service/characteristic até encontrar um que funcione
      let charEncontrado = null;
      for (const pair of BT_SERVICES) {
        try {
          const service = await server.getPrimaryService(pair.service);
          const char    = await service.getCharacteristic(pair.characteristic);
          // Verificar que é gravável
          if (char.properties.write || char.properties.writeWithoutResponse) {
            charEncontrado = char;
            break;
          }
        } catch (_) {
          // Esse serviço não existe nessa impressora — continuar
        }
      }

      if (!charEncontrado) {
        // Fallback: buscar qualquer característica gravável em qualquer serviço
        try {
          const services = await server.getPrimaryServices();
          for (const svc of services) {
            const chars = await svc.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                charEncontrado = c;
                break;
              }
            }
            if (charEncontrado) break;
          }
        } catch (_) {}
      }

      if (!charEncontrado) {
        alert("Impressora conectada mas não foi possível encontrar a característica de escrita.\nVerifique se é uma impressora térmica ESC/POS compatível.");
        setBtStatus("desconectado");
        return false;
      }

      setBtDevice(device);
      setBtChar(charEncontrado);
      setBtNome(device.name || "Impressora BT");
      setBtStatus("conectado");
      return true;

    } catch (err) {
      if (err.name !== "NotFoundError") { // Usuário cancelou — não alertar
        fsError(err, "Mesas:bluetoothConectar");
        alert(`Erro ao conectar à impressora: ${err.message}`);
      }
      setBtStatus("desconectado");
      return false;
    }
  }, []);

  const desconectar = useCallback(() => {
    if (btDevice?.gatt?.connected) {
      btDevice.gatt.disconnect();
    }
    setBtDevice(null);
    setBtChar(null);
    setBtStatus("desconectado");
    setBtNome("");
  }, [btDevice]);

  /**
   * Envia bytes para a impressora em chunks de 512 bytes
   * (limite comum do MTU Bluetooth LE)
   */
  const enviar = useCallback(async (bytes) => {
    if (!btChar) return false;
    try {
      const CHUNK = 512;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const chunk = bytes.slice(i, i + CHUNK);
        if (btChar.properties.writeWithoutResponse) {
          await btChar.writeValueWithoutResponse(chunk);
        } else {
          await btChar.writeValue(chunk);
        }
        // Pequeno delay entre chunks para não saturar o buffer
        if (i + CHUNK < bytes.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
      return true;
    } catch (err) {
      fsError(err, "Mesas:bluetoothEnviar");
      setBtStatus("desconectado");
      setBtChar(null);
      return false;
    }
  }, [btChar]);

  return { btStatus, btNome, btSuportado, conectar, desconectar, enviar };
}

/* ══════════════════════════════════════════════════
   MODAL PIX QR — Geração e polling de pagamento
   ══════════════════════════════════════════════════ */
const CF_BASE = "https://us-central1-assent-2b945.cloudfunctions.net";

function ModalPixQr({ valor, tenantUid, descricao, onClose, onPago }) {
  const [fase, setFase]         = useState("gerando");
  const [qrBase64, setQrBase64] = useState(null);
  const [qrCode,   setQrCode]   = useState(null);
  const [paymentId, setPayId]   = useState(null);
  const [copiado,  setCopiado]  = useState(false);
  const [erroMsg,  setErroMsg]  = useState("");
  const pollingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res   = await fetch(`${CF_BASE}/gerarPixQr`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ tenantUid, valor, descricao }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        if (cancelled) return;
        setQrBase64(data.qrCodeBase64);
        setQrCode(data.qrCode);
        setPayId(data.paymentId);
        setFase("aguardando");
      } catch (err) {
        if (!cancelled) { setErroMsg(err.message); setFase("erro"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (fase !== "aguardando" || !paymentId) return;
    const poll = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res   = await fetch(`${CF_BASE}/consultarPagamento`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ tenantUid, paymentId }),
        });
        const data = await res.json();
        if (data.status === "approved") {
          clearInterval(pollingRef.current);
          setFase("pago");
          // Aguarda 1.5s para o operador ver a confirmação antes de fechar a mesa
          if (onPago) setTimeout(onPago, 1500);
        }
      } catch { /* ignora falha pontual */ }
    };
    pollingRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollingRef.current);
  }, [fase, paymentId]);

  const copiar = () => {
    navigator.clipboard.writeText(qrCode || "");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 360 }}>

        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: "var(--gold)" }}>Pagamento PIX</div>
            <div className="modal-sub">{fmtR$(valor)}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body" style={{ textAlign: "center", padding: "24px 22px" }}>

          {fase === "gerando" && (
            <div style={{ padding: "40px 0", color: "var(--text-2)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              Gerando QR Code...
            </div>
          )}

          {fase === "erro" && (
            <div style={{ padding: "30px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>❌</div>
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 6 }}>Não foi possível gerar o QR Code.</div>
              <div style={{ color: "var(--text-2)", fontSize: 11 }}>{erroMsg || "Verifique se o PIX está ativo nas Configurações."}</div>
            </div>
          )}

          {fase === "pago" && (
            <div style={{ padding: "30px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>Pagamento Confirmado!</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>PIX recebido com sucesso.</div>
            </div>
          )}

          {fase === "aguardando" && qrBase64 && (
            <>
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="QR Code PIX"
                style={{ width: 210, height: 210, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 14 }}
              />
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.4s infinite" }} />
                Aguardando pagamento...
              </div>
              <button
                onClick={copiar}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: copiado ? "rgba(74,222,128,.1)" : "var(--s2)",
                  border: `1px solid ${copiado ? "var(--green)" : "var(--border)"}`,
                  borderRadius: 8, color: copiado ? "var(--green)" : "var(--text)",
                  fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all .2s",
                }}
              >
                <Copy size={12} />
                {copiado ? "Código copiado!" : "Copiar código PIX (copia e cola)"}
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {fase === "pago" ? "Fechar" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   MODAL: COMANDA DA MESA
   ═══════════════════════════════════════════════════ */
function ModalMesa({ mesa, comanda, produtos, servicos, taxas, uid, cargo, nomeUsuario, user, onClose, onVendaSalva }) {
  const isOcupada = !!comanda;

  /* Itens da comanda */
  const [itens, setItens] = useState(comanda?.itens || []);
  const [clienteNome, setClienteNome] = useState(comanda?.clienteNome || "");
  const [formaPgto, setFormaPgto] = useState(comanda?.formaPgto || "Em aberto");
  const [pixQrOpen, setPixQrOpen] = useState(false);
  const [parcelas, setParcelas] = useState(1);
  const [busca, setBusca] = useState("");
  const [showAC, setShowAC] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [confirmFechar, setConfirmFechar] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [cancelando, setCancelando] = useState(false);

  /**
   * Baseline de itens já impressos/salvos.
   * Usado para calcular DELTA a cada "Salvar" — só imprime o que é NOVO.
   */
  const [itensBaseline, setItensBaseline] = useState(comanda?.itens || []);

  /* Bluetooth */
  const { btStatus, btNome, btSuportado, conectar, desconectar, enviar } = useBluetooth();

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

  const setQtdDireta = (idx, val) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    if (n <= 0) { setItens(prev => prev.filter((_, i) => i !== idx)); return; }
    setItens(prev => {
      const novo = [...prev];
      novo[idx] = { ...novo[idx], qtd: n };
      return novo;
    });
  };

  const removerItem = (idx) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  /* ─────────────────────────────────────────────────────
     TICKET DE COZINHA
  ───────────────────────────────────────────────────── */

  /**
   * Calcula o delta entre itens atuais e o baseline (última impressão).
   * Retorna array com:
   *  - Itens completamente novos
   *  - Itens com quantidade aumentada (com campo _adicional: true)
   * Não inclui itens removidos (cozinha já recebeu o pedido).
   */
  const calcularDelta = useCallback((itensAtuais, baseline) => {
    const delta = [];
    for (const item of itensAtuais) {
      const ant = baseline.find(
        a => a.produtoId === item.produtoId && a._tipo === item._tipo
      );
      if (!ant) {
        // Novo item
        delta.push({ ...item });
      } else if (item.qtd > ant.qtd) {
        // Quantidade aumentou
        delta.push({ ...item, qtd: item.qtd - ant.qtd, _adicional: true });
      }
    }
    return delta;
  }, []);

  /**
   * Gera e envia o ticket de cozinha.
   * - Se Bluetooth conectado → envia ESC/POS direto
   * - Senão → abre diálogo de impressão do sistema (window.print)
   */
  const imprimirTicketCozinha = useCallback(async (itensParaImprimir, isAdicional = false) => {
    if (!itensParaImprimir || itensParaImprimir.length === 0) return;

    const dados = {
      mesa: mesa.numero,
      itens: itensParaImprimir,
      clienteNome: clienteNome.trim(),
      isAdicional,
      horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    if (btStatus === "conectado") {
      // Caminho Bluetooth (ESC/POS direto)
      const bytes = gerarESCPOS(dados);
      const ok = await enviar(bytes);
      if (!ok) {
        // BT falhou — tentar fallback
        imprimirTicketCozinhaFallback(dados);
      }
    } else {
      // Fallback: window.print
      imprimirTicketCozinhaFallback(dados);
    }
  }, [mesa.numero, clienteNome, btStatus, enviar]);

  /* Salvar comanda (manter aberta) */
  const salvarComanda = async () => {
    if (itens.length === 0) return; // Nada a salvar
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

      await logAction({
        tenantUid: uid,
        nomeUsuario,
        cargo,
        acao: isOcupada ? "editar" : "criar",
        modulo: "Mesas",
        descricao: isOcupada
          ? `Atualizou comanda — Mesa ${mesa.numero} — ${itens.length} item(s) — R$ ${total.toFixed(2)}`
          : `Abriu Mesa ${mesa.numero} — ${itens.length} item(s) — R$ ${total.toFixed(2)}`,
      });

      /* ── TICKET DE COZINHA ── */
      const delta = calcularDelta(itens, itensBaseline);
      if (delta.length > 0) {
        const isAdicional = itensBaseline.length > 0;
        await imprimirTicketCozinha(delta, isAdicional);
        // Atualizar baseline para próximo save
        setItensBaseline([...itens]);
      }

    } catch (err) {
      fsError(err, "Mesas:salvarComanda");
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

      const payload = {
        cliente: clienteNome.trim() || `Mesa ${mesa.numero}`,
        data: new Date(),
        vendedor: nomeUsuario || user?.displayName || user?.email || "—",
        vendedorCargo: cargo,
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

      /* ── ID gerado DENTRO da transação — leitura atômica do contador ──
         Nunca usar o prop/estado React (pode estar desatualizado).
         O loop anti-colisão garante que mesmo que outro módulo tenha
         corrompido o contador, não sobrescrevemos nenhuma venda existente. */
      let novoId;
      await runTransaction(db, async (tx) => {
        /* 1. Ler contador atual direto do Firestore */
        const userSnap = await tx.get(doc(db, "users", uid));
        let currentCnt = userSnap.data()?.vendaIdCnt || 0;

        /* 2. Anti-colisão: avança até encontrar ID livre */
        let vendaRef;
        let vendaSnap;
        let tentativas = 0;
        do {
          novoId   = `V${String(currentCnt + 1).padStart(4, "0")}`;
          vendaRef = doc(db, "users", uid, "vendas", novoId);
          vendaSnap = await tx.get(vendaRef);
          if (vendaSnap.exists()) currentCnt++;
          tentativas++;
          if (tentativas > 200) throw new Error("Não foi possível gerar ID de venda.");
        } while (vendaSnap.exists());

        /* 3. Descontar estoque de produtos */
        for (const item of itens) {
          if (item.produtoId && item._tipo === "produto") {
            const ref = doc(db, "users", uid, "produtos", item.produtoId);
            tx.update(ref, { estoque: increment(-(item.qtd || 1)) });
          }
        }
        /* 4. Criar venda no slot livre */
        tx.set(vendaRef, payload);
        /* 5. Atualizar contador corretamente (corrige possível corrupção) */
        tx.set(doc(db, "users", uid), { vendaIdCnt: currentCnt + 1 }, { merge: true });
        /* 6. Remover comanda */
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
        fsError(err, "Mesas:lancarCaixa");
      }

      await logAction({ tenantUid: uid, nomeUsuario, cargo, acao: "criar", modulo: "Mesas", descricao: `Fechou Mesa ${mesa.numero} — Venda ${novoId} — R$ ${total.toFixed(2)}` });
      onVendaSalva({
        id:             novoId,
        idVenda:        novoId,
        mesa:           mesa.numero,
        itens,
        formaPagamento: payload.formaPagamento,
        formaPgto:      payload.formaPagamento,
        pagamentos:     [{ label: payload.formaPagamento, valor: total }],
        cliente:        payload.cliente,
        total,
        taxaPercentual: taxaInfo.perc,
        taxaPerc:       taxaInfo.perc,
        valorTaxa:      taxaInfo.valor,
        parcelas:       formaPgto === "Cartão de Crédito" ? parcelas : 1,
      });
      onClose();
    } catch (err) {
      fsError(err, "Mesas:fecharMesa");
      alert("Erro ao fechar mesa. Tente novamente.");
    }
    setFechando(false);
  };

  const podeFechar = podeOperar(cargo);

  /* Cancelar comanda (cliente desistiu) */
  const cancelarComanda = async () => {
    if (!motivoCancelamento.trim()) return;
    setCancelando(true);
    try {
      const cmdRef = doc(db, "users", uid, "comandas", mesa.id);
      const payload = {
        cliente: clienteNome.trim() || `Mesa ${mesa.numero}`,
        data: new Date(),
        vendedor: nomeUsuario || user?.displayName || user?.email || "—",
        vendedorCargo: cargo,
        formaPagamento: "Cancelado",
        observacao: `Mesa ${mesa.numero} — Cancelado: ${motivoCancelamento.trim()}`,
        tipo: "produto",
        total: 0,
        subtotal,
        descontos: subtotal,
        custoTotal: 0,
        lucroEstimado: 0,
        parcelas: null,
        taxaPercentual: 0,
        valorTaxa: 0,
        valorPago: 0,
        valorRestante: 0,
        status: "cancelada",
        statusPagamento: "cancelado",
        valorRecebido: 0,
        origem: "mesa",
        mesaNumero: mesa.numero,
        motivoCancelamento: motivoCancelamento.trim(),
        canceladaEm: new Date().toISOString(),
        canceladaPor: { uid: user?.uid, nome: nomeUsuario || user?.displayName || user?.email || "—", cargo },
        canceladoEm: new Date().toISOString(),
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

      /* ── ID gerado DENTRO da transação — mesma lógica anti-colisão do fecharMesa ── */
      let novoId;
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(doc(db, "users", uid));
        let currentCnt = userSnap.data()?.vendaIdCnt || 0;

        let vendaRef;
        let vendaSnap;
        let tentativas = 0;
        do {
          novoId    = `V${String(currentCnt + 1).padStart(4, "0")}`;
          vendaRef  = doc(db, "users", uid, "vendas", novoId);
          vendaSnap = await tx.get(vendaRef);
          if (vendaSnap.exists()) currentCnt++;
          tentativas++;
          if (tentativas > 200) throw new Error("Não foi possível gerar ID de venda.");
        } while (vendaSnap.exists());

        tx.set(vendaRef, payload);
        tx.set(doc(db, "users", uid), { vendaIdCnt: currentCnt + 1 }, { merge: true });
        tx.delete(cmdRef);
      });

      await logAction({
        tenantUid: uid,
        nomeUsuario,
        cargo,
        acao: "excluir",
        modulo: "Mesas",
        descricao: `Cancelou comanda — Mesa ${mesa.numero} — Motivo: ${motivoCancelamento.trim()}`,
      });
      onVendaSalva(null);
      onClose();
    } catch (err) {
      fsError(err, "Mesas:cancelarComanda");
      alert("Erro ao cancelar. Tente novamente.");
    }
    setCancelando(false);
  };

  /* ── Labels do botão Bluetooth ── */
  const btLabel = btStatus === "conectado"
    ? (btNome || "Impressora")
    : btStatus === "conectando"
    ? "Conectando..."
    : "Impressora BT";

  const BtIcon = btStatus === "conectado" ? BluetoothConnected
    : btStatus === "conectando" ? Bluetooth
    : BluetoothOff;

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

          {/* Banner status impressora */}
          {btStatus === "conectado" ? (
            <div className="printer-banner conectada">
              <BluetoothConnected size={14} />
              <span>Impressora conectada: <strong>{btNome}</strong> — ticket enviado automaticamente ao salvar</span>
              <button
                onClick={desconectar}
                style={{ marginLeft: "auto", fontSize: 11, color: "inherit", background: "none", border: "none", cursor: "pointer", opacity: 0.7, textDecoration: "underline" }}
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div className="printer-banner desconectada">
              <Printer size={14} />
              <span>
                {btSuportado
                  ? "Sem impressora BT — ao salvar, abrirá diálogo de impressão do sistema"
                  : "Impressão via diálogo do sistema (Chrome Android recomendado para BT)"}
              </span>
            </div>
          )}

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
              <span className="cmd-h-item">Item</span>
              <span className="cmd-h-qtd">Qtd</span>
              <span className="cmd-h-total">Total</span>
              <span className="cmd-h-del"></span>
            </div>
            {itens.length === 0
              ? <div className="cmd-empty-items">Nenhum item adicionado</div>
              : itens.map((item, idx) => (
                  <div key={idx} className="cmd-item-row">
                    <div className="cmd-item-cell-nome">
                      <div className="cmd-item-nome">{item.nome}</div>
                      <div className="cmd-item-sub">{fmtR$(item.preco)} /un</div>
                    </div>
                    <div className="cmd-item-qtd">
                      <button className="cmd-qtd-btn" onClick={() => alterarQtd(idx, -1)}>−</button>
                      <input
                        type="number"
                        className="cmd-qtd-input"
                        value={item.qtd}
                        min={1}
                        onChange={e => setQtdDireta(idx, e.target.value)}
                      />
                      <button className="cmd-qtd-btn" onClick={() => alterarQtd(idx, +1)}>+</button>
                    </div>
                    <div className="cmd-item-total">{fmtR$((item.preco || 0) * (item.qtd || 1))}</div>
                    <button className="cmd-item-remove" onClick={() => removerItem(idx)}>
                      <X size={13} color="var(--text-2)" />
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

          {/* Botão impressora Bluetooth — lado esquerdo */}
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            {btSuportado && (
              <button
                className={`btn-bt ${btStatus === "conectado" ? "bt-conectado" : btStatus === "conectando" ? "bt-conectando" : ""}`}
                onClick={btStatus === "conectado" ? desconectar : conectar}
                disabled={btStatus === "conectando"}
                title={btStatus === "conectado" ? "Clique para desconectar" : "Conectar impressora Bluetooth"}
              >
                <BtIcon size={13} />
                {btLabel}
              </button>
            )}
          </div>

          <button className="btn-secondary" onClick={onClose}>Fechar</button>

          {/* PIX QR — aparece quando forma de pagamento é PIX e há itens */}
          {formaPgto === "Pix" && itens.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setPixQrOpen(true)}
              title="Gerar QR Code PIX para o cliente"
              style={{ color: "var(--green)", borderColor: "var(--green)" }}
            >
              <QrCode size={13} /> Gerar PIX
            </button>
          )}

          {/* Cancelar comanda — cliente desistiu */}
          {isOcupada && (
            <button className="btn-danger" onClick={() => setConfirmCancelar(true)}>
              <X size={14} /> Cancelar Comanda
            </button>
          )}

          {/* Salvar comanda aberta + imprimir ticket cozinha */}
          {(itens.length > 0 || isOcupada) && podeFechar && (
            <button className="btn-secondary" onClick={salvarComanda} disabled={salvando}>
              {salvando ? "Salvando..." : <><Printer size={13} /> Salvar + Cozinha</>}
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

      {/* ── Modal cancelamento de comanda ── */}
      {confirmCancelar && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-box modal-box-sm">
            <div className="modal-header">
              <div>
                <div className="modal-title">Cancelar Comanda — Mesa {mesa.numero}</div>
                <div className="modal-sub">O cliente desistiu — registrar histórico</div>
              </div>
              <button className="modal-close" onClick={() => { setConfirmCancelar(false); setMotivoCancelamento(""); }}>
                <X size={14} color="var(--text-2)" />
              </button>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🚫</div>
              <p style={{ fontSize: 13, color: "var(--text-2)", textAlign: "center", marginBottom: 16, lineHeight: 1.6 }}>
                A comanda será cancelada e um histórico será salvo em{" "}
                <strong style={{ color: "var(--text)" }}>Vendas Canceladas</strong>{" "}
                com origem <em>Mesa {mesa.numero}</em>.
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">
                  Motivo do cancelamento <span className="form-label-req">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Ex: cliente desistiu, saiu sem consumir..."
                  value={motivoCancelamento}
                  onChange={e => setMotivoCancelamento(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && motivoCancelamento.trim() && cancelarComanda()}
                />
              </div>
              {itens.length > 0 && (
                <div style={{
                  padding: "10px 13px", borderRadius: 9,
                  background: "var(--s3)", border: "1px solid var(--border)",
                  fontSize: 12, color: "var(--text-2)",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span>{itens.length} item(s) registrado(s)</span>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtR$(subtotal)}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => { setConfirmCancelar(false); setMotivoCancelamento(""); }}
              >
                Voltar
              </button>
              <button
                className="btn-danger"
                onClick={cancelarComanda}
                disabled={cancelando || !motivoCancelamento.trim()}
              >
                {cancelando ? "Cancelando..." : <><X size={14} /> Confirmar Cancelamento</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {pixQrOpen && (
        <ModalPixQr
          valor={total}
          tenantUid={uid}
          descricao={`Mesa ${mesa.numero}${clienteNome ? ` — ${clienteNome}` : ""}`}
          onClose={() => setPixQrOpen(false)}
          onPago={() => {
            setPixQrOpen(false);
            fecharMesa();
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: CONFIGURAR MESAS
   ═══════════════════════════════════════════════════ */
function ModalConfigMesas({ uid, mesas, onClose, nomeUsuario, cargo }) {
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

      await logAction({
        tenantUid: uid,
        nomeUsuario,
        cargo,
        acao: "editar",
        modulo: "Mesas",
        descricao: `Configurou mesas: ${n} mesa(s)`,
      });
      onClose();
    } catch (err) {
      fsError(err, "Mesas:configurar");
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
function ModalRecibo({ dados, empresa, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">✅ Mesa {dados.mesa} fechada</div>
            <div className="modal-sub">Venda {dados.idVenda || dados.id} gerada com sucesso</div>
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
            onClick={() => imprimirRecibo(dados, empresa)}
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

  /* ── Nome real do admin (licencas/{tenantUid}/name) ──
     Mesma lógica de Vendas.jsx: o AuthContext expõe o email do Firebase Auth
     como displayName para admins — buscamos o nome correto no Firestore. */
  const [adminNome, setAdminNome] = useState("");
  useEffect(() => {
    if (cargo !== "admin" || !tenantUid) return;
    getDoc(doc(db, "licencas", tenantUid))
      .then(snap => { if (snap.exists() && snap.data().name) setAdminNome(snap.data().name); })
      .catch(() => {});
  }, [cargo, tenantUid]);

  /* Nome efetivo do operador logado — admin usa adminNome, demais usam nomeUsuario */
  const nomeEfetivo = cargo === "admin"
    ? (adminNome || nomeUsuario || "")
    : (nomeUsuario || "");

  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState({});  // { mesaId: comanda }
  const [produtos, setProdutos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [taxas, setTaxas] = useState(TAXAS_DEFAULT);
  const [configEmpresa, setConfigEmpresa] = useState({});
  const [loading, setLoading] = useState(true);

  const [mesaModal, setMesaModal] = useState(null);      // mesa selecionada
  const [configModal, setConfigModal] = useState(false);
  const [reciboModal, setReciboModal] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("mesas");     // "mesas" | "historico"
  const [historico, setHistorico] = useState([]);

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

    const u1 = onSnapshot(userRef, (_snap) => {
      /* Listener mantido para manter a conexão com o doc do usuário ativa,
         mas o vendaIdCnt não é mais lido do estado React — sempre lemos
         direto do Firestore dentro das transações. */
    }, fsSnapshotError("Mesas:userRef"));

    const u2 = onSnapshot(mesasCol, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      setMesas(arr);
      setLoading(false);
    }, fsSnapshotError("Mesas:mesas"));

    const u3 = onSnapshot(comandasCol, snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setComandas(map);
    }, fsSnapshotError("Mesas:comandas"));

    const u4 = onSnapshot(produtosCol, snap =>
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    fsSnapshotError("Mesas:produtos"));

    const u5 = onSnapshot(servicosCol, snap =>
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    fsSnapshotError("Mesas:servicos"));

    /* Histórico de cancelamentos de mesa */
    const vendasCol = collection(db, "users", uid, "vendas");
    const qCanceladas = query(vendasCol, where("origem", "==", "mesa"), where("statusPagamento", "==", "cancelado"));
    const u6 = onSnapshot(qCanceladas, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
      setHistorico(arr);
    }, fsSnapshotError("Mesas:historico"));

    getDoc(doc(db, "users", uid, "config", "geral")).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.taxas) setTaxas(prev => ({ ...TAXAS_DEFAULT, ...d.taxas }));
        if (d.empresa) setConfigEmpresa(d.empresa);
      }
    }).catch(() => {});

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
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
      {/* Roots de impressão (invisíveis na tela) */}
      <div id="recibo-print-root" />
      <div id="coz-ticket-root" />

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

        {/* ABAS */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="mesas-tabs">
            <button
              className={`mesas-tab ${abaAtiva === "mesas" ? "active" : ""}`}
              onClick={() => setAbaAtiva("mesas")}
            >
              <LayoutGrid size={14} /> Mesas
              {mesasOcupadas > 0 && <span className="count-badge">{mesasOcupadas}</span>}
            </button>
            <button
              className={`mesas-tab ${abaAtiva === "historico" ? "active" : ""}`}
              onClick={() => setAbaAtiva("historico")}
            >
              <Clock size={14} /> Histórico
            </button>
          </div>
        </div>

        {abaAtiva === "mesas" ? (
          <>
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
          </>
        ) : (
          /* ── ABA HISTÓRICO ── */
          <div>
            <div style={{ marginBottom: 14, fontSize: 13, color: "var(--text-3)" }}>
              Comandas canceladas geradas por este módulo — com motivo registrado.
            </div>

            {historico.length === 0 ? (
              <div className="hist-empty">
                <div style={{ fontSize: 28, marginBottom: 8 }}>🕓</div>
                Nenhum cancelamento registrado ainda.
              </div>
            ) : (
              <div className="hist-wrap">
                <div className="hist-header">
                  <span>Mesa</span>
                  <span>Data</span>
                  <span>Motivo</span>
                  <span>Itens</span>
                  <span>Status</span>
                </div>
                {historico.map(v => (
                  <div key={v.id} className="hist-row">
                    <div className="hist-mesa">{v.mesaNumero ?? "—"}</div>
                    <div className="hist-data">{fmtDataHora(v.canceladoEm || v.criadoEm)}</div>
                    <div className="hist-motivo">{v.motivoCancelamento || v.observacao || "—"}</div>
                    <div className="hist-itens">
                      {v.itens?.length
                        ? v.itens.map(i => `${i.qtd}x ${i.nome}`).join(", ")
                        : "Sem itens"}
                    </div>
                    <div><span className="hist-badge-cancelado">Cancelado</span></div>
                  </div>
                ))}
              </div>
            )}
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
          cargo={cargo}
          nomeUsuario={nomeEfetivo}
          user={user}
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
          nomeUsuario={nomeUsuario}
          cargo={cargo}
        />
      )}

      {/* MODAL RECIBO */}
      {reciboModal && (
        <ModalRecibo
          dados={reciboModal}
          empresa={configEmpresa}
          onClose={() => setReciboModal(null)}
        />
      )}
    </>
  );
}
