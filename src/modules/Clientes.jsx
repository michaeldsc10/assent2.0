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

/* ── Cole aqui TODO o CSS que você tinha no arquivo original ── */
const CSS = `
  /* TODO: Cole todo o CSS longo aqui (modal-overlay, form-group, cl-topbar, cl-row, etc.) */
  /* Se não colar o CSS, os estilos não vão aparecer, mas pelo menos o conteúdo deve carregar */
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

/* ── Cole aqui os 4 modais completos (ModalNovoCliente, ModalDetalheVenda, ModalHistorico, ModalConfirmDelete) ── */
// Eles devem ficar exatamente como estavam no seu arquivo original antes das mudanças.
// Se precisar, posso te ajudar a ajustar eles também.

function ModalNovoCliente({ cliente, clientes, onSave, onClose }) { /* seu código original */ }
function ModalDetalheVenda({ venda, onClose }) { /* seu código original */ }
function ModalHistorico({ cliente, vendas, onClose, onVerVenda }) { /* seu código original */ }
function ModalConfirmDelete({ cliente, onConfirm, onClose }) { /* seu código original */ }

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

  // Auth
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
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Erro clientes:", err);
      setLoading(false);
    });

    const unsubVendas = onSnapshot(vendasCol, (snap) => {
      setVendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Erro vendas:", err));

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
    return clientes.filter(c =>
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
              <p>{search ? `Nenhum resultado para "${search}".` : "Nenhum cliente cadastrado ainda."}</p>
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
                  <button className="btn-icon btn-icon-edit" onClick={() => setEditando(c)}>
                    <Edit2 size={13} />
                 
