/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Vendedores.jsx
   Multi-tenant: queries em /users/{tenantUid}/...
   Permissões via useAuth() — módulo "vendedores"
   Regra de comissão: (Venda - Custo) × (% / 100)
   Exclusão protegida: bloqueia se há vendas vinculadas
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X, ChevronRight,
  TrendingUp, DollarSign, ShoppingBag,
} from "lucide-react";

import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";

/* ─────────────────────────────────────────────────────
   CSS — padrão visual ASSENT
───────────────────────────────────────────────────── */
const CSS = `
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
  .modal-box-md  { max-width: 400px; }
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

  /* ── Form ── */
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

  .form-hint {
    font-size: 11px; color: var(--text-3); margin-top: 5px;
    line-height: 1.4;
  }

  /* ── Buttons ── */
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
  .btn-primary:disabled { opacity: .5; cursor: default; }

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
  .btn-danger:disabled { opacity: .45; cursor: default; }

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

  .btn-novo-vd {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: opacity .13s, transform .1s;
  }
  .btn-novo-vd:hover  { opacity: .88; }

  /* ── Topbar ── */
  .vd-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .vd-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .vd-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .vd-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px;
  }
  .vd-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }

  /* ── Tabela ── */
  .vd-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .vd-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .vd-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text);
  }
  .vd-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  /* grid: ID | Nome | Telefone | Email | Comissão | Usuário | Ações */
  .vd-row {
    display: grid;
    grid-template-columns: 72px 1fr 130px 170px 95px 140px 78px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .vd-row:last-child { border-bottom: none; }
  .vd-row:hover { background: rgba(255,255,255,0.02); }
  .vd-row-head { background: var(--s2); }
  .vd-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .vd-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .vd-nome { color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer; }
  .vd-nome:hover { color: var(--gold); text-decoration: underline; }
  .vd-commission-badge {
    display: inline-flex; align-items: center;
    background: rgba(200,165,94,0.1); border: 1px solid rgba(200,165,94,0.2);
    color: var(--gold); border-radius: 6px; padding: 2px 8px;
    font-size: 11px; font-weight: 600; font-family: 'Sora', sans-serif;
  }
  .vd-vinculo-badge {
    display: inline-flex; align-items: center;
    background: rgba(91,142,240,0.08); border: 1px solid rgba(91,142,240,0.2);
    color: var(--blue); border-radius: 6px; padding: 2px 8px;
    font-size: 11px; font-weight: 500; max-width: 130px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .vd-sem-vinculo { font-size: 11px; color: var(--text-3); font-style: italic; }
  .vd-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  .vd-overflow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vd-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
  .vd-empty, .vd-loading { padding: 56px 20px; text-align: center; color: var(--text-3); }

  /* ── Modal Detalhe ── */
  .vdh-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .vdh-kpi {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 13px 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .vdh-kpi-icon {
    width: 28px; height: 28px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 6px;
  }
  .vdh-kpi-label {
    font-size: 10px; font-weight: 500; letter-spacing: .05em;
    text-transform: uppercase; color: var(--text-3);
  }
  .vdh-kpi-val { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; }
  .vdh-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
    margin-bottom: 10px; margin-top: 20px;
  }
  .vdh-commission-box {
    background: rgba(200,165,94,0.06); border: 1px solid rgba(200,165,94,0.18);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .vdh-commission-label { font-size: 11px; color: var(--text-2); font-weight: 500; }
  .vdh-commission-val { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; color: var(--gold); }
  .vdh-commission-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  .vdh-row {
    display: grid;
    grid-template-columns: 80px 1fr 90px 100px 100px 20px;
    padding: 10px 14px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    cursor: pointer; transition: background .12s;
  }
  .vdh-row:last-child { border-bottom: none; }
  .vdh-row:hover { background: rgba(255,255,255,0.02); }
  .vdh-row-head { background: var(--s2); cursor: default; }
  .vdh-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .vdh-venda-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .vdh-total  { font-weight: 600; color: var(--green); text-align: right; }
  .vdh-comiss { font-weight: 600; color: var(--gold);  text-align: right; }
  .vdh-empty  { padding: 32px 14px; text-align: center; color: var(--text-3); font-size: 12px; }

  /* ── Confirm Delete ── */
  .confirm-body {
    padding: 28px 22px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 14px;
  }
  .confirm-icon { font-size: 36px; }
  .confirm-body p { font-size: 13px; color: var(--text-2); line-height: 1.6; }
  .confirm-warning {
    background: rgba(224,82,82,0.08); border: 1px solid rgba(224,82,82,0.2);
    border-radius: 8px; padding: 10px 14px; margin-top: 6px;
    font-size: 12px; color: var(--red); line-height: 1.5; text-align: left;
  }
`;

