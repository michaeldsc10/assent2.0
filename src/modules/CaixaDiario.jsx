/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — CaixaDiario.jsx
   Estrutura Firestore:
     empresas/{empresaId}/caixa_diario/{docId}   → lançamentos
     empresas/{empresaId}/contadores/caixa_diario → contador sequencial
     empresas/{empresaId}/resumo_caixa/atual      → saldo atual
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, X, Download, Filter,
  TrendingUp, TrendingDown, DollarSign,
  ArrowUpCircle, ArrowDownCircle, AlertCircle,
  ChevronDown, RefreshCw,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

/* ═══════════════════════════════════════════════════
   VALIDAÇÃO
   ═══════════════════════════════════════════════════ */

/**
 * Valida os dados de entrada antes de criar um lançamento.
 * Lança um Error descritivo em caso de falha.
 * @param {Object} dados
 */
/**
 * Valida o objeto `valores` de um lançamento.
 * Regras:
 *  - Todos os campos devem ser números finitos e >= 0
 *  - liquido === bruto - taxa  (tolerância de R$ 0,01)
 *  - lucro  === liquido - custo (tolerância de R$ 0,01)
 * @param {Object} valores
 */
function validarObjValores(valores) {
  if (!valores || typeof valores !== "object")
    throw new Error("validação: campo 'valores' é obrigatório e deve ser um objeto.");

  const campos = ["bruto", "taxa", "liquido", "custo", "lucro"];
  for (const campo of campos) {
    if (typeof valores[campo] !== "number" || !isFinite(valores[campo]) || valores[campo] < 0)
      throw new Error(`validação: valores.${campo} deve ser um número >= 0. Recebido: ${valores[campo]}.`);
  }

  const liquidoEsperado = Math.round((valores.bruto - valores.taxa) * 100) / 100;
  if (Math.abs(liquidoEsperado - valores.liquido) > 0.01)
    throw new Error(
      `validação: valores.liquido (${valores.liquido}) diverge de bruto - taxa (${liquidoEsperado}).`
    );

  const lucroEsperado = Math.round((valores.liquido - valores.custo) * 100) / 100;
  if (Math.abs(lucroEsperado - valores.lucro) > 0.01)
    throw new Error(
      `validação: valores.lucro (${valores.lucro}) diverge de liquido - custo (${lucroEsperado}).`
    );
}

export function validarDadosLancamento(dados) {
  const {
    empresaId, usuarioId, tipo,
    descricao, categoria, formaPagamento, data, origem,
    valores,
  } = dados;

  if (!empresaId || typeof empresaId !== "string" || !empresaId.trim())
    throw new Error("validação: empresaId é obrigatório.");

  if (!usuarioId || typeof usuarioId !== "string" || !usuarioId.trim())
    throw new Error("validação: usuarioId é obrigatório.");

  if (!["entrada", "saida"].includes(tipo))
    throw new Error(`validação: tipo deve ser "entrada" ou "saida". Recebido: "${tipo}".`);

  /* ── valores (novo padrão obrigatório) ── */
  validarObjValores(valores);

  if (!descricao || typeof descricao !== "string" || !descricao.trim())
    throw new Error("validação: descricao é obrigatória.");

  if (!categoria || typeof categoria !== "string" || !categoria.trim())
    throw new Error("validação: categoria é obrigatória.");

  if (!formaPagamento || typeof formaPagamento !== "string" || !formaPagamento.trim())
    throw new Error("validação: formaPagamento é obrigatório.");

  if (!data || !(data instanceof Date) || isNaN(data.getTime()))
    throw new Error("validação: data deve ser um objeto Date válido.");

  if (!["manual", "venda", "despesa"].includes(origem))
    throw new Error(`validação: origem deve ser "manual", "venda" ou "despesa". Recebido: "${origem}".`);
}

/* ═══════════════════════════════════════════════════
   FUNÇÃO PRINCIPAL — criarLancamentoCaixa
   ═══════════════════════════════════════════════════ */

