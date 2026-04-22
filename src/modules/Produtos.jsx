/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Produtos.jsx
   Estrutura: users/{uid}/produtos/{id}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Package, Edit2, Trash2, X, AlertTriangle, ImageOff,
} from "lucide-react";

import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { LIMITES_FREE } from "../hooks/useLicenca";
import {BannerLimite} from "../hooks/LicencaUI.jsx";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

/* ── CSS do módulo ── */
const CSS = `
  /* ── Reutiliza variáveis globais do AG ── */

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }

  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 520px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-lg  { max-width: 680px; }
  .modal-box-md  { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
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
  }

  /* Form */
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
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-hint  { font-size: 11px; color: var(--text-3); margin-top: 5px; }

  /* Buttons */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
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
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
  }
  .btn-danger:hover { background: rgba(224,82,82,.18); }
  .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit { color: var(--blue); }
  .btn-icon-edit:hover { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del  { color: var(--red); }
  .btn-icon-del:hover  { background: var(--red-d); border-color: rgba(224,82,82,.2); }

  .btn-novo-pd {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: opacity .13s, transform .1s;
  }
  .btn-novo-pd:hover { opacity: .88; }

  /* Topbar */
  .pd-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .pd-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .pd-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .pd-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; flex: 1; max-width: 300px;
  }
  .pd-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }

  /* Tabela */
  .pd-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .pd-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .pd-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text);
  }
  .pd-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  /* grid: foto | id | nome/sku | preço | custo | margem | estoque | ações */
  .pd-row {
    display: grid;
    grid-template-columns: 44px 64px 1fr 110px 110px 88px 80px 72px;
    padding: 10px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .pd-row:last-child { border-bottom: none; }
  .pd-row:hover { background: rgba(255,255,255,0.02); }
  .pd-row-head { background: var(--s2); }
  .pd-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .pd-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .pd-nome-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pd-nome { color: var(--text); font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pd-sku  { font-size: 10px; color: var(--text-3); letter-spacing: .04em; }
  .pd-preco { color: var(--text); font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; }
  .pd-custo { color: var(--text-3); font-size: 12px; }
  .pd-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  /* Badge margem e estoque */
  .badge {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 2px 9px; border-radius: 20px; font-size: 11px;
    font-family: 'Sora', sans-serif; font-weight: 600;
  }
  .badge-green { background: rgba(68,209,134,.12); color: var(--green); border: 1px solid rgba(68,209,134,.22); }
  .badge-gold  { background: rgba(200,165,94,.12); color: var(--gold);  border: 1px solid rgba(200,165,94,.22); }
  .badge-red   { background: rgba(224,82,82,.12);  color: var(--red);   border: 1px solid rgba(224,82,82,.22); }
  .badge-blue  { background: rgba(91,142,240,.12); color: var(--blue);  border: 1px solid rgba(91,142,240,.22); }

  /* Thumb de foto */
  .pd-thumb {
    width: 32px; height: 32px; border-radius: 7px; overflow: hidden;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pd-thumb img { width: 100%; height: 100%; object-fit: cover; }

  /* Calculadora de margem no modal */
  .margin-calc-box {
    background: var(--s2); border: 1px solid var(--border-h);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  }
  .margin-calc-title {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 12px;
  }
  .margin-calc-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;
  }
  .margin-calc-field label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 6px;
  }
  .margin-result {
    font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
    color: var(--green); padding: 8px 13px;
    background: rgba(68,209,134,.08); border: 1px solid rgba(68,209,134,.18);
    border-radius: 8px; text-align: center;
  }
  .margin-result-label { font-size: 10px; color: var(--text-3); margin-bottom: 3px; }
  .btn-apply-margin {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 8px; font-size: 12px; font-weight: 600;
    background: rgba(200,165,94,.1); color: var(--gold);
    border: 1px solid rgba(200,165,94,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; margin-top: 4px;
    transition: background .13s;
  }
  .btn-apply-margin:hover { background: rgba(200,165,94,.18); }

  /* Upload foto */
  .foto-upload-wrap { display: flex; align-items: center; gap: 10px; }
  .foto-preview {
    width: 48px; height: 48px; border-radius: 10px;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; flex-shrink: 0;
  }
  .foto-preview img { width: 100%; height: 100%; object-fit: cover; }
  .btn-foto {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 8px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    transition: background .13s, color .13s;
  }
  .btn-foto:hover { background: var(--s2); color: var(--text); }
  .btn-foto-rm {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .13s;
  }
  .btn-foto-rm:hover { background: rgba(224,82,82,.18); }

  /* Modal exclusão */
  .confirm-body {
    padding: 24px 22px; text-align: center;
  }
  .confirm-icon { font-size: 32px; margin-bottom: 12px; }
  .confirm-body p { font-size: 13px; color: var(--text-2); line-height: 1.6; }
  .confirm-body strong { color: var(--text); }
  .confirm-warning {
    margin-top: 14px; padding: 10px 14px; border-radius: 8px;
    background: rgba(224,82,82,.08); border: 1px solid rgba(224,82,82,.2);
    display: flex; align-items: flex-start; gap: 8px;
    font-size: 12px; color: var(--red); text-align: left; line-height: 1.5;
  }

  .pd-empty, .pd-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3);
    font-size: 13px;
  }

  /* Separador de seção no modal */
  .form-section-sep {
    border: none; border-top: 1px solid var(--border);
    margin: 18px 0 16px;
  }
  .form-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 14px;
  }
`;

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const gerarIdProduto = (cnt) => `P${String(cnt + 1).padStart(4, "0")}`;

