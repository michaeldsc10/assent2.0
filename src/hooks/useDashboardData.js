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
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-");
      return new Date(+y, +m - 1, +d);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split("/");
      return new Date(+y, +m - 1, +d);
    }
  }
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
 * Retorna { start, end } para o período selecionado.
 * start = Date | null (null = "sem limite inferior")
 * end   = sempre now (ou fim do dia de `to` no Personalizado)
 */
function getPeriodBounds(period, customRange) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Fim do dia de hoje — evita excluir vendas com hora futura no mesmo dia
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === "Personalizado" && customRange?.from && customRange?.to) {
    const [fy, fm, fd] = customRange.from.split("-").map(Number);
    const [ty, tm, td] = customRange.to.split("-").map(Number);
    return {
      start: new Date(fy, fm - 1, fd, 0, 0, 0, 0),
      end:   new Date(ty, tm - 1, td, 23, 59, 59, 999),
    };
  }

  switch (period) {
    case "Hoje":     return { start: today, end: endOfToday };
    case "7 dias":   return { start: new Date(today.getTime() - 6  * 86_400_000), end: endOfToday };
    case "30 dias":  return { start: new Date(today.getTime() - 29 * 86_400_000), end: endOfToday };
    case "Este mês": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfToday };
    case "Todos":    return { start: null, end: endOfToday };
    default:         return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfToday };
  }
}

/* ── Hook principal ───────────────────────────────── */

/**
 * useDashboardData(uid, period, customRange?)
 *
 * Escuta em tempo real todas as coleções relevantes
 * e retorna métricas calculadas baseadas no período.
 *
 * @param {string}       uid         — UID do usuário autenticado
 * @param {string}       period      — Período selecionado no dashboard
 * @param {{ from: string, to: string }|null} customRange — Intervalo personalizado (YYYY-MM-DD)
 * @returns {object} métricas + loading
 */