/**
 * Cria um lançamento no Caixa Diário usando runTransaction.
 *
 * Garante:
 *  ✅ ID sequencial sem colisão (concurrency-safe)
 *  ✅ Cálculo de saldo 100% dentro da transaction
 *  ✅ Prevenção de duplicidade por origem + referenciaId
 *  ✅ serverTimestamp() para auditoria
 *  ✅ Resumo do caixa atualizado atomicamente
 *
/**
 * Cria um lançamento no Caixa Diário usando runTransaction.
 *
 * Garante:
 *  ✅ ID sequencial sem colisão (concurrency-safe)
 *  ✅ Cálculo de saldo 100% dentro da transaction (baseado em valores.liquido)
 *  ✅ Prevenção de duplicidade por origem + referenciaId
 *  ✅ serverTimestamp() para auditoria
 *  ✅ Resumo do caixa atualizado atomicamente
 *  ✅ Snapshot financeiro completo em `valores` — imutável após criação
 *  ✅ Fallback de leitura para registros antigos (campo `valor` legado)
 *
 * REGRA: o Caixa NÃO calcula nada. Recebe os valores prontos do módulo de origem.
 *
 * @param {Object}  dados
 * @param {string}  dados.empresaId
 * @param {string}  dados.usuarioId
 * @param {"entrada"|"saida"} dados.tipo
 * @param {Object}  dados.valores         - snapshot financeiro completo
 * @param {number}  dados.valores.bruto   - valor total cobrado
 * @param {number}  dados.valores.taxa    - taxa da operadora (0 se não houver)
 * @param {number}  dados.valores.liquido - bruto - taxa
 * @param {number}  dados.valores.custo   - custo do produto/serviço
 * @param {number}  dados.valores.lucro   - liquido - custo
 * @param {string}  dados.descricao
 * @param {string}  dados.categoria
 * @param {string}  dados.formaPagamento
 * @param {Date}    dados.data
 * @param {"manual"|"venda"|"despesa"} dados.origem
 * @param {string}  [dados.referenciaId]  - impede duplicidade quando informado
 * @returns {Promise<string>} ID do documento criado
 */
export async function criarLancamentoCaixa(dados) {
  /* ── 0. Validação externa (antes de abrir transaction) ── */
  validarDadosLancamento(dados);

  const {
    empresaId, usuarioId, tipo,
    valores,
    descricao, categoria, formaPagamento,
    data, origem, referenciaId,
  } = dados;

  /* ── 1. Verificar duplicidade ANTES da transaction ──────────────────────
     getDocs NÃO pode ser usado dentro de runTransaction no SDK Web v9+.
     A verificação de duplicidade por query precisa ser feita fora,
     mas a criação do documento é protegida pela transaction.
     ────────────────────────────────────────────────────────────────────── */
  if (referenciaId) {
    const duplicateRef = collection(db, "empresas", empresaId, "caixa_diario");
    const q = query(
      duplicateRef,
      where("referenciaId", "==", referenciaId),
      where("origem", "==", origem),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(
        `duplicidade: já existe um lançamento com origem="${origem}" e referenciaId="${referenciaId}".`
      );
    }
  }

  /* ── 2. Executar transaction ── */
  let docIdCriado = null;

  await runTransaction(db, async (tx) => {
    /* ── 2.1 Referências ── */
    const contadorRef = doc(db, "empresas", empresaId, "contadores", "caixa_diario");
    const resumoRef   = doc(db, "empresas", empresaId, "resumo_caixa", "atual");

    /* ── 2.2 Ler contador (todas as leituras ANTES das escritas) ── */
    const contadorSnap = await tx.get(contadorRef);
    const ultimoId     = contadorSnap.exists() ? (contadorSnap.data().ultimoId ?? 0) : 0;
    const idSequencial = ultimoId + 1;

    /* ── 2.3 Ler resumo do caixa ── */
    const resumoSnap    = await tx.get(resumoRef);
    const saldoAnterior = resumoSnap.exists()
      ? (resumoSnap.data().saldoAtual ?? 0)
      : 0;

    /* ── 2.4 Calcular saldo usando valores.liquido (valor efetivo recebido/pago) ── */
    const saldoAtual = tipo === "entrada"
      ? saldoAnterior + valores.liquido
      : saldoAnterior - valores.liquido;

    /* ── 2.5 Gerar referência do novo documento ── */
    const novoCaixaRef = doc(
      collection(db, "empresas", empresaId, "caixa_diario")
    );
    docIdCriado = novoCaixaRef.id;

    /* ── 2.6 Escrever novo lançamento — snapshot imutável ── */
    tx.set(novoCaixaRef, {
      idSequencial,
      empresaId,
      usuarioId,

      tipo,

      /* snapshot financeiro completo — imutável após criação */
      valores: {
        bruto:   valores.bruto,
        taxa:    valores.taxa,
        liquido: valores.liquido,
        custo:   valores.custo,
        lucro:   valores.lucro,
      },

      descricao:      descricao.trim(),
      categoria:      categoria.trim(),
      formaPagamento: formaPagamento.trim(),

      data,
      criadoEm:    serverTimestamp(),
      atualizadoEm: serverTimestamp(),

      saldoAnterior,
      saldoAtual,

      origem,
      referenciaId: referenciaId ?? null,
    });

    /* ── 2.7 Atualizar contador ── */
    tx.set(contadorRef, { ultimoId: idSequencial }, { merge: true });

    /* ── 2.8 Atualizar resumo do caixa ── */
    tx.set(resumoRef, {
      saldoAtual,
      atualizadoEm: serverTimestamp(),
    }, { merge: true });
  });

  return docIdCriado;
}

