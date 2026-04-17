/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Relatorios.jsx
   Módulo completo de Relatórios Profissionais
   ─────────────────────────────────────────────────
   DEPENDÊNCIA NECESSÁRIA:
     npm install xlsx
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

import {
  BarChart2, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Package, Users, Calendar, FileText,
  Download, Printer, AlertCircle, Loader2,
  ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Receipt, Wallet, LayoutDashboard,
} from "lucide-react";

import { db, auth, onAuthStateChanged } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

import FiltroPeriodo, { getIntervalo, dentroDoIntervalo } from "./FiltroPeriodo";
import CardResumo from "./CardResumo";
import TabelaRelatorio from "./TabelaRelatorio";

/* ══════════════════════════════════════════════════════
   CSS GLOBAL DO MÓDULO
   ══════════════════════════════════════════════════════ */
const CSS = `
/* ── Layout principal ── */
.rel-root {
  display: flex; flex-direction: column;
  height: 100%; min-height: 0; overflow: hidden;
}
.rel-topbar {
  padding: 14px 22px;
  background: var(--s1); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-shrink: 0;
}
.rel-topbar-left { display: flex; align-items: center; gap: 14px; }
.rel-topbar-title h1 {
  font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
  color: var(--text);
}
.rel-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

.rel-actions { display: flex; align-items: center; gap: 8px; }

.rel-body {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}

/* ── Sidebar de navegação interna ── */
.rel-nav {
  width: 192px; flex-shrink: 0;
  background: var(--s1); border-right: 1px solid var(--border);
  padding: 14px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
}
.rel-nav-label {
  font-size: 9px; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-3);
  padding: 10px 10px 6px;
}
.rel-nav-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 10px; border-radius: 8px;
  background: transparent; border: none;
  color: var(--text-2); cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 500;
  width: 100%; text-align: left;
  transition: all .13s;
}
.rel-nav-btn:hover { background: var(--s2); color: var(--text); }
.rel-nav-btn.active {
  background: rgba(200,165,94,0.12);
  color: var(--gold);
  border: 1px solid rgba(200,165,94,0.18);
}
.rel-nav-btn.active svg { color: var(--gold); }

/* ── Conteúdo principal ── */
.rel-content {
  flex: 1; overflow-y: auto; padding: 22px;
  display: flex; flex-direction: column; gap: 22px;
}
.rel-content::-webkit-scrollbar { width: 3px; }
.rel-content::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

/* ── Filtro de período ── */
.fp-wrap {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 10px;
}
.fp-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-3); flex-shrink: 0;
}
.fp-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.fp-btn {
  padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500;
  background: var(--s3); border: 1px solid var(--border);
  color: var(--text-2); cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all .13s;
}
.fp-btn:hover { background: var(--s2); color: var(--text); }
.fp-btn.active {
  background: rgba(200,165,94,0.15); border-color: var(--gold);
  color: var(--gold);
}
.fp-custom {
  display: flex; align-items: center; gap: 8px;
  margin-left: 4px;
}
.fp-date {
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 10px;
  color: var(--text); font-size: 12px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}
.fp-date:focus { border-color: var(--gold); }
.fp-sep { font-size: 11px; color: var(--text-3); }

/* ── Cards de resumo ── */
.cr-grid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
.cr-card {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px;
  display: flex; align-items: flex-start; gap: 14px;
  transition: border-color .15s;
}
.cr-card:hover { border-color: var(--border-h); }
.cr-icon-wrap {
  width: 38px; height: 38px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cr-body { flex: 1; min-width: 0; }
.cr-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-3); margin-bottom: 6px;
}
.cr-value {
  font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
  line-height: 1.1; margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cr-sub {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-3);
}
.cr-skeleton {
  height: 26px; border-radius: 6px;
  background: linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 4px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

/* ── Tabela ── */
.tr-wrap {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden;
}
.tr-header {
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.tr-title {
  font-family: 'Sora', sans-serif; font-size: 13px;
  font-weight: 600; color: var(--text);
}
.tr-badge {
  font-size: 11px; font-weight: 600;
  background: var(--s3); border: 1px solid var(--border-h);
  color: var(--text-2); padding: 2px 10px; border-radius: 20px;
}
.tr-head {
  display: grid; padding: 9px 18px; gap: 8px;
  background: var(--s2); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-3);
}
.tr-row {
  display: grid; padding: 10px 18px; gap: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 12px; color: var(--text-2);
  align-items: center; transition: background .1s;
}
.tr-row:last-child { border-bottom: none; }
.tr-row:hover { background: rgba(255,255,255,0.02); }
.tr-state {
  padding: 40px; text-align: center;
  font-size: 13px; color: var(--text-3);
}

/* ── DRE específico ── */
.dre-section { margin-bottom: 2px; }
.dre-row {
  display: grid; grid-template-columns: 1fr 130px 90px;
  padding: 10px 18px; gap: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px; color: var(--text-2); align-items: center;
}
.dre-row:hover { background: rgba(255,255,255,0.015); }
.dre-row-cat {
  background: var(--s2);
  font-size: 9px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-3);
  padding: 7px 18px; border-bottom: 1px solid var(--border);
}
.dre-row-result {
  background: rgba(0,0,0,0.18);
  font-weight: 700;
  border-top: 1px solid var(--border-h);
}
.dre-label { color: var(--text); }
.dre-sub-label { color: var(--text-2); padding-left: 14px; }
.dre-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }
.dre-pct {
  font-size: 11px; color: var(--text-3);
  font-family: 'Sora', sans-serif; text-align: right;
}
.dre-positivo { color: var(--green) !important; }
.dre-negativo { color: var(--red) !important; }
.dre-neutro   { color: var(--text-2) !important; }

/* ── Ranking de despesas ── */
.rank-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid var(--border);
}
.rank-item:last-child { border-bottom: none; }
.rank-num {
  font-family: 'Sora', sans-serif; font-size: 11px;
  font-weight: 700; color: var(--gold); width: 20px; flex-shrink: 0;
}
.rank-label { flex: 1; font-size: 13px; color: var(--text); }
.rank-bar-wrap { width: 120px; flex-shrink: 0; }
.rank-bar-bg {
  height: 4px; border-radius: 2px; background: var(--s3);
  overflow: hidden;
}
.rank-bar-fill {
  height: 100%; border-radius: 2px;
  background: var(--gold);
  transition: width .4s ease;
}
.rank-val {
  font-family: 'Sora', sans-serif; font-size: 12px;
  font-weight: 600; color: var(--text); min-width: 90px; text-align: right;
}

/* ── Agenda ── */
.ag-item {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  transition: background .1s;
}
.ag-item:last-child { border-bottom: none; }
.ag-item:hover { background: rgba(255,255,255,0.018); }
.ag-date-box {
  flex-shrink: 0; width: 44px; text-align: center;
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 4px;
}
.ag-date-day {
  font-family: 'Sora', sans-serif; font-size: 18px;
  font-weight: 700; color: var(--text); line-height: 1;
}
.ag-date-mon {
  font-size: 9px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: var(--text-3); margin-top: 2px;
}
.ag-info { flex: 1; min-width: 0; }
.ag-titulo { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
.ag-meta { font-size: 11px; color: var(--text-3); display: flex; gap: 10px; }
.ag-badge {
  font-size: 10px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; text-transform: uppercase; letter-spacing: .05em;
  flex-shrink: 0; align-self: flex-start; margin-top: 2px;
}
.ag-badge-hoje { background: rgba(200,165,94,0.15); color: var(--gold); }
.ag-badge-prox { background: rgba(91,142,240,0.12); color: var(--blue); }
.ag-badge-fut  { background: var(--s3); color: var(--text-2); }

/* ── Botões ── */
.btn-primary {
  padding: 9px 20px; border-radius: 9px;
  background: var(--gold); color: #0a0808;
  border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 7px;
  transition: opacity .13s, transform .1s;
}
.btn-primary:hover  { opacity: .88; }
.btn-primary:active { transform: scale(.97); }

.btn-secondary {
  padding: 8px 16px; border-radius: 9px;
  background: var(--s3); color: var(--text-2);
  border: 1px solid var(--border); cursor: pointer;
  font-family: 'DM Sans', sans-serif; font-size: 13px;
  display: flex; align-items: center; gap: 7px;
  transition: background .13s, color .13s;
}
.btn-secondary:hover { background: var(--s2); color: var(--text); }

/* ── Seções ── */
.rel-section-title {
  font-family: 'Sora', sans-serif; font-size: 14px;
  font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 2px;
}
.rel-section-title svg { color: var(--gold); }
.rel-divider {
  height: 1px; background: var(--border); margin: 4px 0;
}

/* ── Estados ── */
.rel-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; gap: 12px;
  color: var(--text-3); text-align: center;
}
.rel-empty p { font-size: 13px; }
.rel-loading {
  display: flex; align-items: center; justify-content: center;
  padding: 60px; color: var(--text-3); gap: 10px; font-size: 13px;
}

/* ── Saldo positivo/negativo ── */
.val-pos { color: var(--green); font-family: 'Sora', sans-serif; font-weight: 600; }
.val-neg { color: var(--red);   font-family: 'Sora', sans-serif; font-weight: 600; }
.val-neu { color: var(--text);  font-family: 'Sora', sans-serif; font-weight: 600; }

/* ══════════════════════════════════════════
   IMPRESSÃO — @media print
   ══════════════════════════════════════════ */
@media print {
  body { background: #fff !important; color: #111 !important; }

  /* Ocultar tudo exceto o conteúdo do relatório */
  .rel-nav, .rel-topbar, .fp-wrap,
  .rel-actions, .btn-primary, .btn-secondary,
  [data-print-hide] { display: none !important; }

  .rel-body { display: block !important; }
  .rel-content {
    padding: 0 !important; overflow: visible !important;
    gap: 16px;
  }

  .cr-card, .tr-wrap, .dre-wrap {
    background: #fff !important;
    border: 1px solid #ccc !important;
    break-inside: avoid;
  }
  .cr-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }

  .tr-head { background: #f5f5f5 !important; }
  .dre-row-cat { background: #f5f5f5 !important; }
  .dre-row-result { background: #ebebeb !important; }

  * { color: #111 !important; }
  .dre-positivo { color: #1a7a3c !important; }
  .dre-negativo { color: #c0392b !important; }
  .val-pos { color: #1a7a3c !important; }
  .val-neg { color: #c0392b !important; }

  .rel-print-header {
    display: flex !important; justify-content: space-between;
    align-items: flex-end; margin-bottom: 24px;
    padding-bottom: 12px; border-bottom: 2px solid #ccc;
  }
  .rel-print-header h2 {
    font-family: 'Sora', sans-serif; font-size: 20px;
    font-weight: 700; color: #111;
  }
  .rel-print-header p { font-size: 11px; color: #666; margin-top: 3px; }
  .rel-print-brand {
    font-family: 'Sora', sans-serif; font-size: 13px;
    font-weight: 700; color: #111;
  }

  @page { size: A4; margin: 20mm 15mm; }
}
/* Ocultar no print por padrão */
.rel-print-header { display: none; }
`;