/* ─────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────── */
const gerarIdVendedor = (cnt) => `V${String(cnt + 1).padStart(4, "0")}`;

const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const CARGO_LABELS = {
  admin: "Admin", financeiro: "Financeiro", comercial: "Comercial",
  compras: "Compras", operacional: "Operacional",
  vendedor: "Vendedor", suporte: "Suporte",
};

const calcComissaoVenda = (venda, percentual) => {
  if (!percentual || percentual <= 0) return 0;
  const itens = venda.itens || [];
  const total = typeof venda.total === "number"
    ? venda.total
    : itens.reduce((s, i) => s + (i.preco || 0) * (i.qtd || 1) - (i.desconto || 0), 0);
  const custoTotal = itens.reduce((s, i) => s + (i.custo || 0) * (i.qtd || 1), 0);
  const lucro = total - custoTotal;
  return lucro > 0 ? lucro * (percentual / 100) : 0;
};

/* ═══════════════════════════════════════════════════
   MODAL: Novo / Editar Vendedor
═══════════════════════════════════════════════════ */
function ModalNovoVendedor({ vendedor, vendedores, usuariosSistema, onSave, onClose }) {
  const isEdit = !!vendedor;

  const [form, setForm] = useState({
    nome:       vendedor?.nome       || "",
    telefone:   vendedor?.telefone   || "",
    email:      vendedor?.email      || "",
    comissao:   vendedor?.comissao   != null ? String(vendedor.comissao) : "",
    observacao: vendedor?.observacao || "",
    usuarioId:  vendedor?.usuarioId  || "",
  });
  const [erros,    setErros]    = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo) e.nome = "Nome é obrigatório.";
    if (nomeLimpo) {
      const dup = vendedores.some(v =>
        v.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() && v.id !== vendedor?.id
      );
      if (dup) e.nome = "Já existe um vendedor com este nome.";
    }
    if (form.comissao !== "") {
      const pct = parseFloat(form.comissao);
      if (isNaN(pct) || pct < 0 || pct > 100)
        e.comissao = "Informe um percentual entre 0 e 100.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    await onSave({
      nome:       form.nome.trim(),
      telefone:   form.telefone.trim(),
      email:      form.email.trim().toLowerCase(),
      comissao:   form.comissao !== "" ? parseFloat(form.comissao) : null,
      observacao: form.observacao.trim(),
      usuarioId:  form.usuarioId || "",
    });
    setSalvando(false);
  };

  const pct = parseFloat(form.comissao);
  const exemploLucro  = 100;
  const exemploComiss = !isNaN(pct) && pct > 0 ? exemploLucro * (pct / 100) : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Vendedor" : "Novo Vendedor"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${vendedor.id} — ${vendedor.nome}` : "Preencha os dados do novo vendedor"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Nome */}
          <div className="form-group">
            <label className="form-label">Nome <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.nome ? "err" : ""}`}
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Nome completo do vendedor"
              autoFocus
            />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          {/* Telefone + Email */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input
                className="form-input"
                value={form.telefone}
                onChange={e => set("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                className="form-input"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="vendedor@empresa.com"
                type="email"
              />
            </div>
          </div>

          {/* Comissão */}
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input
              className={`form-input ${erros.comissao ? "err" : ""}`}
              value={form.comissao}
              onChange={e => set("comissao", e.target.value)}
              placeholder="Ex: 10"
              type="number" min="0" max="100" step="0.1"
              style={{ maxWidth: 160 }}
            />
            {erros.comissao
              ? <div className="form-error">{erros.comissao}</div>
              : exemploComiss !== null
                ? <div className="form-hint">
                    💡 Base = Venda − Custo. Ex: lucro de{" "}
                    <strong style={{ color: "var(--text-2)" }}>{fmtR$(exemploLucro)}</strong>
                    {" "}→ comissão de{" "}
                    <strong style={{ color: "var(--gold)" }}>{fmtR$(exemploComiss)}</strong>
                  </div>
                : <div className="form-hint">
                    Calculado sobre o lucro (Venda − Custo). Deixe em branco se não aplicável.
                  </div>
            }
          </div>

          {/* Usuário de login vinculado */}
          <div className="form-group">
            <label className="form-label">Usuário do sistema vinculado</label>
            <select
              className="form-input"
              value={form.usuarioId}
              onChange={e => set("usuarioId", e.target.value)}
            >
              <option value="">— Nenhum (vendedor sem login) —</option>
              {usuariosSistema
                .filter(u => u.cargo === "vendedor" || !u.cargo)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.email}) — {CARGO_LABELS[u.cargo] || u.cargo}
                  </option>
                ))}
            </select>
            <div className="form-hint">
              Vincule ao usuário de login para que ele veja apenas suas próprias vendas.
            </div>
          </div>

          {/* Observação */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observação</label>
            <input
              className="form-input"
              value={form.observacao}
              onChange={e => set("observacao", e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Vendedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Detalhe do Vendedor
═══════════════════════════════════════════════════ */
function ModalDetalheVendedor({ vendedor, vendas, onClose }) {
  const vendasVendedor = useMemo(() =>
    vendas.filter(v => v.vendedorId === vendedor.id),
    [vendas, vendedor]
  );

  const totalVendas   = vendasVendedor.length;
  const totalFaturado = vendasVendedor.reduce((s, v) => s + (v.total || 0), 0);
  const totalComissao = vendasVendedor.reduce(
    (s, v) => s + calcComissaoVenda(v, vendedor.comissao), 0
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{vendedor.nome}</div>
            <div className="modal-sub">
              {[vendedor.id, vendedor.telefone, vendedor.email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* KPIs */}
          <div className="vdh-kpis">
            <div className="vdh-kpi">
              <div className="vdh-kpi-icon" style={{ background: "rgba(91,142,240,0.12)" }}>
                <ShoppingBag size={14} color="var(--blue)" />
              </div>
              <div className="vdh-kpi-label">Vendas</div>
              <div className="vdh-kpi-val" style={{ color: "var(--text)" }}>{totalVendas}</div>
            </div>
            <div className="vdh-kpi">
              <div className="vdh-kpi-icon" style={{ background: "rgba(80,200,120,0.12)" }}>
                <TrendingUp size={14} color="var(--green)" />
              </div>
              <div className="vdh-kpi-label">Total Faturado</div>
              <div className="vdh-kpi-val" style={{ color: "var(--green)" }}>{fmtR$(totalFaturado)}</div>
            </div>
            <div className="vdh-kpi">
              <div className="vdh-kpi-icon" style={{ background: "rgba(200,165,94,0.12)" }}>
                <DollarSign size={14} color="var(--gold)" />
              </div>
              <div className="vdh-kpi-label">Comissão Total</div>
              <div className="vdh-kpi-val" style={{ color: "var(--gold)" }}>
                {vendedor.comissao ? fmtR$(totalComissao) : "—"}
              </div>
            </div>
          </div>

          {/* Caixa de comissão */}
          {vendedor.comissao > 0 && (
            <div className="vdh-commission-box">
              <div>
                <div className="vdh-commission-label">Comissão sobre lucro · {vendedor.comissao}%</div>
                <div className="vdh-commission-sub">Calculado sobre (Venda − Custo) de cada venda vinculada</div>
              </div>
              <div className="vdh-commission-val">{fmtR$(totalComissao)}</div>
            </div>
          )}

          {/* Lista de vendas */}
          <div className="vdh-section-label">Vendas Vinculadas</div>
          <div className="vd-table-wrap">
            <div className="vdh-row vdh-row-head">
              <span>ID</span><span>Cliente</span><span>Data</span>
              <span style={{ textAlign: "right" }}>Total</span>
              <span style={{ textAlign: "right" }}>Comissão</span>
              <span />
            </div>
            {vendasVendedor.length === 0 ? (
              <div className="vdh-empty">Nenhuma venda vinculada a este vendedor ainda.</div>
            ) : vendasVendedor.map((v) => {
              const comissaoVenda = calcComissaoVenda(v, vendedor.comissao);
              return (
                <div key={v.id} className="vdh-row">
                  <span className="vdh-venda-id">{v.vendaId || v.id}</span>
                  <span style={{ color: "var(--text)" }}>{v.cliente || "—"}</span>
                  <span>{fmtData(v.data)}</span>
                  <span className="vdh-total">{fmtR$(v.total)}</span>
                  <span className="vdh-comiss">{vendedor.comissao ? fmtR$(comissaoVenda) : "—"}</span>
                  <ChevronRight size={13} color="var(--text-3)" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Confirmar Exclusão (bloqueada se tem vendas)
═══════════════════════════════════════════════════ */
function ModalConfirmDelete({ vendedor, vendasVinculadas, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);
  const temVendas = vendasVinculadas > 0;

  const handleConfirm = async () => {
    if (temVendas) return;
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Vendedor</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">{temVendas ? "🔒" : "🗑️"}</div>
          {temVendas ? (
            <>
              <p>Não é possível excluir <strong>{vendedor.nome}</strong>.</p>
              <div className="confirm-warning">
                Este vendedor possui <strong>{vendasVinculadas} venda(s)</strong> registrada(s).
                Excluir quebraria o histórico de vendas.<br /><br />
                Para desativá-lo, edite o registro e adicione uma observação indicando o status.
              </div>
            </>
          ) : (
            <p>
              Tem certeza que deseja excluir <strong>{vendedor.nome}</strong>?<br />
              Esta ação não pode ser desfeita.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {temVendas ? "Fechar" : "Cancelar"}
          </button>
          {!temVendas && (
            <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Vendedores
═══════════════════════════════════════════════════ */
export default function Vendedores() {
  // ── Multi-tenant: tenantUid em vez de user.uid ──
  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir } = useAuth();

  const [vendedores,      setVendedores]      = useState([]);
  const [usuariosSistema, setUsuariosSistema] = useState([]);
  const [vendas,          setVendas]          = useState([]);
  const [vendedorIdCnt,   setVendedorIdCnt]   = useState(0);
  const [search,          setSearch]          = useState("");
  const [loading,         setLoading]         = useState(true);

  const [modalNovo, setModalNovo] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [deletando, setDeletando] = useState(null);
  const [detalhe,   setDetalhe]   = useState(null);

  // ── Flags de permissão ──
  const podeCriarV   = podeCriar("vendedores");
  const podeEditarV  = podeEditar("vendedores");
  const podeExcluirV = podeExcluir("vendedores");

  // ── Listeners Firestore ──
  useEffect(() => {
    if (!tenantUid) return; // guard multi-tenant

    const unsubUser = onSnapshot(doc(db, "users", tenantUid), (snap) => {
      if (snap.exists()) setVendedorIdCnt(snap.data().vendedorIdCnt || 0);
    });

    const unsubVendedores = onSnapshot(
      collection(db, "users", tenantUid, "vendedores"),
      (snap) => {
        setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    const unsubVendas = onSnapshot(
      collection(db, "users", tenantUid, "vendas"),
      (snap) => setVendas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubUsuarios = onSnapshot(
      collection(db, "users", tenantUid, "usuarios"),
      (snap) => setUsuariosSistema(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubUser(); unsubVendedores(); unsubVendas(); unsubUsuarios(); };
  }, [tenantUid]);

  // ── CRUD ──
  const handleAdd = async (form) => {
    if (!tenantUid) return;
    const newId = gerarIdVendedor(vendedorIdCnt);
    await setDoc(doc(db, "users", tenantUid, "vendedores", newId), {
      ...form, criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", tenantUid), { vendedorIdCnt: vendedorIdCnt + 1 }, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.VENDEDORES, descricao: montarDescricao("criar", "Vendedor", form.nome, newId) });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    if (!tenantUid || !editando) return;
    await setDoc(doc(db, "users", tenantUid, "vendedores", editando.id), form, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.VENDEDORES, descricao: montarDescricao("editar", "Vendedor", form.nome, editando.id) });
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "vendedores", deletando.id));
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.VENDEDORES, descricao: montarDescricao("excluir", "Vendedor", deletando.nome, deletando.id) });
    setDeletando(null);
  };

  // ── Busca ──
  const vendedoresFiltrados = useMemo(() => {
    if (!search.trim()) return vendedores;
    const q = search.toLowerCase();
    return vendedores.filter(v =>
      v.nome?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.telefone?.toLowerCase().includes(q)
    );
  }, [vendedores, search]);

  // ── Mapa de vendas por vendedor (proteção de exclusão) ──
  const vendasPorVendedor = useMemo(() => {
    const map = {};
    vendas.forEach(v => {
      if (v.vendedorId) map[v.vendedorId] = (map[v.vendedorId] || 0) + 1;
    });
    return map;
  }, [vendas]);

  // ── Render ──
  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="vd-topbar">
        <div className="vd-topbar-title" style={{ flex: 1 }}>
          <h1>Vendedores</h1>
          <p>Gerencie sua equipe de vendas e comissões</p>
        </div>

        <div className="vd-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {podeCriarV && (
          <button className="btn-novo-vd" onClick={() => setModalNovo(true)}>
            <UserPlus size={14} /> Novo Vendedor
          </button>
        )}
      </header>

      {/* Conteúdo */}
      <div className="ag-content">
        <div className="vd-table-wrap">
          <div className="vd-table-header">
            <span className="vd-table-title">Vendedores cadastrados</span>
            <span className="vd-count-badge">{vendedores.length}</span>
          </div>

          {/* Cabeçalho */}
          <div className="vd-row vd-row-head">
            <span>ID</span>
            <span>Nome</span>
            <span>Telefone</span>
            <span>E-mail</span>
            <span>Comissão</span>
            <span>Usuário vinculado</span>
            {(podeEditarV || podeExcluirV) && (
              <span style={{ textAlign: "right" }}>Ações</span>
            )}
          </div>

          {loading ? (
            <div className="vd-loading">Carregando vendedores...</div>
          ) : vendedoresFiltrados.length === 0 ? (
            <div className="vd-empty"><p>Nenhum vendedor cadastrado ainda.</p></div>
          ) : (
            vendedoresFiltrados.map((v) => {
              const qtdVendas        = vendasPorVendedor[v.id] || 0;
              const usuarioVinculado = usuariosSistema.find(u => u.id === v.usuarioId);
              return (
                <div key={v.id} className="vd-row">
                  <span className="vd-id">{v.id}</span>

                  <div>
                    <div className="vd-nome" onClick={() => setDetalhe(v)}>{v.nome}</div>
                    {qtdVendas > 0 && (
                      <div className="vd-sub">{qtdVendas} venda{qtdVendas > 1 ? "s" : ""}</div>
                    )}
                  </div>

                  <span>{v.telefone || "—"}</span>
                  <span className="vd-overflow">{v.email || "—"}</span>

                  <span>
                    {v.comissao != null
                      ? <span className="vd-commission-badge">{v.comissao}%</span>
                      : "—"}
                  </span>

                  <span>
                    {usuarioVinculado
                      ? <span className="vd-vinculo-badge">{usuarioVinculado.nome}</span>
                      : <span className="vd-sem-vinculo">Sem vínculo</span>
                    }
                  </span>

                  {(podeEditarV || podeExcluirV) && (
                    <div className="vd-actions">
                      {podeEditarV && (
                        <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => setEditando(v)}>
                          <Edit2 size={13} />
                        </button>
                      )}
                      {podeExcluirV && (
                        <button className="btn-icon btn-icon-del" title="Excluir" onClick={() => setDeletando(v)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modais */}
      {modalNovo && podeCriarV && (
        <ModalNovoVendedor
          vendedores={vendedores}
          usuariosSistema={usuariosSistema}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && podeEditarV && (
        <ModalNovoVendedor
          vendedor={editando}
          vendedores={vendedores}
          usuariosSistema={usuariosSistema}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
        />
      )}
      {deletando && podeExcluirV && (
        <ModalConfirmDelete
          vendedor={deletando}
          vendasVinculadas={vendasPorVendedor[deletando.id] || 0}
          onConfirm={handleDelete}
          onClose={() => setDeletando(null)}
        />
      )}
      {detalhe && (
        <ModalDetalheVendedor
          vendedor={detalhe}
          vendas={vendas}
          onClose={() => setDetalhe(null)}
        />
      )}
    </>
  );
}