/* ═══════════════════════════════════════════════════
   HELPER DE INTEGRAÇÃO — módulo de Vendas
   ═══════════════════════════════════════════════════

   Exemplo de uso no módulo de Vendas:

     import { montarValoresDaVenda, criarLancamentoCaixa } from "./CaixaDiario";

     const valores = montarValoresDaVenda({
       valorBruto: 150.00,
       formaPagamento: "Cartão crédito",
       taxaPercentual: 2.99,   // apenas para calcular — Caixa recebe o resultado
       custo: 80.00,
     });

     await criarLancamentoCaixa({
       empresaId, usuarioId,
       tipo: "entrada",
       origem: "venda",
       referenciaId: `V-${venda.idSequencial}`,
       descricao: `Recebimento venda #V-${venda.idSequencial}`,
       formaPagamento,
       categoria: "Venda",
       valores,
       data: new Date(),
     });
   ═══════════════════════════════════════════════════ */

/**
 * Monta o objeto `valores` a partir dos dados brutos de uma venda.
 * Esta função DEVE ser chamada no módulo de Vendas — NUNCA dentro do Caixa.
 *
 * @param {Object} param
 * @param {number} param.valorBruto      - total cobrado do cliente
 * @param {number} param.taxaPercentual  - percentual da taxa (ex: 2.99 para 2.99%)
 * @param {number} param.custo           - custo do produto/serviço
 * @returns {{ bruto, taxa, liquido, custo, lucro }}
 */
export function montarValoresDaVenda({ valorBruto, taxaPercentual = 0, custo = 0 }) {
  const bruto   = Math.round(valorBruto * 100) / 100;
  const taxa    = Math.round(bruto * (taxaPercentual / 100) * 100) / 100;
  const liquido = Math.round((bruto - taxa) * 100) / 100;
  const lucro   = Math.round((liquido - custo) * 100) / 100;
  return { bruto, taxa, liquido, custo, lucro };
}



const PERIODS = ["Hoje", "Ontem", "7 dias", "30 dias", "Mês atual", "Todos"];

const CATEGORIAS_ENTRADA = [
  "Venda", "Serviço", "Recebimento", "Transferência recebida",
  "Empréstimo recebido", "Outros",
];

const CATEGORIAS_SAIDA = [
  "Fornecedor", "Despesa operacional", "Salários", "Aluguel",
  "Impostos", "Transferência enviada", "Retirada", "Outros",
];

const FORMAS_PAGAMENTO = [
  "Dinheiro", "PIX", "Cartão débito", "Cartão crédito",
  "Transferência bancária", "Boleto", "Cheque",
];

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