/* Calcula margem ROI: preço = custo * (1 + margem/100) */
const calcPrecoSugerido = (custo, margem) => {
  const c = parseFloat(String(custo).replace(",", ".")) || 0;
  const m = parseFloat(String(margem).replace(",", ".")) || 0;
  return c * (1 + m / 100);
};

/* Calcula % de margem real dado preço e custo */
const calcMargemReal = (preco, custo) => {
  const p = parseFloat(String(preco).replace(",", ".")) || 0;
  const c = parseFloat(String(custo).replace(",", ".")) || 0;
  if (c === 0) return 0;
  return ((p - c) / c) * 100;
};

const fmtNum = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

/* ══════════════════════════════════════════════════════
   MODAL: Novo / Editar Produto
   ══════════════════════════════════════════════════════ */
function ModalNovoProduto({ produto, produtos, onSave, onClose }) {
  const isEdit = !!produto;
  const fotoInputRef = useRef(null);

  const [form, setForm] = useState({
    nome:    produto?.nome    || "",
    sku:     produto?.sku     || "",
    preco:   produto?.preco != null ? fmtNum(produto.preco) : "",
    custo:   produto?.custo  != null ? fmtNum(produto.custo) : "",
    estoque: produto?.estoque != null ? String(produto.estoque) : "0",
    foto:    produto?.foto    || null,
  });

  /* Campos da calculadora (estado local, não vão direto pro form) */
  const [calcCusto,  setCalcCusto]  = useState("");
  const [calcMargem, setCalcMargem] = useState("");
  const precoSugerido = calcPrecoSugerido(calcCusto, calcMargem);

  const [erros,    setErros]    = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  /* Aplica resultado da calculadora nos campos reais */
  const aplicarCalculo = () => {
    if (!calcCusto) return;
    set("custo",  fmtNum(parseFloat(String(calcCusto).replace(",", ".")) || 0));
    set("preco",  fmtNum(precoSugerido));
  };

  /* Upload de foto → base64 */
  const handleFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("foto", reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const validar = () => {
    const e = {};
    const nomeLimpo = form.nome.trim();

    if (!nomeLimpo) {
      e.nome = "Nome é obrigatório.";
    } else {
      const duplicado = produtos.some(
        (p) =>
          p.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() &&
          p.id !== produto?.id
      );
      if (duplicado) e.nome = "Já existe um produto com este nome exato.";
    }

    const preco  = parseFloat(String(form.preco).replace(",", ".")) || 0;
    const custo  = parseFloat(String(form.custo).replace(",", ".")) || 0;
    const estoque = parseInt(form.estoque, 10);

    if (form.preco !== "" && preco < 0)  e.preco  = "Preço inválido.";
    if (form.custo !== "" && custo < 0)  e.custo  = "Custo inválido.";
    if (isNaN(estoque) || estoque < 0)   e.estoque = "Estoque inválido.";

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);

    const preco  = parseFloat(String(form.preco).replace(",", "."))  || 0;
    const custo  = parseFloat(String(form.custo).replace(",", "."))  || 0;
    const estoque = parseInt(form.estoque, 10) || 0;
    const margem  = calcMargemReal(preco, custo);

    await onSave({
      nome:    form.nome.trim(),
      sku:     form.sku.trim(),
      preco,
      custo,
      estoque,
      margem:  parseFloat(margem.toFixed(1)),
      foto:    form.foto || null,
    });
    setSalvando(false);
  };

  /* Margem em tempo real com base nos campos de preço/custo preenchidos */
  const precoNum  = parseFloat(String(form.preco).replace(",", ".")) || 0;
  const custoNum  = parseFloat(String(form.custo).replace(",", ".")) || 0;
  const margemLive = precoNum > 0 && custoNum > 0
    ? calcMargemReal(precoNum, custoNum)
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-box-lg">

        <div className="modal-header">
          <div>
            <div className="modal-title">
              {isEdit ? "Editar Produto" : "Novo Produto"}
            </div>
            <div className="modal-sub">
              {isEdit
                ? `Editando ${produto.id} — ${produto.nome}`
                : "Preencha os dados do novo produto"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* ── Nome + SKU ── */}
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: "span 1" }}>
              <label className="form-label">
                Nome <span className="form-label-req">*</span>
              </label>
              <input
                className={`form-input ${erros.nome ? "err" : ""}`}
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Nome do produto"
                autoFocus
              />
              {erros.nome && <div className="form-error">{erros.nome}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">SKU <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
              <input
                className="form-input"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="ex: PF-3040-01"
              />
            </div>
          </div>

          {/* ── Preço + Custo + Margem live ── */}
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Preço de Venda (R$)</label>
              <input
                className={`form-input ${erros.preco ? "err" : ""}`}
                value={form.preco}
                onChange={(e) => set("preco", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              {erros.preco && <div className="form-error">{erros.preco}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Custo (R$)</label>
              <input
                className={`form-input ${erros.custo ? "err" : ""}`}
                value={form.custo}
                onChange={(e) => set("custo", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              {erros.custo && <div className="form-error">{erros.custo}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Margem (ROI) calculada</label>
              <div
                className="form-input"
                style={{
                  display: "flex", alignItems: "center",
                  color: margemLive !== null
                    ? margemLive >= 30
                      ? "var(--green)"
                      : margemLive >= 10
                        ? "var(--gold)"
                        : "var(--red)"
                    : "var(--text-3)",
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                }}
              >
                {margemLive !== null ? `${margemLive.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>

          {/* ── Calculadora de Margem ── */}
          <div className="margin-calc-box">
            <div className="margin-calc-title">🧮 Calculadora de Margem por ROI</div>
            <div className="margin-calc-row">
              <div className="margin-calc-field">
                <label>Custo (R$)</label>
                <input
                  className="form-input"
                  value={calcCusto}
                  onChange={(e) => setCalcCusto(e.target.value)}
                  placeholder="ex: 100,00"
                  inputMode="decimal"
                />
              </div>
              <div className="margin-calc-field">
                <label>Margem (%)</label>
                <input
                  className="form-input"
                  value={calcMargem}
                  onChange={(e) => setCalcMargem(e.target.value)}
                  placeholder="ex: 40"
                  inputMode="decimal"
                />
              </div>
              <div className="margin-calc-field">
                <label>Preço Sugerido</label>
                <div className="margin-result">
                  <div className="margin-result-label" />
                  {calcCusto && calcMargem
                    ? fmtR$(precoSugerido)
                    : <span style={{ color: "var(--text-3)", fontSize: 12, fontWeight: 400 }}>preencha os campos</span>
                  }
                </div>
              </div>
            </div>
            <p className="form-hint" style={{ marginBottom: 8 }}>
              Fórmula: Preço = Custo × (1 + Margem%). Ex: R$100 × 140% = R$140,00
            </p>
            <button
              className="btn-apply-margin"
              onClick={aplicarCalculo}
              disabled={!calcCusto || !calcMargem}
            >
              ↑ Aplicar ao produto
            </button>
          </div>

          <hr className="form-section-sep" />
          <div className="form-section-label">Estoque & Foto</div>

          {/* ── Estoque ── */}
          <div className="form-group" style={{ maxWidth: 180 }}>
            <label className="form-label">Estoque Inicial</label>
            <input
              className={`form-input ${erros.estoque ? "err" : ""}`}
              type="number"
              min="0"
              value={form.estoque}
              onChange={(e) => set("estoque", e.target.value)}
              placeholder="0"
            />
            {erros.estoque && <div className="form-error">{erros.estoque}</div>}
          </div>

          {/* ── Foto ── */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Foto <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
            <div className="foto-upload-wrap">
              <div className="foto-preview">
                {form.foto
                  ? <img src={form.foto} alt="preview" />
                  : <ImageOff size={16} color="var(--text-3)" />
                }
              </div>
              <button className="btn-foto" onClick={() => fotoInputRef.current?.click()}>
                📷 Escolher
              </button>
              {form.foto && (
                <button className="btn-foto-rm" onClick={() => set("foto", null)} title="Remover foto">
                  <X size={12} />
                </button>
              )}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFoto}
              />
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleSalvar}
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : isEdit
                ? "Salvar Alterações"
                : "+ Salvar Produto"}
          </button>
        </div>

      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   MODAL: Confirmar Exclusão (com proteção de vendas)
   ══════════════════════════════════════════════════════ */
function ModalConfirmDelete({ produto, vendasComProduto, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);
  const bloqueado = vendasComProduto > 0;

  const handleConfirm = async () => {
    if (bloqueado) return;
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">
            {bloqueado ? "Produto em uso" : "Excluir Produto"}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="confirm-body">
          <div className="confirm-icon">{bloqueado ? "🔒" : "🗑️"}</div>
          {bloqueado ? (
            <>
              <p>
                O produto <strong>{produto.nome}</strong> não pode ser excluído pois está
                vinculado a <strong>{vendasComProduto} venda{vendasComProduto > 1 ? "s" : ""}</strong>.
              </p>
              <div className="confirm-warning">
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Excluir este produto quebraria o histórico de vendas. Se quiser
                  desativá-lo, edite e deixe o estoque em zero.
                </span>
              </div>
            </>
          ) : (
            <p>
              Tem certeza que deseja excluir{" "}
              <strong>{produto.nome}</strong>?<br />
              Esta ação não pode ser desfeita.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {bloqueado ? "Entendido" : "Cancelar"}
          </button>
          {!bloqueado && (
            <button
              className="btn-danger"
              onClick={handleConfirm}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function Produtos({ isPro = false }) {
  const [produtos, setProdutos] = useState([]);
  const [vendas,   setVendas]   = useState([]);
  // ── Multi-tenant ──
  const { tenantUid, podeCriar, podeEditar, podeExcluir } = useAuth();

  // ── Flags de permissão ──
  const podeCriarV  = podeCriar("produtos");
  const podeEditarV = podeEditar("produtos");
  const podeExcluirV = podeExcluir("produtos");

  const [produtoIdCnt, setProdutoIdCnt] = useState(0);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);

  const [modalNovo, setModalNovo] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [deletando, setDeletando] = useState(null);


  /* Firestore */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const userRef    = doc(db, "users", tenantUid);
    const produtosCol = collection(db, "users", tenantUid, "produtos");
    const vendasCol  = collection(db, "users", tenantUid, "vendas");

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setProdutoIdCnt(snap.data().produtoIdCnt || 0);
    });

    const unsubProdutos = onSnapshot(produtosCol, (snap) => {
      setProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubVendas = onSnapshot(vendasCol, (snap) => {
      setVendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUser(); unsubProdutos(); unsubVendas(); };
  }, [tenantUid]);

  /* Conta quantas vendas referenciam um produto pelo nome */
  const vendasDoProduto = (nomeProduto) =>
    vendas.filter((v) =>
      v.itens?.some(
        (i) =>
          (i.nome || i.produto || "").trim().toLowerCase() ===
          nomeProduto.trim().toLowerCase()
      )
    ).length;

  /* Handlers */
  const handleAdd = async (formData) => {
    if (!tenantUid) return;
    const newId = gerarIdProduto(produtoIdCnt);
    await setDoc(doc(db, "users", tenantUid, "produtos", newId), {
      ...formData,
      criadoEm: new Date().toISOString(),
    });
    await setDoc(
      doc(db, "users", tenantUid),
      { produtoIdCnt: produtoIdCnt + 1 },
      { merge: true }
    );
    setModalNovo(false);
  };

  const handleEdit = async (formData) => {
    if (!tenantUid || !editando) return;
    await setDoc(
      doc(db, "users", tenantUid, "produtos", editando.id),
      formData,
      { merge: true }
    );
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "produtos", deletando.id));
    setDeletando(null);
  };

  /* Filtro por busca */
  const produtosFiltrados = useMemo(() => {
    if (!search.trim()) return produtos;
    const q = search.toLowerCase();
    return produtos.filter(
      (p) =>
        p.nome?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q)
    );
  }, [produtos, search]);

  /* Badge de margem */
  const badgeMargem = (m) => {
    if (m == null || m === 0) return <span className="badge badge-blue">—</span>;
    if (m >= 30) return <span className="badge badge-green">{m.toFixed(1)}%</span>;
    if (m >= 10) return <span className="badge badge-gold">{m.toFixed(1)}%</span>;
    return <span className="badge badge-red">{m.toFixed(1)}%</span>;
  };

  /* Badge de estoque */
  const badgeEstoque = (e) => {
    if (e == null) return <span className="badge badge-blue">—</span>;
    if (e > 10)  return <span className="badge badge-green">{e}</span>;
    if (e > 0)   return <span className="badge badge-gold">{e}</span>;
    return <span className="badge badge-red">0</span>;
  };

  // App.jsx bloqueia render enquanto loadingAuth||!tenantUid, então esse guard é redundante mas seguro

  return (
    <>
      <style>{CSS}</style>

      {/* ── Topbar ── */}
      <header className="pd-topbar">
        <div className="pd-topbar-title">
          <h1>Produtos</h1>
          <p>Gerencie seu catálogo de produtos e margens</p>
        </div>

        <div className="pd-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome, SKU ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {podeCriarV && (
        <button
          className="btn-novo-pd"
          onClick={() => setModalNovo(true)}
          disabled={!isPro && produtos.length >= LIMITES_FREE.produtos}
          title={!isPro && produtos.length >= LIMITES_FREE.produtos ? `Limite de ${LIMITES_FREE.produtos} produtos atingido no plano Free` : undefined}
        >
          <Package size={14} /> + Novo Produto
        </button>
        )}
      </header>

      {/* ── Conteúdo ── */}
      <div className="ag-content">
        <BannerLimite total={produtos.length} limite={LIMITES_FREE.produtos} tipo="produtos" isPro={isPro} />
        <div className="pd-table-wrap">
          <div className="pd-table-header">
            <span className="pd-table-title">Produtos cadastrados</span>
            <span className="pd-count-badge">{produtos.length}</span>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="pd-row pd-row-head">
            <span />
            <span>ID</span>
            <span>Produto</span>
            <span>Preço</span>
            <span>Custo</span>
            <span>Margem</span>
            <span>Estoque</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="pd-loading">Carregando produtos...</div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="pd-empty">
              {search
                ? "Nenhum produto encontrado para essa busca."
                : "Nenhum produto cadastrado ainda."}
            </div>
          ) : (
            produtosFiltrados.map((p) => (
              <div key={p.id} className="pd-row">

                {/* Foto */}
                <div className="pd-thumb">
                  {p.foto
                    ? <img src={p.foto} alt={p.nome} />
                    : <ImageOff size={13} color="var(--text-3)" />
                  }
                </div>

                {/* ID */}
                <span className="pd-id">{p.id}</span>

                {/* Nome + SKU */}
                <div className="pd-nome-cell">
                  <span className="pd-nome">{p.nome}</span>
                  {p.sku && <span className="pd-sku">{p.sku}</span>}
                </div>

                {/* Preço */}
                <span className="pd-preco">{fmtR$(p.preco)}</span>

                {/* Custo */}
                <span className="pd-custo">{fmtR$(p.custo)}</span>

                {/* Margem */}
                {badgeMargem(p.margem)}

                {/* Estoque */}
                {badgeEstoque(p.estoque)}

                {/* Ações */}
                <div className="pd-actions">
                  {podeEditarV && (
                  <button
                    className="btn-icon btn-icon-edit"
                    title="Editar"
                    onClick={() => setEditando(p)}
                  >
                    <Edit2 size={13} />
                  </button>
                  )}
                  {podeExcluirV && (
                  <button
                    className="btn-icon btn-icon-del"
                    title="Excluir"
                    onClick={() => setDeletando(p)}
                  >
                    <Trash2 size={13} />
                  </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modais ── */}
      {modalNovo && podeCriarV && (
        <ModalNovoProduto
          produtos={produtos}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && podeEditarV && (
        <ModalNovoProduto
          produto={editando}
          produtos={produtos}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
        />
      )}
      {deletando && podeExcluirV && (
        <ModalConfirmDelete
          produto={deletando}
          vendasComProduto={vendasDoProduto(deletando.nome)}
          onConfirm={handleDelete}
          onClose={() => setDeletando(null)}
        />
      )}
    </>
  );
}