export function useDashboardData(uid, period = "Este mês", customRange = null) {
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
    let desmontado = false;
    const TOTAL = 6;
    const markDone = () => {
      loaded++;
      if (!desmontado && loaded >= TOTAL) setLoading(false);
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
          if (col === "vendas") {
          }
          setRaw((prev) => ({ ...prev, [key]: docs }));
          markDone();
        },
        (err) => {
          console.error(`[useDashboardData] ERRO na coleção "${col}":`, err.code, err.message);
          markDone();
        }
      )
    );

    return () => {
      desmontado = true;
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  /* ── Métricas computadas (memoizadas) ─────────── */
  const metrics = useMemo(() => {
    // Guard: não calcula com dados incompletos (evita flash de valores errados)
    // Retorna zeros seguros em vez de null — evita .toFixed() em undefined
    if (loading) return {
      receitaBruta: 0, custoTotal: 0, lucroLiquido: 0, margem: 0,
      numVendas: 0, ticketMedio: 0, projecao: 0,
      numClientes: 0, numProdutos: 0, numServicos: 0,
      totalAReceber: 0, valorDespesasPagas: 0,
      despesasVencidas: 0, despesasAVencer: 0, despesasPendentes: 0, despesasPagasMes: 0,
      faturamentoPorDia: [], mixData: [{ name: "Produtos", value: 50 }, { name: "Serviços", value: 50 }],
      topProdutos: [], topClientes: [], ultimasVendas: [],
    };
    const { vendas, clientes, produtos, servicos, despesas, aReceber } = raw;
    const { start: periodStart, end: periodEnd } = getPeriodBounds(period, customRange);
    const now  = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    /* ── Filtra vendas pelo período ── */
    const vendasPeriodo = periodStart
      ? vendas.filter((v) => {
          const dt = toDate(v.data);
          return dt && dt >= periodStart && dt <= periodEnd;
        })
      : vendas;

    /* ── Receita & Vendas ── */
    // Caixa: só soma o que foi efetivamente recebido (total - restante a receber)
    const receitaVendas = vendasPeriodo.reduce((s, v) => {
      const total    = Number(v.total) || 0;
      const restante = Number(v.valorRestante) || 0;
      return s + (total - restante);
    }, 0);

    /* Receitas manuais do a_receber (não vinculadas a vendas) — regime de caixa */
    const receitaAReceberManual = aReceber
      .filter((r) => r.origem !== "venda")
      .reduce((s, r) => {
        /* Com histórico: soma cada entrada individualmente pelo período */
        if (Array.isArray(r.historicoPagamentos) && r.historicoPagamentos.length > 0) {
          return s + r.historicoPagamentos.reduce((acc, p) => {
            const dt = toDate(p.data);
            if (!dt) return acc;
            if (periodStart && (dt < periodStart || dt > periodEnd)) return acc;
            return acc + Number(p.valor || 0);
          }, 0);
        }
        /* Legado: sem histórico — filtra pela data do pagamento */
        if (Number(r.valorPago || 0) <= 0) return s;
        const dt = toDate(r.dataPagamento) || toDate(r.dataCriacao);
        if (!dt) return s;
        if (periodStart && (dt < periodStart || dt > periodEnd)) return s;
        return s + Number(r.valorPago || 0);
      }, 0);

    const receitaBruta = receitaVendas + receitaAReceberManual;
    const numVendas   = vendasPeriodo.length;
    const ticketMedio = numVendas > 0 ? receitaBruta / numVendas : 0;

    /* Custo de mercadorias/serviços (campo `custo` por item) */
    const totalDespesasPeriodo = despesas
      .filter((d) => {
        if (d.status !== "pago" && d.status !== "parcial") return false;
        const dt = toDate(d.dataPagamentoTs) || parseVencimento(d.dataPagamento) || parseVencimento(d.vencimento);
        if (!dt) return false;
        if (periodStart && (dt < periodStart || dt > periodEnd)) return false;
        return true;
      })
      .reduce((s, d) => s + (d.status === "parcial" ? (Number(d.valorPago) || 0) : (Number(d.valor) || 0)), 0);

    const custoTotal = totalDespesasPeriodo;
    const lucroLiquido = receitaBruta - custoTotal;
    const margem =
      receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    /* Projeção 30 dias (taxa média diária × 30) */
    let projecao = 0;
    if (periodStart && receitaBruta > 0) {
      const dias = Math.max(1, Math.round((periodEnd - periodStart) / 86_400_000));
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
    const despesasPagas = despesas.filter((d) => d.status === "pago" || d.status === "parcial");
    const valorDespesasPagas = despesasPagas.reduce(
      (s, d) => s + (d.status === "parcial" ? (Number(d.valorPago) || 0) : (Number(d.valor) || 0)), 0
    );

    /* ── A Receber ── */
    // Não depende do campo status (não gravado no Firestore) — usa valorRestante real
    const totalAReceber = aReceber.reduce((s, a) => {
      const restante = Number(a.valorRestante) ?? Math.max(0, Number(a.valorTotal || 0) - Number(a.valorPago || 0));
      return s + (restante > 0 ? restante : 0);
    }, 0);

    /* ── Faturamento por período (respeita o filtro ativo) ── */
    let faturamentoPorDia = [];

    if (period === "Hoje") {
      /* Agrupa por hora (00h–23h) */
      faturamentoPorDia = Array.from({ length: 24 }, (_, h) => {
        const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
        const fim    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 59, 59, 999);
        const total  = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= inicio && dt <= fim; })
          .reduce((s, v) => s + Math.max(0, (Number(v.total) || 0) - (Number(v.valorRestante) || 0)), 0);
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
          .reduce((s, v) => s + Math.max(0, (Number(v.total) || 0) - (Number(v.valorRestante) || 0)), 0);
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        return { d: `${meses[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`, v: total };
      });
    } else if (period === "Personalizado" && periodStart) {
      /* Personalizado: agrupa por dia entre from e to */
      const totalDias = Math.round((periodEnd - periodStart) / 86_400_000) + 1;
      const dias = Math.min(totalDias, 60);
      faturamentoPorDia = Array.from({ length: dias }, (_, i) => {
        const d    = new Date(periodStart.getTime() + i * 86_400_000);
        const next = new Date(d.getTime() + 86_400_000);
        const total = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= d && dt < next; })
          .reduce((s, v) => s + Math.max(0, (Number(v.total) || 0) - (Number(v.valorRestante) || 0)), 0);
        return {
          d: `${String(d.getDate()).padStart(2, "0")}/${d.getMonth() + 1}`,
          v: total,
        };
      });
    } else {
      /* Agrupa por dia — usa o periodStart calculado */
      const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = periodEnd ?? now;
      const totalDias = Math.round((end - start) / 86_400_000) + 1;
      const dias = Math.min(totalDias, 60); /* máximo 60 pontos */
      faturamentoPorDia = Array.from({ length: dias }, (_, i) => {
        const d    = new Date(start.getTime() + i * 86_400_000);
        const next = new Date(d.getTime() + 86_400_000);
        const total = vendas
          .filter((v) => { const dt = toDate(v.data); return dt && dt >= d && dt < next; })
          .reduce((s, v) => s + Math.max(0, (Number(v.total) || 0) - (Number(v.valorRestante) || 0)), 0);
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
      const nome = (v.cliente || "").trim();
      // Exclui vendas sem cliente (PDV anônimo) e mesas
      if (!nome || nome === "—" || nome === "-" || /^mesa\s/i.test(nome)) return;
      cliMap[nome] = (cliMap[nome] || 0) + Math.max(0, (Number(v.total) || 0) - (Number(v.valorRestante) || 0));
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
  }, [raw, period, customRange, loading]);

  return { ...(metrics ?? {}), loading };
}
