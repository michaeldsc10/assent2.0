/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — hooks/useDashboardData.js
   Hook de dados reais do Dashboard (Firestore)

   Coleções lidas:
     users/{uid}/vendas       → receita, vendas, itens
     users/{uid}/clientes     → contagem
     users/{uid}/produtos     → contagem
     users/{uid}/servicos     → contagem
     users/{uid}/despesas     → status/vencimentos
     users/{uid}/a_receber    → saldo em aberto
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

/* ── Helpers ──────────────────────────────────────── */

/** Converte qualquer valor de data para Date nativo */
export const toDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();          // Firestore Timestamp
  if (v instanceof Date) return v;
  return new Date(v);
};

/** Converte campo vencimento (pode ser "YYYY-MM-DD" ou Timestamp) */
export const parseVencimento = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return new Date(+y, +m - 1, +d);
  }
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return new Date(+y, +m - 1, +d);
  }
  return new Date(v);
};

/** Formata valor monetário em BRL */
export const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Formata data para "dd/mm/aaaa" */
export const fmtData = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
};

/**
 * Retorna a data de início do período selecionado.
 * Retorna null para "Todos".
 */
function getPeriodStart(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "Hoje":      return today;
    case "7 dias":    return new Date(today.getTime() - 6  * 86_400_000);
    case "30 dias":   return new Date(today.getTime() - 29 * 86_400_000);
    case "Este mês":  return new Date(now.getFullYear(), now.getMonth(), 1);
    case "Todos":     return null;
    default:          return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

/* ── Hook principal ───────────────────────────────── */

/**
 * useDashboardData(uid, period)
 *
 * Escuta em tempo real todas as coleções relevantes
 * e retorna métricas calculadas baseadas no período.
 *
 * @param {string}  uid    — UID do usuário autenticado
 * @param {string}  period — Período selecionado no dashboard
 * @returns {object} métricas + loading
 */
export function useDashboardData(uid, period = "Este mês") {
  const [raw, setRaw] = useState({
    vendas:   [],
    clientes: [],
    produtos:  [],
    servicos:  [],
    despesas:  [],
    aReceber:  [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let loaded = 0;
    const TOTAL = 6;
    const markDone = () => {
      loaded++;
      if (loaded >= TOTAL) setLoading(false);
    };

    /* Mapeia: [nome da coleção, chave no estado raw] */
    const COLS = [
      ["vendas",    "vendas"  ],
      ["clientes",  "clientes"],
      ["produtos",  "produtos" ],
      ["servicos",  "servicos" ],
      ["despesas",  "despesas" ],
      ["a_receber", "aReceber" ],
    ];

    const unsubs = COLS.map(([col, key]) =>
      onSnapshot(
        collection(db, "users", uid, col),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRaw((prev) => ({ ...prev, [key]: docs }));
          markDone();
        },
        () => markDone() // silencia erros de permissão e avança loading
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  /* ── Métricas computadas (memoizadas) ─────────── */
  const metrics = useMemo(() => {
    const { vendas, clientes, produtos, servicos, despesas, aReceber } = raw;
    const periodStart = getPeriodStart(period);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    /* ── Filtra vendas pelo período ── */
    const vendasPeriodo = periodStart
      ? vendas.filter((v) => {
          const dt = toDate(v.data);
          return dt && dt >= periodStart;
        })
      : vendas;

    /* ── Receita & Vendas ── */
    const receitaBruta = vendasPeriodo.reduce(
      (s, v) => s + (Number(v.total) || 0), 0
    );
    const numVendas   = vendasPeriodo.length;
    const ticketMedio = numVendas > 0 ? receitaBruta / numVendas : 0;

    /* Custo de mercadorias/serviços (campo `custo` por item) */
    const custoTotal = vendasPeriodo.reduce(
      (s, v) =>
        s +
        (v.itens || []).reduce(
          (si, i) => si + (Number(i.custo) || 0) * (Number(i.qtd) || 1),
          0
        ),
      0
    );

    const lucroLiquido = receitaBruta - custoTotal;
    const margem =
      receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    /* Projeção 30 dias (taxa média diária × 30) */
    let projecao = 0;
    if (periodStart && receitaBruta > 0) {
      const dias = Math.max(1, Math.round((now - periodStart) / 86_400_000));
      projecao = (receitaBruta / dias) * 30;
    }

    /* ── Despesas ── */
    const despesasVencidas = despesas.filter((d) => {
      if (d.status === "pago" || d.status === "cancelado") return false;
      const venc = parseVencimento(d.vencimento);
      return venc && venc < now;
    });
    const despesasAVencer = despesas.filter((d) => {
      if (d.status === "pago" || d.status === "cancelado") return false;
      const venc = parseVencimento(d.vencimento);
      return venc && venc >= now && venc <= in30;
    });
    const despesasPendentes = despesas.filter(
      (d) => d.status !== "pago" && d.status !== "cancelado"
    );
    const despesasPagas = despesas.filter((d) => d.status === "pago");
    const valorDespesasPagas = despesasPagas.reduce(
      (s, d) => s + (Number(d.valor) || 0), 0
    );

    /* ── A Receber ── */
    const totalAReceber = aReceber
      .filter((a) => a.status !== "pago")
      .reduce(
        (s, a) =>
          s +
          (Number(a.valorRestante) ||
            Math.max(0, Number(a.valorTotal) - Number(a.valorPago)) ||
            0),
        0
      );

    /* ── Faturamento por período (respeita o filtro ativo) ── */
    let faturamentoPorDia = [];

    if (period === "Hoje") {
      /* Agrupa por hora (00h–23h) */
      faturamentoPorDia = Array.from({ length: 24 }, (_, h) => {
        const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
        const fim    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 59, 59, 999);
        const total  = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= inicio && dt <= fim; })
          .reduce((s, v) => s + (Number(v.total) || 0), 0);
        return { d: `${String(h).padStart(2, "0")}h`, v: total };
      });
    } else if (period === "Todos") {
      /* Agrupa por mês (últimos 12 meses) */
      faturamentoPorDia = Array.from({ length: 12 }, (_, i) => {
        const ref   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const fim    = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
        const total  = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= inicio && dt <= fim; })
          .reduce((s, v) => s + (Number(v.total) || 0), 0);
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        return { d: `${meses[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`, v: total };
      });
    } else {
      /* Agrupa por dia — usa o periodStart calculado */
      const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const totalDias = Math.round((now - start) / 86_400_000) + 1;
      const dias = Math.min(totalDias, 60); /* máximo 60 pontos */
      faturamentoPorDia = Array.from({ length: dias }, (_, i) => {
        const d    = new Date(start.getTime() + i * 86_400_000);
        const next = new Date(d.getTime() + 86_400_000);
        const total = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= d && dt < next; })
          .reduce((s, v) => s + (Number(v.total) || 0), 0);
        return {
          d: `${String(d.getDate()).padStart(2, "0")}/${d.getMonth() + 1}`,
          v: total,
        };
      });
    }

    /* ── Mix de Receita (Produtos vs Serviços) ── */
    let totalProd = 0;
    let totalServ = 0;
    vendasPeriodo.forEach((v) =>
      (v.itens || []).forEach((item) => {
        const val =
          (Number(item.preco) || 0) * (Number(item.qtd) || 1) -
          (Number(item.desconto) || 0);
        if (item.tipo === "servico") totalServ += val;
        else totalProd += val;
      })
    );
    const totalMix = totalProd + totalServ;
    const mixData =
      totalMix > 0
        ? [
            { name: "Produtos",  value: Math.round((totalProd / totalMix) * 100) },
            { name: "Serviços", value: Math.round((totalServ / totalMix) * 100) },
          ]
        : [
            { name: "Produtos",  value: 50 },
            { name: "Serviços", value: 50 },
          ];

    /* ── Top Produtos ── */
    const prodMap = {};
    vendasPeriodo.forEach((v) =>
      (v.itens || []).forEach((item) => {
        if (item.tipo === "servico") return;
        const k = item.nome || item.produto || "Produto";
        if (!prodMap[k]) prodMap[k] = { qtd: 0, total: 0 };
        prodMap[k].qtd   += Number(item.qtd) || 1;
        prodMap[k].total +=
          (Number(item.preco) || 0) * (Number(item.qtd) || 1) -
          (Number(item.desconto) || 0);
      })
    );
    const topProdutos = Object.entries(prodMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([nome, d]) => ({ nome, qtd: d.qtd, total: d.total }));

    /* ── Top Clientes ── */
    const cliMap = {};
    vendasPeriodo.forEach((v) => {
      const k = v.cliente || "—";
      cliMap[k] = (cliMap[k] || 0) + (Number(v.total) || 0);
    });
    const topClientes = Object.entries(cliMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, total]) => ({ nome, total }));

    /* ── Últimas Vendas (mais recentes primeiro) ── */
    const ultimasVendas = [...vendasPeriodo]
      .sort(
        (a, b) =>
          (toDate(b.data)?.getTime() || 0) - (toDate(a.data)?.getTime() || 0)
      )
      .slice(0, 5);

    return {
      /* Receita */
      receitaBruta,
      custoTotal,
      lucroLiquido,
      margem,
      numVendas,
      ticketMedio,
      projecao,
      /* Contagens */
      numClientes: clientes.length,
      numProdutos: produtos.length,
      numServicos: servicos.length,
      /* Financeiro */
      totalAReceber,
      valorDespesasPagas,
      /* Despesas por status */
      despesasVencidas:   despesasVencidas.length,
      despesasAVencer:    despesasAVencer.length,
      despesasPendentes:  despesasPendentes.length,
      despesasPagasMes:   despesasPagas.length,
      /* Gráficos */
      faturamentoPorDia,
      mixData,
      /* Tabelas */
      topProdutos,
      topClientes,
      ultimasVendas,
    };
  }, [raw, period]);

  return { ...metrics, loading };
}
