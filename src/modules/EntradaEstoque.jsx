/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — EntradaEstoque.jsx (VERSÃO CORRIGIDA)
   Correções:
   • "No document to update" → agora usa set() com merge
   • Exclusão agora funciona corretamente
   • Modal de confirmação de exclusão (padrão do sistema)
   • Maior robustez com transactions
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  PackagePlus, Search, X, AlertCircle, CheckCircle2, Edit, Trash2 
} from "lucide-react";
import { db, auth, onAuthStateChanged } from "../lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

/* ── CSS (adicionado estilos para modal de confirmação) ── */
const CSS = `
  /* ... (mantenha todo o CSS anterior que você já tinha) ... */

  /* Modal de Confirmação de Exclusão */
  .confirm-modal-box {
    max-width: 420px;
  }
  .confirm-title {
    font-size: 16px; font-weight: 600; color: var(--red);
  }
  .confirm-text {
    font-size: 13px; color: var(--text-2); line-height: 1.5;
    margin: 12px 0 20px;
  }
`;

/* ── Helpers (mesmos de antes) ── */
const hoje = () => new Date().toISOString().slice(0, 10);

const fmtR$ = (v) =>
  v != null && v !== "" ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d + "T00:00:00");
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const sanitize = (s) => (typeof s === "string" ? s.trim() : s);

const MOTIVOS = ["Compra de fornecedor", "Ajuste de estoque", "Devolução de cliente", "Transferência entre locais", "Produção interna", "Outros"];

/* Toast */
function Toast({ msg, tipo }) {
  if (!msg) return null;
  const Icon = tipo === "sucesso" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`ee-toast ${tipo}`}>
      <Icon size={15} />
      {msg}
    </div>
  );
}

