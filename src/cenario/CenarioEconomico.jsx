// src/cenario/CenarioEconomico.jsx
// ASSENT Cenário Econômico — painel independente de indicadores (API pública SGS/BCB)
//
// Segurança / arquitetura:
//  • Sem Firestore, sem auth, sem API key. Somente leitura de API pública.
//  • Só busca séries da whitelist SERIES (códigos fixos, nenhuma entrada do usuário na URL).
//  • Resposta validada (formato, data, número finito). Nenhum dangerouslySetInnerHTML.
//  • Cache em localStorage (namespace próprio), lido de forma defensiva.
//  • Tema/cores herdam as variáveis CSS do Dashboard (.ag-app / .ag-app.light).
//
// Séries oficiais (SGS/BCB):
//  432   Meta Selic definida pelo Copom (% a.a., diária)
//  1178  Selic anualizada base 252 — efetiva (% a.a., diária)
//  4389  CDI anualizada base 252 (% a.a., diária)
//  433   IPCA — variação mensal (%)
//  13522 IPCA — acumulado em 12 meses (%)
//  189   IGP-M — variação mensal (%)   → 12m calculado por encadeamento
//  1     Dólar americano, câmbio livre — venda (R$, diária)
//  10813 Dólar americano, câmbio livre — compra (R$, diária)

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceDot, ReferenceLine, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, RefreshCw, ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";

/* ═══════════════════ CONFIG ═══════════════════ */
const API_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.";
const SRC_URL  = "https://dadosabertos.bcb.gov.br/";
const LS       = "assent_cenario_v1:";
const MIN      = 60 * 1000;
const COOLDOWN = 60 * 1000;
const DATE_RE  = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const SERIES = {
  selicMeta: { code: 432,   freq: "D", ttl: 30 * MIN,      win: 400 },
  selicEf:   { code: 1178,  freq: "D", ttl: 30 * MIN,      win: 45  },
  cdi:       { code: 4389,  freq: "D", ttl: 30 * MIN,      win: 45  },
  usdV:      { code: 1,     freq: "D", ttl: 30 * MIN,      win: 45  },
  usdC:      { code: 10813, freq: "D", ttl: 30 * MIN,      win: 45  },
  eurV:      { ptax: true, moeda: "EUR", side: "V", freq: "D", ttl: 30 * MIN, win: 45 },
  eurC:      { ptax: true, moeda: "EUR", side: "C", freq: "D", ttl: 30 * MIN, win: 45 },
  ipcaM:     { code: 433,   freq: "M", ttl: 6 * 60 * MIN,  win: 800 },
  ipca12:    { code: 13522, freq: "M", ttl: 6 * 60 * MIN,  win: 800 },
  igpmM:     { code: 189,   freq: "M", ttl: 6 * 60 * MIN,  win: 800 },
};

const PERIODS = [
  { id: "30d", label: "30 dias", days: 30   },
  { id: "3m",  label: "3 meses", days: 92   },
  { id: "6m",  label: "6 meses", days: 183  },
  { id: "12m", label: "12 meses", days: 366 },
  { id: "5a",  label: "5 anos",  days: 1827 },
];

const CHARTS = {
  selic: {
    label: "Selic", freq: "D", dec: 2, mode: "pp",
    views: [{
      id: "d", label: "Meta × Efetiva", unit: "% a.a.",
      lines: [
        { src: "selicMeta", name: "Selic meta",     color: "var(--gold)", step: true },
        { src: "selicEf",   name: "Selic efetiva",  color: "var(--blue)", ghost: true },
      ],
    }],
  },
  ipca: {
    label: "IPCA", freq: "M", dec: 2, mode: "pp",
    views: [
      { id: "m", label: "Mensal",        unit: "% a.m.", bar: true, lines: [{ src: "ipcaM",  name: "IPCA mensal",    color: "var(--gold)" }] },
      { id: "a", label: "Acumulado 12m", unit: "% 12m",              lines: [{ src: "ipca12", name: "IPCA 12 meses", color: "var(--gold)" }] },
    ],
  },
  cdi: {
    label: "CDI", freq: "D", dec: 2, mode: "pp",
    views: [{ id: "d", label: "Anualizado (base 252)", unit: "% a.a.", lines: [{ src: "cdi", name: "CDI", color: "var(--gold)" }] }],
  },
  igpm: {
    label: "IGP-M", freq: "M", dec: 2, mode: "pp",
    views: [
      { id: "m", label: "Mensal",        unit: "% a.m.", bar: true, lines: [{ src: "igpmM",  name: "IGP-M mensal",    color: "var(--gold)" }] },
      { id: "a", label: "Acumulado 12m", unit: "% 12m",              lines: [{ src: "igpm12", name: "IGP-M 12 meses", color: "var(--gold)" }] },
    ],
  },
  usd: {
    label: "Dólar", freq: "D", dec: 4, mode: "pct",
    views: [{
      id: "d", label: "Venda × Compra", unit: "R$",
      lines: [
        { src: "usdV", name: "Venda",  color: "var(--gold)" },
        { src: "usdC", name: "Compra", color: "var(--blue)", ghost: true },
      ],
    }],
  },
  eur: {
    label: "Euro", freq: "D", dec: 4, mode: "pct",
    views: [{
      id: "d", label: "Venda × Compra (PTAX)", unit: "R$",
      lines: [
        { src: "eurV", name: "Venda",  color: "var(--gold)" },
        { src: "eurC", name: "Compra", color: "var(--blue)", ghost: true },
      ],
    }],
  },
  cmp: {
    label: "Comparar", freq: "M", dec: 2, mode: "pp",
    views: [
      {
        id: "c", label: "Selic × IPCA 12m", unit: "% a.a.",
        lines: [
          { src: "selicM", name: "Selic meta (fim do mês)", color: "var(--gold)", step: true },
          { src: "ipca12", name: "IPCA 12 meses",           color: "var(--blue)", ghost: true },
        ],
      },
      { id: "r", label: "Juro real", unit: "%", lines: [{ src: "real", name: "Juro real", color: "var(--gold)" }] },
    ],
  },
};

const OLINDA = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/";
const LIVE_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL";
const LIVE_EVERY = 2 * MIN;

const INFO = [
  { id: "selic", t: "Selic",  d: "Taxa básica de juros. Quando sobe, crédito e financiamentos ficam mais caros e aplicações rendem mais; quando cai, o contrário. A meta é definida pelo Copom; a efetiva é a taxa média praticada no mercado." },
  { id: "ipca",  t: "IPCA",   d: "Inflação oficial, medida pelo IBGE. Mostra quanto os preços ao consumidor variaram no mês e em 12 meses. Ajuda a revisar preços e custos." },
  { id: "cdi",   t: "CDI",    d: "Taxa de referência das aplicações de renda fixa, sempre muito próxima da Selic. Serve de base para comparar rendimentos." },
  { id: "igpm",  t: "IGP-M",  d: "Índice da FGV usado como referência em reajustes de contratos, como aluguéis. Reflete preços no atacado, na construção e no consumo." },
  { id: "usd",   t: "Dólar",  d: "Cotação comercial do dólar americano. Influencia o custo de produtos importados, insumos e fornecedores que dependem de moeda estrangeira." },
  { id: "eur",   t: "Euro",   d: "Cotação do euro em reais (PTAX de fechamento do Banco Central). Importante para quem compra da Europa, viaja ou tem fornecedores e contratos em euro." },
  { id: "real",  t: "Juro real", d: "Quanto a Selic rende acima da inflação: (1 + Selic) ÷ (1 + IPCA 12m) - 1. Juro real alto encarece o crédito e favorece quem investe em renda fixa. É uma medida simplificada, não uma previsão." },
];