/* ══════════════════════════════════════════════════════
   HELPERS GLOBAIS
   ══════════════════════════════════════════════════════ */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtPct = (v) =>
  `${Number(v || 0).toFixed(1)}%`;

const parseDate = (d) => {
  if (!d) return null;
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  } catch { return null; }
};

const fmtData = (d) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString("pt-BR") : "—";
};

const fmtDataCurta = (d) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
};

const MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const getDiasRestantes = (rawDate) => {
  const dt = parseDate(rawDate);
  if (!dt) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.setHours(0,0,0,0) - hoje) / 86400000);
  return diff;
};

/* ══════════════════════════════════════════════════════
   FUNÇÃO: exportar para Excel
   ══════════════════════════════════════════════════════ */
function exportarExcel(nomeRelatorio, sheets) {
  /* sheets: [{ nome: "Planilha", colunas: [str], dados: [[...]] }] */
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ nome, colunas, dados }) => {
    const wsData = [colunas, ...dados];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    /* Largura automática */
    const maxCols = wsData[0]?.length || 0;
    ws["!cols"] = Array.from({ length: maxCols }, (_, i) => ({
      wch: Math.max(
        colunas[i]?.length || 10,
        ...dados.map((r) => String(r[i] || "").length)
      ) + 2,
    }));

    XLSX.utils.book_append_sheet(wb, ws, nome);
  });

  const hoje = new Date();
  const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  XLSX.writeFile(wb, `relatorio-${nomeRelatorio}-${dataStr}.xlsx`);
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: DRE
   ══════════════════════════════════════════════════════ */
