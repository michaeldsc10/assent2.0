/* ═══════════════════════════════════════════════════
   ASSENT - Tour guiado (reutilizável)
   ─────────────────────────────────────────────────
   useTour(tourId, { enabled, autoStart, ctx })
     -> { available, open, start, layer }
   <TourInfoButton onClick={start} />   (ícone "i")
   Primeira abertura por dispositivo: localStorage.
   Definições dos passos: ./tours.js
   ═══════════════════════════════════════════════════ */

import React, {
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback,
} from "react";
import { Info, X } from "lucide-react";
import { getTour } from "./tours.js";

/* ── Persistência (por dispositivo) ───────────────── */
const PREFIX = "assent:tour:";
const memSeen = new Set(); // fallback se localStorage estiver bloqueado
const keyOf = (id, v) => `${PREFIX}${id}:v${v}`;

export function tourVisto(id, v = 1) {
  const k = keyOf(id, v);
  if (memSeen.has(k)) return true;
  try { return window.localStorage.getItem(k) === "1"; } catch { return false; }
}
export function marcarTourVisto(id, v = 1) {
  const k = keyOf(id, v);
  memSeen.add(k);
  try { window.localStorage.setItem(k, "1"); } catch { /* storage indisponível */ }
}
export function resetarTour(id, v = 1) {
  const k = keyOf(id, v);
  memSeen.delete(k);
  try { window.localStorage.removeItem(k); } catch { /* storage indisponível */ }
}

/* ── CSS ──────────────────────────────────────────── */
const TOUR_CSS = `
.ast-root{position:fixed;inset:0;z-index:100000;font-family:'Sora',system-ui,sans-serif}
.ast-block{position:absolute;inset:0}
.ast-dim{position:absolute;inset:0;background:rgba(5,5,8,.62);opacity:0;transition:opacity .25s}
.ast-dim.on{opacity:1}
.ast-spot{position:absolute;border-radius:12px;pointer-events:none;border:1.5px solid var(--gold);
  box-shadow:0 0 0 9999px rgba(5,5,8,.62),0 0 0 4px rgba(200,165,94,.18);opacity:0}
.ast-spot.on{opacity:1}
.ast-anim .ast-spot,.ast-spot.anim{transition:top .3s cubic-bezier(.4,0,.2,1),left .3s cubic-bezier(.4,0,.2,1),width .3s cubic-bezier(.4,0,.2,1),height .3s cubic-bezier(.4,0,.2,1),opacity .2s}
.ast-card{position:absolute;background:var(--s1);color:var(--text);border:1px solid var(--border);
  border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.45);padding:16px 16px 14px;opacity:0}
.ast-card.on{opacity:1}
.ast-card.anim{transition:top .3s cubic-bezier(.4,0,.2,1),left .3s cubic-bezier(.4,0,.2,1),opacity .2s}
.ast-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.ast-step{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
.ast-x{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:7px;
  background:transparent;border:none;color:var(--text-3);cursor:pointer;margin:-4px -4px -4px 0}
.ast-x:hover{background:var(--s2);color:var(--text)}
.ast-title{font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:6px;color:var(--text)}
.ast-body{font-size:12.5px;line-height:1.55;color:var(--text-2)}
.ast-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}
.ast-dots{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.ast-dot{width:5px;height:5px;border-radius:99px;background:var(--border);transition:width .2s,background .2s}
.ast-dot.on{width:16px;background:var(--gold)}
.ast-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}
.ast-btn{font-family:inherit;font-size:12px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer;
  background:var(--s2);border:1px solid var(--border);color:var(--text-2);transition:border-color .15s,color .15s}
.ast-btn:hover{border-color:var(--gold);color:var(--gold)}
.ast-btn.primary{background:var(--gold);border-color:var(--gold);color:#0d0d11}
.ast-btn.primary:hover{filter:brightness(1.08);color:#0d0d11}
.ast-btn:focus-visible,.ast-x:focus-visible,.ast-skip:focus-visible,.ast-info-btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.ast-skip{font-family:inherit;font-size:11px;background:none;border:none;color:var(--text-3);cursor:pointer;padding:4px 2px}
.ast-skip:hover{color:var(--text)}
.ast-arrow{position:absolute;width:10px;height:10px;background:var(--s1);border:1px solid var(--border);transform:rotate(45deg)}
.ast-arrow.up{top:-6px;border-right:none;border-bottom:none}
.ast-arrow.down{bottom:-6px;border-left:none;border-top:none}
.ast-arrow.left{left:-6px;border-right:none;border-top:none}
.ast-arrow.right{right:-6px;border-left:none;border-bottom:none}
.ast-info-btn{width:34px;height:34px;border-radius:8px;background:var(--s2);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-2);flex-shrink:0;
  margin-left:8px;padding:0;transition:border-color .15s,color .15s}
.ast-info-btn:hover{border-color:var(--gold);color:var(--gold)}
@media (prefers-reduced-motion: reduce){
  .ast-spot,.ast-card,.ast-dim,.ast-dot{transition:none !important}
}
`;