/* ═══════════════════ UTILS ═══════════════════ */
const nf = {};
const fmt = (v, d = 2) => {
  if (!Number.isFinite(v)) return "n/d";
  nf[d] = nf[d] || new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return nf[d].format(v);
};
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); };
const toBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMes = (iso) => `${MESES[+iso.slice(5, 7) - 1]}/${iso.slice(0, 4)}`;
const fmtDia = (iso) => toBR(iso);
const fmtTs = (t) => {
  const d = new Date(t);
  return `${toBR(isoLocal(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const sliceFrom = (d, from) => d.filter((r) => r[0] >= from);
const ymIdx = (iso) => +iso.slice(0, 4) * 12 + +iso.slice(5, 7);

function downsample(rows, max = 320) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  const out = rows.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
  return out;
}

function rolling12(m) {
  const out = [];
  for (let i = 11; i < m.length; i++) {
    if (ymIdx(m[i][0]) - ymIdx(m[i - 11][0]) !== 11) continue;
    let f = 1;
    for (let k = i - 11; k <= i; k++) f *= 1 + m[k][1] / 100;
    out.push([m[i][0], (f - 1) * 100]);
  }
  return out;
}

function monthlyLast(a) {
  const m = new Map();
  for (const [d, v] of a) m.set(d.slice(0, 7), v);
  return [...m.entries()].map(([ym, v]) => [`${ym}-01`, v]);
}
function realSeries(selicM, ipca12) {
  const sm = new Map(selicM.map(([d, v]) => [d.slice(0, 7), v]));
  const out = [];
  for (const [d, ip] of ipca12) {
    const sv = sm.get(d.slice(0, 7));
    if (sv != null) out.push([d, ((1 + sv / 100) / (1 + ip / 100) - 1) * 100]);
  }
  return out;
}
function parseNum(s) {
  let t = String(s).trim().replace(/[^\d.,]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
const irRate = (days) => (days <= 180 ? 0.225 : days <= 360 ? 0.2 : days <= 720 ? 0.175 : 0.15);
function fmtLiveAt(at, t) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(at || "");
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : fmtTs(t);
}

/* ═══════════════════ CACHE + FETCH ═══════════════════ */
function readCache(key) {
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.from !== "string" || typeof o.t !== "number" || !Array.isArray(o.d) || o.d.length > 20000) return null;
    const ok = o.d.every((r) => Array.isArray(r) && typeof r[0] === "string" && Number.isFinite(r[1]));
    return ok ? o : null;
  } catch { return null; }
}
function writeCache(key, obj) {
  try { localStorage.setItem(LS + key, JSON.stringify(obj)); } catch { /* quota/privado: ignora */ }
}

const usDate = (iso) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`;
const ptaxInflight = new Map();
function fetchPtaxRows(moeda, fromIso) {
  if (moeda !== "EUR") return Promise.reject(new Error("moeda"));
  const id = `${moeda}|${fromIso}`;
  let p = ptaxInflight.get(id);
  if (!p) {
    p = (async () => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 20000);
      try {
        const url = `${OLINDA}CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
          `?@moeda='${moeda}'&@dataInicial='${usDate(fromIso)}'&@dataFinalCotacao='${usDate(daysAgo(0))}'` +
          `&$top=10000&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error("http " + r.status);
        const j = await r.json();
        if (!Array.isArray(j?.value)) throw new Error("formato");
        const byDay = new Map(); // fica com o último boletim do dia (PTAX de fechamento)
        for (const x of j.value) {
          const dh = typeof x?.dataHoraCotacao === "string" ? x.dataHoraCotacao : "";
          const d = dh.slice(0, 10);
          const v = Number(x?.cotacaoVenda), c = Number(x?.cotacaoCompra);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !(v > 0) || !(c > 0)) continue;
          const cur = byDay.get(d);
          if (!cur || dh > cur.dh) byDay.set(d, { dh, v, c });
        }
        const out = [...byDay.entries()].map(([d, o]) => [d, o.v, o.c]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
        if (!out.length) throw new Error("vazio");
        return out;
      } finally { clearTimeout(to); }
    })().finally(() => ptaxInflight.delete(id));
    ptaxInflight.set(id, p);
  }
  return p;
}

async function fetchRaw(key, fromIso) {
  const s = SERIES[key];
  if (!s) throw new Error("serie");
  if (s.ptax) {
    const rows = await fetchPtaxRows(s.moeda, fromIso);
    return rows.map((r) => [r[0], s.side === "V" ? r[1] : r[2]]);
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const url = `${API_BASE}${s.code}/dados?formato=json&dataInicial=${toBR(fromIso)}&dataFinal=${toBR(daysAgo(0))}`;
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error("formato");
    const out = [];
    for (const x of j) {
      const m = DATE_RE.exec(x?.data);
      const v = Number(x?.valor);
      if (m && Number.isFinite(v)) out.push([`${m[3]}-${m[2]}-${m[1]}`, v]);
    }
    if (!out.length) throw new Error("vazio");
    out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return out;
  } finally { clearTimeout(to); }
}

async function fetchLive() {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(LIVE_URL, { signal: ctrl.signal });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const out = {};
    for (const [k, cur] of [["USDBRL", "USD"], ["EURBRL", "EUR"]]) {
      const x = j?.[k];
      const bid = Number(x?.bid), ask = Number(x?.ask), pct = Number(x?.pctChange);
      if (bid > 0 && ask > 0 && bid < 1000 && ask < 1000) {
        out[cur] = { bid, ask, pct: Number.isFinite(pct) ? pct : null, at: typeof x?.create_date === "string" ? x.create_date.slice(0, 19) : "" };
      }
    }
    if (!out.USD && !out.EUR) throw new Error("vazio");
    return { ...out, t: Date.now() };
  } finally { clearTimeout(to); }
}

const inflight = new Map();
async function getSeries(key, fromIso, force = false) {
  const s = SERIES[key];
  const c = readCache(key);
  const covers = c && c.from <= fromIso;
  if (covers && !force && Date.now() - c.t < s.ttl) {
    return { data: sliceFrom(c.d, fromIso), t: c.t, stale: false };
  }
  const id = `${key}|${fromIso}`;
  let p = inflight.get(id);
  if (!p) { p = fetchRaw(key, fromIso).finally(() => inflight.delete(id)); inflight.set(id, p); }
  try {
    const d = await p;
    const t = Date.now();
    const merged = covers ? [...c.d.filter((r) => r[0] < fromIso), ...d] : d;
    writeCache(key, { from: covers ? c.from : fromIso, t, d: merged });
    return { data: d, t, stale: false };
  } catch (e) {
    if (covers) return { data: sliceFrom(c.d, fromIso), t: c.t, stale: true };
    throw e;
  }
}

/* ═══════════════════ CARDS ═══════════════════ */
const last = (a) => (a && a.length ? a[a.length - 1] : null);
const prev = (a) => (a && a.length > 1 ? a[a.length - 2] : null);

function mkDelta(cur, pr, mode, ctx) {
  if (cur == null || pr == null) return null;
  const diff = mode === "pct" ? ((cur / pr) - 1) * 100 : cur - pr;
  const kind = Math.abs(diff) < 0.005 ? "flat" : diff > 0 ? "up" : "down";
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const txt = kind === "flat" ? "Estável" : `${sign}${fmt(Math.abs(diff), 2)} ${mode === "pct" ? "%" : "p.p."}`;
  return { kind, txt, ctx };
}

