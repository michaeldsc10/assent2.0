/* ═══════════════════════════════════════════════════
   AnnouncementModal.jsx  —  Firebase SDK modular (v9+)
   ═══════════════════════════════════════════════════ */
import { useEffect, useState, useCallback } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

/* ─── Estilos ─────────────────────────────────────── */
const STYLES = `
@keyframes ann-fade-in  { from { opacity:0 } to { opacity:1 } }
@keyframes ann-slide-up {
  from { opacity:0; transform: translateY(32px) scale(0.95) }
  to   { opacity:1; transform: translateY(0)   scale(1)    }
}
@keyframes ann-shimmer {
  0%   { left: -100% }
  100% { left:  180% }
}
.ann-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.80);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: ann-fade-in .25s ease;
}
.ann-box {
  position: relative;
  background: #0D0D0D;
  border: 1px solid #2A2A2A;
  border-radius: 20px;
  width: 100%; max-width: 460px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.08);
  animation: ann-slide-up .38s cubic-bezier(0.34,1.4,0.64,1);
}
.ann-box::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%);
  z-index: 2;
}
.ann-close {
  position: absolute; top: 13px; right: 14px; z-index: 10;
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid #2A2A2A;
  color: #888; font-size: 14px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .18s, color .18s, border-color .18s;
  font-family: inherit;
}
.ann-close:hover {
  background: rgba(255,255,255,0.13);
  color: #EAEAEA;
  border-color: #D4AF37;
}
.ann-img-zone {
  width: 100%; max-height: 230px;
  overflow: hidden; position: relative;
}
.ann-img-zone img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ann-img-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.42);
  display: flex; align-items: center; justify-content: center;
}
.ann-content { padding: 26px 26px 24px; }
.ann-title {
  font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif;
  font-size: 20px; font-weight: 700;
  color: #EAEAEA; line-height: 1.25; margin-bottom: 10px;
}
.ann-msg {
  font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
  font-size: 14px; color: #999;
  line-height: 1.65; margin-bottom: 22px;
  white-space: pre-wrap;
}
.ann-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  width: 100%; padding: 14px 22px;
  background: linear-gradient(135deg, #B8860B 0%, #D4AF37 60%, #F0D060 100%);
  border: none; border-radius: 11px;
  color: #050505;
  font-family: 'Montserrat', 'Syne', sans-serif;
  font-size: 13px; font-weight: 700; letter-spacing: 1.8px;
  text-transform: uppercase;
  cursor: pointer; text-decoration: none;
  position: relative; overflow: hidden;
  box-shadow: 0 4px 22px rgba(212,175,55,0.38), 0 1px 0 rgba(255,255,255,0.18) inset;
  transition: box-shadow .22s, transform .18s;
}
.ann-cta::before {
  content: '';
  position: absolute; top: 0; left: -100%;
  width: 55%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
  transform: skewX(-18deg);
  animation: ann-shimmer 2.6s ease-in-out infinite;
}
.ann-cta:hover {
  box-shadow: 0 7px 32px rgba(212,175,55,0.55), 0 1px 0 rgba(255,255,255,0.22) inset;
  transform: translateY(-1px);
}
.ann-cta:active { transform: translateY(0) scale(0.99); }
.ann-cta-float { width: auto; padding: 12px 28px; }
`;

function injectStyles() {
  if (document.getElementById("__ann-modal-styles__")) return;
  const el = document.createElement("style");
  el.id = "__ann-modal-styles__";
  el.textContent = STYLES;
  document.head.appendChild(el);
}

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.6"
    strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12,5 19,12 12,19" />
  </svg>
);

export default function AnnouncementModal({ userPlan = "free" }) {
  const [anuncio, setAnuncio] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    injectStyles();

    async function fetchAnuncio() {
      try {
        // SDK modular v9+ — sem .collection() no objeto db
        const q = query(
          collection(db, "anunciosAG"),
          where("ativo", "==", true),
          orderBy("criadoEm", "desc"),
          limit(10)
        );
        const snap = await getDocs(q);

        if (snap.empty) return;

        // filtra destinatário no cliente (evita índice composto)
        const compativel = snap.docs.find((doc) => {
          const dest = doc.data().destinatario || "todos";
          if (dest === "todos") return true;
          if (dest === "pro"  && userPlan === "pro") return true;
          if (dest === "free" && userPlan !== "pro") return true;
          return false;
        });

        if (!compativel) return;

        // não reexibe o mesmo anúncio na mesma sessão
        const sessionKey = `ann_seen_${compativel.id}`;
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, "1");

        setAnuncio({ id: compativel.id, ...compativel.data() });
        setVisible(true);
      } catch (err) {
        console.warn("[AnnouncementModal] erro ao buscar anúncio:", err);
      }
    }

    fetchAnuncio();
  }, [userPlan]);

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (!visible || !anuncio) return null;

  const {
    titulo,
    mensagem,
    imagem   = "",
    btnTexto = "Vamos lá!",
    btnUrl   = "",
    btnPos   = "abaixo",
  } = anuncio;

  const temImagem     = Boolean(imagem);
  const btnSobreposto = temImagem && btnPos === "sobreposto";

  function BotaoCTA({ className = "" }) {
    const cls = `ann-cta ${className}`;
    return btnUrl ? (
      <a href={btnUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        {btnTexto} <ArrowIcon />
      </a>
    ) : (
      <button className={cls} onClick={close}>
        {btnTexto} <ArrowIcon />
      </button>
    );
  }

  return (
    <div
      className="ann-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="ann-box" role="dialog" aria-modal="true" aria-labelledby="ann-title">

        <button className="ann-close" onClick={close} aria-label="Fechar">✕</button>

        {temImagem && (
          <div className="ann-img-zone">
            <img src={imagem} alt={titulo} />
            {btnSobreposto && (
              <div className="ann-img-overlay">
                <BotaoCTA className="ann-cta-float" />
              </div>
            )}
          </div>
        )}

        <div className="ann-content">
          <div className="ann-title" id="ann-title">{titulo}</div>
          <div className="ann-msg">{mensagem}</div>
          {!btnSobreposto && <BotaoCTA />}
        </div>

      </div>
    </div>
  );
}