const fmtR$ = (v = 0) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (d) => {
  if (!d) return "—";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtHora = (d) => {
  if (!d) return "—";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

function filtrarPorPeriodo(lista, period) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return lista.filter((l) => {
    const d = l.data?.toDate ? l.data.toDate() : new Date(l.data ?? l.criadoEm);
    if (period === "Hoje")       return d >= hoje;
    if (period === "Ontem") {
      const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
      return d >= ontem && d < hoje;
    }
    if (period === "7 dias")  { const t = new Date(hoje); t.setDate(t.getDate() - 7);  return d >= t; }
    if (period === "30 dias") { const t = new Date(hoje); t.setDate(t.getDate() - 30); return d >= t; }
    if (period === "Mês atual") {
      return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    }
    return true;
  });
}

function exportarCSV(lista) {
  const header = "ID Seq,Tipo,Descrição,Categoria,Forma Pgto,Bruto,Taxa,Líquido,Custo,Lucro,Saldo Anterior,Saldo Atual,Data,Origem";
  const rows = lista.map(l => {
    /* fallback para registros antigos que possuem apenas `valor` */
    const bruto   = l.valores?.bruto   ?? l.valor ?? 0;
    const taxa    = l.valores?.taxa    ?? 0;
    const liquido = l.valores?.liquido ?? l.valor ?? 0;
    const custo   = l.valores?.custo   ?? 0;
    const lucro   = l.valores?.lucro   ?? 0;
    return [
      l.idSequencial, l.tipo, `"${l.descricao}"`, l.categoria,
      l.formaPagamento,
      bruto, taxa, liquido, custo, lucro,
      l.saldoAnterior, l.saldoAtual,
      fmtData(l.data), l.origem,
    ].join(",");
  });
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `caixa_diario_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════ */
const CSS = `
  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 520px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-md { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
    position: sticky; top: 0;
    background: var(--s1); z-index: 2;
  }
  .modal-title {
    font-family: 'Sora', sans-serif;
    font-size: 16px; font-weight: 600; color: var(--text);
  }
  .modal-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; margin-top: 2px; transition: background .13s;
  }
  .modal-close:hover { background: var(--s2); border-color: var(--border-h); }
  .modal-body   { padding: 20px 22px; }
  .modal-footer {
    padding: 14px 22px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: var(--s1); z-index: 2;
  }

  /* ── Buttons ── */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-entrada {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,222,128,.12); color: var(--green);
    border: 1px solid rgba(74,222,128,.2); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-entrada:hover { background: rgba(74,222,128,.2); }

  .btn-saida {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(224,82,82,.1); color: var(--red);
    border: 1px solid rgba(224,82,82,.2); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-saida:hover { background: rgba(224,82,82,.18); }

  /* ── Forms ── */
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ── Tipo toggle ── */
  .tipo-toggle {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;
  }
  .tipo-btn {
    padding: 11px; border-radius: 10px; cursor: pointer;
    border: 1.5px solid var(--border); background: var(--s2);
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: all .15s;
  }
  .tipo-btn.entrada-active {
    background: rgba(74,222,128,.12); border-color: rgba(74,222,128,.4);
    color: var(--green);
  }
  .tipo-btn.saida-active {
    background: rgba(224,82,82,.1); border-color: rgba(224,82,82,.35);
    color: var(--red);
  }
  .tipo-btn:not(.entrada-active):not(.saida-active) { color: var(--text-3); }

  /* ── Topbar ── */
  .cx-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .cx-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .cx-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .cx-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px; flex: 1; min-width: 180px;
  }
  .cx-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }
  .cx-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

  /* ── Filtros de período ── */
  .cx-periods {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 22px; border-bottom: 1px solid var(--border);
    background: var(--s1); flex-wrap: wrap;
  }
  .cx-period-btn {
    padding: 5px 13px; border-radius: 20px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .cx-period-btn:hover { border-color: var(--border-h); color: var(--text); }
  .cx-period-btn.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold); font-weight: 600;
  }

  /* ── Cards de resumo ── */
  .cx-cards {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
    padding: 16px 22px; background: var(--s1);
    border-bottom: 1px solid var(--border);
  }
  @media (max-width: 640px) { .cx-cards { grid-template-columns: 1fr; } }
  .cx-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 16px;
  }
  .cx-card-label {
    font-size: 10px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 8px;
  }
  .cx-card-val {
    font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700;
    color: var(--text);
  }
  .cx-card-val.green { color: var(--green); }
  .cx-card-val.red   { color: var(--red);   }
  .cx-card-sub {
    font-size: 11px; color: var(--text-3); margin-top: 4px;
  }
  .cx-card-icon {
    float: right; margin-top: -28px; opacity: .18;
  }

  /* ── Tabela ── */
  .cx-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .cx-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .cx-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 8px;
  }
  .cx-count-badge {
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 9px; border-radius: 20px;
  }
  .cx-export-btn {
    padding: 5px 12px; border-radius: 7px; font-size: 11px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    border: 1px solid var(--border); background: var(--s3); color: var(--text-2);
    display: flex; align-items: center; gap: 5px; transition: all .13s;
  }
  .cx-export-btn:hover { background: var(--s2); color: var(--text); }

  /* Linha */
  .cx-row {
    display: grid;
    grid-template-columns: 60px 90px 1fr 130px 130px 110px 110px 90px;
    align-items: center; padding: 11px 18px; gap: 12px;
    border-bottom: 1px solid var(--border); transition: background .1s; cursor: pointer;
  }
  .cx-row:last-child { border-bottom: none; }
  .cx-row:not(.cx-row-head):hover { background: var(--s2); }
  .cx-row-head {
    background: var(--s2); cursor: default;
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
  }
  .cx-row > span { font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cx-row-head > span { color: var(--text-3); }

  .cx-seq { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--text-3) !important; }
  .cx-desc { color: var(--text) !important; font-size: 13px !important; font-weight: 500; }
  .cx-val-entrada { color: var(--green) !important; font-weight: 600; font-size: 13px !important; }
  .cx-val-saida   { color: var(--red) !important;   font-weight: 600; font-size: 13px !important; }
  .cx-saldo       { color: var(--text) !important;  font-family: 'Sora', sans-serif; font-size: 12px !important; }

  .cx-tipo-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600;
    font-family: 'DM Sans', sans-serif;
  }
  .cx-tipo-entrada { background: rgba(74,222,128,.1);  color: var(--green); }
  .cx-tipo-saida   { background: rgba(224,82,82,.1);   color: var(--red);   }

  .cx-fp-badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px;
    background: var(--s3); border: 1px solid var(--border-h); color: var(--text-2);
  }
  .cx-origem-badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px;
    font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
    background: var(--s3); color: var(--text-3);
  }

  /* ── Empty / Loading ── */
  .cx-loading, .cx-empty {
    text-align: center; padding: 48px 22px; color: var(--text-3); font-size: 13px;
  }
  .cx-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; }

  /* ── Toast ── */
  .cx-toast {
    position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
    background: var(--s1); border: 1px solid var(--border-h);
    color: var(--text); border-radius: 10px; padding: 11px 18px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,.5); z-index: 9999;
    display: flex; align-items: center; gap: 8px;
    animation: slideUp .2s ease;
  }
  .cx-toast.success { border-color: rgba(74,222,128,.4); color: var(--green); }
  .cx-toast.error   { border-color: rgba(224,82,82,.4);  color: var(--red);   }

  /* ── Detalhe ── */
  .cx-detalhe-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px;
  }
  .cx-detalhe-row:last-child { border-bottom: none; }
  .cx-detalhe-label { color: var(--text-3); font-size: 12px; }
  .cx-detalhe-val   { color: var(--text); font-weight: 500; }

  /* ── Responsividade ── */
  @media (max-width: 900px) {
    .cx-row {
      grid-template-columns: 55px 85px 1fr 110px 100px 90px;
    }
    .cx-row > *:nth-child(7),
    .cx-row > *:nth-child(8) { display: none; }
  }