function RelatorioDRE({ vendas, despesas, intervalo }) {
  const dados = useMemo(() => {
    const vFiltradas = vendas.filter((v) => dentroDoIntervalo(v.data, intervalo));
    const dFiltradas = despesas.filter((d) => dentroDoIntervalo(d.data, intervalo));

    const receitaBruta = vFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);

    /* Custo dos produtos: campo custo nas vendas ou nas linhas de itens */
    const custoTotal = vFiltradas.reduce((s, v) => {
      if (v.itens?.length) {
        return s + v.itens.reduce((si, it) =>
          si + (Number(it.custo || it.precoCusto || 0) * Number(it.quantidade || 1)), 0);
      }
      return s + Number(v.custo || v.custoTotal || 0);
    }, 0);

    const lucroBruto = receitaBruta - custoTotal;

    const totalDespesas = dFiltradas.reduce((s, d) => s + Number(d.valor || 0), 0);

    const lucroLiquido = lucroBruto - totalDespesas;

    const margem = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    /* Despesas por categoria */
    const porCategoria = {};
    dFiltradas.forEach((d) => {
      const cat = d.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    });

    return {
      receitaBruta, custoTotal, lucroBruto,
      totalDespesas, lucroLiquido, margem,
      qtdeVendas: vFiltradas.length,
      porCategoria,
    };
  }, [vendas, despesas, intervalo]);

  const pct = (v) =>
    dados.receitaBruta > 0
      ? fmtPct((v / dados.receitaBruta) * 100)
      : "0.0%";

  const handleExport = () => {
    exportarExcel("dre", [{
      nome: "DRE",
      colunas: ["Item", "Valor (R$)", "% Receita"],
      dados: [
        ["Receita Bruta (Vendas)", dados.receitaBruta.toFixed(2), pct(dados.receitaBruta)],
        ["(-) Custos de Produtos",  `-${dados.custoTotal.toFixed(2)}`, pct(dados.custoTotal)],
        ["= Lucro Bruto",          dados.lucroBruto.toFixed(2),  pct(dados.lucroBruto)],
        ["(-) Despesas Totais",    `-${dados.totalDespesas.toFixed(2)}`, pct(dados.totalDespesas)],
        ...Object.entries(dados.porCategoria).map(([k, v]) => [`  · ${k}`, `-${v.toFixed(2)}`, pct(v)]),
        ["= Lucro Líquido",        dados.lucroLiquido.toFixed(2), fmtPct(dados.margem)],
      ],
    }]);
  };

  return (
    <div className="dre-wrap">
      {/* KPIs */}
      <div className="cr-grid" style={{ marginBottom: 20 }}>
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Receita Bruta"
          value={fmtR$(dados.receitaBruta)}
          sub={`${dados.qtdeVendas} venda(s)`}
          trend="neutral"
          colorVar="var(--gold)"
        />
        <CardResumo
          icon={<Package size={18} />}
          label="Custos (Produtos)"
          value={fmtR$(dados.custoTotal)}
          sub={pct(dados.custoTotal) + " da receita"}
          trend="down"
          colorVar="var(--text-2)"
        />
        <CardResumo
          icon={<BarChart2 size={18} />}
          label="Lucro Bruto"
          value={fmtR$(dados.lucroBruto)}
          sub={pct(dados.lucroBruto) + " da receita"}
          trend={dados.lucroBruto >= 0 ? "up" : "down"}
          colorVar={dados.lucroBruto >= 0 ? "var(--green)" : "var(--red)"}
        />
        <CardResumo
          icon={<Receipt size={18} />}
          label="Despesas"
          value={fmtR$(dados.totalDespesas)}
          sub={pct(dados.totalDespesas) + " da receita"}
          trend="down"
          colorVar="var(--red)"
        />
        <CardResumo
          icon={<Wallet size={18} />}
          label="Lucro Líquido"
          value={fmtR$(dados.lucroLiquido)}
          sub={`Margem: ${fmtPct(dados.margem)}`}
          trend={dados.lucroLiquido >= 0 ? "up" : "down"}
          colorVar={dados.lucroLiquido >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* Tabela DRE */}
      <div className="tr-wrap">
        <div className="tr-header">
          <span className="tr-title">Demonstração do Resultado do Exercício</span>
          <button className="btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }} onClick={handleExport}>
            <Download size={12} /> Excel
          </button>
        </div>

        {/* Receitas */}
        <div className="dre-row dre-row-cat">RECEITAS</div>
        <div className="dre-row">
          <span className="dre-label">Receita Bruta (Vendas)</span>
          <span className="dre-val dre-positivo">{fmtR$(dados.receitaBruta)}</span>
          <span className="dre-pct">{pct(dados.receitaBruta)}</span>
        </div>

        {/* Custos */}
        <div className="dre-row dre-row-cat">CUSTOS</div>
        <div className="dre-row">
          <span className="dre-sub-label">(-) Custo dos Produtos Vendidos</span>
          <span className="dre-val dre-negativo">- {fmtR$(dados.custoTotal)}</span>
          <span className="dre-pct">{pct(dados.custoTotal)}</span>
        </div>

        {/* Lucro Bruto */}
        <div className={`dre-row dre-row-result`}>
          <span className="dre-label" style={{ fontFamily: "'Sora', sans-serif" }}>= LUCRO BRUTO</span>
          <span className={`dre-val ${dados.lucroBruto >= 0 ? "dre-positivo" : "dre-negativo"}`}>
            {fmtR$(dados.lucroBruto)}
          </span>
          <span className="dre-pct" style={{ fontWeight: 700 }}>{pct(dados.lucroBruto)}</span>
        </div>

        {/* Despesas */}
        <div className="dre-row dre-row-cat">DESPESAS OPERACIONAIS</div>
        {Object.entries(dados.porCategoria).length > 0
          ? Object.entries(dados.porCategoria)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val]) => (
                <div key={cat} className="dre-row">
                  <span className="dre-sub-label">(-) {cat}</span>
                  <span className="dre-val dre-negativo">- {fmtR$(val)}</span>
                  <span className="dre-pct">{pct(val)}</span>
                </div>
              ))
          : <div className="dre-row">
              <span className="dre-sub-label">(-) Despesas Totais</span>
              <span className="dre-val dre-negativo">- {fmtR$(dados.totalDespesas)}</span>
              <span className="dre-pct">{pct(dados.totalDespesas)}</span>
            </div>
        }

        {/* Lucro Líquido */}
        <div className="dre-row dre-row-result">
          <span className="dre-label" style={{ fontFamily: "'Sora', sans-serif" }}>= LUCRO LÍQUIDO</span>
          <span className={`dre-val ${dados.lucroLiquido >= 0 ? "dre-positivo" : "dre-negativo"}`}>
            {fmtR$(dados.lucroLiquido)}
          </span>
          <span
            className="dre-pct"
            style={{
              fontWeight: 700,
              color: dados.lucroLiquido >= 0 ? "var(--green)" : "var(--red)",
            }}
          >
            {fmtPct(dados.margem)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: FINANCEIRO (CAIXA)
   ══════════════════════════════════════════════════════ */
function RelatorioFinanceiro({ caixa, intervalo }) {
  const dados = useMemo(() => {
    const filtrado = caixa.filter((c) => dentroDoIntervalo(c.data, intervalo));
    const entradas = filtrado.filter((c) =>
      (c.tipo || "").toLowerCase().includes("entrada") || Number(c.valor || 0) > 0 && !c.tipo
    );
    const saidas = filtrado.filter((c) =>
      (c.tipo || "").toLowerCase().includes("saida") || (c.tipo || "").toLowerCase().includes("saída")
    );
    const totalEntradas = entradas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalSaidas   = saidas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const saldo = totalEntradas - totalSaidas;

    /* Agrupar por dia para caixa diário */
    const porDia = {};
    filtrado.forEach((c) => {
      const dt = parseDate(c.data);
      if (!dt) return;
      const key = dt.toLocaleDateString("pt-BR");
      if (!porDia[key]) porDia[key] = { data: c.data, entradas: 0, saidas: 0 };
      const isEntrada = (c.tipo || "").toLowerCase().includes("entrada");
      if (isEntrada) porDia[key].entradas += Number(c.valor || 0);
      else            porDia[key].saidas  += Number(c.valor || 0);
    });

    const linhasDiarias = Object.entries(porDia)
      .sort((a, b) => {
        const da = parseDate(porDia[a[0]].data);
        const db2 = parseDate(porDia[b[0]].data);
        return (db2 || 0) - (da || 0);
      })
      .map(([dia, v]) => ({
        dia,
        entradas: v.entradas,
        saidas: v.saidas,
        saldo: v.entradas - v.saidas,
      }));

    return { totalEntradas, totalSaidas, saldo, linhasDiarias, qtde: filtrado.length };
  }, [caixa, intervalo]);

  const handleExport = () => {
    exportarExcel("financeiro", [{
      nome: "Caixa Diário",
      colunas: ["Data", "Entradas (R$)", "Saídas (R$)", "Saldo Dia (R$)"],
      dados: dados.linhasDiarias.map((r) => [
        r.dia,
        r.entradas.toFixed(2),
        r.saidas.toFixed(2),
        r.saldo.toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<ArrowUpRight size={18} />}
          label="Total Entradas"
          value={fmtR$(dados.totalEntradas)}
          sub={`${dados.qtde} movimentações`}
          trend="up" colorVar="var(--green)"
        />
        <CardResumo
          icon={<ArrowDownRight size={18} />}
          label="Total Saídas"
          value={fmtR$(dados.totalSaidas)}
          sub="no período" trend="down" colorVar="var(--red)"
        />
        <CardResumo
          icon={<Wallet size={18} />}
          label="Saldo do Período"
          value={fmtR$(dados.saldo)}
          sub={dados.saldo >= 0 ? "Positivo" : "Negativo"}
          trend={dados.saldo >= 0 ? "up" : "down"}
          colorVar={dados.saldo >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      <TabelaRelatorio
        title="Caixa Diário"
        count={dados.linhasDiarias.length}
        empty="Nenhuma movimentação no período."
        data={dados.linhasDiarias}
        columns={[
          { key: "dia", label: "Data" },
          {
            key: "entradas", label: "Entradas", align: "right",
            render: (v) => <span className="val-pos">{fmtR$(v)}</span>,
          },
          {
            key: "saidas", label: "Saídas", align: "right",
            render: (v) => <span className="val-neg">{fmtR$(v)}</span>,
          },
          {
            key: "saldo", label: "Saldo", align: "right",
            render: (v) => (
              <span className={v >= 0 ? "val-pos" : "val-neg"}>{fmtR$(v)}</span>
            ),
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: DESPESAS
   ══════════════════════════════════════════════════════ */
function RelatorioDespesas({ despesas, intervalo }) {
  const dados = useMemo(() => {
    const filtradas = despesas
      .filter((d) => dentroDoIntervalo(d.data, intervalo))
      .sort((a, b) => {
        const da = parseDate(a.data), db2 = parseDate(b.data);
        return (db2 || 0) - (da || 0);
      });

    const total = filtradas.reduce((s, d) => s + Number(d.valor || 0), 0);

    const porCategoria = {};
    filtradas.forEach((d) => {
      const cat = d.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    });

    const ranking = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({ cat, val }));

    const maxVal = ranking[0]?.val || 1;

    return { filtradas, total, ranking, maxVal };
  }, [despesas, intervalo]);

  const handleExport = () => {
    exportarExcel("despesas", [{
      nome: "Despesas",
      colunas: ["Data", "Descrição", "Categoria", "Valor (R$)"],
      dados: dados.filtradas.map((d) => [
        fmtData(d.data), d.descricao || "—", d.categoria || "—", Number(d.valor || 0).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Receipt size={18} />}
          label="Total de Despesas"
          value={fmtR$(dados.total)}
          sub={`${dados.filtradas.length} registros`}
          trend="down" colorVar="var(--red)"
        />
        <CardResumo
          icon={<BarChart2 size={18} />}
          label="Categorias"
          value={String(dados.ranking.length)}
          sub="categorias distintas" trend="neutral" colorVar="var(--blue)"
        />
        <CardResumo
          icon={<DollarSign size={18} />}
          label="Média por Despesa"
          value={dados.filtradas.length > 0 ? fmtR$(dados.total / dados.filtradas.length) : "R$ 0,00"}
          sub="ticket médio" trend="neutral" colorVar="var(--gold)"
        />
      </div>

      {/* Ranking por categoria */}
      {dados.ranking.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Ranking por Categoria</span>
            <span className="tr-badge">{dados.ranking.length}</span>
          </div>
          {dados.ranking.map((r, i) => (
            <div key={r.cat} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{r.cat}</span>
              <div className="rank-bar-wrap">
                <div className="rank-bar-bg">
                  <div className="rank-bar-fill" style={{ width: `${(r.val / dados.maxVal) * 100}%` }} />
                </div>
              </div>
              <span className="rank-val">{fmtR$(r.val)}</span>
            </div>
          ))}
        </div>
      )}

      <TabelaRelatorio
        title="Lançamentos de Despesas"
        count={dados.filtradas.length}
        empty="Nenhuma despesa no período."
        data={dados.filtradas}
        columns={[
          { key: "data",      label: "Data",      render: (v) => fmtData(v) },
          { key: "descricao", label: "Descrição" },
          { key: "categoria", label: "Categoria" },
          {
            key: "valor", label: "Valor", align: "right",
            render: (v) => <span className="val-neg">{fmtR$(v)}</span>,
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: VENDAS
   ══════════════════════════════════════════════════════ */
function RelatorioVendas({ vendas, intervalo }) {
  const dados = useMemo(() => {
    const filtradas = vendas
      .filter((v) => dentroDoIntervalo(v.data, intervalo))
      .sort((a, b) => {
        const da = parseDate(a.data), db2 = parseDate(b.data);
        return (db2 || 0) - (da || 0);
      });

    const total = filtradas.reduce((s, v) => s + Number(v.total || 0), 0);
    const ticket = filtradas.length > 0 ? total / filtradas.length : 0;

    /* Produtos mais vendidos */
    const prodContagem = {};
    filtradas.forEach((v) => {
      (v.itens || []).forEach((it) => {
        const nome = it.produto || it.nome || "Produto";
        const qtd  = Number(it.quantidade || 1);
        const val  = Number(it.total || it.valorUnitario || 0) * qtd;
        if (!prodContagem[nome]) prodContagem[nome] = { qtd: 0, total: 0 };
        prodContagem[nome].qtd   += qtd;
        prodContagem[nome].total += val;
      });
    });

    const maisPedidos = Object.entries(prodContagem)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .slice(0, 10)
      .map(([nome, v]) => ({ nome, ...v }));

    /* Por forma de pagamento */
    const porFP = {};
    filtradas.forEach((v) => {
      const fp = v.formaPagamento || "Não informado";
      porFP[fp] = (porFP[fp] || 0) + 1;
    });

    return { filtradas, total, ticket, maisPedidos, porFP };
  }, [vendas, intervalo]);

  const handleExport = () => {
    exportarExcel("vendas", [
      {
        nome: "Vendas",
        colunas: ["ID", "Data", "Cliente", "Forma Pagamento", "Total (R$)"],
        dados: dados.filtradas.map((v) => [
          v.id, fmtData(v.data), v.clienteNome || v.cliente || "—",
          v.formaPagamento || "—", Number(v.total || 0).toFixed(2),
        ]),
      },
      {
        nome: "Produtos mais vendidos",
        colunas: ["Produto", "Qtd Vendida", "Total (R$)"],
        dados: dados.maisPedidos.map((p) => [p.nome, p.qtd, p.total.toFixed(2)]),
      },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<ShoppingCart size={18} />}
          label="Total Vendido"
          value={fmtR$(dados.total)}
          sub={`${dados.filtradas.length} vendas`}
          trend="up" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<BarChart2 size={18} />}
          label="Ticket Médio"
          value={fmtR$(dados.ticket)}
          sub="por venda" trend="neutral" colorVar="var(--blue)"
        />
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Qtd. de Vendas"
          value={String(dados.filtradas.length)}
          sub="no período" trend="neutral" colorVar="var(--green)"
        />
      </div>

      {/* Produtos mais vendidos */}
      {dados.maisPedidos.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Produtos Mais Vendidos</span>
          </div>
          {dados.maisPedidos.map((p, i) => (
            <div key={p.nome} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{p.nome}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                {p.qtd} un.
              </span>
              <span className="rank-val">{fmtR$(p.total)}</span>
            </div>
          ))}
        </div>
      )}

      <TabelaRelatorio
        title="Histórico de Vendas"
        count={dados.filtradas.length}
        empty="Nenhuma venda no período."
        data={dados.filtradas}
        columns={[
          { key: "id",    label: "ID", render: (v) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v}</span> },
          { key: "data",  label: "Data", render: (v) => fmtData(v) },
          { key: "clienteNome", label: "Cliente", render: (v, row) => v || row.cliente || "—" },
          { key: "formaPagamento", label: "Pagamento" },
          {
            key: "total", label: "Total", align: "right",
            render: (v) => <span className="val-pos">{fmtR$(v)}</span>,
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: ESTOQUE
   ══════════════════════════════════════════════════════ */
function RelatorioEstoque({ produtos }) {
  /* Estoque não usa filtro de período — é snapshot atual */
  const dados = useMemo(() => {
    const total = produtos.length;
    const valorTotal = produtos.reduce(
      (s, p) => s + Number(p.precoVenda || 0) * Number(p.quantidade || 0), 0
    );
    const baixoEstoque = produtos.filter(
      (p) => Number(p.quantidade || 0) <= Number(p.estoqueMinimo || p.estoque_minimo || 5)
    );
    const semEstoque = produtos.filter((p) => Number(p.quantidade || 0) === 0);

    const sorted = [...produtos].sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));
    return { total, valorTotal, baixoEstoque, semEstoque, sorted };
  }, [produtos]);

  const handleExport = () => {
    exportarExcel("estoque", [{
      nome: "Estoque",
      colunas: ["Produto", "Quantidade", "Preço Venda (R$)", "Preço Custo (R$)", "Valor Total (R$)"],
      dados: dados.sorted.map((p) => [
        p.nome || "—",
        Number(p.quantidade || 0),
        Number(p.precoVenda || 0).toFixed(2),
        Number(p.precoCusto || 0).toFixed(2),
        (Number(p.precoVenda || 0) * Number(p.quantidade || 0)).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Package size={18} />}
          label="Total de Produtos"
          value={String(dados.total)}
          sub="cadastrados" trend="neutral" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<DollarSign size={18} />}
          label="Valor em Estoque"
          value={fmtR$(dados.valorTotal)}
          sub="valor de venda" trend="neutral" colorVar="var(--green)"
        />
        <CardResumo
          icon={<AlertCircle size={18} />}
          label="Estoque Baixo"
          value={String(dados.baixoEstoque.length)}
          sub="produtos críticos"
          trend={dados.baixoEstoque.length > 0 ? "down" : "neutral"}
          colorVar={dados.baixoEstoque.length > 0 ? "var(--red)" : "var(--text-2)"}
        />
        <CardResumo
          icon={<Minus size={18} />}
          label="Sem Estoque"
          value={String(dados.semEstoque.length)}
          sub="produtos zerados"
          trend={dados.semEstoque.length > 0 ? "down" : "neutral"}
          colorVar={dados.semEstoque.length > 0 ? "var(--red)" : "var(--text-2)"}
        />
      </div>

      {dados.baixoEstoque.length > 0 && (
        <div className="tr-wrap" style={{ border: "1px solid rgba(224,82,82,.3)" }}>
          <div className="tr-header" style={{ background: "rgba(224,82,82,.06)" }}>
            <span className="tr-title" style={{ color: "var(--red)" }}>
              ⚠ Produtos com Estoque Crítico
            </span>
            <span className="tr-badge">{dados.baixoEstoque.length}</span>
          </div>
          <TabelaRelatorio
            data={dados.baixoEstoque}
            columns={[
              { key: "nome", label: "Produto" },
              { key: "quantidade", label: "Qtd Atual", align: "center",
                render: (v) => <span style={{ color: "var(--red)", fontWeight: 700 }}>{v}</span> },
              { key: "estoqueMinimo", label: "Mínimo", align: "center",
                render: (v, row) => v ?? row.estoque_minimo ?? 5 },
              { key: "precoVenda", label: "Preço", align: "right",
                render: (v) => fmtR$(v) },
            ]}
            empty=""
          />
        </div>
      )}

      <TabelaRelatorio
        title="Todos os Produtos"
        count={dados.total}
        empty="Nenhum produto cadastrado."
        data={dados.sorted}
        columns={[
          { key: "nome",      label: "Produto" },
          { key: "categoria", label: "Categoria" },
          { key: "quantidade", label: "Qtd", align: "center" },
          { key: "precoVenda", label: "Preço Venda", align: "right",
            render: (v) => fmtR$(v) },
          { key: "precoCusto", label: "Custo", align: "right",
            render: (v) => fmtR$(v) },
          { key: "precoVenda", label: "Valor em Estoque", align: "right",
            render: (v, row) => fmtR$(Number(v || 0) * Number(row.quantidade || 0)) },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: CLIENTES
   ══════════════════════════════════════════════════════ */
function RelatorioClientes({ clientes, vendas, intervalo }) {
  const dados = useMemo(() => {
    const total = clientes.length;

    /* Clientes que compraram no período */
    const vendasPeriodo = vendas.filter((v) => dentroDoIntervalo(v.data, intervalo));
    const idsAtivos = new Set(vendasPeriodo.map((v) => v.clienteId || v.cliente_id).filter(Boolean));
    const ativos = clientes.filter((c) => idsAtivos.has(c.id));

    /* Clientes com fiado */
    const comFiado = clientes.filter((c) => Number(c.fiado || c.debito || 0) > 0);
    const totalFiado = comFiado.reduce((s, c) => s + Number(c.fiado || c.debito || 0), 0);

    /* Top clientes por valor gasto no período */
    const gastosPorCliente = {};
    vendasPeriodo.forEach((v) => {
      const id = v.clienteId || v.cliente_id;
      if (!id) return;
      gastosPorCliente[id] = (gastosPorCliente[id] || 0) + Number(v.total || 0);
    });
    const topClientes = Object.entries(gastosPorCliente)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, total2]) => {
        const c = clientes.find((x) => x.id === id);
        return { id, nome: c?.nome || id, total: total2 };
      });

    return { total, ativos, comFiado, totalFiado, topClientes };
  }, [clientes, vendas, intervalo]);

  const handleExport = () => {
    exportarExcel("clientes", [{
      nome: "Clientes",
      colunas: ["ID", "Nome", "Telefone", "CPF/CNPJ", "Fiado (R$)"],
      dados: clientes.map((c) => [
        c.id, c.nome || "—", c.telefone || "—", c.cpf || "—",
        Number(c.fiado || c.debito || 0).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Users size={18} />}
          label="Total de Clientes"
          value={String(dados.total)}
          sub="cadastrados" trend="neutral" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Clientes Ativos"
          value={String(dados.ativos.length)}
          sub="compraram no período" trend="up" colorVar="var(--green)"
        />
        <CardResumo
          icon={<Receipt size={18} />}
          label="Clientes c/ Fiado"
          value={String(dados.comFiado.length)}
          sub={fmtR$(dados.totalFiado) + " em aberto"}
          trend={dados.comFiado.length > 0 ? "down" : "neutral"}
          colorVar={dados.comFiado.length > 0 ? "var(--red)" : "var(--text-2)"}
        />
      </div>

      {dados.topClientes.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Top Clientes no Período</span>
          </div>
          {dados.topClientes.map((c, i) => (
            <div key={c.id} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{c.nome}</span>
              <span className="rank-val">{fmtR$(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {dados.comFiado.length > 0 && (
        <TabelaRelatorio
          title="Clientes com Fiado em Aberto"
          count={dados.comFiado.length}
          empty=""
          data={dados.comFiado}
          columns={[
            { key: "id",   label: "ID", render: (v) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v}</span> },
            { key: "nome", label: "Nome" },
            { key: "telefone", label: "Telefone" },
            { key: "fiado", label: "Fiado", align: "right",
              render: (v, row) => <span className="val-neg">{fmtR$(v || row.debito)}</span> },
          ]}
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: AGENDA
   ══════════════════════════════════════════════════════ */
function RelatorioAgenda({ agenda, intervalo }) {
  const dados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    /* Agenda usa a data do compromisso como referência */
    const filtrada = agenda
      .filter((a) => dentroDoIntervalo(a.data || a.dataHora, intervalo))
      .sort((a, b) => {
        const da = parseDate(a.data || a.dataHora);
        const db2 = parseDate(b.data || b.dataHora);
        return (da || 0) - (db2 || 0);
      });

    const futuros = filtrada.filter((a) => {
      const dt = parseDate(a.data || a.dataHora);
      return dt && dt >= hoje;
    });
    const passados = filtrada.filter((a) => {
      const dt = parseDate(a.data || a.dataHora);
      return dt && dt < hoje;
    });

    return { filtrada, futuros, passados };
  }, [agenda, intervalo]);

  const getBadge = (rawDate) => {
    const dias = getDiasRestantes(rawDate);
    if (dias === null) return null;
    if (dias === 0) return { label: "Hoje", cls: "ag-badge-hoje" };
    if (dias > 0 && dias <= 7) return { label: `Em ${dias}d`, cls: "ag-badge-prox" };
    if (dias > 7) return { label: "Futuro", cls: "ag-badge-fut" };
    return null;
  };

  const handleExport = () => {
    exportarExcel("agenda", [{
      nome: "Agenda",
      colunas: ["Data", "Hora", "Título", "Tipo", "Status", "Descrição"],
      dados: dados.filtrada.map((a) => [
        fmtData(a.data || a.dataHora),
        a.hora || "—",
        a.titulo || a.title || "—",
        a.tipo || a.type || "—",
        a.status || "—",
        a.descricao || a.description || "—",
      ]),
    }]);
  };

  const renderItem = (a, i) => {
    const rawDate = a.data || a.dataHora;
    const dt = parseDate(rawDate);
    const badge = getBadge(rawDate);
    const dia  = dt ? dt.getDate() : "?";
    const mes  = dt ? MESES_CURTOS[dt.getMonth()] : "?";

    return (
      <div key={a.id || i} className="ag-item">
        <div className="ag-date-box">
          <div className="ag-date-day">{dia}</div>
          <div className="ag-date-mon">{mes}</div>
        </div>
        <div className="ag-info">
          <div className="ag-titulo">{a.titulo || a.title || "Sem título"}</div>
          <div className="ag-meta">
            {a.hora && <span>🕐 {a.hora}</span>}
            {(a.tipo || a.type) && <span>{a.tipo || a.type}</span>}
            {a.status && <span style={{ textTransform: "capitalize" }}>{a.status}</span>}
          </div>
          {(a.descricao || a.description) && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {a.descricao || a.description}
            </div>
          )}
        </div>
        {badge && <span className={`ag-badge ${badge.cls}`}>{badge.label}</span>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo icon={<Calendar size={18} />} label="Total no Período"
          value={String(dados.filtrada.length)} sub="compromissos" trend="neutral" colorVar="var(--gold)" />
        <CardResumo icon={<TrendingUp size={18} />} label="Futuros"
          value={String(dados.futuros.length)} sub="agendados" trend="up" colorVar="var(--green)" />
        <CardResumo icon={<TrendingDown size={18} />} label="Passados"
          value={String(dados.passados.length)} sub="realizados" trend="neutral" colorVar="var(--text-2)" />
      </div>

      {dados.futuros.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Próximos Compromissos</span>
            <span className="tr-badge">{dados.futuros.length}</span>
          </div>
          {dados.futuros.map(renderItem)}
        </div>
      )}

      {dados.passados.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Compromissos Passados</span>
            <span className="tr-badge">{dados.passados.length}</span>
          </div>
          {dados.passados.map(renderItem)}
        </div>
      )}

      {dados.filtrada.length === 0 && (
        <div className="rel-empty">
          <Calendar size={32} color="var(--text-3)" />
          <p>Nenhum compromisso no período selecionado.</p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MENU DE NAVEGAÇÃO — configuração
   ══════════════════════════════════════════════════════ */
const MENU = [
  { key: "dre",        label: "DRE",        icon: <LayoutDashboard size={15} /> },
  { key: "financeiro", label: "Financeiro", icon: <Wallet size={15} />         },
  { key: "vendas",     label: "Vendas",     icon: <ShoppingCart size={15} />   },
  { key: "despesas",   label: "Despesas",   icon: <Receipt size={15} />        },
  { key: "estoque",    label: "Estoque",    icon: <Package size={15} />        },
  { key: "clientes",   label: "Clientes",   icon: <Users size={15} />          },
  { key: "agenda",     label: "Agenda",     icon: <Calendar size={15} />       },
];

const TITULO_RELATORIO = {
  dre:        "DRE — Demonstração do Resultado",
  financeiro: "Relatório Financeiro",
  vendas:     "Relatório de Vendas",
  despesas:   "Relatório de Despesas",
  estoque:    "Relatório de Estoque",
  clientes:   "Relatório de Clientes",
  agenda:     "Relatório de Agenda",
};

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Relatorios
   ══════════════════════════════════════════════════════ */
export default function Relatorios() {
  const [uid, setUid]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [ativo, setAtivo]       = useState("dre");

  /* Filtro de período */
  const [periodo,     setPeriodo]     = useState("mes");
  const [dataInicio,  setDataInicio]  = useState("");
  const [dataFim,     setDataFim]     = useState("");

  /* Dados das collections */
  const [vendas,    setVendas]    = useState([]);
  const [clientes,  setClientes]  = useState([]);
  const [despesas,  setDespesas]  = useState([]);
  const [produtos,  setProdutos]  = useState([]);
  const [agenda,    setAgenda]    = useState([]);
  const [caixa,     setCaixa]     = useState([]);

  /* Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return unsub;
  }, []);

  /* Firestore — subscribe a todas as collections necessárias */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const col = (name) => collection(db, "users", uid, name);
    setLoading(true);

    const subs = [
      onSnapshot(col("vendas"),   (s) => setVendas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(col("clientes"), (s) => setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(col("despesas"), (s) => { setDespesas(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(col("produtos"), (s) => setProdutos(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        /* Ignorar erro se collection não existir */ () => {}),
      onSnapshot(col("agenda"),   (s) => setAgenda(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("caixa"),    (s) => setCaixa(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
    ];

    // Fallback: garantir que loading pare mesmo sem despesas
    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      subs.forEach((fn) => { try { fn(); } catch {} });
      clearTimeout(timeout);
    };
  }, [uid]);

  /* Intervalo calculado */
  const intervalo = useMemo(
    () => getIntervalo(periodo, dataInicio, dataFim),
    [periodo, dataInicio, dataFim]
  );

  /* Impressão */
  const handlePrint = useCallback(() => window.print(), []);

  if (!uid) {
    return (
      <div className="rel-loading">
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        Carregando autenticação...
      </div>
    );
  }

  /* Renderiza o relatório ativo */
  const renderConteudo = () => {
    if (loading) {
      return (
        <div className="rel-loading">
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          Carregando dados...
        </div>
      );
    }
    switch (ativo) {
      case "dre":        return <RelatorioDRE vendas={vendas} despesas={despesas} intervalo={intervalo} />;
      case "financeiro": return <RelatorioFinanceiro caixa={caixa} intervalo={intervalo} />;
      case "vendas":     return <RelatorioVendas vendas={vendas} intervalo={intervalo} />;
      case "despesas":   return <RelatorioDespesas despesas={despesas} intervalo={intervalo} />;
      case "estoque":    return <RelatorioEstoque produtos={produtos} />;
      case "clientes":   return <RelatorioClientes clientes={clientes} vendas={vendas} intervalo={intervalo} />;
      case "agenda":     return <RelatorioAgenda agenda={agenda} intervalo={intervalo} />;
      default:           return null;
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="rel-root">
        {/* Barra superior */}
        <header className="rel-topbar">
          <div className="rel-topbar-left">
            <div className="rel-topbar-title">
              <h1>Relatórios</h1>
              <p>{TITULO_RELATORIO[ativo]}</p>
            </div>
          </div>
          <div className="rel-actions">
            <button className="btn-secondary" onClick={handlePrint} data-print-hide>
              <Printer size={13} /> Imprimir
            </button>
          </div>
        </header>

        <div className="rel-body">
          {/* Sidebar de navegação */}
          <nav className="rel-nav" data-print-hide>
            <div className="rel-nav-label">Relatórios</div>
            {MENU.map((item) => (
              <button
                key={item.key}
                className={`rel-nav-btn ${ativo === item.key ? "active" : ""}`}
                onClick={() => setAtivo(item.key)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Área de conteúdo */}
          <main className="rel-content">
            {/* Cabeçalho de impressão (visível só no print) */}
            <div className="rel-print-header">
              <div>
                <h2>{TITULO_RELATORIO[ativo]}</h2>
                <p>Gerado em {new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}</p>
              </div>
              <div className="rel-print-brand">ASSENT Gestão</div>
            </div>

            {/* Filtro de período */}
            <FiltroPeriodo
              periodo={periodo}
              setPeriodo={setPeriodo}
              dataInicio={dataInicio}
              setDataInicio={setDataInicio}
              dataFim={dataFim}
              setDataFim={setDataFim}
            />

            {/* Conteúdo do relatório */}
            {renderConteudo()}
          </main>
        </div>
      </div>
    </>
  );
}