function buildCards(st, live) {
  const g = (k) => st[k]?.data;
  const cards = [];

  // Selic
  {
    const a = g("selicMeta"), ef = last(g("selicEf"));
    let value = null, ref = null, delta = null;
    if (a?.length) {
      const [d, v] = last(a); value = v; ref = fmtDia(d);
      let i = a.length - 1;
      while (i > 0 && a[i - 1][1] === v) i--;
      delta = i > 0
        ? mkDelta(v, a[i - 1][1], "pp", `vigente desde ${fmtDia(a[i][0])}`)
        : { kind: "flat", txt: "Estável", ctx: "sem alteração em ~13 meses" };
    }
    cards.push({
      id: "selic", name: "Selic meta", freq: "Diário", code: "SGS 432", unit: " % a.a.", dec: 2, value, ref, delta,
      sub: ef ? [{ k: "Selic efetiva", v: `${fmt(ef[1], 2)}% a.a.` }] : [],
      spark: a ? downsample(a.map((r) => r[1]), 60) : [], step: true,
      avail: !!a?.length,
    });
  }
  // IPCA
  {
    const a = g("ipca12"), m = last(g("ipcaM"));
    cards.push({
      id: "ipca", name: "IPCA · 12 meses", freq: "Mensal", code: "SGS 13522", unit: " %", dec: 2,
      value: last(a)?.[1] ?? null, ref: last(a) ? fmtMes(last(a)[0]) : null,
      delta: a && prev(a) ? mkDelta(last(a)[1], prev(a)[1], "pp", "vs. mês anterior") : null,
      sub: m ? [{ k: `Mensal (${fmtMes(m[0])})`, v: `${fmt(m[1], 2)}%` }] : [],
      spark: a ? a.slice(-12).map((r) => r[1]) : [], avail: !!a?.length,
    });
  }
  // CDI
  {
    const a = g("cdi");
    cards.push({
      id: "cdi", name: "CDI", freq: "Diário", code: "SGS 4389", unit: " % a.a.", dec: 2,
      value: last(a)?.[1] ?? null, ref: last(a) ? fmtDia(last(a)[0]) : null,
      delta: a && prev(a) ? mkDelta(last(a)[1], prev(a)[1], "pp", "vs. dia útil anterior") : null,
      sub: [], spark: a ? a.slice(-30).map((r) => r[1]) : [], step: true, avail: !!a?.length,
    });
  }
  // IGP-M
  {
    const r12 = g("igpmM") ? rolling12(g("igpmM")) : null;
    const m = last(g("igpmM"));
    cards.push({
      id: "igpm", name: "IGP-M · 12 meses", freq: "Mensal", code: "SGS 189", unit: " %", dec: 2,
      value: last(r12)?.[1] ?? null, ref: last(r12) ? fmtMes(last(r12)[0]) : null,
      delta: r12 && prev(r12) ? mkDelta(last(r12)[1], prev(r12)[1], "pp", "vs. mês anterior") : null,
      sub: m ? [{ k: `Mensal (${fmtMes(m[0])})`, v: `${fmt(m[1], 2)}%` }] : [],
      spark: r12 ? r12.slice(-12).map((r) => r[1]) : [], avail: !!r12?.length,
    });
  }
  // Dólar
  {
    const a = g("usdV"), c = last(g("usdC"));
    cards.push({
      id: "usd", name: "Dólar · venda", freq: "Diário", code: "SGS 1", prefix: "R$ ", dec: 4,
      value: last(a)?.[1] ?? null, ref: last(a) ? fmtDia(last(a)[0]) : null,
      delta: a && prev(a) ? mkDelta(last(a)[1], prev(a)[1], "pct", "vs. dia útil anterior") : null,
      sub: [
        ...(c ? [{ k: "Compra", v: `R$ ${fmt(c[1], 4)}` }] : []),
        ...(live?.USD ? [{ k: "Agora (intradia)", v: `R$ ${fmt(live.USD.ask, 4)}` }] : []),
      ],
      spark: a ? a.slice(-30).map((r) => r[1]) : [], avail: !!a?.length,
    });
  }
  // Euro (PTAX fechamento)
  {
    const a = g("eurV"), c = last(g("eurC"));
    cards.push({
      id: "eur", name: "Euro · venda", freq: "Diário", code: "PTAX BCB", prefix: "R$ ", dec: 4,
      value: last(a)?.[1] ?? null, ref: last(a) ? fmtDia(last(a)[0]) : null,
      delta: a && prev(a) ? mkDelta(last(a)[1], prev(a)[1], "pct", "vs. dia útil anterior") : null,
      sub: [
        ...(c ? [{ k: "Compra", v: `R$ ${fmt(c[1], 4)}` }] : []),
        ...(live?.EUR ? [{ k: "Agora (intradia)", v: `R$ ${fmt(live.EUR.ask, 4)}` }] : []),
      ],
      spark: a ? a.slice(-30).map((r) => r[1]) : [], avail: !!a?.length,
    });
  }
  // Juro real (Fisher): Selic meta atual x IPCA 12m mais recente
  {
    const sa = g("selicMeta"), ia = g("ipca12");
    const sl = last(sa), il = last(ia);
    let value = null, delta = null, spark = [];
    if (sl && il) {
      value = ((1 + sl[1] / 100) / (1 + il[1] / 100) - 1) * 100;
      const al = realSeries(monthlyLast(sa), ia);
      spark = al.slice(-12).map((r) => r[1]).concat(value);
      if (al.length) delta = mkDelta(value, last(al)[1], "pp", `vs. fim de ${fmtMes(last(al)[0])}`);
    }
    cards.push({
      id: "real", wide: true, name: "Juro real", freq: "Calculado", code: "Selic e IPCA 12m", unit: " % a.a.", dec: 2,
      value, ref: sl && il ? `Selic ${fmtDia(sl[0])}` : null, delta,
      sub: sl && il ? [{ k: "Selic meta", v: `${fmt(sl[1], 2)}% a.a.` }, { k: `IPCA 12m (${fmtMes(il[0])})`, v: `${fmt(il[1], 2)}%` }] : [],
      spark, avail: value != null,
    });
  }
  return cards;
}