`;

/* ═══════════════════════════════════════════════════
   MODAL — Novo Lançamento
   ═══════════════════════════════════════════════════ */

function ModalNovoLancamento({ empresaId, usuarioId, saldoAtual, onSave, onClose }) {
  const [tipo,           setTipo]           = useState("entrada");
  const [valorBruto,     setValorBruto]     = useState("");
  const [taxa,           setTaxa]           = useState("0");
  const [custo,          setCusto]          = useState("0");
  const [descricao,      setDescricao]      = useState("");
  const [categoria,      setCategoria]      = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [data,           setData]           = useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  const [salvando, setSalvando] = useState(false);
  const [erros,    setErros]    = useState({});

  const categorias = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  /* valores derivados — apenas para prévia visual, sem salvar esses cálculos */
  const bruto   = parseFloat(String(valorBruto).replace(",", ".")) || 0;
  const taxaNum = parseFloat(String(taxa).replace(",", "."))       || 0;
  const custoNum= parseFloat(String(custo).replace(",", "."))      || 0;
  const liquido = Math.round((bruto - taxaNum) * 100) / 100;
  const lucro   = Math.round((liquido - custoNum) * 100) / 100;

  const validar = () => {
    const e = {};
    if (!valorBruto || isNaN(bruto) || bruto <= 0) e.valorBruto = "Informe um valor bruto válido maior que zero.";
    if (taxaNum < 0)    e.taxa  = "Taxa não pode ser negativa.";
    if (taxaNum > bruto) e.taxa = "Taxa não pode ser maior que o valor bruto.";
    if (custoNum < 0)   e.custo = "Custo não pode ser negativo.";
    if (!descricao.trim())  e.descricao = "Descrição obrigatória.";
    if (!categoria)         e.categoria = "Selecione uma categoria.";
    if (!formaPagamento)    e.formaPagamento = "Selecione a forma de pagamento.";
    if (!data)              e.data = "Data obrigatória.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const dados = {
        empresaId,
        usuarioId,
        tipo,
        /* objeto valores completo — Caixa não calcula, apenas persiste */
        valores: {
          bruto,
          taxa:    taxaNum,
          liquido,
          custo:   custoNum,
          lucro,
        },
        descricao,
        categoria,
        formaPagamento,
        data: new Date(data + "T12:00:00"),
        origem: "manual",
      };
      await onSave(dados);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Novo Lançamento</div>
            <div className="modal-sub">Saldo atual: {fmtR$(saldoAtual)}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-body">
          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de lançamento <span className="form-label-req">*</span></label>
            <div className="tipo-toggle">
              <button
                className={`tipo-btn ${tipo === "entrada" ? "entrada-active" : ""}`}
                onClick={() => { setTipo("entrada"); setCategoria(""); }}
              >
                <ArrowUpCircle size={15} /> Entrada
              </button>
              <button
                className={`tipo-btn ${tipo === "saida" ? "saida-active" : ""}`}
                onClick={() => { setTipo("saida"); setCategoria(""); }}
              >
                <ArrowDownCircle size={15} /> Saída
              </button>
            </div>
          </div>

          {/* Valor Bruto */}
          <div className="form-group">
            <label className="form-label">Valor Bruto (R$) <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.valorBruto ? "err" : ""}`}
              type="number" min="0.01" step="0.01" placeholder="0,00"
              value={valorBruto} onChange={e => setValorBruto(e.target.value)}
            />
            {erros.valorBruto && <div className="form-error">{erros.valorBruto}</div>}
          </div>

          {/* Taxa + Custo */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Taxa (R$)</label>
              <input
                className={`form-input ${erros.taxa ? "err" : ""}`}
                type="number" min="0" step="0.01" placeholder="0,00"
                value={taxa} onChange={e => setTaxa(e.target.value)}
              />
              {erros.taxa && <div className="form-error">{erros.taxa}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Custo (R$)</label>
              <input
                className={`form-input ${erros.custo ? "err" : ""}`}
                type="number" min="0" step="0.01" placeholder="0,00"
                value={custo} onChange={e => setCusto(e.target.value)}
              />
              {erros.custo && <div className="form-error">{erros.custo}</div>}
            </div>
          </div>

          {/* Descrição */}
          <div className="form-group">
            <label className="form-label">Descrição <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.descricao ? "err" : ""}`}
              placeholder="Ex: Recebimento de cliente João..."
              value={descricao} onChange={e => setDescricao(e.target.value)}
            />
            {erros.descricao && <div className="form-error">{erros.descricao}</div>}
          </div>

          {/* Categoria + Forma de Pagamento */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria <span className="form-label-req">*</span></label>
              <select
                className={`form-input ${erros.categoria ? "err" : ""}`}
                value={categoria} onChange={e => setCategoria(e.target.value)}
              >
                <option value="">Selecionar...</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {erros.categoria && <div className="form-error">{erros.categoria}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Forma de Pagamento <span className="form-label-req">*</span></label>
              <select
                className={`form-input ${erros.formaPagamento ? "err" : ""}`}
                value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
              >
                <option value="">Selecionar...</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {erros.formaPagamento && <div className="form-error">{erros.formaPagamento}</div>}
            </div>
          </div>

          {/* Data */}
          <div className="form-group">
            <label className="form-label">Data <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.data ? "err" : ""}`}
              type="date" value={data} onChange={e => setData(e.target.value)}
            />
            {erros.data && <div className="form-error">{erros.data}</div>}
          </div>

          {/* Prévia do snapshot financeiro */}
          {bruto > 0 && (
            <div style={{
              background: tipo === "entrada" ? "rgba(74,222,128,.06)" : "rgba(224,82,82,.06)",
              border: `1px solid ${tipo === "entrada" ? "rgba(74,222,128,.2)" : "rgba(224,82,82,.2)"}`,
              borderRadius: 10, padding: "12px 14px", marginTop: 4,
            }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Prévia do Snapshot Financeiro
              </div>
              {[
                ["Bruto",   fmtR$(bruto),    "var(--text)"],
                ["Taxa",    `- ${fmtR$(taxaNum)}`, "var(--red)"],
                ["Líquido", fmtR$(liquido),  "var(--text)"],
                ["Custo",   `- ${fmtR$(custoNum)}`, "var(--red)"],
                ["Lucro",   fmtR$(lucro),    lucro >= 0 ? "var(--green)" : "var(--red)"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-3)" }}>{label}</span>
                  <span style={{ color, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", marginTop: 8,
                paddingTop: 8, borderTop: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Saldo após</span>
                <span style={{
                  fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14,
                  color: tipo === "entrada" ? "var(--green)" : "var(--red)",
                }}>
                  {fmtR$(tipo === "entrada" ? saldoAtual + liquido : saldoAtual - liquido)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={salvando}
          >
            {salvando ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
            {salvando ? "Salvando..." : "Registrar Lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL — Detalhe do Lançamento
   ═══════════════════════════════════════════════════ */

function ModalDetalheLancamento({ lancamento, onClose }) {
  const isEntrada = lancamento.tipo === "entrada";

  /* compatibilidade: registros antigos possuem apenas `valor` */
  const v = lancamento.valores;
  const legado = !v;
  const bruto   = v?.bruto   ?? lancamento.valor ?? 0;
  const taxa    = v?.taxa    ?? 0;
  const liquido = v?.liquido ?? lancamento.valor ?? 0;
  const custo   = v?.custo   ?? 0;
  const lucro   = v?.lucro   ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalhe do Lançamento</div>
            <div className="modal-sub">#{lancamento.idSequencial} · {fmtData(lancamento.data)}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Tipo</span>
            <span className={`cx-tipo-badge ${isEntrada ? "cx-tipo-entrada" : "cx-tipo-saida"}`}>
              {isEntrada ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
              {lancamento.tipo}
            </span>
          </div>

          {/* Snapshot financeiro */}
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Valor Bruto</span>
            <span className="cx-detalhe-val" style={{ color: isEntrada ? "var(--green)" : "var(--red)", fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
              {isEntrada ? "+" : "-"}{fmtR$(bruto)}
            </span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Taxa</span>
            <span className="cx-detalhe-val" style={{ color: taxa > 0 ? "var(--red)" : "var(--text-3)" }}>
              {taxa > 0 ? `- ${fmtR$(taxa)}` : fmtR$(0)}
            </span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Líquido</span>
            <span className="cx-detalhe-val" style={{ fontWeight: 600 }}>{fmtR$(liquido)}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Custo</span>
            <span className="cx-detalhe-val" style={{ color: custo > 0 ? "var(--red)" : "var(--text-3)" }}>
              {custo > 0 ? `- ${fmtR$(custo)}` : fmtR$(0)}
            </span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Lucro</span>
            <span className="cx-detalhe-val" style={{ color: lucro >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
              {fmtR$(lucro)}
            </span>
          </div>

          {legado && (
            <div style={{ fontSize: 10, color: "var(--text-3)", padding: "4px 0", fontStyle: "italic" }}>
              * Registro legado — snapshot detalhado indisponível.
            </div>
          )}

          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Descrição</span>
            <span className="cx-detalhe-val" style={{ maxWidth: 220, textAlign: "right" }}>{lancamento.descricao}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Categoria</span>
            <span className="cx-detalhe-val">{lancamento.categoria}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Forma de Pagamento</span>
            <span className="cx-fp-badge">{lancamento.formaPagamento}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Data</span>
            <span className="cx-detalhe-val">{fmtData(lancamento.data)}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Saldo Anterior</span>
            <span className="cx-detalhe-val">{fmtR$(lancamento.saldoAnterior)}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Saldo Após</span>
            <span className="cx-detalhe-val" style={{ fontWeight: 700 }}>{fmtR$(lancamento.saldoAtual)}</span>
          </div>
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Origem</span>
            <span className="cx-origem-badge">{lancamento.origem}</span>
          </div>
          {lancamento.referenciaId && (
            <div className="cx-detalhe-row">
              <span className="cx-detalhe-label">Referência ID</span>
              <span className="cx-detalhe-val" style={{ fontSize: 11, color: "var(--text-3)" }}>{lancamento.referenciaId}</span>
            </div>
          )}
          <div className="cx-detalhe-row">
            <span className="cx-detalhe-label">Registrado em</span>
            <span className="cx-detalhe-val" style={{ fontSize: 11 }}>
              {fmtData(lancamento.criadoEm)} {fmtHora(lancamento.criadoEm)}
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
   COMPONENTE PRINCIPAL — CaixaDiario
   ═══════════════════════════════════════════════════ */

export default function CaixaDiario({ empresaId: empresaIdProp }) {
  const [uid,         setUid]         = useState(null);
  const [empresaId,   setEmpresaId]   = useState(empresaIdProp || null);
  const [lancamentos, setLancamentos] = useState([]);
  const [resumo,      setResumo]      = useState({ saldoAtual: 0 });
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [period,      setPeriod]      = useState("Hoje");
  const [modalNovo,   setModalNovo]   = useState(false);
  const [detalhe,     setDetalhe]     = useState(null);
  const [toast,       setToast]       = useState(null);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      if (!empresaIdProp && user?.uid) setEmpresaId(user.uid); // fallback
    });
    return unsub;
  }, [empresaIdProp]);

  /* ── Snapshot lançamentos ── */
  useEffect(() => {
    if (!empresaId) return;
    setLoading(true);
    const ref = collection(db, "empresas", empresaId, "caixa_diario");
    const q   = query(ref, orderBy("idSequencial", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLancamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [empresaId]);

  /* ── Snapshot resumo ── */
  useEffect(() => {
    if (!empresaId) return;
    const ref = doc(db, "empresas", empresaId, "resumo_caixa", "atual");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setResumo(snap.data());
      else               setResumo({ saldoAtual: 0 });
    });
    return unsub;
  }, [empresaId]);

  /* ── Toast helper ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Salvar lançamento ── */
  const handleSave = async (dados) => {
    if (!uid || !empresaId) return;
    try {
      await criarLancamentoCaixa({ ...dados, empresaId, usuarioId: uid });
      setModalNovo(false);
      showToast("Lançamento registrado com sucesso!");
    } catch (err) {
      console.error("Erro ao criar lançamento:", err);
      showToast(err.message || "Erro ao registrar lançamento.", "error");
      throw err; // para manter o modal aberto
    }
  };

  /* ── Filtros ── */
  const lancamentosFiltrados = useMemo(() => {
    let lista = filtrarPorPeriodo(lancamentos, period);
    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(l =>
        l.descricao?.toLowerCase().includes(q) ||
        l.categoria?.toLowerCase().includes(q) ||
        l.formaPagamento?.toLowerCase().includes(q) ||
        String(l.idSequencial).includes(q)
      );
    }
    return lista;
  }, [lancamentos, period, search]);

  /* ── Totais do período ── */
  const { totalEntradas, totalSaidas } = useMemo(() => {
    let totalEntradas = 0, totalSaidas = 0;
    lancamentosFiltrados.forEach(l => {
      /* compatibilidade com registros legados que possuem apenas `valor` */
      const val = l.valores?.liquido ?? l.valor ?? 0;
      if (l.tipo === "entrada") totalEntradas += val;
      else                      totalSaidas   += val;
    });
    return { totalEntradas, totalSaidas };
  }, [lancamentosFiltrados]);

  if (!uid) return <div className="cx-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Topbar */}
      <header className="cx-topbar">
        <div className="cx-topbar-title">
          <h1>Caixa Diário</h1>
          <p>Controle de entradas e saídas financeiras</p>
        </div>

        <div className="cx-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por descrição, categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="cx-topbar-right">
          <button
            onClick={() => setModalNovo(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 9,
              background: "var(--gold)", color: "#0a0808",
              border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
              whiteSpace: "nowrap", transition: "opacity .13s",
            }}
          >
            <Plus size={14} /> Novo Lançamento
          </button>
        </div>
      </header>

      {/* Filtros de período */}
      <div className="cx-periods">
        {PERIODS.map(p => (
          <button
            key={p}
            className={`cx-period-btn ${period === p ? "active" : ""}`}
            onClick={() => setPeriod(p)}
          >{p}</button>
        ))}
      </div>

      {/* Cards de resumo */}
      <div className="cx-cards">
        <div className="cx-card">
          <div className="cx-card-label">Saldo Atual</div>
          <div
            className="cx-card-val"
            style={{ color: resumo.saldoAtual >= 0 ? "var(--text)" : "var(--red)" }}
          >
            {fmtR$(resumo.saldoAtual)}
          </div>
          <div className="cx-card-sub">Acumulado geral</div>
          <DollarSign size={36} className="cx-card-icon" color="var(--gold)" />
        </div>

        <div className="cx-card">
          <div className="cx-card-label">Entradas · {period}</div>
          <div className="cx-card-val green">{fmtR$(totalEntradas)}</div>
          <div className="cx-card-sub">{lancamentosFiltrados.filter(l => l.tipo === "entrada").length} lançamentos</div>
          <TrendingUp size={36} className="cx-card-icon" color="var(--green)" />
        </div>

        <div className="cx-card">
          <div className="cx-card-label">Saídas · {period}</div>
          <div className="cx-card-val red">{fmtR$(totalSaidas)}</div>
          <div className="cx-card-sub">{lancamentosFiltrados.filter(l => l.tipo === "saida").length} lançamentos</div>
          <TrendingDown size={36} className="cx-card-icon" color="var(--red)" />
        </div>
      </div>

      {/* Tabela */}
      <div className="ag-content">
        <div className="cx-table-wrap">
          <div className="cx-table-header">
            <div className="cx-table-title">
              Lançamentos
              <span className="cx-count-badge">{lancamentosFiltrados.length}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cx-export-btn" onClick={() => exportarCSV(lancamentosFiltrados)}>
                <Download size={11} /> CSV
              </button>
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="cx-row cx-row-head">
            <span>#</span>
            <span>TIPO</span>
            <span>DESCRIÇÃO</span>
            <span>CATEGORIA</span>
            <span>FORMA PGTO</span>
            <span>VALOR</span>
            <span>SALDO APÓS</span>
            <span>DATA</span>
          </div>

          {loading ? (
            <div className="cx-loading">Carregando lançamentos...</div>
          ) : lancamentosFiltrados.length === 0 ? (
            <div className="cx-empty">
              <DollarSign size={28} color="var(--text-3)" />
              <p>Nenhum lançamento encontrado.</p>
              <p style={{ fontSize: 12 }}>Registre entradas e saídas do caixa.</p>
            </div>
          ) : lancamentosFiltrados.map(l => (
            <div key={l.id} className="cx-row" onClick={() => setDetalhe(l)}>
              <span className="cx-seq">#{l.idSequencial}</span>
              <span>
                <span className={`cx-tipo-badge ${l.tipo === "entrada" ? "cx-tipo-entrada" : "cx-tipo-saida"}`}>
                  {l.tipo === "entrada"
                    ? <ArrowUpCircle size={10} />
                    : <ArrowDownCircle size={10} />
                  }
                  {l.tipo}
                </span>
              </span>
              <span className="cx-desc">{l.descricao}</span>
              <span>{l.categoria}</span>
              <span><span className="cx-fp-badge">{l.formaPagamento}</span></span>
              <span className={l.tipo === "entrada" ? "cx-val-entrada" : "cx-val-saida"}>
                {l.tipo === "entrada" ? "+" : "-"}{fmtR$(l.valores?.liquido ?? l.valor ?? 0)}
              </span>
              <span className="cx-saldo">{fmtR$(l.saldoAtual)}</span>
              <span>{fmtData(l.data)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {modalNovo && (
        <ModalNovoLancamento
          empresaId={empresaId}
          usuarioId={uid}
          saldoAtual={resumo.saldoAtual}
          onSave={handleSave}
          onClose={() => setModalNovo(false)}
        />
      )}

      {detalhe && (
        <ModalDetalheLancamento
          lancamento={detalhe}
          onClose={() => setDetalhe(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`cx-toast ${toast.type}`}>
          {toast.type === "success"
            ? <ArrowUpCircle size={14} />
            : <AlertCircle size={14} />
          }
          {toast.msg}
        </div>
      )}
    </>
  );
}
