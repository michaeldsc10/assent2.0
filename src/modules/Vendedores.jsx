// Vendedores.jsx — ASSENT v2.0
// Multi-tenant: queries em /users/{tenantUid}/...
// Permissões via useAuth() — módulo "vendedores" (admin: vcex | comercial: v)

import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CARGO_LABELS = {
  admin:       "Admin",
  financeiro:  "Financeiro",
  comercial:   "Comercial",
  compras:     "Compras",
  operacional: "Operacional",
  vendedor:    "Vendedor",
  suporte:     "Suporte / Atendimento",
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ---------------------------------------------------------------------------
// Modal — Novo / Editar Vendedor
// ---------------------------------------------------------------------------
function ModalVendedor({ vendedor, usuariosSistema, onSalvar, onFechar }) {
  const isEdicao = Boolean(vendedor?.id);

  const [form, setForm] = useState({
    nome:        vendedor?.nome        || "",
    telefone:    vendedor?.telefone    || "",
    email:       vendedor?.email       || "",
    comissao:    vendedor?.comissao    ?? "",
    observacao:  vendedor?.observacao  || "",
    usuarioId:   vendedor?.usuarioId   || "",
    ativo:       vendedor?.ativo       ?? true,
  });

  const [erro, setErro] = useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro("O nome do vendedor é obrigatório.");
      return;
    }
    const comissaoNum = parseFloat(String(form.comissao).replace(",", "."));
    if (form.comissao !== "" && (isNaN(comissaoNum) || comissaoNum < 0)) {
      setErro("Comissão inválida.");
      return;
    }
    setErro("");
    onSalvar({
      ...form,
      nome:      form.nome.trim(),
      comissao:  form.comissao === "" ? null : comissaoNum,
      usuarioId: form.usuarioId || "",
    });
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <h2 className="modal-titulo">
          {isEdicao ? "Editar Vendedor" : "Novo Vendedor"}
        </h2>

        {erro && <p className="erro-msg">{erro}</p>}

        <form onSubmit={handleSubmit}>
          {/* Nome */}
          <label className="campo-label">
            Nome *
            <input
              name="nome"
              value={form.nome}
              onChange={handleChange}
              className="campo-input"
              required
            />
          </label>

          {/* Telefone */}
          <label className="campo-label">
            Telefone
            <input
              name="telefone"
              value={form.telefone}
              onChange={handleChange}
              className="campo-input"
            />
          </label>

          {/* E-mail */}
          <label className="campo-label">
            E-mail
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="campo-input"
            />
          </label>

          {/* Comissão */}
          <label className="campo-label">
            Comissão (%)
            <input
              type="number"
              name="comissao"
              value={form.comissao}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              className="campo-input"
              placeholder="Ex: 5"
            />
          </label>

          {/* Vínculo com usuário do sistema */}
          <label className="campo-label">
            Usuário do sistema vinculado
            <select
              name="usuarioId"
              value={form.usuarioId}
              onChange={handleChange}
              className="campo-input"
            >
              <option value="">— Nenhum (vendedor sem login) —</option>
              {usuariosSistema
                .filter((u) => u.cargo === "vendedor" || !u.cargo)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.email}) — {CARGO_LABELS[u.cargo] || u.cargo}
                  </option>
                ))}
            </select>
            <small className="campo-hint">
              Vincule ao usuário de login para que ele veja apenas suas próprias vendas.
            </small>
          </label>

          {/* Observação */}
          <label className="campo-label">
            Observação
            <textarea
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              className="campo-input"
              rows={3}
            />
          </label>

          {/* Ativo — só em edição */}
          {isEdicao && (
            <label className="campo-label campo-checkbox">
              <input
                type="checkbox"
                name="ativo"
                checked={form.ativo}
                onChange={handleChange}
              />
              Vendedor ativo
            </label>
          )}

          <div className="modal-acoes">
            <button type="button" className="btn-secundario" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario">
              {isEdicao ? "Salvar alterações" : "Criar vendedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function Vendedores() {
  // ── Multi-tenant: usa tenantUid (não user.uid) nas queries ──
  const {
    tenantUid,
    podeCriar,
    podeEditar,
    podeExcluir,
  } = useAuth();

  const [vendedores,      setVendedores]      = useState([]);
  const [usuariosSistema, setUsuariosSistema] = useState([]);
  const [vendas,          setVendas]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modalAberto,     setModalAberto]     = useState(false);
  const [vendedorEditando, setVendedorEditando] = useState(null);
  const [expandido,       setExpandido]       = useState(null);
  const [busca,           setBusca]           = useState("");

  // ── Flags de permissão para o módulo ──
  const podeCriarVendedor  = podeCriar("vendedores");
  const podeEditarVendedor = podeEditar("vendedores");
  const podeExcluirVendedor = podeExcluir("vendedores");

  // ── Listener: vendedores ──
  useEffect(() => {
    if (!tenantUid) return; // guard multi-tenant

    const q = query(
      collection(db, "users", tenantUid, "vendedores"),
      orderBy("nome")
    );
    const unsub = onSnapshot(q, (snap) => {
      setVendedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantUid]);

  // ── Listener: usuários do sistema (para o select de vínculo) ──
  useEffect(() => {
    if (!tenantUid) return; // guard multi-tenant

    const unsub = onSnapshot(
      collection(db, "users", tenantUid, "usuarios"),
      (snap) => {
        setUsuariosSistema(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [tenantUid]);

  // ── Listener: vendas (para o painel expandido) ──
  useEffect(() => {
    if (!tenantUid) return; // guard multi-tenant

    const unsub = onSnapshot(
      collection(db, "users", tenantUid, "vendas"),
      (snap) => {
        setVendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [tenantUid]);

  // ── Helpers de vendas ──
  function vendasPorVendedor(vendedorId) {
    return vendas.filter((v) => v.vendedorId === vendedorId);
  }

  function totalVendedor(vendedorId) {
    return vendasPorVendedor(vendedorId).reduce(
      (acc, v) => acc + Number(v.total || 0),
      0
    );
  }

  // ── CRUD ──
  async function handleSalvar(dados) {
    const colVendedores = collection(db, "users", tenantUid, "vendedores");

    if (vendedorEditando) {
      await updateDoc(doc(colVendedores, vendedorEditando.id), {
        ...dados,
        atualizadoEm: serverTimestamp(),
      });
    } else {
      await addDoc(colVendedores, {
        ...dados,
        criadoEm: serverTimestamp(),
      });
    }
    fecharModal();
  }

  async function handleExcluir(id) {
    if (!window.confirm("Excluir este vendedor? Esta ação é irreversível.")) return;
    await deleteDoc(doc(db, "users", tenantUid, "vendedores", id));
  }

  function abrirModal(vendedor = null) {
    setVendedorEditando(vendedor);
    setModalAberto(true);
  }

  function fecharModal() {
    setVendedorEditando(null);
    setModalAberto(false);
  }

  // ── Filtro de busca ──
  const vendedoresFiltrados = vendedores.filter((v) =>
    v.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) return <p className="loading-msg">Carregando vendedores…</p>;

  return (
    <div className="pagina-container">
      <div className="pagina-header">
        <h1 className="pagina-titulo">Vendedores</h1>

        {/* Botão só aparece para quem pode criar */}
        {podeCriarVendedor && (
          <button className="btn-primario" onClick={() => abrirModal()}>
            + Novo Vendedor
          </button>
        )}
      </div>

      {/* Busca */}
      <input
        className="campo-busca"
        placeholder="Buscar vendedor…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {/* Tabela */}
      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Comissão</th>
              <th>Usuário vinculado</th>
              <th>Status</th>
              {/* Coluna Ações só se tiver pelo menos editar ou excluir */}
              {(podeEditarVendedor || podeExcluirVendedor) && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {vendedoresFiltrados.length === 0 ? (
              <tr>
                <td
                  colSpan={(podeEditarVendedor || podeExcluirVendedor) ? 7 : 6}
                  className="tabela-vazia"
                >
                  Nenhum vendedor encontrado.
                </td>
              </tr>
            ) : (
              vendedoresFiltrados.map((v) => {
                const usuarioVinculado = usuariosSistema.find(
                  (u) => u.id === v.usuarioId
                );
                return (
                  <React.Fragment key={v.id}>
                    <tr
                      className={`tabela-linha ${expandido === v.id ? "expandida" : ""}`}
                      onClick={() =>
                        setExpandido(expandido === v.id ? null : v.id)
                      }
                    >
                      <td className="negrito">{v.nome}</td>
                      <td>{v.telefone || "—"}</td>
                      <td>{v.email || "—"}</td>
                      <td>{v.comissao != null ? `${v.comissao}%` : "—"}</td>

                      {/* Usuário vinculado */}
                      <td>
                        {usuarioVinculado ? (
                          <span className="badge badge-vinculado">
                            {usuarioVinculado.nome}
                          </span>
                        ) : (
                          <span className="badge badge-sem-vinculo">
                            Sem vínculo
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`badge ${
                            v.ativo !== false ? "badge-ativo" : "badge-inativo"
                          }`}
                        >
                          {v.ativo !== false ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      {/* Ações — respeita permissões */}
                      {(podeEditarVendedor || podeExcluirVendedor) && (
                        <td className="acoes-celula">
                          {podeEditarVendedor && (
                            <button
                              className="btn-acao editar"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModal(v);
                              }}
                            >
                              Editar
                            </button>
                          )}
                          {podeExcluirVendedor && (
                            <button
                              className="btn-acao excluir"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExcluir(v.id);
                              }}
                            >
                              Excluir
                            </button>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Painel expandido — vendas do vendedor */}
                    {expandido === v.id && (
                      <tr className="linha-expandida">
                        <td
                          colSpan={
                            (podeEditarVendedor || podeExcluirVendedor) ? 7 : 6
                          }
                        >
                          <div className="painel-vendas">
                            <strong>Vendas registradas</strong>

                            {vendasPorVendedor(v.id).length === 0 ? (
                              <p className="sem-vendas">
                                Nenhuma venda vinculada a este vendedor.
                                {!v.usuarioId &&
                                  " Vincule um usuário do sistema para ativar o filtro."}
                              </p>
                            ) : (
                              <>
                                <table className="tabela-interna">
                                  <thead>
                                    <tr>
                                      <th>Nº</th>
                                      <th>Cliente</th>
                                      <th>Data</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vendasPorVendedor(v.id).map((venda) => (
                                      <tr key={venda.id}>
                                        <td>{venda.vendaId || venda.id}</td>
                                        <td>{venda.cliente || "—"}</td>
                                        <td>
                                          {venda.data
                                            ? new Date(
                                                venda.data
                                              ).toLocaleDateString("pt-BR")
                                            : "—"}
                                        </td>
                                        <td>{formatarMoeda(venda.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="total-vendedor">
                                  Total:{" "}
                                  <strong>
                                    {formatarMoeda(totalVendedor(v.id))}
                                  </strong>
                                </p>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — só abre se tiver permissão */}
      {modalAberto && (podeCriarVendedor || podeEditarVendedor) && (
        <ModalVendedor
          vendedor={vendedorEditando}
          usuariosSistema={usuariosSistema}
          onSalvar={handleSalvar}
          onFechar={fecharModal}
        />
      )}
    </div>
  );
}