/* ═══════════════════ CSS ═══════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
.ce-root{color-scheme:dark;--ce-g30:rgba(200,165,94,.3);--ce-g40:rgba(200,165,94,.4);--ce-g50:rgba(200,165,94,.5);--ce-pulse:rgba(200,165,94,.45);--ce-pulse0:rgba(200,165,94,0);--ce-drop:rgba(200,165,94,.35);--ce-grid:rgba(200,165,94,.05);--ce-amber-line:rgba(245,158,11,.28);--ce-up:var(--gold-l);--ce-tip-sh:0 12px 32px rgba(0,0,0,.4);--ce-card-bg:linear-gradient(160deg,var(--s2),var(--s1) 55%);--ce-panel-bg:linear-gradient(180deg,var(--s2),var(--s1) 40%);--ce-card-sh:none;--ce-card-sh-h:var(--glow-card),var(--glow-gold)}
.ag-app.light .ce-root{color-scheme:light;--ce-g30:rgba(154,117,24,.3);--ce-g40:rgba(154,117,24,.4);--ce-g50:rgba(154,117,24,.5);--ce-pulse:rgba(154,117,24,.4);--ce-pulse0:rgba(154,117,24,0);--ce-drop:rgba(154,117,24,.28);--ce-grid:rgba(154,117,24,.08);--ce-amber-line:rgba(217,119,6,.3);--ce-up:var(--gold);--ce-tip-sh:0 10px 28px rgba(0,0,0,.14);--ce-card-bg:linear-gradient(160deg,#fcfbf9,var(--s1) 60%);--ce-panel-bg:linear-gradient(180deg,#fcfbf9,var(--s1) 45%);--ce-card-sh:0 1px 2px rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.04);--ce-card-sh-h:0 3px 10px rgba(0,0,0,.09)}
.ce-root{--ce-mono:'JetBrains Mono','Montserrat',ui-monospace,monospace;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;color:var(--text);font-family:'Sora',system-ui,sans-serif;-webkit-font-smoothing:antialiased;background:var(--bg)}
.ce-root::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
  background:
   radial-gradient(900px 380px at 12% -8%,var(--gold-d),transparent 70%),
   radial-gradient(700px 320px at 100% 0%,var(--blue-d),transparent 70%),
   linear-gradient(var(--ce-grid) 1px,transparent 1px) 0 0/48px 48px,
   linear-gradient(90deg,var(--ce-grid) 1px,transparent 1px) 0 0/48px 48px;
  -webkit-mask-image:linear-gradient(180deg,#000 0,transparent 520px);mask-image:linear-gradient(180deg,#000 0,transparent 520px);opacity:.9}
.ce-wrap{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:22px 24px 48px;display:flex;flex-direction:column;gap:22px}
.ce-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.ce-back{display:inline-flex;align-items:center;gap:6px;font:500 12px 'Sora',sans-serif;color:var(--text-2);background:none;border:0;cursor:pointer;padding:4px 0;margin-bottom:10px;transition:color .15s}
.ce-back:hover{color:var(--gold)}
.ce-kicker{display:flex;align-items:center;gap:8px;font:600 9.5px var(--ce-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.ce-kicker i{width:18px;height:1px;background:var(--gold);opacity:.6}
.ce-h1{font-size:clamp(22px,3.2vw,30px);font-weight:600;letter-spacing:-.02em;line-height:1.1}
.ce-sub{font-size:13px;color:var(--text-2);margin-top:6px}
.ce-head-r{display:flex;align-items:center;gap:10px}
.ce-status{display:flex;align-items:center;gap:8px;font:500 10.5px var(--ce-mono);color:var(--text-2);padding:9px 14px;border:1px solid var(--border);border-radius:999px;background:var(--s1);letter-spacing:.02em}
.ce-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 0 var(--gold);animation:ce-pulse 2.4s infinite}
.ce-status.warn .ce-dot{background:var(--amber);animation:none}
@keyframes ce-pulse{0%{box-shadow:0 0 0 0 var(--ce-pulse)}70%{box-shadow:0 0 0 7px var(--ce-pulse0)}100%{box-shadow:0 0 0 0 var(--ce-pulse0)}}
.ce-ico-btn{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--border);background:var(--s1);color:var(--text-2);cursor:pointer;transition:all .15s}
.ce-ico-btn:hover:not(:disabled){color:var(--gold);border-color:var(--gold);background:var(--gold-d)}
.ce-ico-btn:disabled{opacity:.45;cursor:not-allowed}
.ce-spin{animation:ce-rot .9s linear infinite}
@keyframes ce-rot{to{transform:rotate(360deg)}}
.ce-banner{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:16px;border:1px solid var(--ce-amber-line);background:var(--amber-d);color:var(--text-2);font-size:12px;line-height:1.5}
.ce-banner svg{flex-shrink:0;color:var(--amber);margin-top:1px}
.ce-label{font:600 9.5px var(--ce-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.ce-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
@media(min-width:1000px){.ce-cards{grid-template-columns:repeat(4,1fr)}.ce-card.wide{grid-column:span 2}}
.ce-card{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:10px;padding:18px 18px 14px;background:var(--ce-card-bg);box-shadow:var(--ce-card-sh);border:1px solid var(--border);border-radius:22px;cursor:pointer;overflow:hidden;transition:border-color .2s,transform .2s,box-shadow .2s;min-height:196px}
.ce-card:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.ce-card::before{content:"";position:absolute;top:-46px;right:-46px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,var(--gold-d),transparent 70%);opacity:.7;transition:opacity .2s;pointer-events:none}
.ce-card:hover{border-color:var(--border-h);transform:translateY(-1px);box-shadow:var(--ce-card-sh-h)}
.ce-card:hover::before,.ce-card.on::before{opacity:1}
.ce-card.on{border-color:var(--ce-g40)}
.ce-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ce-card-name{font-size:12px;font-weight:500;color:var(--text-2)}
.ce-chip{font:600 8.5px var(--ce-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);background:var(--s3);border-radius:999px;padding:3px 9px}
.ce-val{font:500 clamp(22px,2.2vw,27px) var(--ce-mono);letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--text);line-height:1.05}
.ce-val small{font-size:.5em;color:var(--text-3);margin-left:3px;letter-spacing:0}
.ce-val.na{font-size:15px;color:var(--text-3);font-family:'Sora',sans-serif;letter-spacing:0}
.ce-delta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:500 11px var(--ce-mono)}
.ce-delta b{display:inline-flex;align-items:center;gap:4px;font-weight:600;padding:3px 9px;border-radius:999px}
.ce-delta.up b{color:var(--ce-up);background:var(--gold-d)}
.ce-delta.down b{color:var(--blue);background:var(--blue-d)}
.ce-delta.flat b{color:var(--text-2);background:var(--s3)}
.ce-delta span{color:var(--text-3);font:400 10.5px 'Sora',sans-serif}
.ce-subrow{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-3)}
.ce-subrow b{font:500 11px var(--ce-mono);color:var(--text-2)}
.ce-spark{height:34px;margin:auto -4px 0;opacity:.9}
.ce-ref{font:400 10px var(--ce-mono);color:var(--text-3);letter-spacing:.02em}
.ce-skel{background:linear-gradient(90deg,var(--s2),var(--s3),var(--s2));background-size:200% 100%;animation:ce-sh 1.4s infinite;border-radius:12px}
@keyframes ce-sh{to{background-position:-200% 0}}
.ce-panel{background:var(--ce-panel-bg);box-shadow:var(--ce-card-sh);border:1px solid var(--border);border-radius:26px;padding:22px;position:relative;overflow:hidden}
.ce-panel-h{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.ce-tabs,.ce-seg{display:inline-flex;gap:2px;padding:3px;background:var(--s3);border-radius:999px;max-width:100%;overflow-x:auto}
.ce-tab,.ce-segb{all:unset;box-sizing:border-box;cursor:pointer;font:500 12px 'Sora',sans-serif;color:var(--text-2);padding:7px 15px;border-radius:999px;white-space:nowrap;transition:all .15s}
.ce-tab:hover:not(.on),.ce-segb:hover:not(.on):not(:disabled){color:var(--text)}
.ce-tab.on,.ce-segb.on{background:var(--gold-d);color:var(--gold);box-shadow:inset 0 0 0 1px var(--ce-g30)}
.ce-segb{font:500 11px var(--ce-mono);padding:6px 12px}
.ce-segb:disabled{opacity:.35;cursor:not-allowed}
.ce-tab:focus-visible,.ce-segb:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
.ce-ctrl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ce-chart-box{border-radius:20px;background:radial-gradient(120% 90% at 50% 0%,var(--gold-d),transparent 65%),var(--s2);border:1px solid var(--border);padding:14px 10px 6px 4px}
.ce-chart{height:320px;position:relative}
.ce-chart .recharts-area-curve{filter:drop-shadow(0 6px 10px var(--ce-drop))}
.ce-halo{animation:ce-halo 2.2s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ce-halo{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.9);opacity:0}}
.ce-chart-msg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:12.5px;color:var(--text-3);gap:10px;align-content:center}
.ce-retry{all:unset;cursor:pointer;font:500 11px var(--ce-mono);color:var(--gold);border:1px solid var(--ce-g30);padding:7px 16px;border-radius:999px}
.ce-retry:hover{background:var(--gold-d)}
.ce-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--text-2);margin-bottom:8px}
.ce-legend span{display:inline-flex;align-items:center;gap:6px}
.ce-legend i{width:10px;height:2px;border-radius:2px}
.ce-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.ce-stat{background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:3px}
.ce-stat b{font:500 13px var(--ce-mono);font-variant-numeric:tabular-nums;color:var(--text)}
.ce-tip{background:var(--s2);border:1px solid var(--border-h);border-radius:14px;padding:10px 14px;box-shadow:var(--ce-tip-sh);font-size:11px}
.ce-tip-d{font:500 10px var(--ce-mono);color:var(--text-3);margin-bottom:5px;letter-spacing:.04em}
.ce-tip-r{display:flex;align-items:center;gap:7px;color:var(--text-2);margin-top:2px}
.ce-tip-r i{width:8px;height:8px;border-radius:50%}
.ce-tip-r b{margin-left:auto;padding-left:14px;font:600 11.5px var(--ce-mono);color:var(--text)}
.ce-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.ce-info-i{background:var(--ce-card-bg);box-shadow:var(--ce-card-sh);border:1px solid var(--border);border-radius:20px;padding:18px 18px}
.ce-info-i h4{font-size:12.5px;font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:7px}
.ce-info-i h4::before{content:"";width:6px;height:6px;background:var(--gold);border-radius:50%}
.ce-info-i p{font-size:12px;line-height:1.6;color:var(--text-2)}
.ce-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--text-3);line-height:1.6;padding-top:4px}
.ce-foot a{color:var(--gold);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.ce-foot a:hover{text-decoration:underline}
.ce-h2{font-size:17px;font-weight:600;letter-spacing:-.01em;margin-top:4px}
.ce-tool{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px}
.ce-form{display:flex;flex-direction:column;gap:14px}
.ce-field{display:flex;flex-direction:column;gap:7px}
.ce-in{all:unset;box-sizing:border-box;width:100%;background:var(--s3);border:1px solid var(--border);border-radius:14px;padding:12px 16px;font:500 14px var(--ce-mono);color:var(--text);transition:border-color .15s,box-shadow .15s}
.ce-in:focus{border-color:var(--ce-g50);box-shadow:0 0 0 3px var(--gold-d)}
select.ce-in{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--text-3) 50%),linear-gradient(135deg,var(--text-3) 50%,transparent 50%);background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:36px}
.ce-res{background:var(--s2);border:1px solid var(--border);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:10px;justify-content:center;min-height:180px}
.ce-res-v{font:500 clamp(24px,3vw,32px) var(--ce-mono);color:var(--ce-up);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ce-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--text-2)}
.ce-row b{font:500 12px var(--ce-mono);color:var(--text);text-align:right}
.ce-note{font-size:11px;color:var(--text-3);line-height:1.55}
@media(max-width:720px){
  .ce-tool{grid-template-columns:1fr}
  .ce-in{font-size:16px}
  .ce-wrap{padding:16px 14px 40px;gap:18px}
  .ce-cards{grid-template-columns:repeat(2,1fr)}
  .ce-card{min-height:184px;padding:14px 13px 12px}
  .ce-chart{height:250px}
  .ce-stats{grid-template-columns:repeat(2,1fr)}
  .ce-panel{padding:16px 12px;border-radius:22px}
  .ce-head-r{width:100%;justify-content:space-between}
}
@media(max-width:720px){.ce-card.wide{grid-column:span 2}}
@media(max-width:400px){.ce-cards{grid-template-columns:1fr}.ce-card.wide{grid-column:auto}}
@media(prefers-reduced-motion:reduce){.ce-dot,.ce-skel,.ce-spin{animation:none}.ce-card{transition:none}}
`;

/* ═══════════════════ SUBCOMPONENTES ═══════════════════ */
function EndDot({ cx, cy }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle className="ce-halo" cx={cx} cy={cy} r={8} fill="var(--gold)" opacity={0.35} />
      <circle cx={cx} cy={cy} r={4.5} fill="var(--ce-up)" stroke="var(--s2)" strokeWidth={2} />
    </g>
  );
}

