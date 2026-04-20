// Vendas.jsx — ASSENT v2.0
// Correções aplicadas:
//   [FIX-1] Payload grava `vendedor` (nome) + `vendedorId` (id) — não só texto
//   [FIX-3] Select de vendedor travado quando cargo === "vendedor"

import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../contexts/AuthContext";
// AuthContext expõe: { user, cargo, vendedorId, vendedorNome }
// - user        → Firebase Auth user (uid, email)
// - cargo       → string: "admin" | "financeiro" | "comercial" | ... | "vendedor"
// - vendedorId  → string | null  (preenchido apenas quando cargo === "vendedor")
// - vendedorNome → string | null

// ---------------------------------------------------------------------------
// Permissões de cargo para este módulo
// ---------------------------------------------------------------------------
const PERMISSOES = {
  admin:       { ver: true, criar: true, editar: true, excluir: true },
  financeiro:  { ver: true, criar: false, editar: false, excluir: false },
  comercial:   { ver: true, criar: true, editar: true, excluir: false },
  compras:     { ver: false },
  operacional: { ver: true, criar: false, editar: false, excluir: false },
  vendedor:    { ver: true, criar: true, editar: false, excluir: false },
  suporte:     { ver: false },
};

function permissao(cargo, acao) {
  return PERMISSOES[cargo]?.[acao] ?? false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function gerarNumeroVenda(contador) {
  return String(contador).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Modal Nova Venda / Editar Venda
// ---------------------------------------------------------------------------
function ModalNovaVenda({
  venda,          // null = nova venda | objeto = edição
  clientes,
  produtos,
  servicos,
  vendedoresCadastro, // lista de vendedores do Firestore /vendedores
  cargo,          // cargo do usuário logado
  vendedorId,     // vendedorId do usuário logado (só quando cargo === "vendedor")
  vendedorNome,   // nome do vendedor logado
  onSalvar,
  onFechar,
}) {
  const isEdicao = Boolean(venda?.id);

  // [FIX-3] Se cargo === "vendedor", o select é pré-preenchido e desabilitado
  const vendedorTravado = cargo === "vendedor";

  const vendedorInicial = isEdicao
    ? { id: venda.vendedorId || "", nome: venda.vendedor || "" }
    : vendedorTravado
    ? { id: vendedorId || "", nome: vendedorNome || "" }
    : { id: "", nome: "" };

  const [clienteSelecionado, setClienteSelecionado] = useState(
    venda?.clienteId || ""
  );
  const [itens, setItens] = useState(
    venda?.itens || []
  );
  const [vendedorSelecionado, setVendedorSelecionado] = useState(vendedorInicial);
  const [status, setStatus] = useState(venda?.status || "pendente");
  const [desconto, setDesconto] = useState(venda?.desconto ?? 0);
  const [observacao, setObservacao] = useState(venda?.observacao || "");
  const [erro, setErro] = useState("");

  // Subtotal calculado
  const subtotal = useMemo(
    () => itens.reduce((acc, item) => acc + (item.total || 0), 0),
    [itens]
  );
  const totalFinal = Math.max(0, subtotal - Number(desconto || 0));

  // Selecionar vendedor via select (só para admin / comercial)
  function handleVendedorChange(e) {
    const id = e.target.value;
    const encontrado = vendedoresCadastro.find((v) => v.id === id);
    setVendedorSelecionado(
      encontrado ? { id: encontrado.id, nome: encontrado.nome } : { id: "", nome: "" }
    );
  }

  // Adicionar item (produto ou serviço)
  function adicionarItem(tipo, itemId) {
    const catalogo = tipo === "produto" ? produtos : servicos;
    const encontrado = catalogo.find((i) => i.id === itemId);
    if (!encontrado) return;
    setItens((prev) => [
      ...prev,
      {
        tipo,
        itemId: encontrado.id,
        nome: encontrado.nome,
        preco: encontrado.preco || 0,
        quantidade: 1,
        total: encontrado.preco || 0,
      },
    ]);
  }

  function atualizarQuantidade(index, qtd) {
    setItens((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantidade: qtd, total: item.preco * qtd }
          : item
      )
    );
  }

  function removerItem(index) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!clienteSelecionado) {
      setErro("Selecione um cliente.");
      return;
    }
    if (itens.length === 0) {
      setErro("Adicione pelo menos um item à venda.");
      return;
    }
    // [FIX-1] + [FIX-3]: vendedor sempre salvo com id + nome
    // Para cargo "vendedor", vendedorSelecionado já está pré-preenchido e travado.
    const clienteObj = clientes.find((c) => c.id === clienteSelecionado);

    setErro("");
    onSalvar({
      clienteId: clienteSelecionado,
      cliente: clienteObj?.nome || "",
      itens,
      subtotal,
      desconto: Number(desconto || 0),
      total: totalFinal,
      status,
      observacao: observacao.trim(),
      // [FIX-1] grava nome e id separados
      vendedor: vendedorSelecionado.nome,
      vendedorId: vendedorSelecionado.id,
    });
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div
        className="modal-box modal-grande"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-titulo">
          {isEdicao ? "Editar Venda" : "Nova Venda"}
        </h2>

        {erro && <p className="erro-msg">{erro}</p>}

        <form onSubmit={handleSubmit}>
          {/* Cliente */}
          <label className="campo-label">
            Cliente *
            <select
              value={clienteSelecionado}
              onChange={(e) => setClienteSelecionado(e.target.value)}
              className="campo-input"
              required
            >
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          {/* [FIX-3] Vendedor — travado se cargo === "vendedor" */}
          <label className="campo-label">
            Vendedor
            {vendedorTravado ? (
              <>
                <input
                  className="campo-input campo-travado"
                  value={vendedorNome || "Vendedor não vinculado"}
                  disabled
                  readOnly
                />
                {/* Campos ocultos garantem que o valor chegue ao submit */}
                <input type="hidden" value={vendedorSelecionado.id} />
                <small className="campo-hint">
                  Atribuído automaticamente ao seu cadastro de vendedor.
                </small>
              </>
            ) : (
              <select
                value={vendedorSelecionado.id}
                onChange={handleVendedorChange}
                className="campo-input"
              >
                <option value="">— Sem vendedor —</option>
                {vendedoresCadastro
                  .filter((v) => v.ativo !== false)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                      {v.comissao ? ` (${v.comissao}%)` : ""}
                    </option>
                  ))}
              </select>
            )}
          </label>

          {/* Itens da venda */}
          <fieldset className="fieldset-itens">
            <legend>Itens</legend>

            <div className="adicionar-item-row">
              <select
                className="campo-input"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [tipo, id] = e.target.value.split("::");
                  adicionarItem(tipo, id);
                  e.target.value = "";
                }}
              >
                <option value="">+ Adicionar produto ou serviço…</option>
                {produtos.length > 0 && (
                  <optgroup label="Produtos">
                    {produtos.map((p) => (
                      <option key={p.id} value={`produto::${p.id}`}>
                        {p.nome} — {formatarMoeda(p.preco)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {servicos.length > 0 && (
                  <optgroup label="Serviços">
                    {servicos.map((s) => (
                      <option key={s.id} value={`servico::${s.id}`}>
                        {s.nome} — {formatarMoeda(s.preco)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {itens.length > 0 && (
              <table className="tabela-itens">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Preço unit.</th>
                    <th>Qtd</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, index) => (
                    <tr key={index}>
                      <td>{item.nome}</td>
                      <td>{formatarMoeda(item.preco)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) =>
                            atualizarQuantidade(index, Number(e.target.value))
                          }
                          className="input-quantidade"
                        />
                      </td>
                      <td>{formatarMoeda(item.total)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-remover"
                          onClick={() => removerItem(index)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </fieldset>

          {/* Desconto */}
          <label className="campo-label">
            Desconto (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="campo-input"
            />
          </label>

          {/* Totais */}
          <div className="resumo-totais">
            <span>Subtotal: {formatarMoeda(subtotal)}</span>
            <span>Desconto: − {formatarMoeda(desconto)}</span>
            <strong>Total: {formatarMoeda(totalFinal)}</strong>
          </div>

          {/* Status */}
          <label className="campo-label">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="campo-input"
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {/* Observação */}
          <label className="campo-label">
            Observação
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="campo-input"
              rows={2}
            />
          </label>

          <div className="modal-acoes">
            <button type="button" className="btn-secundario" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario">
              {isEdicao ? "Salvar alterações" : "Registrar venda"}
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
export default function Vendas() {
  const { user, cargo, vendedorId, vendedorNome } = useContext(AuthContext);

  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [vendedoresCadastro, setVendedoresCadastro] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaEditando, setVendaEditando] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const podeVer = permissao(cargo, "ver");
  const podeCriar = permissao(cargo, "criar");
  const podeEditar = permissao(cargo, "editar");
  const podeExcluir = permissao(cargo, "excluir");

  // Caminhos Firestore
  const colVendas = collection(db, "users", user.uid, "vendas");

  // ---------------------------------------------------------------------------
  // Queries com filtro de cargo
  // [REGRA 1] Vendedor enxerga APENAS suas próprias vendas.
  // ⚠️ CRÍTICO: o filtro é aplicado no Firestore (backend), não apenas no frontend.
  //    As Security Rules do Firestore devem reforçar esta restrição.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!podeVer) return;

    let q;
    if (cargo === "vendedor") {
      if (!vendedorId) {
        // Vendedor sem vínculo: não mostra nada
        setVendas([]);
        setLoading(false);
        return;
      }
      // [REGRA 1] Filtro no Firestore por vendedorId
      q = query(
        colVendas,
        where("vendedorId", "==", vendedorId),
        orderBy("criadoEm", "desc")
      );
    } else {
      // Admin, Financeiro, Comercial, Operacional: todas as vendas
      q = query(colVendas, orderBy("criadoEm", "desc"));
    }

    const unsub = onSnapshot(q, (snap) => {
      setVendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user.uid, cargo, vendedorId]);

  // Clientes, Produtos, Serviços, Vendedores (para o modal)
  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, "users", user.uid, "clientes"), orderBy("nome")),
        (s) => setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, "users", user.uid, "produtos"), orderBy("nome")),
        (s) => setProdutos(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, "users", user.uid, "servicos"), orderBy("nome")),
        (s) => setServicos(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(
          collection(db, "users", user.uid, "vendedores"),
          orderBy("nome")
        ),
        (s) =>
          setVendedoresCadastro(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user.uid]);

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------
  async function handleSalvar(dados) {
    if (vendaEditando) {
      await updateDoc(doc(colVendas, vendaEditando.id), {
        ...dados,
        atualizadoEm: serverTimestamp(),
      });
    } else {
      // Gera número sequencial de venda com transaction
      const docEmpresa = doc(db, "users", user.uid);
      let novoId;
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docEmpresa);
        const atual = snap.data()?.vendaIdCnt || 0;
        novoId = atual + 1;
        transaction.update(docEmpresa, { vendaIdCnt: novoId });
      });

      await addDoc(colVendas, {
        ...dados,
        vendaId: gerarNumeroVenda(novoId),
        criadoEm: serverTimestamp(),
        criadoPor: user.uid,
      });
    }
    fecharModal();
  }

  async function handleExcluir(id) {
    if (!podeExcluir) return;
    if (!window.confirm("Excluir esta venda?")) return;
    await deleteDoc(doc(colVendas, id));
  }

  function abrirModal(venda = null) {
    if (venda && !podeEditar) return;
    if (!venda && !podeCriar) return;
    setVendaEditando(venda);
    setModalAberto(true);
  }

  function fecharModal() {
    setVendaEditando(null);
    setModalAberto(false);
  }

  // Filtros locais (após query já filtrada no Firestore)
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const matchBusca =
        !busca ||
        v.cliente?.toLowerCase().includes(busca.toLowerCase()) ||
        v.vendaId?.includes(busca) ||
        v.vendedor?.toLowerCase().includes(busca.toLowerCase());
      const matchStatus =
        filtroStatus === "todos" || v.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [vendas, busca, filtroStatus]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!podeVer) {
    return (
      <div className="acesso-negado">
        <span className="icone-cadeado">🔒</span>
        <p>Seu cargo não tem acesso ao módulo de Vendas.</p>
      </div>
    );
  }

  if (loading) return <p className="loading-msg">Carregando vendas…</p>;

  return (
    <div className="pagina-container">
      <div className="pagina-header">
        <h1 className="pagina-titulo">Vendas</h1>
        {podeCriar && (
          <button className="btn-primario" onClick={() => abrirModal()}>
            + Nova Venda
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="filtros-row">
        <input
          className="campo-busca"
          placeholder="Buscar por cliente, nº ou vendedor…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="campo-input filtro-status"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Aviso para vendedor sem vínculo */}
      {cargo === "vendedor" && !vendedorId && (
        <div className="alerta-aviso">
          ⚠️ Seu usuário ainda não está vinculado a um cadastro de vendedor.
          Solicite ao administrador que faça o vínculo em Vendedores.
        </div>
      )}

      {/* Tabela */}
      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
              {(podeEditar || podeExcluir) && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {vendasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="tabela-vazia">
                  Nenhuma venda encontrada.
                </td>
              </tr>
            ) : (
              vendasFiltradas.map((v) => (
                <tr key={v.id} className="tabela-linha">
                  <td className="negrito">#{v.vendaId || "—"}</td>
                  <td>{v.cliente || "—"}</td>
                  {/* [FIX-1] exibe nome do vendedor (campo texto para display) */}
                  <td>{v.vendedor || "—"}</td>
                  <td>{formatarMoeda(v.total)}</td>
                  <td>
                    <span className={`badge badge-status-${v.status}`}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                  </td>
                  <td>
                    {v.criadoEm?.toDate
                      ? v.criadoEm.toDate().toLocaleDateString("pt-BR")
                      : v.data
                      ? new Date(v.data).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  {(podeEditar || podeExcluir) && (
                    <td className="acoes-celula">
                      {podeEditar && (
                        <button
                          className="btn-acao editar"
                          onClick={() => abrirModal(v)}
                        >
                          Editar
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="btn-acao excluir"
                          onClick={() => handleExcluir(v.id)}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAberto && (
        <ModalNovaVenda
          venda={vendaEditando}
          clientes={clientes}
          produtos={produtos}
          servicos={servicos}
          vendedoresCadastro={vendedoresCadastro}
          cargo={cargo}
          vendedorId={vendedorId}
          vendedorNome={vendedorNome}
          onSalvar={handleSalvar}
          onFechar={fecharModal}
        />
      )}
    </div>
  );
}
