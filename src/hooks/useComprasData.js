/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — useComprasData.js
   Hook: dados reativos de Compras + métricas para Relatórios
   Coleções: compras | insumos | movimentacoes
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

/* ── Helpers de data ── */
const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** Converte campo data (string YYYY-MM-DD ou Firestore Timestamp) → Date local */
function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();                        // Firestore Timestamp
  if (typeof val === "string") {                                    // YYYY-MM-DD string
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(val);
}

/** Retorna "YYYY-MM" de uma data */
const anoMes = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* ═══════════════════════════════════════════════════
   HOOK PRINCIPAL
   ═══════════════════════════════════════════════════ */
export function useComprasData(uid) {
  const [compras,        setCompras]        = useState([]);
  const [insumos,        setInsumos]        = useState([]);
  const [movimentacoes,  setMovimentacoes]  = useState([]);
  const [loading,        setLoading]        = useState(true);

  /* ── Listeners em tempo real ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    let ready = 0;
    const onReady = () => { ready++; if (ready >= 3) setLoading(false); };

    const unsubC = onSnapshot(
      collection(db, "users", uid, "compras"),
      snap => { setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() }))); onReady(); },
      err  => { console.error("[useComprasData] compras:", err); onReady(); }
    );

    const unsubI = onSnapshot(
      collection(db, "users", uid, "insumos"),
      snap => { setInsumos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); onReady(); },
      err  => { console.error("[useComprasData] insumos:", err); onReady(); }
    );

    const unsubM = onSnapshot(
      collection(db, "users", uid, "movimentacoes"),
      snap => { setMovimentacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); onReady(); },
      err  => { console.error("[useComprasData] movimentacoes:", err); onReady(); }
    );

    return () => { unsubC(); unsubI(); unsubM(); };
  }, [uid]);

  /* ── Métricas derivadas ── */
  const metrics = useMemo(() => {
    const agora       = new Date();
    const anoAtual    = agora.getFullYear();
    const mesAtual    = agora.getMonth();       // 0-indexed
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    /* ── Filtros por mês ── */
    const esMesAtual    = (c) => { const d = toDate(c.data); return d && d.getFullYear() === anoAtual    && d.getMonth() === mesAtual; };
    const esMesAnterior = (c) => { const d = toDate(c.data); return d && d.getFullYear() === anoAnterior && d.getMonth() === mesAnterior; };

    const comprasAtivas          = compras.filter(c => c.status !== "cancelado");
    const comprasMesAtual        = comprasAtivas.filter(esMesAtual);
    const comprasMesAnterior     = comprasAtivas.filter(esMesAnterior);

    const totalGasto             = comprasMesAtual.reduce((s, c) => s + (c.valorTotal || 0), 0);
    const totalGastoMesAnterior  = comprasMesAnterior.reduce((s, c) => s + (c.valorTotal || 0), 0);
    const numCompras             = comprasMesAtual.length;
    const ticketMedioCompra      = numCompras > 0 ? totalGasto / numCompras : 0;

    /* ── Gastos por fornecedor (all-time) ── */
    const fornMap = {};
    comprasAtivas.forEach(c => {
      const id = c.fornecedorId;
      if (!id) return;
      if (!fornMap[id]) fornMap[id] = { fornecedorId: id, fornecedorNome: c.fornecedorNome || "—", total: 0, numCompras: 0 };
      fornMap[id].total     += c.valorTotal || 0;
      fornMap[id].numCompras++;
    });
    const gastosPorFornecedor = Object.values(fornMap).sort((a, b) => b.total - a.total);

    /* ── Top insumos: por quantidade e por valor (entradas) ── */
    const qtdMap = {};
    const valMap = {};
    movimentacoes
      .filter(m => m.tipo === "entrada")
      .forEach(m => {
        const id = m.insumoId;
        if (!id) return;

        if (!qtdMap[id]) qtdMap[id] = { insumoId: id, insumoNome: m.insumoNome || "—", totalQtd: 0, unidade: m.unidade || "" };
        qtdMap[id].totalQtd += m.quantidade || 0;

        if (!valMap[id]) valMap[id] = { insumoId: id, insumoNome: m.insumoNome || "—", totalValor: 0 };
        valMap[id].totalValor += (m.valorUnitario || 0) * (m.quantidade || 0);
      });

    // Enriquecer unidade com dado do insumo cadastrado (mais confiável)
    insumos.forEach(ins => {
      if (qtdMap[ins.id]) qtdMap[ins.id].unidade = ins.unidade || qtdMap[ins.id].unidade;
    });

    const topInsumosPorQtd   = Object.values(qtdMap).sort((a, b) => b.totalQtd   - a.totalQtd  ).slice(0, 10);
    const topInsumosPorValor = Object.values(valMap).sort((a, b) => b.totalValor  - a.totalValor).slice(0, 10);

    /* ── Estoque calculado por insumo (entradas − saídas) ── */
    const estoqueMap = {};
    movimentacoes.forEach(m => {
      const id = m.insumoId;
      if (!id) return;
      if (estoqueMap[id] === undefined) estoqueMap[id] = 0;
      if (m.tipo === "entrada") estoqueMap[id] += m.quantidade || 0;
      else                      estoqueMap[id] -= m.quantidade || 0;
    });

    const estoquePorInsumo = insumos.map(ins => {
      const atual  = Math.max(0, estoqueMap[ins.id] ?? 0);
      const minimo = ins.estoqueMinimo || 0;
      return {
        insumoId: ins.id,
        nome:     ins.nome,
        atual,
        minimo,
        unidade:  ins.unidade || "",
        categoria: ins.categoria || "",
        alerta:   atual <= minimo,
        ativo:    ins.ativo !== false,
      };
    });

    const insumosAbaixoMinimo = estoquePorInsumo.filter(e => e.alerta && e.ativo).length;

    /* ── Gasto mensal — últimos 6 meses ── */
    const gastoMensalMap = {};
    comprasAtivas.forEach(c => {
      const d = toDate(c.data);
      if (!d) return;
      const key = anoMes(d);
      gastoMensalMap[key] = (gastoMensalMap[key] || 0) + (c.valorTotal || 0);
    });

    // Garante os últimos 6 meses mesmo que sem dados
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - i, 1);
      const key = anoMes(d);
      if (gastoMensalMap[key] === undefined) gastoMensalMap[key] = 0;
    }

    const gastoMensal = Object.entries(gastoMensalMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, total]) => {
        const [ano, mes] = key.split("-");
        return { mes: `${MESES_ABREV[parseInt(mes) - 1]}/${ano.slice(2)}`, total };
      });

    /* ── Compras detalhadas (para exportação/tabela) ── */
    const comprasDetalhadas = [...comprasAtivas].sort((a, b) => {
      const da = toDate(a.data) || 0;
      const db_ = toDate(b.data) || 0;
      return db_ - da; // mais recente primeiro
    });

    return {
      totalGasto,
      totalGastoMesAnterior,
      numCompras,
      ticketMedioCompra,
      gastosPorFornecedor,
      topInsumosPorQtd,
      topInsumosPorValor,
      estoquePorInsumo,
      insumosAbaixoMinimo,
      gastoMensal,
      comprasDetalhadas,
    };
  }, [compras, insumos, movimentacoes]);

  return {
    /* raw data (para CRUD no Compras.jsx) */
    compras,
    insumos,
    movimentacoes,
    loading,
    /* métricas derivadas */
    ...metrics,
  };
}