function Spark({ data, step, id }) {
  if (!data || data.length < 2) return <div className="ce-spark" />;
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div className="ce-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 200, height: 34 }}>
        <AreaChart data={rows} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--gold)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--gold)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type={step ? "stepAfter" : "monotone"} dataKey="v" stroke="var(--gold)" strokeWidth={1.4}
            fill={`url(#sp-${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Card({ c, on, loading, failed, onClick }) {
  const D = c.delta;
  const Icon = D?.kind === "up" ? TrendingUp : D?.kind === "down" ? TrendingDown : Minus;
  const showSkel = loading && !c.avail;
  return (
    <button className={`ce-card${on ? " on" : ""}${c.wide ? " wide" : ""}`} onClick={onClick} aria-label={`${c.name}: ver histórico`}>
      <div className="ce-card-top">
        <span className="ce-card-name">{c.name}</span>
        <span className="ce-chip">{c.freq}</span>
      </div>
      {showSkel ? (
        <>
          <div className="ce-skel" style={{ height: 28, width: "70%" }} />
          <div className="ce-skel" style={{ height: 14, width: "45%" }} />
        </>
      ) : c.avail ? (
        <>
          <div className="ce-val">
            {c.prefix}{fmt(c.value, c.dec)}{c.unit && <small>{c.unit}</small>}
          </div>
          {D && (
            <div className={`ce-delta ${D.kind}`}>
              <b><Icon size={11} strokeWidth={2.4} />{D.txt}</b>
              <span>{D.ctx}</span>
            </div>
          )}
          {c.sub.map((s) => (
            <div className="ce-subrow" key={s.k}><span>{s.k}</span><b>{s.v}</b></div>
          ))}
        </>
      ) : (
        <>
          <div className="ce-val na">Indisponível</div>
          <div className="ce-subrow"><span>{failed ? "Fonte oficial fora do ar no momento." : "Sem dados."}</span></div>
        </>
      )}
      <Spark data={c.spark} step={c.step} id={c.id} />
      <div className="ce-ref">{c.ref ? `Ref. ${c.ref}` : "Sem data"} · {c.code}</div>
    </button>
  );
}

function Tip({ active, payload, label, unit, dec, freq }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ce-tip">
      <div className="ce-tip-d">{freq === "M" ? fmtMes(label) : fmtDia(label)}</div>
      {payload.map((p) => (
        <div className="ce-tip-r" key={p.dataKey}>
          <i style={{ background: p.color || p.fill }} />
          <span>{p.name}</span>
          <b>{unit === "R$" ? `R$ ${fmt(p.value, dec)}` : `${fmt(p.value, dec)} ${unit}`}</b>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════ FERRAMENTAS ═══════════════════ */
function Field({ id, label, children }) {
  return (<div className="ce-field"><label className="ce-label" htmlFor={id}>{label}</label>{children}</div>);
}
const fmtBRL = (v) => `R$ ${fmt(v, 2)}`;

function Corretor() {
  const [valor, setValor] = useState("1.000,00");
  const [idx, setIdx] = useState("ipcaM");
  const [meses, setMeses] = useState(12);
  const [r, setR] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setR({ status: "loading" });
    getSeries(idx, daysAgo(meses * 31 + 45)).then((x) => {
      const sel = x.data.slice(-meses);
      if (sel.length < meses || ymIdx(sel[sel.length - 1][0]) - ymIdx(sel[0][0]) !== meses - 1) throw new Error("incompleto");
      const factor = sel.reduce((f, row) => f * (1 + row[1] / 100), 1);
      if (alive) setR({ status: "ok", factor, from: sel[0][0], to: sel[sel.length - 1][0], stale: x.stale });
    }).catch(() => alive && setR({ status: "error" }));
    return () => { alive = false; };
  }, [idx, meses]);

  const v = parseNum(valor);
  const okV = Number.isFinite(v) && v > 0 && v < 1e12;
  return (
    <div className="ce-tool">
      <div className="ce-form">
        <Field id="cv-valor" label="Valor de referência (R$)">
          <input id="cv-valor" className="ce-in" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1.000,00" />
        </Field>
        <Field id="cv-idx" label="Índice de correção">
          <select id="cv-idx" className="ce-in" value={idx} onChange={(e) => setIdx(e.target.value)}>
            <option value="ipcaM">IPCA</option>
            <option value="igpmM">IGP-M</option>
          </select>
        </Field>
        <Field id="cv-meses" label="Há quanto tempo">
          <select id="cv-meses" className="ce-in" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {[6, 12, 24, 36, 60].map((m) => (<option key={m} value={m}>{m} meses</option>))}
          </select>
        </Field>
      </div>
      <div className="ce-res" aria-live="polite">
        {r.status === "loading" && <div className="ce-skel" style={{ height: 70 }} />}
        {r.status === "error" && <span className="ce-note">Não foi possível obter o índice agora. Tente novamente em instantes.</span>}
        {r.status === "ok" && !okV && <span className="ce-note">Informe um valor válido.</span>}
        {r.status === "ok" && okV && (
          <>
            <span className="ce-label">{fmtBRL(v)} de {fmtMes(r.from)} valem hoje</span>
            <div className="ce-res-v">{fmtBRL(v * r.factor)}</div>
            <div className="ce-row"><span>Variação acumulada</span><b>{fmt((r.factor - 1) * 100, 2)}%</b></div>
            <div className="ce-row"><span>Diferença</span><b>{fmtBRL(v * r.factor - v)}</b></div>
            <div className="ce-row"><span>Período</span><b>{fmtMes(r.from)} a {fmtMes(r.to)}</b></div>
            <span className="ce-note">
              Usa as {meses} últimas variações mensais divulgadas do {idx === "ipcaM" ? "IPCA" : "IGP-M"}{r.stale ? " (dados salvos, fonte indisponível)" : ""}. Útil para estimar reajustes de contratos e aluguéis.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SimuladorCDI({ cdi }) {
  const [valor, setValor] = useState("10.000,00");
  const [pct, setPct] = useState("100");
  const [meses, setMeses] = useState(12);
  const v = parseNum(valor);
  const p = parseNum(pct);
  const okV = Number.isFinite(v) && v > 0 && v < 1e12;
  const okP = Number.isFinite(p) && p > 0 && p <= 500;
  const rate = cdi ? (cdi[1] * p) / 100 : null;
  const factor = rate != null && okP ? Math.pow(1 + rate / 100, meses / 12) : null;
  const bruto = okV && factor ? v * (factor - 1) : null;
  const ir = irRate(meses * 30);
  return (
    <div className="ce-tool">
      <div className="ce-form">
        <Field id="sc-valor" label="Valor investido (R$)">
          <input id="sc-valor" className="ce-in" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="10.000,00" />
        </Field>
        <Field id="sc-pct" label="Rentabilidade (% do CDI)">
          <input id="sc-pct" className="ce-in" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="100" />
        </Field>
        <Field id="sc-meses" label="Prazo">
          <select id="sc-meses" className="ce-in" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {[1, 3, 6, 12, 24, 36, 60].map((m) => (<option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>))}
          </select>
        </Field>
      </div>
      <div className="ce-res" aria-live="polite">
        {!cdi && <span className="ce-note">CDI indisponível no momento. Atualize os indicadores.</span>}
        {cdi && (!okV || !okP) && <span className="ce-note">Informe valor e percentual válidos (até 500% do CDI).</span>}
        {cdi && okV && okP && (
          <>
            <span className="ce-label">Valor líquido estimado em {meses} {meses === 1 ? "mês" : "meses"}</span>
            <div className="ce-res-v">{fmtBRL(v + bruto * (1 - ir))}</div>
            <div className="ce-row"><span>Valor bruto</span><b>{fmtBRL(v + bruto)}</b></div>
            <div className="ce-row"><span>Rendimento bruto</span><b>{fmtBRL(bruto)}</b></div>
            <div className="ce-row"><span>IR estimado ({fmt(ir * 100, 1)}%)</span><b>{fmtBRL(bruto * ir)}</b></div>
            <div className="ce-row"><span>Taxa usada</span><b>{fmt(rate, 2)}% a.a. ({fmtDia(cdi[0])})</b></div>
            <span className="ce-note">
              Projeção com o CDI atual mantido constante. IR pela tabela regressiva da renda fixa; LCI, LCA e outros produtos podem ser isentos. Estimativa, não garantia de rendimento.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Conversor({ store, live }) {
  const [amt, setAmt] = useState("1.000,00");
  const [dir, setDir] = useState("BRL-USD");
  const [from, to] = dir.split("-");
  const buying = from === "BRL";
  const cur = buying ? to : from;
  const sym = cur === "USD" ? "US$" : "€";
  const L = live?.[cur];
  let rate = null, srcTxt = "", when = "";
  if (L) {
    rate = buying ? L.ask : L.bid; srcTxt = "AwesomeAPI (intradia)"; when = fmtLiveAt(L.at, live.t);
  } else {
    const kV = cur === "USD" ? "usdV" : "eurV", kC = cur === "USD" ? "usdC" : "eurC";
    const sRow = last(buying ? store[kV]?.data : store[kC]?.data);
    if (sRow) { rate = sRow[1]; srcTxt = cur === "USD" ? "Banco Central (fechamento)" : "Banco Central (PTAX)"; when = fmtDia(sRow[0]); }
  }
  const v = parseNum(amt);
  const okV = Number.isFinite(v) && v > 0 && v < 1e12;
  const res = rate && okV ? (buying ? v / rate : v * rate) : null;
  return (
    <div className="ce-tool">
      <div className="ce-form">
        <Field id="cc-amt" label={`Valor (${buying ? "R$" : sym})`}>
          <input id="cc-amt" className="ce-in" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="1.000,00" />
        </Field>
        <Field id="cc-dir" label="Conversão">
          <select id="cc-dir" className="ce-in" value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="BRL-USD">Real → Dólar</option>
            <option value="USD-BRL">Dólar → Real</option>
            <option value="BRL-EUR">Real → Euro</option>
            <option value="EUR-BRL">Euro → Real</option>
          </select>
        </Field>
      </div>
      <div className="ce-res" aria-live="polite">
        {rate == null && <span className="ce-note">Cotação do {cur === "USD" ? "dólar" : "euro"} indisponível no momento. Tente novamente em instantes.</span>}
        {rate != null && !okV && <span className="ce-note">Informe um valor válido.</span>}
        {res != null && (
          <>
            <span className="ce-label">{buying ? fmtBRL(v) : `${sym} ${fmt(v, 2)}`} equivalem a</span>
            <div className="ce-res-v">{buying ? `${sym} ${fmt(res, 2)}` : fmtBRL(res)}</div>
            <div className="ce-row"><span>Cotação usada ({buying ? "venda" : "compra"})</span><b>1 {cur} = R$ {fmt(rate, 4)}</b></div>
            <div className="ce-row"><span>Fonte</span><b>{srcTxt}</b></div>
            <div className="ce-row"><span>Referência</span><b>{when}</b></div>
            <span className="ce-note">Cotação comercial de referência. O valor cobrado em corretoras, bancos e casas de câmbio inclui spread e tarifas.</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ COMPONENTE PRINCIPAL ═══════════════════ */
export default function CenarioEconomico({ onVoltar }) {
  const mounted = useRef(true);
  const chartRef = useRef(null);
  const lastRefresh = useRef(0);

  const [store, setStore] = useState(() => {
    const o = {};
    for (const k of Object.keys(SERIES)) {
      const c = readCache(k);
      if (c) o[k] = { data: sliceFrom(c.d, daysAgo(SERIES[k].win)), t: c.t, stale: false };
    }
    return o;
  });
  const [err, setErr] = useState({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [cool, setCool] = useState(false);

  const [tab, setTab] = useState("selic");
  const [viewId, setViewId] = useState("d");
  const [period, setPeriod] = useState("12m");
  const [chart, setChart] = useState({ status: "loading", rows: [] });
  const [tool, setTool] = useState("corretor");
  const [live, setLive] = useState(null);
  const liveT = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /* carga dos cards (cache-first, sem bloquear a página) */
  const loadAll = useCallback(async (force = false) => {
    setLoading(true);
    await Promise.all(Object.keys(SERIES).map(async (k) => {
      try {
        const r = await getSeries(k, daysAgo(SERIES[k].win), force);
        if (!mounted.current) return;
        setStore((p) => ({ ...p, [k]: r }));
        setErr((p) => ({ ...p, [k]: r.stale }));
      } catch {
        if (mounted.current) setErr((p) => ({ ...p, [k]: true }));
      }
    }));
    if (mounted.current) setLoading(false);
  }, []);
  useEffect(() => { loadAll(false); }, [loadAll]);

  /* cotação intradia (opcional): só com a aba visível, a cada 2 min; falha em silêncio */
  const runLive = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const r = await fetchLive();
      if (mounted.current) { liveT.current = Date.now(); setLive(r); }
    } catch { /* mantém o último valor; sem aviso para não poluir */ }
  }, []);
  useEffect(() => {
    runLive();
    const id = setInterval(runLive, LIVE_EVERY);
    const vis = () => { if (document.visibilityState === "visible" && Date.now() - liveT.current > LIVE_EVERY) runLive(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [runLive]);

  const refresh = () => {
    const now = Date.now();
    if (now - lastRefresh.current < COOLDOWN) return;
    lastRefresh.current = now;
    setCool(true);
    setTimeout(() => mounted.current && setCool(false), COOLDOWN);
    runLive();
    loadAll(true).then(() => mounted.current && setTick((t) => t + 1));
  };

  const cards = useMemo(() => buildCards(store, live), [store, live]);

  /* gráfico: carrega só o período/indicador selecionado */
  const cfg = CHARTS[tab];
  const view = cfg.views.find((v) => v.id === viewId) || cfg.views[0];
  const monthly = cfg.freq === "M";
  const effPeriod = monthly && (period === "30d" || period === "3m") ? "12m" : period;
  const periodDays = PERIODS.find((p) => p.id === effPeriod).days;

  useEffect(() => {
    let alive = true;
    setChart((c) => ({ ...c, status: "loading" }));
    (async () => {
      const cut = daysAgo(periodDays);
      const derived = view.lines.some((l) => l.src === "igpm12");
      const from = derived ? daysAgo(periodDays + 400) : cut;
      const res = await Promise.all(view.lines.map(async (l) => {
        if (l.src === "igpm12") return sliceFrom(rolling12((await getSeries("igpmM", from)).data), cut);
        if (l.src === "selicM") return sliceFrom(monthlyLast((await getSeries("selicMeta", from)).data), cut);
        if (l.src === "real") {
          const [a, b] = await Promise.all([getSeries("selicMeta", from), getSeries("ipca12", from)]);
          return sliceFrom(realSeries(monthlyLast(a.data), b.data), cut);
        }
        return sliceFrom((await getSeries(l.src, from)).data, cut);
      }));
      const map = new Map();
      res.forEach((arr, li) => arr.forEach(([d, v]) => {
        const row = map.get(d) || { d };
        row[`s${li}`] = v;
        map.set(d, row);
      }));
      const rows = [...map.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
      if (!rows.length) throw new Error("vazio");
      if (alive) setChart({ status: "ok", rows: monthly ? rows : downsample(rows) });
    })().catch(() => alive && setChart({ status: "error", rows: [] }));
    return () => { alive = false; };
  }, [tab, viewId, effPeriod, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTab = (id, scroll, pickView) => {
    setTab(id); setViewId(pickView || CHARTS[id].views[0].id);
    if (scroll) chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* estatísticas do período (1ª série) */
  const stats = useMemo(() => {
    const vals = chart.rows.map((r) => r.s0).filter(Number.isFinite);
    if (vals.length < 2) return null;
    const first = vals[0], lastV = vals[vals.length - 1];
    const ch = cfg.mode === "pct" ? ((lastV / first) - 1) * 100 : lastV - first;
    return {
      min: Math.min(...vals), max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      ch, chTxt: `${ch > 0 ? "+" : ch < 0 ? "-" : ""}${fmt(Math.abs(ch), 2)} ${cfg.mode === "pct" ? "%" : "p.p."}`,
    };
  }, [chart.rows, cfg.mode]);

  /* status global */
  const lastT = useMemo(() => {
    const ts = Object.values(store).map((s) => s.t).filter(Boolean);
    return ts.length ? Math.max(...ts) : null;
  }, [store]);
  const failedKeys = Object.keys(err).filter((k) => err[k]);
  const failedNames = [...new Set(failedKeys.map((k) =>
    k.startsWith("selic") ? "Selic" : k.startsWith("ipca") ? "IPCA" : k === "cdi" ? "CDI" : k.startsWith("igpm") ? "IGP-M" : k.startsWith("eur") ? "Euro" : "Dólar"))];
  const anyData = cards.some((c) => c.avail);

  const xTick = (iso) => {
    if (monthly) return `${MESES[+iso.slice(5, 7) - 1]}/${iso.slice(2, 4)}`;
    return periodDays <= 92 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : `${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
  };
  const yTick = (v) => (view.unit === "R$" ? fmt(v, 2) : fmt(v, 1));
  const gridStroke = "var(--border)";

  const lastRow = chart.rows[chart.rows.length - 1];
  const common = {
    data: chart.rows, margin: { top: 14, right: 14, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid stroke={gridStroke} strokeDasharray="3 6" vertical={false} />
      <XAxis dataKey="d" tickFormatter={xTick} tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={36} />
      <YAxis tickFormatter={yTick} tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
      <Tooltip content={<Tip unit={view.unit} dec={cfg.dec} freq={cfg.freq} />} cursor={view.bar ? { fill: "var(--gold-d)", radius: 10 } : { stroke: "var(--gold)", strokeOpacity: 0.4, strokeDasharray: "3 4" }} />
    </>
  );

  return (
    <div className="ce-root">
      <style>{CSS}</style>
      <div className="ce-wrap">

        {/* Cabeçalho */}
        <header className="ce-head">
          <div>
            {onVoltar && (
              <button className="ce-back" onClick={onVoltar}><ArrowLeft size={13} /> Voltar ao Gestão</button>
            )}
            <div className="ce-kicker"><i />Assent</div>
            <h1 className="ce-h1">Cenário Econômico</h1>
            <p className="ce-sub">Acompanhe os principais indicadores da economia brasileira.</p>
          </div>
          <div className="ce-head-r">
            <div className={`ce-status${failedKeys.length ? " warn" : ""}`} role="status">
              <span className="ce-dot" />
              {lastT ? `Atualizado ${fmtTs(lastT)}` : loading ? "Carregando…" : "Sem dados"}
            </div>
            <button className="ce-ico-btn" onClick={refresh} disabled={loading || cool}
              title={cool ? "Aguarde 1 minuto para atualizar novamente" : "Atualizar indicadores"} aria-label="Atualizar indicadores">
              <RefreshCw size={14} className={loading ? "ce-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Aviso de indisponibilidade */}
        {failedKeys.length > 0 && !loading && (
          <div className="ce-banner" role="alert">
            <AlertTriangle size={15} />
            <span>
              {anyData
                ? `Não foi possível atualizar: ${failedNames.join(", ")}. Exibindo os últimos dados salvos${lastT ? ` (${fmtTs(lastT)})` : ""}.`
                : "A fonte oficial (Banco Central) está indisponível no momento. Tente novamente em instantes."}
            </span>
          </div>
        )}

        {/* Indicadores principais */}
        <section>
          <div className="ce-label" style={{ marginBottom: 10 }}>Indicadores principais</div>
          <div className="ce-cards">
            {cards.map((c) => (
              <Card key={c.id} c={c} on={tab === (c.id === "real" ? "cmp" : c.id)} loading={loading}
                failed={Object.entries(err).some(([k, v]) => v && k.startsWith(c.id))}
                onClick={() => (c.id === "real" ? selectTab("cmp", true, "r") : selectTab(c.id, true))} />
            ))}
          </div>
        </section>

        {/* Histórico */}
        <section className="ce-panel" ref={chartRef} style={{ scrollMarginTop: 12 }}>
          <div className="ce-panel-h">
            <div className="ce-tabs" role="tablist" aria-label="Indicador">
              {Object.entries(CHARTS).map(([id, c]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={`ce-tab${tab === id ? " on" : ""}`} onClick={() => selectTab(id, false)}>{c.label}</button>
              ))}
            </div>
            <div className="ce-ctrl">
              {cfg.views.length > 1 && (
                <div className="ce-seg" role="group" aria-label="Métrica">
                  {cfg.views.map((v) => (
                    <button key={v.id} className={`ce-segb${view.id === v.id ? " on" : ""}`} onClick={() => setViewId(v.id)}>{v.label}</button>
                  ))}
                </div>
              )}
              <div className="ce-seg" role="group" aria-label="Período">
                {PERIODS.map((p) => {
                  const dis = monthly && (p.id === "30d" || p.id === "3m");
                  return (
                    <button key={p.id} disabled={dis} title={dis ? "Dado mensal: use 6 meses ou mais" : p.label}
                      className={`ce-segb${effPeriod === p.id ? " on" : ""}`} onClick={() => setPeriod(p.id)}>
                      {p.id === "5a" ? "5A" : p.id.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="ce-legend">
            {view.lines.map((l) => (<span key={l.src}><i style={{ background: l.color }} />{l.name}</span>))}
            <span style={{ marginLeft: "auto", color: "var(--text-3)" }}>
              {view.unit} · dados {monthly ? "mensais" : "diários"}
            </span>
          </div>

          <div className="ce-chart-box"><div className="ce-chart">
            {chart.status === "ok" && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 320 }}>
                {view.bar ? (
                  <BarChart {...common}>
                    {axes}
                    <defs>
                      <linearGradient id="ce-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: "var(--gold-l)", stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: "var(--gold)", stopOpacity: 0.35 }} />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="s0" name={view.lines[0].name} radius={[10, 10, 10, 10]} maxBarSize={34} isAnimationActive={false}>
                      {chart.rows.map((r, i) => (
                        <Cell key={r.d} fill="url(#ce-bar)" fillOpacity={i === chart.rows.length - 1 ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart {...common}>
                    <defs>
                      <linearGradient id="ce-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: "var(--gold)", stopOpacity: 0.38 }} />
                        <stop offset="70%" style={{ stopColor: "var(--gold)", stopOpacity: 0.06 }} />
                        <stop offset="100%" style={{ stopColor: "var(--gold)", stopOpacity: 0 }} />
                      </linearGradient>
                      <linearGradient id="ce-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" style={{ stopColor: "var(--gold)", stopOpacity: 0.55 }} />
                        <stop offset="100%" style={{ stopColor: "var(--gold-l)", stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    {axes}
                    {view.lines.map((l, i) => (
                      <Area key={l.src} dataKey={`s${i}`} name={l.name} type={l.step ? "stepAfter" : "monotone"}
                        stroke={l.ghost ? l.color : "url(#ce-line)"} strokeWidth={l.ghost ? 1.6 : 2.6} strokeLinecap="round" strokeDasharray={l.ghost ? "2 6" : undefined}
                        fill={l.ghost ? "none" : "url(#ce-fill)"} dot={false} connectNulls isAnimationActive={false}
                        activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--s2)", fill: "var(--ce-up)" }} />
                    ))}
                    {lastRow && Number.isFinite(lastRow.s0) && (
                      <>
                        <ReferenceLine y={lastRow.s0} stroke="var(--gold)" strokeOpacity={0.3} strokeDasharray="2 5" />
                        <ReferenceDot x={lastRow.d} y={lastRow.s0} shape={<EndDot />} ifOverflow="visible" />
                      </>
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
            {chart.status === "loading" && (
              <div className="ce-chart-msg"><div className="ce-skel" style={{ width: "100%", height: "100%", position: "absolute", inset: 0, opacity: 0.5 }} /></div>
            )}
            {chart.status === "error" && (
              <div className="ce-chart-msg">
                <span>Não foi possível carregar o histórico. Fonte indisponível.</span>
                <button className="ce-retry" onClick={() => setTick((t) => t + 1)}>Tentar novamente</button>
              </div>
            )}
          </div></div>

          {stats && chart.status === "ok" && (
            <div className="ce-stats">
              {[["Mínimo", fmt(stats.min, cfg.dec)], ["Máximo", fmt(stats.max, cfg.dec)], ["Média", fmt(stats.avg, cfg.dec)], ["Variação no período", stats.chTxt]].map(([k, v]) => (
                <div className="ce-stat" key={k}><span className="ce-label">{k}</span><b>{v}</b></div>
              ))}
            </div>
          )}
        </section>

        {/* Ferramentas */}
        <section className="ce-panel">
          <div className="ce-panel-h">
            <div>
              <div className="ce-label">Ferramentas</div>
              <h2 className="ce-h2">Calculadoras financeiras</h2>
            </div>
            <div className="ce-tabs" role="tablist" aria-label="Ferramenta">
              {[["corretor", "Corretor de valores"], ["cdi", "Simulador CDI"], ["cambio", "Conversor"]].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tool === id} className={`ce-tab${tool === id ? " on" : ""}`} onClick={() => setTool(id)}>{label}</button>
              ))}
            </div>
          </div>
          {tool === "corretor" && <Corretor />}
          {tool === "cdi" && <SimuladorCDI cdi={last(store.cdi?.data)} />}
          {tool === "cambio" && <Conversor store={store} live={live} />}
        </section>

        {/* Informações */}
        <section>
          <div className="ce-label" style={{ marginBottom: 10 }}>Entenda os indicadores</div>
          <div className="ce-info">
            {INFO.map((i) => (
              <article className="ce-info-i" key={i.id}><h4>{i.t}</h4><p>{i.d}</p></article>
            ))}
          </div>
        </section>

        {/* Fonte */}
        <footer className="ce-foot">
          <span>
            Fonte: Banco Central do Brasil, Sistema Gerenciador de Séries Temporais (SGS). IPCA: IBGE · IGP-M: FGV · Dólar: câmbio livre (venda/compra) · Euro: PTAX de fechamento. Cotação intradia de dólar e euro: AwesomeAPI (terceiros, informativa).
            O IGP-M em 12 meses é calculado a partir da variação mensal oficial. Dados informativos; não constituem recomendação financeira.
          </span>
          <a href={SRC_URL} target="_blank" rel="noopener noreferrer">Dados Abertos BCB <ExternalLink size={11} /></a>
        </footer>
      </div>
    </div>
  );
}
