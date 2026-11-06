/* ═══════════════════════════════════════════════════
   Matriz de Eisenhower — Matriz.jsx (protótipo)
   Mesmo AuthContext do Gestão (sessão única), dados isolados em:
     matriz_users/{uid}/tarefas/{id}
     matriz_users/{uid}/config/prefs
   Requer <AuthProvider> (contexts/AuthContext) acima.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  collection, doc, onSnapshot, addDoc, updateDoc,
  deleteDoc, setDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import {
  Plus, Sun, Moon, Settings, LogOut, Check, Trash2,
  ChevronLeft, ChevronRight, Zap, Clock, X, Lock, Bell,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

/* ── Constantes ─────────────────────────────────── */
const DAY = 864e5;
const DEF = { auto: true, limiteDias: 2, notificar: true, mostrarMotivo: true, mostrarConcluidas: true };
const Q = {
  q1: { t: "Urgente e importante",         s: "Fazer agora", d: "Crises, prazos finais e tarefas prioritárias." },
  q2: { t: "Importante, mas não urgente",  s: "Planejar",    d: "Metas, planejamento e desenvolvimento." },
  q3: { t: "Urgente, mas não importante",  s: "Delegar",     d: "Demandas operacionais e interrupções delegáveis." },
  q4: { t: "Não urgente e não importante", s: "Eliminar",    d: "Distrações e atividades de baixo valor." },
};
const VIEWS = [["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]];

/* ── Datas ──────────────────────────────────────── */
const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diasAte = (prazo) => Math.round((parse(prazo) - hoje()) / DAY);
const fmt = (d, o) => d.toLocaleDateString("pt-BR", o);

function periodo(view, b) {
  const d = new Date(b); d.setHours(0, 0, 0, 0);
  if (view === "dia") return [d, d];
  if (view === "semana") { const s = addDias(d, -d.getDay()); return [s, addDias(s, 6)]; }
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)];
}
function mover(view, b, n) {
  const d = new Date(b);
  if (view === "dia") d.setDate(d.getDate() + n);
  else if (view === "semana") d.setDate(d.getDate() + 7 * n);
  else d.setMonth(d.getMonth() + n, 1);
  return d;
}
function rotulo(view, [s, e]) {
  if (view === "dia") return fmt(s, { weekday: "long", day: "numeric", month: "long" });
  if (view === "semana") return `${fmt(s, { day: "numeric", month: "short" })} a ${fmt(e, { day: "numeric", month: "short" })}`;
  return fmt(s, { month: "long", year: "numeric" });
}

const dataConc = (t) => {
  const c = t.concluidaEm;
  return c && typeof c.toDate === "function" ? c.toDate() : null;
};

/* ── Regras de quadrante / urgência ─────────────── */
const qOf = (t) => (t.importante ? (t.urgente ? "q1" : "q2") : (t.urgente ? "q3" : "q4"));
const urgAuto = (t, lim) => diasAte(t.prazo) <= lim;
function motivo(t, lim) {
  const d = diasAte(t.prazo);
  if (d < 0) return `Prazo vencido há ${-d} dia(s)`;
  if (d === 0) return "O prazo é hoje";
  if (d === 1) return "O prazo é amanhã";
  return `Faltam ${d} dias (limite: ${lim})`;
}
function prazoTxt(t) {
  const d = diasAte(t.prazo);
  const base = d < 0 ? `Venceu há ${-d}d` : d === 0 ? "Hoje" : d === 1 ? "Amanhã" : `Em ${d}d`;
  return `${base} · ${fmt(parse(t.prazo), { day: "2-digit", month: "short" })}`;
}

/* ═══════════════════════════════════════════════════
   Raiz: gate de autenticação + tema
   ═══════════════════════════════════════════════════ */