function injetarCss() {
  if (typeof document === "undefined" || document.getElementById("ast-tour-css")) return;
  const el = document.createElement("style");
  el.id = "ast-tour-css";
  el.textContent = TOUR_CSS;
  document.head.appendChild(el);
}

/* ── Utilidades ───────────────────────────────────── */
const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
const reduzMovimento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Primeiro elemento visível com data-tour="id" */
function acharAlvo(id) {
  try {
    const nodes = document.querySelectorAll(`[data-tour="${CSS.escape(id)}"]`);
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  } catch { /* seletor inválido */ }
  return null;
}

const lerRect = (el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
};
const rectIgual = (a, b) =>
  a && b && ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) < 0.5);

/* Posição do card em relação ao alvo */
function calcPos(rect, cw, ch, vw, vh, pref = "bottom") {
  const M = 12, G = 14, P = 6;
  const B = vw <= 720 ? 64 : 0; // barra inferior do mobile
  if (!rect) {
    return { top: Math.max(M, (vh - ch) / 2), left: Math.max(M, (vw - cw) / 2), side: null, arrow: null };
  }
  const sp = {
    bottom: vh - B - (rect.bottom + P) - G - M,
    top: rect.top - P - G - M,
    right: vw - (rect.right + P) - G - M,
    left: rect.left - P - G - M,
  };
  const need = { bottom: ch, top: ch, right: cw, left: cw };
  const opp = { bottom: "top", top: "bottom", left: "right", right: "left" };
  const estreito = vw < 560;
  const preferido = estreito && (pref === "left" || pref === "right") ? "bottom" : pref;
  const ordem = estreito
    ? [preferido, opp[preferido]]
    : [preferido, opp[preferido], "bottom", "top", "right", "left"];
  const side = ordem.find((s) => sp[s] >= need[s]) || null;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (!side) {
    /* Sem espaço ao redor: ancora na base da tela */
    return { top: Math.max(M, vh - B - ch - M), left: clamp(cx - cw / 2, M, vw - cw - M), side: null, arrow: null };
  }
  let top, left;
  if (side === "bottom") { top = rect.bottom + P + G; left = cx - cw / 2; }
  else if (side === "top") { top = rect.top - P - G - ch; left = cx - cw / 2; }
  else if (side === "right") { left = rect.right + P + G; top = cy - ch / 2; }
  else { left = rect.left - P - G - cw; top = cy - ch / 2; }

  top = clamp(top, M, vh - B - ch - M);
  left = clamp(left, M, vw - cw - M);
  const arrow = side === "top" || side === "bottom"
    ? { x: clamp(cx - left, 22, cw - 22) }
    : { y: clamp(cy - top, 22, ch - 22) };
  return { top, left, side, arrow };
}

