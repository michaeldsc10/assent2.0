/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Clientes.jsx
   Estrutura: users/{uid}/clientes/{id}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X, ChevronRight, Printer,
} from "lucide-react";

import { db, auth, onAuthStateChanged } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

/* ── CSS ── (Cole aqui todo o CSS original do módulo Clientes) */
const CSS = `
  /* ← Cole todo o CSS que estava no seu arquivo original aqui 
     (tudo que começa com .modal-overlay até o final do CSS) */
`;

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

const gerarIdCliente = (cnt) => `C${String(cnt + 1).padStart(4, "0")}`;

const PERIODS_HIST = ["Tudo", "Hoje", "7 dias", "30 dias", "Este mês"];

/* ── MODAIS (Cole aqui os 4 modais completos do seu arquivo original) ── */
function ModalNovoCliente({ cliente, clientes, onSave, onClose }) {
  /* Cole aqui todo o código da função ModalNovoCliente que você tinha */
  return <div>Modal Novo Cliente (ainda não colado)</div>;
}

function ModalDetalheVenda({ venda, onClose }) {
  /* Cole aqui o ModalDetalheVenda */
  return <div>Modal Detalhe Venda</div>;
}

function ModalHistorico({ cliente, vendas, onClose, onVerVenda }) {
  /* Cole aqui o ModalHistorico */
  return <div>Modal Histórico</div>;
}

function ModalConfirmDelete({ cliente, onConfirm, onClose }) {
  /* Cole aqui o ModalConfirmDelete */
  return <div>Modal Confirm Delete</div>;
}

/* ======================= COMPONENTE PRINCIPAL ======================= */
export default function Clientes() {
  const [uid, setUid] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [clienteIdCnt, setClienteIdCnt] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [deletando, setDeletando] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [vendaDetalhe, setVendaDetalhe] = useState(null);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid || null));
    return unsub;
  }, []);

  // Firestore Realtime
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const userRef = doc(db, "users", uid);
    const clientesCol = collection(db, "users", uid, "clientes");
    const vendasCol = collection(db, "users", uid, "vendas");

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setClienteIdCnt(snap.data().clienteIdCnt || 0);
      } else {
        setDoc(userRef, {
          name: "Usuário",
          email: auth.currentUser?.email || "",
          plan: "pro",
          createdAt: new Date(),
          clienteIdCnt: 0,
        });
      }
    });

    const unsubClientes = onSnapshot(clientesCol, (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar clientes:", err);
      setLoading(false);
    });

    const unsubVendas = onSnapshot(vendasCol, (snap) => {
      setVendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Erro ao carregar vendas:", err));

    return () => {
      unsubUser();
      unsubClientes();
      unsubVendas();
    };
  }, [uid]);

  const handleAdd = async (form) => {
    if (!uid) return;
    const newId = gerarIdCliente(clienteIdCnt);
    await setDoc(doc(db, "users", uid, "clientes", newId), {
      ...form,
      criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", uid), { clienteIdCnt: clienteIdCnt + 1 }, { merge: true });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    if (!uid || !editando) return;
    await setDoc(doc(db, "users", uid, "clientes", editando.id), form, { merge: true });
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!uid || !deletando) return;
    await deleteDoc(doc(db, "users", uid, "clientes", deletando.id));
    setDeletando(null);
  };

  const clientesFiltrados = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter((c) =>
      c.nome?.toLowerCase().includes(q) ||
      c.cpf?.toLowerCase().includes(q) ||
      c.telefone?.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  if (!uid) return <div className="cl-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>

      <header className="cl-topbar">
        <div className="cl-topbar-title">
          <h1>Clientes</h1>
          <p>Gerencie e acompanhe sua base de clientes</p>
        </div>

        <div className="cl-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-novo-cl" onClick={() => setModalNovo(true)}>
          <UserPlus size={14} /> Novo Cliente
        </button>
      </header>

      <div className="ag-content">
        <div className="cl-table-wrap">
          <div className="cl-table-header">
            <span className="cl-table-title">Clientes cadastrados</span>
            <span className="cl-count-badge">{clientes.length}</span>
          </div>

          <div className="cl-row cl-row-head">
            <span>ID</span>
            <span>Nome</span>
            <span>Telefone</span>
            <span>CPF / CNPJ</span>
            <span>Instagram</span>
            <span>Endereço</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="cl-loading">Carregando clientes...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="cl-empty">
              <p>
                {search ? `Nenhum resultado para "${search}".` : "Nenhum cliente cadastrado ainda."}
              </p>
            </div>
          ) : (
            clientesFiltrados.map((c) => (
              <div key={c.id} className="cl-row">
                <span className="cl-id">{c.id}</span>
                <span className="cl-nome" onClick={() => setHistorico(c)}>{c.nome}</span>
                <span>{c.telefone || "—"}</span>
                <span>{c.cpf || "—"}</span>
                <span className="cl-insta">{c.instagram ? `@${c.instagram}` : "—"}</span>
                <span className="cl-overflow">{c.endereco || "—"}</span>
                <div className="cl-actions">
                  <button
                    className="btn-icon btn-icon-edit"
                    onClick={() => setEditando(c)}
                    title="Editar cliente"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn-icon btn-icon-del"
                    onClick={() => setDeletando(c)}
                    title="Excluir cliente"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modais */}
      {modalNovo && (
        <ModalNovoCliente
          clientes={clientes}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && (
        <ModalNovoCliente
          cliente={editando}
          clientes={clientes}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
        />
      )}
      {deletando && (
        <ModalConfirmDelete
          cliente={deletando}
          onConfirm={handleDelete}
          onClose={() => setDeletando(null)}
        />
      )}
      {historico && (
        <ModalHistorico
          cliente={historico}
          vendas={vendas}
          onClose={() => setHistorico(null)}
          onVerVenda={setVendaDetalhe}
        />
      )}
      {vendaDetalhe && (
        <ModalDetalheVenda
          venda={vendaDetalhe}
          onClose={() => setVendaDetalhe(null)}
        />
      )}
    </>
  );
}