const FONTS = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Montserrat:wght@400;500;600;700&display=swap";
function useFontes() {
  useEffect(() => {
    const add = (id, attrs) => {
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.id = id;
      Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
      document.head.appendChild(l);
    };
    add("mx-pc1", { rel: "preconnect", href: "https://fonts.googleapis.com" });
    add("mx-pc2", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" });
    add("mx-fonts", { rel: "stylesheet", href: FONTS });
  }, []);
}

export default function Matriz() {
  useFontes();
  const { user, tenantUid, loadingAuth } = useAuth();
  const [tema, setTemaState] = useState(() => {
    try { return localStorage.getItem("mx-tema") || "claro"; } catch { return "claro"; }
  });
  const setTema = (t) => {
    setTemaState(t);
    try { localStorage.setItem("mx-tema", t); } catch { /* ignore */ }
  };
  return (
    <div className="mx" data-t={tema}>
      <style>{CSS}</style>
      {loadingAuth ? <div className="ls"><div className="spin" /></div>
        : user && tenantUid ? <App user={user} tema={tema} setTema={setTema} />
        : <Login />}
    </div>
  );
}

/* ── Login (mesmo auth do ASSENT) ───────────────── */
function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await signIn(email, senha); }
    catch (x) { setErr(x.message || "Erro ao entrar."); setBusy(false); }
  };
  return (
    <div className="ls">
      <form className="md lg-card" onSubmit={go} noValidate>
        <h1 className="cap">Matriz de Eisenhower</h1>
        <p className="hint">Entre para organizar suas prioridades.</p>
        <label className="fld"><span>E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></label>
        <label className="fld"><span>Senha</span>
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={busy} /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="pr" disabled={busy || !email || !senha}>{busy ? "Entrando..." : "Entrar"}</button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sino de notificações — SÓ da Matriz
   Derivado das tarefas em tempo real; não grava no banco e não toca
   nas notificações do Gestão. "Visto" fica no localStorage do aparelho.
   ═══════════════════════════════════════════════════ */
const NT = {
  atr:    { r: 0, c: "#dc2626" },
  hoje:   { r: 1, c: "#ea580c" },
  amanha: { r: 2, c: "#ca8a04" },
  mov:    { r: 3, c: "#2563eb" },
};
function Sino({ tarefas, uid, onOpen }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const chave = `mx-notif-${uid}`;
  const [vistos, setVistos] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem(chave) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });

  const itens = useMemo(() => {
    const out = [];
    tarefas.forEach((t) => {
      if (t.concluida) return;
      if (t.prazo) {
        const d = diasAte(t.prazo);
        if (d < 0) out.push({ id: `${t.id}:atr`, k: "atr", t, sub: `Venceu há ${-d} dia(s)` });
        else if (d === 0) out.push({ id: `${t.id}:hoje`, k: "hoje", t, sub: "Vence hoje" });
        else if (d === 1) out.push({ id: `${t.id}:amanha`, k: "amanha", t, sub: "Vence amanhã" });
      }
      const ms = t.movidoEm?.toMillis?.();
      if (ms && t.movidoMotivo && Date.now() - ms < 72 * 36e5) {
        out.push({ id: `${t.id}:mov:${ms}`, k: "mov", t, sub: `Movida para ${Q[qOf(t)].s} · ${t.movidoMotivo}` });
      }
    });
    return out.sort((a, b) => NT[a.k].r - NT[b.k].r).slice(0, 30);
  }, [tarefas]);

  const novos = itens.filter((i) => !vistos.includes(i.id)).length;

  const alternar = () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir) {
      const ids = itens.map((i) => i.id);
      setVistos(ids);
      try { localStorage.setItem(chave, JSON.stringify(ids)); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  return (
    <div className="bell" ref={ref}>
      <button className="ib" aria-label={novos ? `Notificações: ${novos} novas` : "Notificações"} aria-expanded={aberto} onClick={alternar}>
        <Bell size={18} />
        {novos > 0 && <span className="bdg">{novos > 9 ? "9+" : novos}</span>}
      </button>
      {aberto && (
        <div className="pn" role="dialog" aria-label="Notificações">
          <div className="pnh">Notificações</div>
          {itens.length === 0
            ? <div className="pne">Tudo em dia.</div>
            : itens.map((i) => (
              <button key={i.id} className="ni" onClick={() => { setAberto(false); onOpen(i.t); }}>
                <i style={{ background: NT[i.k].c }} />
                <span><b>{i.t.titulo}</b><small>{i.sub}</small></span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   App
   ═══════════════════════════════════════════════════ */
function App({ user, tema, setTema }) {
  const { signOut } = useAuth();
  const uid = user.uid;
  const colRef = useMemo(() => collection(db, "matriz_users", uid, "tarefas"), [uid]);
  const prefRef = useMemo(() => doc(db, "matriz_users", uid, "config", "prefs"), [uid]);

  const [tarefas, setTarefas] = useState([]);
  const [prefs, setPrefs] = useState(DEF);
  const [view, setView] = useState("semana");
  const [base, setBase] = useState(() => new Date());
  const [modal, setModal] = useState(null);
  const [cfg, setCfg] = useState(false);
  const [del, setDel] = useState(null);
  const [foco, setFoco] = useState(null);
  const [lista, setLista] = useState(null); // "conc" | "atr"
  const [rep, setRep] = useState(null); // {id, prazo}: remarcando
  const [mob, setMob] = useState(() => window.matchMedia("(max-width:820px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(max-width:820px)");
    const f = () => setMob(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (!foco) return undefined;
    const k = (e) => { if (e.key === "Escape" && !modal && !del && !cfg) setFoco(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [foco, modal, del, cfg]);
  const [toasts, setToasts] = useState([]);
  const [over, setOver] = useState(null);
  const dragId = useRef(null);
  const busy = useRef(false);

  const push = useCallback((m) => {
    const id = Date.now() + Math.random();
    setToasts((a) => [...a, { id, m }]);
    setTimeout(() => setToasts((a) => a.filter((x) => x.id !== id)), 6000);
  }, []);

  /* dados em tempo real */
  useEffect(() => {
    const u1 = onSnapshot(colRef,
      (s) => setTarefas(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => push("Não foi possível carregar as tarefas."));
    const u2 = onSnapshot(prefRef, (s) => { if (s.exists()) setPrefs({ ...DEF, ...s.data() }); });
    return () => { u1(); u2(); };
  }, [colRef, prefRef, push]);

  /* ── Motor automático: só roda com "automático" ligado ── */
  useEffect(() => {
    if (!prefs.auto) return undefined;
    const run = async () => {
      if (busy.current) return;
      const lim = prefs.limiteDias;
      const mud = tarefas.filter((t) => t.prazo && !t.concluida && urgAuto(t, lim) !== !!t.urgente);
      if (!mud.length) return;
      busy.current = true;
      try {
        const b = writeBatch(db);
        mud.forEach((t) => {
          const u = urgAuto(t, lim);
          b.update(doc(colRef, t.id), {
            urgente: u, movidoDe: qOf(t), movidoEm: serverTimestamp(),
            movidoMotivo: u ? motivo(t, lim) : "Prazo ficou mais distante",
          });
        });
        await b.commit();
        if (prefs.notificar) mud.forEach((t) => push(`“${t.titulo}” foi para ${Q[qOf({ ...t, urgente: urgAuto(t, lim) })].s}`));
      } catch { push("Erro ao reorganizar tarefas."); }
      finally { busy.current = false; }
    };
    run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
  }, [tarefas, prefs.auto, prefs.limiteDias, prefs.notificar, colRef, push]);

  /* ── Ações ── */
  const setPref = (k, v) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    setDoc(prefRef, { [k]: v }, { merge: true }).catch(() => push("Erro ao salvar configuração."));
  };
  const novo = (q) => {
    const urg = q === "q1" || q === "q3";
    return {
      titulo: "", notas: "",
      prazo: iso(addDias(hoje(), urg || !q ? 0 : prefs.limiteDias + 5)),
      importante: q ? q === "q1" || q === "q2" : true,
      urgente: q ? urg : false,
    };
  };
  const salvar = async (f) => {
    const dados = {
      titulo: f.titulo.trim().slice(0, 120),
      notas: (f.notas || "").trim().slice(0, 500),
      prazo: f.prazo,
      importante: !!f.importante,
      urgente: prefs.auto ? urgAuto(f, prefs.limiteDias) : !!f.urgente,
    };
    try {
      if (f.id) await updateDoc(doc(colRef, f.id), { ...dados, movidoMotivo: null });
      else await addDoc(colRef, { ...dados, concluida: false, criadaEm: serverTimestamp() });
      setModal(null);
      // tarefa fora do período em tela: leva a visão até ela
      const pz = parse(f.prazo);
      const [pi, pf] = periodo(view, base);
      const h = hoje();
      const aparece = (pz >= pi && pz <= pf) || (pz < h && pi <= h && h <= pf);
      if (!aparece) {
        setBase(pz);
        push(`Salva para ${fmt(pz, { day: "2-digit", month: "short" })}. Visão ajustada.`);
      }
    } catch { push("Erro ao salvar tarefa."); }
  };
  const alternar = (t) => updateDoc(doc(colRef, t.id), { concluida: !t.concluida, concluidaEm: t.concluida ? null : serverTimestamp() }).catch(() => push("Erro ao atualizar."));
  const remarcar = async () => {
    if (!rep || !rep.prazo) return;
    const t = tarefas.find((x) => x.id === rep.id);
    if (!t) { setRep(null); return; }
    try {
      await updateDoc(doc(colRef, t.id), {
        prazo: rep.prazo,
        urgente: prefs.auto ? urgAuto({ prazo: rep.prazo }, prefs.limiteDias) : !!t.urgente,
        movidoMotivo: null,
      });
      setRep(null);
      push(`Novo prazo: ${fmt(parse(rep.prazo), { day: "2-digit", month: "short" })}.`);
    } catch { push("Erro ao remarcar."); }
  };
  useEffect(() => {
    if (!lista) return undefined;
    const k = (e) => { if (e.key === "Escape" && !modal && !del && !cfg) { if (rep) setRep(null); else setLista(null); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [lista, rep, modal, del, cfg]);

  useEffect(() => {
    if (!del) return undefined;
    const k = (e) => { if (e.key === "Escape") setDel(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [del]);
  const excluir = (t) => setDel(t);
  const confirmarExcluir = () => {
    const t = del;
    setDel(null);
    if (t) deleteDoc(doc(colRef, t.id)).catch(() => push("Erro ao excluir."));
  };
  /* ── Arrastar no toque (long-press): HTML5 drag não funciona em touch ── */
  const [ghost, setGhost] = useState(null);
  const semClique = useRef(0);
  const soltarRef = useRef(null);
  const iniciarToque = (e, t) => {
    if (prefs.auto || e.touches.length !== 1) return;
    const x0 = e.touches[0].clientX, y0 = e.touches[0].clientY;
    let ativo = false, alvo = null;
    const timer = setTimeout(() => {
      ativo = true;
      dragId.current = t.id;
      if (navigator.vibrate) navigator.vibrate(15);
      setGhost({ x: x0, y: y0, titulo: t.titulo });
    }, 350);
    const limpar = () => {
      clearTimeout(timer);
      document.removeEventListener("touchmove", mover);
      document.removeEventListener("touchend", fim);
      document.removeEventListener("touchcancel", cancelar);
    };
    const mover = (ev) => {
      const p = ev.touches[0];
      if (!ativo) { if (Math.abs(p.clientX - x0) > 8 || Math.abs(p.clientY - y0) > 8) limpar(); return; }
      ev.preventDefault();
      setGhost({ x: p.clientX, y: p.clientY, titulo: t.titulo });
      alvo = document.elementFromPoint(p.clientX, p.clientY)?.closest?.("[data-q]")?.dataset.q ?? null;
      setOver(alvo);
    };
    const fim = (ev) => {
      const era = ativo, q = alvo;
      limpar(); setGhost(null); setOver(null);
      if (!era) return;
      ev.preventDefault();
      semClique.current = Date.now();
      if (q) soltarRef.current(q); else dragId.current = null;
    };
    const cancelar = () => { limpar(); setGhost(null); setOver(null); dragId.current = null; };
    document.addEventListener("touchmove", mover, { passive: false });
    document.addEventListener("touchend", fim);
    document.addEventListener("touchcancel", cancelar);
  };

  const soltar = (q) => {
    const id = dragId.current; setOver(null); dragId.current = null;
    if (!id || prefs.auto) return;
    const t = tarefas.find((x) => x.id === id);
    if (!t || qOf(t) === q) return;
    updateDoc(doc(colRef, id), { importante: q === "q1" || q === "q2", urgente: q === "q1" || q === "q3", movidoMotivo: null })
      .catch(() => push("Erro ao mover."));
  };
  soltarRef.current = soltar;

  /* ── Derivados ── */
  const [ini, fim] = periodo(view, base);
  const h0 = hoje();
  const visiveis = tarefas.filter((t) => {
    if (!t.prazo) return false;
    if (t.concluida && !prefs.mostrarConcluidas) return false;
    const p = parse(t.prazo);
    if (p >= ini && p <= fim) return true;
    return !t.concluida && p < h0 && ini <= h0 && h0 <= fim; // vencidas aparecem no período atual
  });
  const grupos = { q1: [], q2: [], q3: [], q4: [] };
  visiveis.forEach((t) => grupos[qOf(t)].push(t));
  Object.values(grupos).forEach((g) => g.sort((a, b) => (a.concluida - b.concluida) || a.prazo.localeCompare(b.prazo)));
  const pend = visiveis.filter((t) => !t.concluida);
  const feitas = visiveis.filter((t) => t.concluida)
    .sort((a, b) => ((dataConc(b) || 0) - (dataConc(a) || 0)));
  const atrasadas = pend.filter((t) => parse(t.prazo) < h0).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const stats = [
    ["Pendentes", pend.length],
    ["Concluídas", feitas.length, "conc"],
    ["Urgentes", pend.filter((t) => t.urgente).length],
    ["Atrasadas", atrasadas.length, "atr"],
  ];

  const renderQuadro = (q, emFoco) => {
    const compacto = mob && !emFoco;
    const lista = grupos[q];
    return (
      <section key={q} data-q={q} className={`q ${q}${emFoco ? " full" : ""}${!emFoco && over === q ? " over" : ""}`}
        tabIndex={emFoco ? undefined : 0}
        aria-label={emFoco ? undefined : `Ampliar ${Q[q].s}`}
        onKeyDown={emFoco ? undefined : (e) => { if (e.key === "Enter" && e.target === e.currentTarget) setFoco(q); }}
        onClick={emFoco ? undefined : (e) => {
          if (e.target.closest("button")) return;
          if (Date.now() - semClique.current < 500) return;
          if (!compacto && e.target.closest(".tk")) return;
          setFoco(q);
        }}
        onDragOver={emFoco ? undefined : (e) => { if (!prefs.auto) { e.preventDefault(); setOver(q); } }}
        onDragLeave={emFoco ? undefined : () => setOver(null)}
        onDrop={emFoco ? undefined : () => soltar(q)}>
        <div className="qh">
          <div>
            <div className="qt">{q.toUpperCase()}: {Q[q].t}</div>
            <div className="qs">{Q[q].s}</div>
            <div className="qd">{Q[q].d}</div>
          </div>
          <div className="qa">
            <button className="add" aria-label={`Adicionar em ${Q[q].s}`} onClick={() => setModal(novo(q))}><Plus size={16} /></button>
            {emFoco && <button className="add" aria-label="Fechar" onClick={() => setFoco(null)}><X size={16} /></button>}
          </div>
        </div>
        <div className="lst">
          {lista.length === 0 && <div className="emp">Nada aqui neste período.</div>}
          {lista.map((t) => {
            const ms = t.movidoEm?.toMillis?.() ?? Date.now();
            const why = prefs.mostrarMotivo && t.movidoMotivo && !t.concluida && Date.now() - ms < 72 * 36e5;
            const atras = !t.concluida && parse(t.prazo) < h0;
            return (
              <div key={t.id} className={"tk" + (t.concluida ? " done" : "") + (why ? " moved" : "")}
                draggable={!prefs.auto && !emFoco && !window.matchMedia("(pointer: coarse)").matches}
                onDragStart={() => { dragId.current = t.id; }}
                onTouchStart={emFoco ? undefined : (e) => iniciarToque(e, t)}
                onContextMenu={prefs.auto ? undefined : (e) => e.preventDefault()}>
                <button className={"ck" + (t.concluida ? " on" : "")} aria-label="Concluir" onClick={() => alternar(t)}>
                  {t.concluida && <Check size={12} />}
                </button>
                <div className="tkb" onClick={() => { if (!compacto) setModal(t); }}>
                  <div className="tkt">{t.titulo}</div>
                  <div className={"tkm" + (atras ? " late" : "")}><Clock size={11} /> {prazoTxt(t)}</div>
                  {why && <div className="why"><Zap size={11} /> {t.movidoMotivo}</div>}
                </div>
                <button className="ic" aria-label="Excluir" onClick={() => excluir(t)}><Trash2 size={14} /></button>
              </div>
            );
          })}
          {compacto && lista.length > 3 && <div className="mais">+{lista.length - 3}</div>}
        </div>
      </section>
    );
  };

  return (
    <>
      <header className="hd">
        <div className="wr hdi">
          <div className="lg"><span className="dot" />Matriz <b>Eisenhower</b></div>
          <div className="seg vw" role="tablist">
            {VIEWS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
          <div className="nav">
            <button className="ib" aria-label="Anterior" onClick={() => setBase(mover(view, base, -1))}><ChevronLeft size={18} /></button>
            <button className="td" onClick={() => setBase(new Date())}>Hoje</button>
            <button className="ib" aria-label="Próximo" onClick={() => setBase(mover(view, base, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="hr">
            <Sino tarefas={tarefas} uid={uid} onOpen={setModal} />
            <button className="ib" aria-label="Alternar tema" onClick={() => setTema(tema === "claro" ? "escuro" : "claro")}>
              {tema === "claro" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="ib" aria-label="Configurações" onClick={() => setCfg(true)}><Settings size={18} /></button>
            <button className="ib" aria-label="Sair" onClick={signOut}><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="wr">
        <div className="top">
          <div>
            <h1 className="cap">{rotulo(view, [ini, fim])}</h1>
            <span className={"badge" + (prefs.auto ? " on" : "")}>
              {prefs.auto ? <Zap size={12} /> : <Lock size={12} />}
              {prefs.auto ? "Reorganização automática" : "Modo manual: arraste entre quadrantes"}
            </span>
          </div>
          <button className="pr" onClick={() => setModal(novo())}><Plus size={16} /> Nova tarefa</button>
        </div>

        <div className="stats">
          {stats.map(([l, n, k]) => k ? (
            <button type="button" className={"st bt" + (lista === k ? " sel" : "") + (k === "atr" && n > 0 ? " warn" : "")} key={l} aria-haspopup="dialog" onClick={() => { setRep(null); setLista(k); }}>
              <b>{n}</b><span>{l}</span>
            </button>
          ) : (<div className="st" key={l}><b>{n}</b><span>{l}</span></div>))}
        </div>

        <div className="grid">
          {Object.keys(Q).map((q) => renderQuadro(q, false))}
        </div>
      </main>

      {ghost && <div className="gst" style={{ left: ghost.x, top: ghost.y }}>{ghost.titulo}</div>}

      {foco && (
        <div className="ov" onMouseDown={() => setFoco(null)}>
          <div className="qx" role="dialog" aria-modal="true" aria-label={Q[foco].s} onMouseDown={(e) => e.stopPropagation()}>
            {renderQuadro(foco, true)}
          </div>
        </div>
      )}

      {lista && (
        <div className="ov" onMouseDown={() => { setRep(null); setLista(null); }}>
          <div className="md lst" role="dialog" aria-modal="true" aria-labelledby="ls-t" onMouseDown={(e) => e.stopPropagation()}>
            <div className="lsh">
              <h3 id="ls-t">{lista === "conc" ? `Concluídas · ${rotulo(view, [ini, fim])}` : `Atrasadas · ${atrasadas.length} ${atrasadas.length === 1 ? "tarefa" : "tarefas"}`}</h3>
              <button type="button" className="ib" aria-label="Fechar" onClick={() => { setRep(null); setLista(null); }}><X size={18} /></button>
            </div>
            <div className="lsb">
              {lista === "conc" && (feitas.length === 0
                ? <div className="emp">Nenhuma tarefa concluída neste período.</div>
                : feitas.map((t) => {
                  const dc = dataConc(t);
                  return (
                    <div key={t.id} className="li done">
                      <button type="button" className="ck on" style={{ "--c": "var(--q2t)" }} aria-label="Reabrir tarefa" onClick={() => alternar(t)}><Check size={12} /></button>
                      <div className="lib">
                        <div className="lit">{t.titulo}</div>
                        <div className="lim">{dc ? `concluída em ${fmt(dc, { day: "numeric", month: "short" })} · ` : "concluída · "}estava em {Q[qOf(t)].s}</div>
                      </div>
                    </div>
                  );
                }))}
              {lista === "atr" && (atrasadas.length === 0
                ? <div className="emp">Nenhuma tarefa atrasada.</div>
                : atrasadas.map((t) => {
                  const d = -diasAte(t.prazo);
                  const edit = rep && rep.id === t.id;
                  return (
                    <div key={t.id} className="li late">
                      <button type="button" className="ck" style={{ "--c": "var(--t2)" }} aria-label="Concluir tarefa" onClick={() => alternar(t)} />
                      <div className="lib">
                        <div className="lit">{t.titulo}</div>
                        <div className="lim late">venceu em {fmt(parse(t.prazo), { day: "numeric", month: "short" })} · {d} {d === 1 ? "dia" : "dias"} de atraso</div>
                      </div>
                      {edit ? (
                        <div className="rp">
                          <input type="date" aria-label="Novo prazo" autoFocus min={iso(h0)} value={rep.prazo}
                            onChange={(e) => setRep({ id: t.id, prazo: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") remarcar(); }} />
                          <button type="button" className="pr sm" disabled={!rep.prazo || rep.prazo < iso(h0)} onClick={remarcar}>OK</button>
                        </div>
                      ) : (
                        <button type="button" className="np" onClick={() => setRep({ id: t.id, prazo: iso(h0) })}>Novo prazo</button>
                      )}
                    </div>
                  );
                }))}
            </div>
          </div>
        </div>
      )}

      {modal && <Form init={modal} auto={prefs.auto} lim={prefs.limiteDias} onSave={salvar} onClose={() => setModal(null)} />}

      {del && (
        <div className="ov" onMouseDown={() => setDel(null)}>
          <div className="md cf" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" onMouseDown={(e) => e.stopPropagation()}>
            <h3 id="cf-t">Excluir tarefa?</h3>
            <p className="cft">“{del.titulo}” será removida e não poderá ser recuperada.</p>
            <div className="act">
              <button type="button" className="gh" autoFocus onClick={() => setDel(null)}>Cancelar</button>
              <button type="button" className="pr dg" onClick={confirmarExcluir}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {cfg && (
        <div className="ov" onMouseDown={() => setCfg(false)}>
          <aside className="dr" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drh"><h3>Configurações</h3>
              <button className="ib" aria-label="Fechar" onClick={() => setCfg(false)}><X size={18} /></button></div>
            <Row t="Modo automático" s="Reposiciona tarefas pendentes conforme o prazo. Desligado, você move manualmente."
              on={prefs.auto} set={(v) => setPref("auto", v)} />
            <div className={"row" + (prefs.auto ? "" : " off")}>
              <div><b>Urgente quando faltar</b><small>A importância nunca muda sozinha.</small></div>
              <select value={prefs.limiteDias} disabled={!prefs.auto} onChange={(e) => setPref("limiteDias", +e.target.value)}>
                {[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? "No dia" : `${n} dia(s)`}</option>)}
              </select>
            </div>
            <Row t="Avisar quando mudar" s="Mostra um aviso quando uma tarefa troca de quadrante."
              on={prefs.notificar} set={(v) => setPref("notificar", v)} />
            <Row t="Mostrar motivo" s="Exibe na tarefa por que ela mudou."
              on={prefs.mostrarMotivo} set={(v) => setPref("mostrarMotivo", v)} />
            <Row t="Mostrar concluídas" s="Mantém tarefas feitas visíveis, esmaecidas."
              on={prefs.mostrarConcluidas} set={(v) => setPref("mostrarConcluidas", v)} />
          </aside>
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" onClick={() => setToasts((a) => a.filter((x) => x.id !== t.id))}>
            <Zap size={14} /> {t.m}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Subcomponentes ─────────────────────────────── */
function Row({ t, s, on, set }) {
  return (
    <div className="row">
      <div><b>{t}</b><small>{s}</small></div>
      <button type="button" role="switch" aria-checked={on} aria-label={t} className={"sw" + (on ? " on" : "")} onClick={() => set(!on)}><i /></button>
    </div>
  );
}

function Form({ init, auto, lim, onSave, onClose }) {
  const [f, setF] = useState(init);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const ok = f.titulo.trim() && f.prazo;
  return (
    <div className="ov" onMouseDown={onClose}>
      <form className="md" onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ok) onSave(f); }}>
        <h3>{f.id ? "Editar tarefa" : "Nova tarefa"}</h3>
        <label className="fld"><span>Título</span>
          <input autoFocus maxLength={120} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="O que precisa ser feito?" /></label>
        <label className="fld"><span>Prazo</span>
          <input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} /></label>
        <div className="fld"><span>Importância</span>
          <div className="seg">
            <button type="button" className={f.importante ? "on" : ""} onClick={() => set("importante", true)}>Importante</button>
            <button type="button" className={!f.importante ? "on" : ""} onClick={() => set("importante", false)}>Não importante</button>
          </div></div>
        {auto ? (
          <p className="hint"><Zap size={12} /> Urgência automática: vira urgente quando faltar {lim === 0 ? "o dia do prazo" : `${lim} dia(s) ou menos`}.</p>
        ) : (
          <div className="fld"><span>Urgência</span>
            <div className="seg">
              <button type="button" className={f.urgente ? "on" : ""} onClick={() => set("urgente", true)}>Urgente</button>
              <button type="button" className={!f.urgente ? "on" : ""} onClick={() => set("urgente", false)}>Não urgente</button>
            </div></div>
        )}
        <label className="fld"><span>Notas</span>
          <textarea rows={3} maxLength={500} value={f.notas || ""} onChange={(e) => set("notas", e.target.value)} placeholder="Detalhes opcionais" /></label>
        <div className="act">
          <button type="button" className="gh" onClick={onClose}>Cancelar</button>
          <button className="pr" disabled={!ok}>Salvar tarefa</button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════ */
const CSS = `
.mx{--bg:#f4f8ff;--bg2:#dce8ff;--sf:#fff;--tx:#0b1b3a;--t2:#5b6b8c;--bd:#d3deF3;--ac:#2563eb;--acx:#fff;--hv:#eaf1ff;--sh:0 10px 30px rgba(37,99,235,.12);
--q1:#fbe6e6;--q1t:#8a1c1c;--q2:#e0f0e3;--q2t:#0f6b2e;--q3:#ffedd5;--q3t:#8a4a00;--q4:#e8e9ef;--q4t:#4b5160;
--title:"Sora",system-ui,-apple-system,"Segoe UI",sans-serif;--body:"Montserrat",system-ui,-apple-system,"Segoe UI",sans-serif;
min-height:100vh;color:var(--tx);font-family:var(--body);
background:radial-gradient(900px 500px at 8% -10%,var(--bg2),transparent 70%),var(--bg)}
.mx[data-t=escuro]{--bg:#000;--bg2:#1a1a1a;--sf:#0a0a0a;--tx:#fff;--t2:#9b9b9b;--bd:#272727;--ac:#fff;--acx:#000;--hv:#171717;--sh:0 10px 30px rgba(0,0,0,.7)}
.mx *{box-sizing:border-box}
.mx[data-t=escuro] .q{--sf:#fff;--tx:#0b1b3a;--t2:#5b6b8c;--bd:#d3def3;--hv:#eaf1ff;--ac:#2563eb;--acx:#fff;--sh:0 10px 30px rgba(37,99,235,.12)}
.mx[data-t=escuro] .dot{box-shadow:12px 0 0 #ff8f8f,0 12px 0 #7ee0a0}
.q{color:var(--tx)}
.mx h1,.mx h2,.mx h3,.lg,.st b,.qs,.qt,.pnh{font-family:var(--title)}
.mx button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.mx button:focus-visible,.mx input:focus-visible,.mx select:focus-visible,.mx textarea:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.wr{max-width:1180px;margin:0 auto;padding:0 20px}
.hd{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);background:color-mix(in srgb,var(--bg) 80%,transparent);border-bottom:1px solid var(--bd)}
.hdi{display:flex;align-items:center;gap:14px;padding-block:12px;flex-wrap:wrap}
.lg{font-size:17px;font-weight:400;display:flex;align-items:center;gap:8px;margin-right:auto}
.lg b{font-weight:700}
.dot{width:10px;height:10px;border-radius:3px;background:var(--ac);box-shadow:12px 0 0 var(--q1t),0 12px 0 var(--q2t);margin-right:14px;display:inline-block;transform:translate(0,-6px)}
.hr,.nav{display:flex;align-items:center;gap:4px}
.ib{width:36px;height:36px;padding:0!important;line-height:0;border-radius:10px;display:grid!important;place-items:center;transition:background .15s}
.ib svg,.add svg,.ck svg,.ic svg{display:block;margin:0;flex:none}
.ib:hover{background:var(--hv)}
.td{padding:7px 12px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid var(--bd)!important}
.td:hover{background:var(--hv)}
.seg{display:inline-flex;padding:3px;border-radius:12px;background:var(--hv);border:1px solid var(--bd);gap:2px}
.seg button{padding:7px 14px;border-radius:9px;font-size:13px;font-weight:600;color:var(--t2);transition:all .18s}
.seg button.on{background:var(--ac);color:var(--acx);box-shadow:0 2px 8px rgba(0,0,0,.18)}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:28px 0 18px;flex-wrap:wrap}
.cap{margin:0 0 8px;font-size:clamp(24px,4vw,34px);font-weight:700;letter-spacing:-.02em;text-transform:capitalize}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:5px 10px;border-radius:99px;background:var(--hv);border:1px solid var(--bd);color:var(--t2)}
.badge.on{color:var(--ac)}
.mx[data-t=claro] .badge.on{background:#dbe7ff;border-color:#b6ccff}
.pr{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--ac)!important;color:var(--acx)!important;padding:11px 18px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:var(--sh);transition:transform .15s}
.pr:hover:not(:disabled){transform:translateY(-1px)}
.pr:disabled{opacity:.45;cursor:not-allowed}
.gh{padding:11px 16px;border-radius:12px;font-weight:600;color:var(--t2)}
.gh:hover{background:var(--hv)}
.md.lst{max-width:560px;max-height:min(80vh,640px);gap:12px}
.lsh{display:flex;justify-content:space-between;align-items:center;gap:10px}
.lsh h3{overflow-wrap:anywhere}
.lsb{display:flex;flex-direction:column;gap:10px;overflow:auto;padding:2px}
.li{display:flex;align-items:center;gap:12px;background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px 14px}
.li.late{border-color:var(--q1t)}
.lib{flex:1;min-width:0}
.lit{font-weight:700;font-size:14.5px;overflow-wrap:anywhere}
.li.done .lit,.li.done .lim{color:var(--t2)}
.lim{font-size:12.5px;color:var(--t2);margin-top:2px}
.lim.late{color:var(--q1t)}
.np{flex:none;padding:8px 14px;border-radius:10px;border:2px solid var(--ac)!important;color:var(--ac)!important;font-size:13px;font-weight:700;transition:background .15s}
.np:hover{background:var(--hv)}
.rp{display:flex;gap:6px;align-items:center;flex:none}
.rp input{padding:7px 8px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit;font-size:13px}
.pr.sm{padding:8px 12px;font-size:13px}
@media(max-width:560px){.li{flex-wrap:wrap}.np,.rp{margin-left:32px}}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.mx .st{position:relative;width:100%;text-align:left;color:var(--tx);background:color-mix(in srgb,var(--sf) 62%,transparent);backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%);border:1px solid color-mix(in srgb,var(--bd) 85%,transparent);border-radius:14px;padding:12px 16px;display:flex;align-items:baseline;gap:8px;box-shadow:0 4px 14px rgba(11,27,58,.07),inset 0 1px 0 rgba(255,255,255,.5);transition:transform .18s,box-shadow .18s,background .18s,border-color .18s}
.mx[data-t=escuro] .st{box-shadow:0 4px 14px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06)}
.mx .st.bt{cursor:pointer;padding-right:34px}
.mx .st.bt::after{content:"\\203A";position:absolute;right:14px;top:50%;transform:translateY(-52%);font-size:22px;line-height:1;color:var(--t2);opacity:.55;transition:transform .18s,opacity .18s,color .18s}
.mx .st.bt:hover{transform:translateY(-3px);background:color-mix(in srgb,var(--sf) 85%,transparent);border-color:color-mix(in srgb,var(--ac) 50%,transparent);box-shadow:0 12px 28px color-mix(in srgb,var(--ac) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.6)}
.mx .st.bt:hover::after{transform:translate(4px,-52%);opacity:1;color:var(--ac)}
.mx .st.bt:active{transform:translateY(0) scale(.97);box-shadow:0 3px 8px color-mix(in srgb,var(--ac) 20%,transparent)}
.mx .st.bt.sel{border-color:var(--ac);background:color-mix(in srgb,var(--sf) 90%,transparent);box-shadow:0 0 0 2px var(--ac),0 10px 24px color-mix(in srgb,var(--ac) 25%,transparent)}
.mx .st.bt.warn b{color:var(--q1t)}
.mx[data-t=escuro] .st.bt.warn b{color:#ff8f8f}
.st b{font-size:24px;font-weight:700}
.st span{font-size:13px;color:var(--t2)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-bottom:60px}
.q{border-radius:20px;padding:18px;min-height:300px;border:1px solid color-mix(in srgb,var(--c) 22%,var(--bd));background:color-mix(in srgb,var(--bg-q) 78%,transparent);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);box-shadow:0 6px 20px color-mix(in srgb,var(--c) 14%,transparent),inset 0 1px 0 rgba(255,255,255,.45);transition:box-shadow .2s,transform .2s,background .2s,border-color .2s}
.mx[data-t=escuro] .q{background:color-mix(in srgb,var(--bg-q) 94%,transparent)}
.grid .q:hover:not(.over){transform:translateY(-4px);background:color-mix(in srgb,var(--bg-q) 92%,transparent);border-color:color-mix(in srgb,var(--c) 55%,transparent);box-shadow:0 16px 36px color-mix(in srgb,var(--c) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.55)}
.grid .q:active:not(.over){transform:translateY(-1px) scale(.992)}
.grid .q:focus-visible{outline:2px solid var(--c);outline-offset:3px}
.q.full{background:var(--bg-q);box-shadow:var(--sh)}
.q1{--bg-q:var(--q1);--c:var(--q1t)}.q2{--bg-q:var(--q2);--c:var(--q2t)}.q3{--bg-q:var(--q3);--c:var(--q3t)}.q4{--bg-q:var(--q4);--c:var(--q4t)}
.q.over{box-shadow:0 0 0 2px var(--c),var(--sh);transform:scale(1.01)}
.grid .q{cursor:pointer}
.qa{display:flex;gap:6px;align-items:flex-start}
.mais{font-size:11px;font-weight:700;color:var(--c);text-align:center;padding:2px 0}
.qx{width:100%;max-width:640px;max-height:90vh;overflow:auto;border-radius:20px;animation:in .2s ease-out}
.q.full{min-height:0}
.qh{display:flex;justify-content:space-between;gap:10px;margin-bottom:14px}
.qt{font-size:14px;font-weight:600}
.qs{font-size:18px;font-weight:700;color:var(--c);margin:2px 0}
.qd{font-size:12.5px;color:var(--t2)}
.add{width:34px;height:34px;padding:0!important;line-height:0;flex:none;border-radius:10px;display:grid!important;place-items:center;color:var(--c)!important;border:1px solid color-mix(in srgb,var(--c) 40%,transparent)!important;transition:all .15s}
.add:hover{background:var(--c)!important;color:var(--bg-q)!important}
.lst{display:flex;flex-direction:column;gap:8px}
.emp{font-size:13px;color:var(--t2);padding:18px 0;text-align:center;border:1px dashed var(--bd);border-radius:12px}
.tk{display:flex;gap:10px;align-items:flex-start;background:var(--sf);border:1px solid var(--bd);border-left:3px solid var(--c);border-radius:12px;padding:10px 10px 10px 12px;transition:transform .15s,box-shadow .15s,opacity .2s}
.tk[draggable=true]{cursor:grab}
.grid .tk{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.gst{position:fixed;z-index:70;pointer-events:none;transform:translate(-50%,-130%);max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--sf);color:var(--tx);border:1px solid var(--bd);border-left:3px solid var(--ac);padding:8px 12px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:var(--sh)}
.tk:hover{transform:translateY(-1px);box-shadow:var(--sh)}
.tk.done{opacity:.5}.tk.done .tkt{text-decoration:line-through}
.tk.moved{animation:pulse 1.4s ease-out 1}
@keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 70%,transparent)}100%{box-shadow:0 0 0 12px transparent}}
.ck{width:20px;height:20px;padding:0!important;line-height:0;flex:none;margin-top:1px;border-radius:6px;border:2px solid var(--c)!important;display:grid!important;place-items:center;transition:all .15s}
.ck.on{background:var(--c)!important;color:var(--sf)!important}
.tkb{flex:1;min-width:0;cursor:pointer}
.tkt{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.tkm,.why{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t2);margin-top:3px}
.tkm.late{color:var(--q1t);font-weight:700}
.why{color:var(--c);font-weight:600}
.ic{display:grid;place-items:center;line-height:0;opacity:0;color:var(--t2)!important;padding:4px;border-radius:8px;transition:opacity .15s}
.tk:hover .ic,.ic:focus-visible{opacity:1}
.ic:hover{color:var(--q1t)!important}
.ov{position:fixed;inset:0;z-index:40;background:rgba(0,10,30,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
.mx[data-t=escuro] .ov{background:rgba(0,0,0,.75)}
.md{width:100%;max-width:440px;background:var(--sf);border:1px solid var(--bd);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--sh);animation:in .2s ease-out}
@keyframes in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.md h3{margin:0;font-size:20px}
.fld{display:flex;flex-direction:column;gap:6px}
.fld>span{font-size:13px;font-weight:600;color:var(--t2)}
.fld input,.fld textarea,.row select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit;font-size:14px}
.fld textarea{resize:vertical}
.fld .seg button{flex:1}
.hint{margin:0;font-size:13px;color:var(--t2);display:flex;gap:6px;align-items:center}
.cf{max-width:380px}
.cft{margin:0;font-size:14px;line-height:1.5;color:var(--t2);overflow-wrap:anywhere}
.pr.dg{background:#dc2626!important;color:#fff!important}
.act{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.err{font-size:13px;color:var(--q1t);background:var(--q1);border-radius:10px;padding:10px 12px}
.dr{position:fixed;right:0;top:0;bottom:0;width:min(380px,100%);background:var(--sf);border-left:1px solid var(--bd);padding:20px;display:flex;flex-direction:column;gap:6px;animation:sl .22s ease-out;overflow:auto}
@keyframes sl{from{transform:translateX(100%)}to{transform:none}}
.ov:has(.dr){justify-content:flex-end;padding:0}
.drh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.drh h3{margin:0;font-size:20px}
.row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--bd)}
.row.off{opacity:.45}
.row b{display:block;font-size:14px}
.row small{display:block;font-size:12.5px;color:var(--t2);margin-top:2px}
.row select{width:auto}
.sw{width:44px;height:26px;flex:none;border-radius:99px;background:var(--bd)!important;position:relative;transition:background .2s}
.sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sw.on{background:var(--ac)!important}
.sw.on i{transform:translateX(18px);background:var(--acx)}
.mx[data-t=claro] .sw.on i{background:#fff}
.bell{position:relative}
.bell .ib{position:relative}
.bdg{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;pointer-events:none}
.pn{position:absolute;right:0;top:calc(100% + 8px);width:min(340px,90vw);max-height:60vh;overflow:auto;background:var(--sf);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--sh);z-index:30;padding:6px}
.pnh{padding:8px 10px;font-size:13px;font-weight:700;color:var(--t2)}
.pne{padding:18px 10px;text-align:center;font-size:13px;color:var(--t2)}
.ni{display:flex!important;align-items:flex-start;gap:10px;width:100%;padding:9px 10px!important;border-radius:10px;text-align:left}
.ni:hover{background:var(--hv)}
.ni i{width:8px;height:8px;flex:none;margin-top:6px;border-radius:50%}
.ni span{display:flex;flex-direction:column;gap:2px;min-width:0}
.ni b{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ni small{font-size:12px;color:var(--t2)}
@media(max-width:520px){.bell{position:static}.pn{position:fixed;left:12px;right:12px;top:64px;width:auto}}
.toasts{position:fixed;right:16px;bottom:16px;z-index:60;display:flex;flex-direction:column;gap:8px;max-width:calc(100% - 32px)}
.toast{display:flex;gap:8px;align-items:center;background:var(--ac);color:var(--acx);padding:11px 14px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:var(--sh);cursor:pointer;animation:in .25s ease-out}
.ls{min-height:100vh;display:grid;place-items:center;padding:16px}
.lg-card{max-width:380px}
.spin{width:36px;height:36px;border-radius:50%;border:3px solid var(--bd);border-top-color:var(--ac);animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media(max-width:820px){
.grid{grid-template-columns:1fr 1fr;gap:8px}
.grid .q{min-height:0;padding:10px;border-radius:16px}
.grid .qh{margin-bottom:8px;gap:6px}
.grid .qt{font-size:10.5px;line-height:1.25}
.grid .qs{font-size:14px}
.grid .qd,.grid .tkm,.grid .why,.grid .ic,.grid .ck{display:none}
.grid .add{width:28px;height:28px;border-radius:8px}
.grid .lst{gap:6px}
.grid .tk{padding:7px 8px}
.grid .tkt{font-size:12px}
.grid .emp{padding:12px 4px;font-size:11px}
.stats{grid-template-columns:repeat(2,1fr)}.hdi{gap:10px}.lg{width:100%}}
@media(prefers-reduced-motion:reduce){.mx *{animation:none!important;transition:none!important}}
`;