/* ── Overlay ──────────────────────────────────────── */
function TourOverlay({ steps, ctxRef, onClose }) {
  const lista = useMemo(
    () => steps.filter((s) => {
      try { return !s.when || s.when(ctxRef.current); } catch { return false; }
    }),
    [steps, ctxRef]
  );

  const [idx, setIdx] = useState(0);
  const [alvo, setAlvo] = useState(null);
  const [rect, setRect] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [pos, setPos] = useState(null);
  const [animar, setAnimar] = useState(false);

  const dirRef = useRef(1);
  const mostradosRef = useRef(0);
  const cardRef = useRef(null);
  const primarioRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const base = lista[idx];
  const mobile = vp.w <= 720 && base?.mobile ? base.mobile : null;
  const step = useMemo(() => (base ? { ...base, ...(mobile || {}) } : base), [base, mobile]);
  const ultimo = idx === lista.length - 1;

  /* Foco: guarda e devolve */
  useEffect(() => {
    const anterior = document.activeElement;
    return () => { try { anterior?.focus?.({ preventScroll: true }); } catch { /* noop */ } };
  }, []);

  /* Prepara o passo: onEnter, acha alvo (com espera), pula se ausente */
  useEffect(() => {
    if (!step) { onCloseRef.current(mostradosRef.current > 0); return undefined; }
    let cancelado = false;
    let timer;
    try { step.onEnter?.(ctxRef.current); } catch { /* noop */ }

    if (!step.target) {
      setAlvo(null); setRect(null); setPronto(true); mostradosRef.current += 1;
      return undefined;
    }
    setPronto(false);
    let tentativas = 0;
    const tick = () => {
      if (cancelado) return;
      const el = acharAlvo(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const mob = window.innerWidth <= 720;
        const fora = r.top < 70 || r.bottom > window.innerHeight - (mob ? 84 : 20);
        if (fora && !el.closest("header, nav, aside")) {
          const alto = r.height > window.innerHeight * 0.6;
          el.scrollIntoView({
            block: alto ? "start" : "center",
            inline: "nearest",
            behavior: reduzMovimento() ? "auto" : "smooth",
          });
        }
        setAlvo(el); setRect(lerRect(el)); setPronto(true); mostradosRef.current += 1;
        return;
      }
      tentativas += 1;
      if (tentativas > 30) {
        const prox = idx + dirRef.current;
        if (prox < 0 || prox >= lista.length) onCloseRef.current(mostradosRef.current > 0);
        else setIdx(prox);
        return;
      }
      timer = setTimeout(tick, 50);
    };
    tick();
    return () => { cancelado = true; clearTimeout(timer); };
  }, [idx, lista, step, ctxRef]);

  /* Acompanha o alvo: scroll, resize, mudança de tamanho, remontagem */
  useEffect(() => {
    if (!alvo || !step?.target) return undefined;
    let raf = 0;
    const medir = () => {
      raf = 0;
      let el = alvo;
      if (!el.isConnected) {
        el = acharAlvo(step.target);
        if (!el) return;
        setAlvo(el);
      }
      const novo = lerRect(el);
      setRect((atual) => (rectIgual(atual, novo) ? atual : novo));
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
    };
    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir); };
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(agendar) : null;
    ro?.observe(alvo);
    const iv = setInterval(agendar, 400);
    agendar();
    return () => {
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
      ro?.disconnect();
      clearInterval(iv);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [alvo, step]);

  /* Posiciona o card */
  useLayoutEffect(() => {
    if (!pronto || !cardRef.current) return;
    const cw = cardRef.current.offsetWidth;
    const ch = cardRef.current.offsetHeight;
    setPos(calcPos(step?.target ? rect : null, cw, ch, vp.w, vp.h, step?.side));
  }, [pronto, rect, vp, idx, step]);

  useEffect(() => {
    if (!pos || animar) return undefined;
    const r = requestAnimationFrame(() => setAnimar(true));
    return () => cancelAnimationFrame(r);
  }, [pos, animar]);

  /* Foco no botão principal a cada passo */
  useEffect(() => {
    if (pronto) primarioRef.current?.focus({ preventScroll: true });
  }, [pronto, idx]);

  const ir = useCallback((d) => {
    dirRef.current = d;
    const prox = idx + d;
    if (prox >= lista.length) { onCloseRef.current(true); return; }
    if (prox < 0) return;
    setIdx(prox);
  }, [idx, lista.length]);

  /* Teclado: Esc, setas, Tab preso no card */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(true); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); ir(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); ir(-1); return; }
      if (e.key === "Tab" && cardRef.current) {
        const f = cardRef.current.querySelectorAll("button:not([disabled])");
        if (!f.length) return;
        const primeiro = f[0], ultimoEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimoEl.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimoEl) { e.preventDefault(); primeiro.focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ir]);

  if (!step) return null;

  const largura = Math.min(340, vp.w - 24);
  const P = 6;
  const comAlvo = !!step.target && !!rect && pronto;

  return (
    <div className={`ast-root${animar ? " ast-anim" : ""}`} role="presentation">
      <div className="ast-block" aria-hidden="true" />
      <div className={`ast-dim${comAlvo ? "" : " on"}`} aria-hidden="true" />
      <div
        className={`ast-spot${comAlvo ? " on" : ""}${animar ? " anim" : ""}`}
        aria-hidden="true"
        style={comAlvo ? {
          top: rect.top - P, left: rect.left - P,
          width: rect.width + P * 2, height: rect.height + P * 2,
        } : { top: 0, left: 0, width: 0, height: 0 }}
      />
      <div
        ref={cardRef}
        className={`ast-card${pronto && pos ? " on" : ""}${animar ? " anim" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ast-title"
        aria-describedby="ast-body"
        style={{ width: largura, top: pos?.top ?? 0, left: pos?.left ?? 0 }}
      >
        {pos?.side && pos.arrow && (
          <span
            className={`ast-arrow ${{ bottom: "up", top: "down", right: "left", left: "right" }[pos.side]}`}
            style={pos.arrow.x != null ? { left: pos.arrow.x - 5 } : { top: pos.arrow.y - 5 }}
            aria-hidden="true"
          />
        )}
        <div className="ast-head">
          <span className="ast-step">{idx + 1} de {lista.length}</span>
          <button type="button" className="ast-x" aria-label="Fechar tutorial" onClick={() => onCloseRef.current(true)}>
            <X size={14} />
          </button>
        </div>
        <div className="ast-title" id="ast-title">{step.title}</div>
        <div className="ast-body" id="ast-body" aria-live="polite">{step.body}</div>
        <div className="ast-foot">
          {lista.length <= 8 ? (
            <div className="ast-dots" aria-hidden="true">
              {lista.map((_, i) => <span key={i} className={`ast-dot${i === idx ? " on" : ""}`} />)}
            </div>
          ) : (
            !ultimo
              ? <button type="button" className="ast-skip" onClick={() => onCloseRef.current(true)}>Pular</button>
              : <span />
          )}
          <div className="ast-actions">
            {lista.length <= 8 && !ultimo && (
              <button type="button" className="ast-skip" onClick={() => onCloseRef.current(true)}>Pular</button>
            )}
            {idx > 0 && (
              <button type="button" className="ast-btn" onClick={() => ir(-1)}>Voltar</button>
            )}
            <button type="button" className="ast-btn primary" ref={primarioRef} onClick={() => ir(1)}>
              {ultimo ? "Concluir" : idx === 0 ? "Começar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hook ─────────────────────────────────────────── */
const tentadosNaSessao = new Set();

export function useTour(tourId, { enabled = true, autoStart = true, ctx } = {}) {
  const def = getTour(tourId);
  const version = def?.version ?? 1;
  const available = !!def && enabled && def.steps.length > 0;
  const [open, setOpen] = useState(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => { injetarCss(); }, []);

  /* Trocou de módulo ou desabilitou: fecha sem marcar */
  useEffect(() => { setOpen(false); }, [tourId, enabled]);

  /* Abre sozinho na primeira vez neste dispositivo */
  useEffect(() => {
    if (!available || !autoStart || open) return undefined;
    if (tentadosNaSessao.has(tourId) || tourVisto(tourId, version)) return undefined;
    const t = setTimeout(() => {
      tentadosNaSessao.add(tourId);
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [available, autoStart, open, tourId, version]);

  const close = useCallback((marcar = true) => {
    if (marcar && tourId) marcarTourVisto(tourId, version);
    setOpen(false);
  }, [tourId, version]);

  const start = useCallback(() => { if (available) setOpen(true); }, [available]);

  const layer = open && available
    ? <TourOverlay key={tourId} steps={def.steps} ctxRef={ctxRef} onClose={close} />
    : null;

  return { available, open, start, layer };
}

/* ── Botão "i" ────────────────────────────────────── */
export function TourInfoButton({ onClick, title = "Ver tutorial desta tela", tourTarget = "tour-info" }) {
  useEffect(() => { injetarCss(); }, []);
  return (
    <button
      type="button"
      className="ast-info-btn"
      data-tour={tourTarget}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Info size={16} />
    </button>
  );
}