/* ====================== MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ====================== */
function ModalConfirmDelete({ movimento, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box confirm-modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title confirm-title">Confirmar Exclusão</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          <div className="confirm-text">
            Tem certeza que deseja excluir esta entrada?<br /><br />
            <strong>Produto:</strong> {movimento.produtoNome || movimento.produtoId}<br />
            <strong>Quantidade:</strong> +{movimento.quantidade}<br />
            <strong>Data:</strong> {fmtData(movimento.data)}<br /><br />
            O estoque será reduzido automaticamente.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button 
            className="btn-primary" 
            style={{ background: "var(--red)", color: "#fff" }}
            onClick={onConfirm}
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================== MODAL ENTRADA (CRIAR / EDITAR) ====================== */
function ModalEntrada({ uid, produtos, fornecedores, movimento = null, onSalvo, onClose }) {
  const isEditing = !!movimento;

  const [form, setForm] = useState(() => isEditing ? {
    produtoId: movimento.produtoId || "",
    quantidade: String(movimento.quantidade ?? ""),
    motivo: movimento.motivo || "",
    fornecedor: movimento.fornecedor || "",
    data: movimento.data || hoje(),
    observacao: movimento.observacao || "",
    custo: movimento.custo != null ? String(movimento.custo) : "",
  } : {
    produtoId: "", quantidade: "", motivo: "", fornecedor: "", data: hoje(), observacao: "", custo: ""
  });

  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [errGlobal, setErrGlobal] = useState("");

  const produtoSelecionado = useMemo(() => produtos.find(p => p.id === form.produtoId) || null, [form.produtoId, produtos]);

  const estoqueAtual = produtoSelecionado?.estoque ?? 0;
  const oldQuantidade = isEditing ? Number(movimento.quantidade) || 0 : 0;
  const qtdForm = Math.max(0, Number(form.quantidade) || 0);
  const delta = qtdForm - oldQuantidade;
  const novoEstoque = Math.max(0, estoqueAtual + delta);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
    setErrGlobal("");
  };

  const validar = () => {
    const e = {};
    if (!form.produtoId) e.produtoId = "Selecione um produto.";
    if (!form.quantidade || Number(form.quantidade) < 0) e.quantidade = "Quantidade inválida.";
    if (!form.motivo) e.motivo = "Selecione o motivo.";
    if (!form.data) e.data = "Data inválida.";
    if (form.custo !== "" && Number(form.custo) < 0) e.custo = "Custo não pode ser negativo.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    setErrGlobal("");

    try {
      const produtoRef = doc(db, "users", uid, "produtos", form.produtoId);

      await runTransaction(db, async (tx) => {
  const prodSnap = await tx.get(produtoRef);
  if (!prodSnap.exists()) throw new Error("Produto não encontrado.");

  const estoqueReal = prodSnap.data().estoque ?? 0;
  const novoEst = Math.max(0, estoqueReal + delta);   // delta = qtdForm - oldQuantidade

  // Atualiza o produto
  tx.set(produtoRef, { estoque: novoEst }, { merge: true });

  if (form.custo !== "" && !isNaN(Number(form.custo))) {
    tx.set(produtoRef, { custo: Number(form.custo) }, { merge: true });
  }

  const movRef = doc(db, "users", uid, "movimentacoes_estoque", movimento.id);

  // Usa SET com MERGE ao invés de UPDATE (resolve "No document to update")
  tx.set(movRef, {
    quantidade: Number(form.quantidade),
    motivo: sanitize(form.motivo),
    fornecedor: sanitize(form.fornecedor) || null,
    observacao: sanitize(form.observacao) || null,
    data: sanitize(form.data),
    custo: form.custo !== "" ? Number(form.custo) : null,
    estoqueAnterior: estoqueReal,
    estoqueNovo: novoEst,
    dataAtualizacao: serverTimestamp(),
  }, { merge: true });
});

      onSalvo(isEditing ? "Entrada atualizada com sucesso!" : "Entrada registrada com sucesso!");
      onClose();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setErrGlobal(err.message || "Erro desconhecido ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {isEditing ? "Editar Entrada de Estoque" : "Registrar Entrada de Estoque"}
            </div>
            <div className="modal-sub">
              {isEditing 
                ? "Corrija os dados (o estoque será ajustado automaticamente pelo delta)" 
                : "Informe os dados da movimentação de entrada"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Produto */}
          <div className="form-group">
            <label className="form-label">
              Produto <span className="form-label-req">*</span>
            </label>

            {isEditing ? (
              /* Em edição o produto é BLOQUEADO (segurança) */
              <>
                <div className="form-input readonly">
                  {produtoSelecionado 
                    ? `${produtoSelecionado.nome} ${produtoSelecionado.sku ? `(${produtoSelecionado.sku})` : ""}` 
                    : "Produto removido"}
                </div>
                <div className="form-note">Produto não pode ser alterado em edições.</div>
              </>
            ) : (
              <select
                className={`form-input ${erros.produtoId ? "err" : ""}`}
                value={form.produtoId}
                onChange={(e) => set("produtoId", e.target.value)}
              >
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            )}

            {erros.produtoId && <div className="form-error">{erros.produtoId}</div>}
          </div>

          {/* Preview de estoque em tempo real (adaptado para edição) */}
          {produtoSelecionado && (
            <div className="ee-preview">
              <div className="ee-preview-card">
                <div className="ee-preview-label">Estoque Atual</div>
                <div className="ee-preview-val atual">{estoqueAtual}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">
                  {isEditing ? "Ajuste (Delta)" : "Adicionando"}
                </div>
                <div className={`ee-preview-val ${delta >= 0 ? "add" : "reduce"}`}>
                  {delta >= 0 ? `+${delta}` : delta}
                </div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Novo Estoque</div>
                <div className="ee-preview-val novo">{novoEstoque}</div>
              </div>
            </div>
          )}

          {/* Quantidade + Data */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Quantidade <span className="form-label-req">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className={`form-input ${erros.quantidade ? "err" : ""}`}
                value={form.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
                placeholder="0"
              />
              {erros.quantidade && <div className="form-error">{erros.quantidade}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">
                Data <span className="form-label-req">*</span>
              </label>
              <input
                type="date"
                className={`form-input ${erros.data ? "err" : ""}`}
                value={form.data}
                onChange={(e) => set("data", e.target.value)}
              />
              {erros.data && <div className="form-error">{erros.data}</div>}
            </div>
          </div>

          {/* Motivo */}
          <div className="form-group">
            <label className="form-label">
              Motivo <span className="form-label-req">*</span>
            </label>
            <select
              className={`form-input ${erros.motivo ? "err" : ""}`}
              value={form.motivo}
              onChange={(e) => set("motivo", e.target.value)}
            >
              <option value="">Selecione o motivo...</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {erros.motivo && <div className="form-error">{erros.motivo}</div>}
          </div>

          {/* Fornecedor + Custo */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fornecedor</label>
              <select
                className="form-input"
                value={form.fornecedor}
                onChange={(e) => set("fornecedor", e.target.value)}
              >
                <option value="">Nenhum</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.nome || f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Custo unitário (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`form-input ${erros.custo ? "err" : ""}`}
                value={form.custo}
                onChange={(e) => set("custo", e.target.value)}
                placeholder="0,00"
              />
              {erros.custo && <div className="form-error">{erros.custo}</div>}
            </div>
          </div>

          {/* Observação */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observação</label>
            <textarea
              className="form-input"
              rows={2}
              style={{ resize: "vertical", minHeight: 60 }}
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Informações adicionais (opcional)..."
            />
          </div>

          {/* Erro global */}
          {errGlobal && (
            <div
              style={{
                marginTop: 14, display: "flex", alignItems: "center", gap: 7,
                background: "var(--red-d, rgba(224,82,82,0.1))",
                border: "1px solid rgba(224,82,82,0.25)",
                borderRadius: 8, padding: "9px 13px",
                color: "var(--red)", fontSize: 12,
              }}
            >
              <AlertCircle size={14} />
              {errGlobal}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={salvando}>
            {salvando ? (
              <>
                <div className="spinner" /> Salvando...
              </>
            ) : (
              <>
                <PackagePlus size={14} />
                {isEditing ? "Salvar Alterações" : "Registrar Entrada"}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}


/* Componente Principal */
export default function EntradaEstoque() {
  const [uid, setUid] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [movimentoParaEditar, setMovimentoParaEditar] = useState(null);

  // Novo estado para modal de exclusão
  const [movimentoParaExcluir, setMovimentoParaExcluir] = useState(null);

  const [toast, setToast] = useState({ msg: "", tipo: "sucesso" });
  const showToast = (msg, tipo = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast({ msg: "", tipo: "sucesso" }), 3500);
  };

  // Auth + listeners (mesmo código anterior)

  /* EDITAR */
  const handleEditar = (mov) => {
    setMovimentoParaEditar(mov);
    setModalEntradaAberto(true);
  };

  /* EXCLUIR - abre modal bonito */

const confirmarExclusao = async () => {
  if (!movimentoParaExcluir) return;

  try {
    const mov = movimentoParaExcluir;

    const movRef = doc(db, "users", uid, "movimentacoes_estoque", mov.id);
    const produtoRef = doc(db, "users", uid, "produtos", mov.produtoId);

    await runTransaction(db, async (tx) => {
      const prodSnap = await tx.get(produtoRef);
      if (!prodSnap.exists()) throw new Error("Produto não encontrado.");

      const estoqueReal = prodSnap.data().estoque ?? 0;
      const qtd = Number(mov.quantidade) || 0;
      const novoEstoque = Math.max(0, estoqueReal - qtd);

      tx.set(produtoRef, { estoque: novoEstoque }, { merge: true });
      tx.delete(movRef);
    });

    showToast("Entrada excluída com sucesso!", "sucesso");
    setMovimentoParaExcluir(null);

  } catch (err) {
    console.error(err);
    showToast("Erro ao excluir: " + err.message, "erro");
  }
};
   
  const handleExcluir = (mov) => {
  setMovimentoParaExcluir(mov);
};

 
  // ... resto do componente (tabela, botões de ação, etc.)

  return (
    <>
      <style>{CSS}</style>
      {/* Topbar e Tabela ... (mesmo de antes) */}

      {/* Modal Entrada */}
      {modalEntradaAberto && (
        <ModalEntrada
          uid={uid}
          produtos={produtos}
          fornecedores={fornecedores}
          movimento={movimentoParaEditar}
          onSalvo={(msg) => showToast(msg)}
          onClose={() => { setModalEntradaAberto(false); setMovimentoParaEditar(null); }}
        />
      )}

      {/* Modal Confirmação de Exclusão */}
      {movimentoParaExcluir && (
        <ModalConfirmDelete
          movimento={movimentoParaExcluir}
          onConfirm={confirmarExclusao}
          onClose={() => setMovimentoParaExcluir(null)}
        />
      )}

      <Toast msg={toast.msg} tipo={toast.tipo} />
    </>
  );
}
