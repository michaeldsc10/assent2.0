/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Alunos.jsx (Módulo de Matrículas)
   ─────────────────────────────────────────────────
   Estrutura Firestore (pós-unificação):
     users/{uid}/clientes/{docId}          → cada aluno (perfis: ["aluno"])
                                             docId = aluno_{ts}_{rand}
                                             idSeq = sequencial visual A0001…
                                             foto  = base64 direto no documento

     users/{uid}/a_receber/{autoId}        → mensalidades em aberto
                                             origem: "mensalidade"
                                             idSeqMens = M0001…
                                             clienteId, mesReferencia

     users/{uid}/vendas/{autoId}           → mensalidades pagas (venda sintética)
                                             categoria: "Mensalidade"
                                             tipoVenda: "mensalidade"

     users/{uid}/config/matriculas         → template mensagem WhatsApp
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useContext, useMemo, useRef } from "react";
import {
  Search, Plus, Edit2, Trash2, X, Users,
  MessageCircle, Calendar, CreditCard, Settings,
  ChevronLeft, CheckCircle, AlertCircle, Clock,
  Phone, Mail, MapPin, User, FileText, DollarSign, Camera, AtSign,
} from "lucide-react";

import AuthContext from "../contexts/AuthContext";
import { logAction, LOG_ACAO } from "../lib/logAction";
import { db } from "../lib/firebase";
import { fsError, fsSnapshotError } from "../utils/firestoreError";

import {
  collection, doc, setDoc, deleteDoc, updateDoc,
  onSnapshot, getDoc, addDoc, getDocs,
  query, where,
} from "firebase/firestore";

/* ══════════════════════════════════════════════════
   PERMISSÕES (segue padrão Vendas/AReceber)
   ══════════════════════════════════════════════════ */
const PERMISSOES_MATRICULAS = {
  admin:       { ver: true,  criar: true,  editar: true,  excluir: true  },
  financeiro:  { ver: true,  criar: false, editar: false, excluir: false },
  comercial:   { ver: true,  criar: true,  editar: true,  excluir: false },
  operacional: { ver: false, criar: false, editar: false, excluir: false },
  vendedor:    { ver: true,  criar: true,  editar: true,  excluir: false },
  compras:     { ver: false, criar: false, editar: false, excluir: false },
  suporte:     { ver: true,  criar: false, editar: true,  excluir: false },
};
const permMat = (cargo, acao) => PERMISSOES_MATRICULAS[cargo]?.[acao] ?? false;

const MSG_WHATSAPP_DEFAULT =
  "Olá [nome], tudo bem? Passando para lembrar da sua mensalidade de [mes] no valor de [valor]. " +
  "Qualquer dúvida estou à disposição. 💙";

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/* ══════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════ */
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtData = (iso) => {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso + (iso.length === 10 ? "T12:00:00" : "")) : new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch { return "—"; }
};

const fmtTelefone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const fmtCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const fmtValorInput = (v) => {
  const d = onlyDigits(v);
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseValorInput = (v) => {
  const d = onlyDigits(v);
  return d ? Number(d) / 100 : 0;
};

/* Gerador de docId único para alunos na coleção /clientes */
const gerarDocIdAluno = () =>
  `aluno_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/* Próximo idSeq visual — puramente display */
const proximoIdSeq = (alunos) => {
  const max = alunos.reduce((m, a) => Math.max(m, Number(a.idSeq || 0)), 0);
  return max + 1;
};
const fmtIdSeq     = (n) => `A${String(n).padStart(4, "0")}`;
const fmtIdSeqMens = (n) => `M${String(n).padStart(4, "0")}`;

/* YYYY-MM do mês/ano */
const toMesRef = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;

/* Calcula data de vencimento (YYYY-MM-DD) para um dia X, ano e mês dados. */
const calcVencimento = (ano, mes /*1-12*/, dia) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/* Dado um aluno e a data atual, retorna próximo mês (ano, mes) ainda não gerado. */
const proximoMesParaGerar = (aluno, mensalidadesDoAluno) => {
  if (!mensalidadesDoAluno.length) {
    const base = aluno.dataInicio
      ? new Date(aluno.dataInicio + "T12:00:00")
      : new Date();
    return { ano: base.getFullYear(), mes: base.getMonth() + 1 };
  }
  const ordenadas = [...mensalidadesDoAluno].sort((a, b) =>
    (a.mesReferencia || "").localeCompare(b.mesReferencia || "")
  );
  const ultima = ordenadas[ordenadas.length - 1];
  const [anoStr, mesStr] = (ultima.mesReferencia || "").split("-");
  let ano = Number(anoStr) || new Date().getFullYear();
  let mes = Number(mesStr) || new Date().getMonth() + 1;
  mes += 1;
  if (mes > 12) { mes = 1; ano += 1; }
  return { ano, mes };
};

/* Status visual da mensalidade */
const statusMensalidade = (mens) => {
  const restante = Number(mens.valorRestante ?? 0);
  if (restante <= 0) return "paga";
  const hoje = new Date().toISOString().slice(0, 10);
  const venc = mens.dataVencimento || "";
  if (venc && venc < hoje) return "vencida";
  try {
    const dVenc = new Date(venc + "T12:00:00");
    const dHoje = new Date(hoje + "T12:00:00");
    const diffDias = Math.round((dVenc - dHoje) / 86400000);
    if (diffDias <= 3) return "vencendo";
  } catch {}
  return "pendente";
};

const primeiroNome = (s) => String(s || "").trim().split(/\s+/)[0] || "";

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */
const CSS = `
.modal-overlay { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.78);
  backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center;
  padding:20px; animation:fadeIn .15s ease; }
.modal-overlay-top { z-index:1100; }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.modal-box { background:var(--s1); border:1px solid var(--border-h); border-radius:16px;
  width:100%; max-width:520px; max-height:92vh; overflow-y:auto;
  box-shadow:0 28px 72px rgba(0,0,0,.65); animation:slideUp .18s ease; }
.modal-box-xl { max-width:820px; }
.modal-box-lg { max-width:680px; }
.modal-box-md { max-width:420px; }
.modal-box::-webkit-scrollbar { width:3px; }
.modal-box::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }
.modal-header { padding:20px 22px 16px; border-bottom:1px solid var(--border);
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
  position:sticky; top:0; background:var(--s1); z-index:2; }
.modal-title { font-family:'Sora',sans-serif; font-size:16px; font-weight:600; color:var(--text); }
.modal-sub { font-size:12px; color:var(--text-2); margin-top:3px; }
.modal-close { width:30px; height:30px; border-radius:8px; flex-shrink:0;
  background:var(--s3); border:1px solid var(--border);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  margin-top:2px; transition:background .13s; }
.modal-close:hover { background:var(--s2); border-color:var(--border-h); }
.modal-body { padding:20px 22px; }
.modal-footer { padding:14px 22px; border-top:1px solid var(--border);
  display:flex; justify-content:flex-end; gap:10px;
  position:sticky; bottom:0; background:var(--s1); z-index:2; }

.btn-primary { padding:9px 20px; border-radius:9px; background:var(--gold); color:#0a0808;
  border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
  transition:opacity .13s, transform .1s; display:flex; align-items:center; gap:6px; }
.btn-primary:hover { opacity:.88; }
.btn-primary:active { transform:scale(.97); }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { padding:9px 20px; border-radius:9px; background:var(--s3); color:var(--text-2);
  border:1px solid var(--border); cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px;
  transition:background .13s, color .13s; display:flex; align-items:center; gap:6px; }
.btn-secondary:hover { background:var(--s2); color:var(--text); }
.btn-danger { padding:9px 20px; border-radius:9px; background:var(--red-d); color:var(--red);
  border:1px solid rgba(224,82,82,.25); cursor:pointer;
  font-family:'DM Sans',sans-serif; font-size:13px; transition:background .13s;
  display:flex; align-items:center; gap:6px; }
.btn-danger:hover { background:rgba(224,82,82,.18); }
.btn-green { padding:9px 20px; border-radius:9px;
  background:rgba(74,222,128,.12); color:var(--green);
  border:1px solid rgba(74,222,128,.2); cursor:pointer;
  font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
  transition:background .13s; display:flex; align-items:center; gap:6px; }
.btn-green:hover { background:rgba(74,222,128,.2); }
.btn-icon { width:30px; height:30px; border-radius:7px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; border:1px solid transparent;
  background:transparent; transition:all .13s; }
.btn-icon-edit { color:var(--blue); }
.btn-icon-edit:hover { background:var(--blue-d); border-color:rgba(91,142,240,.2); }
.btn-icon-del { color:var(--red); }
.btn-icon-del:hover { background:var(--red-d); border-color:rgba(224,82,82,.2); }
.btn-icon-wpp { color:#25D366; }
.btn-icon-wpp:hover { background:rgba(37,211,102,.12); border-color:rgba(37,211,102,.25); }
.btn-icon-view { color:var(--text-2); }
.btn-icon-view:hover { background:var(--s3); border-color:var(--border-h); }

.form-group { margin-bottom:16px; }
.form-label { display:block; font-size:10px; font-weight:600;
  letter-spacing:.07em; text-transform:uppercase;
  color:var(--text-2); margin-bottom:7px; }
.form-label-req { color:var(--gold); margin-left:2px; }
.form-input, .form-textarea { width:100%; background:var(--s2);
  border:1px solid var(--border); border-radius:9px;
  padding:10px 13px; color:var(--text); font-size:13px;
  font-family:'DM Sans',sans-serif; outline:none;
  transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
.form-textarea { resize:vertical; min-height:80px; font-family:'DM Sans',sans-serif; }
.form-input:focus, .form-textarea:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(200,165,94,.1); }
.form-input.err { border-color:var(--red); }
.form-error { font-size:11px; color:var(--red); margin-top:5px; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.form-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }

.mat-root { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden;
  flex:1 1 auto; }
.mat-topbar { padding:14px 22px; background:var(--s1); border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; gap:14px; flex-shrink:0;
  flex-wrap:wrap; }
.mat-topbar h1 { font-family:'Sora',sans-serif; font-size:17px; font-weight:600; color:var(--text); }
.mat-topbar p { font-size:11px; color:var(--text-2); margin-top:2px; }
.mat-actions { display:flex; gap:8px; flex-shrink:0; }

.mat-content { flex:1 1 0; min-height:0; overflow-y:auto; overflow-x:hidden;
  -webkit-overflow-scrolling:touch; padding:22px;
  display:flex; flex-direction:column; gap:20px; }
.mat-content::-webkit-scrollbar { width:3px; }
.mat-content::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }

.mat-cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; }
.mat-card { background:var(--s1); border:1px solid var(--border); border-radius:12px;
  padding:16px 18px; display:flex; flex-direction:column; gap:6px; }
.mat-card-label { font-size:11px; color:var(--text-2); font-weight:500; }
.mat-card-value { font-family:'Sora',sans-serif; font-size:22px; font-weight:600; color:var(--text); }
.mat-card-value.split { display:flex; align-items:baseline; gap:6px; }
.mat-card-value .warn { color:#F5A623; }
.mat-card-value .danger { color:var(--red); }
.mat-card-value .ok { color:var(--green); }
.mat-card-value .sep { color:var(--text-3); font-size:16px; font-weight:400; }

.mat-filters { display:flex; gap:10px; align-items:center; }
.mat-search { flex:1; position:relative; }
.mat-search svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-3); }
.mat-search input { width:100%; padding:10px 12px 10px 36px;
  background:var(--s2); border:1px solid var(--border); border-radius:9px;
  color:var(--text); font-size:13px; font-family:'DM Sans',sans-serif;
  outline:none; transition:border-color .15s; box-sizing:border-box; }
.mat-search input:focus { border-color:var(--gold); }
.mat-filter-select { padding:10px 12px; background:var(--s2);
  border:1px solid var(--border); border-radius:9px;
  color:var(--text); font-size:13px; font-family:'DM Sans',sans-serif; outline:none;
  min-width:170px; cursor:pointer; }

.mat-table-wrap { background:var(--s1); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.mat-table-header { padding:14px 18px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; gap:12px; }
.mat-table-title { font-family:'Sora',sans-serif; font-size:14px; font-weight:600;
  color:var(--text); display:flex; align-items:center; gap:8px; }
.mat-table-badge { font-size:10px; background:var(--s3); color:var(--text-3);
  padding:2px 8px; border-radius:20px; font-weight:600; }
.mat-row, .mat-row-head { display:grid;
  grid-template-columns: 72px 1.3fr 110px 110px 110px 110px 120px;
  gap:10px; padding:12px 18px; border-bottom:1px solid var(--border); align-items:center; }
.mat-row-head { font-size:10px; font-weight:600; letter-spacing:.07em;
  text-transform:uppercase; color:var(--text-3); background:var(--s2); }
.mat-row { font-size:13px; cursor:pointer; transition:background .13s; }
.mat-row:hover { background:var(--s2); }
.mat-row:last-child { border-bottom:none; }
.mat-id { font-family:'JetBrains Mono','Courier New',monospace; color:var(--text-3); font-size:12px; }
.mat-aluno-nome { color:var(--text); font-weight:500; }
.mat-aluno-sub { color:var(--text-3); font-size:11px; }
.mat-valor { font-family:'JetBrains Mono','Courier New',monospace; color:var(--text); }
.mat-actions-cell { display:flex; justify-content:flex-end; gap:4px; }

.mat-pill { display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600; white-space:nowrap; }
.mat-pill.ok { background:rgba(74,222,128,.12); color:var(--green); border:1px solid rgba(74,222,128,.2); }
.mat-pill.warn { background:rgba(245,166,35,.12); color:#F5A623; border:1px solid rgba(245,166,35,.25); }
.mat-pill.danger { background:rgba(224,82,82,.12); color:var(--red); border:1px solid rgba(224,82,82,.25); }
.mat-pill.neutral { background:var(--s3); color:var(--text-3); border:1px solid var(--border); }

.aluno-avatar { width:36px; height:36px; border-radius:50%; object-fit:cover;
  border:1.5px solid var(--border-h); flex-shrink:0; }
.aluno-avatar-placeholder { width:36px; height:36px; border-radius:50%;
  background:var(--s3); border:1.5px solid var(--border);
  display:flex; align-items:center; justify-content:center;
  font-family:'Sora',sans-serif; font-size:13px; font-weight:600;
  color:var(--text-2); flex-shrink:0; }
.foto-picker-wrap { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.foto-picker-circle { width:80px; height:80px; border-radius:50%; position:relative;
  cursor:pointer; flex-shrink:0; overflow:hidden;
  border:2px dashed var(--border); background:var(--s2);
  display:flex; align-items:center; justify-content:center;
  transition:border-color .15s; }
.foto-picker-circle:hover { border-color:var(--gold); }
.foto-picker-circle img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.foto-picker-overlay { position:absolute; inset:0; border-radius:50%;
  background:rgba(0,0,0,.55); display:flex; align-items:center;
  justify-content:center; opacity:0; transition:opacity .15s; }
.foto-picker-circle:hover .foto-picker-overlay { opacity:1; }
.foto-picker-info { font-size:12px; color:var(--text-2); line-height:1.6; }
.foto-picker-info strong { color:var(--text); display:block; margin-bottom:2px; }

.foto-lightbox { position:fixed; inset:0; z-index:1300; background:rgba(0,0,0,.92);
  backdrop-filter:blur(8px); display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:20px; animation:fadeIn .15s ease; }
.foto-lightbox-img { max-width:min(480px,90vw); max-height:60vh; border-radius:50%;
  object-fit:cover; border:3px solid var(--gold);
  box-shadow:0 0 80px rgba(212,175,55,.25); }
.foto-lightbox-actions { display:flex; gap:10px; }

.crop-overlay { position:fixed; inset:0; z-index:1200; background:rgba(0,0,0,.88);
  backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; }
.crop-box { background:var(--s1); border:1px solid var(--border-h); border-radius:18px;
  width:360px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:18px;
  box-shadow:0 28px 72px rgba(0,0,0,.7); }
.crop-title { font-family:'Sora',sans-serif; font-size:15px; font-weight:600; color:var(--text); }
.crop-stage { width:260px; height:260px; border-radius:50%; overflow:hidden;
  position:relative; cursor:grab; border:3px solid var(--gold);
  background:#111; user-select:none; }
.crop-stage:active { cursor:grabbing; }
.crop-stage img { position:absolute; transform-origin:center center; pointer-events:none; }
.crop-hint { font-size:11px; color:var(--text-3); text-align:center; line-height:1.6; }
.crop-zoom { display:flex; align-items:center; gap:10px; width:100%; }
.crop-zoom input[type=range] { flex:1; accent-color:var(--gold); }
.crop-zoom span { font-size:11px; color:var(--text-3); min-width:36px; text-align:center; }
.crop-footer { display:flex; gap:10px; width:100%; }
.crop-footer .btn-primary { flex:1; justify-content:center; }
.crop-footer .btn-secondary { justify-content:center; }

.mat-empty { padding:42px 18px; text-align:center; color:var(--text-3); font-size:13px; }
.mat-empty svg { margin-bottom:8px; }

.mat-quick-filters { display:flex; gap:7px; flex-wrap:wrap; margin-top:10px; }
.mat-qbtn { display:inline-flex; align-items:center; gap:5px; padding:5px 13px;
  border-radius:20px; font-size:12px; font-weight:600; cursor:pointer;
  border:1px solid var(--border); background:var(--s3); color:var(--text-2);
  transition:all .13s; white-space:nowrap; }
.mat-qbtn:hover { background:var(--s2); color:var(--text); border-color:var(--border-h); }
.mat-qbtn.active-warn { background:rgba(245,166,35,.13); color:#F5A623; border-color:rgba(245,166,35,.35); }
.mat-qbtn.active-danger { background:rgba(224,82,82,.13); color:var(--red); border-color:rgba(224,82,82,.35); }
.mat-qbtn.active-neutral { background:var(--s2); color:var(--text); border-color:var(--border-h); }

.mat-col-sort { cursor:pointer; user-select:none; display:inline-flex; align-items:center; gap:4px; }
.mat-col-sort:hover { color:var(--text-2); }
.mat-sort-icon { font-size:10px; color:var(--gold); }

.mat-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
.mat-detail-item { background:var(--s2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; }
.mat-detail-label { font-size:10px; font-weight:600; letter-spacing:.07em;
  text-transform:uppercase; color:var(--text-3); margin-bottom:4px; }
.mat-detail-value { font-size:13px; color:var(--text); word-break:break-word; }
.mat-section-title { font-family:'Sora',sans-serif; font-size:13px; font-weight:600;
  color:var(--text); margin:4px 0 12px; display:flex; align-items:center; gap:7px; }

.mat-mens-list { display:flex; flex-direction:column; border:1px solid var(--border);
  border-radius:10px; overflow:hidden; }
.mat-mens-row { display:grid; grid-template-columns: 1fr 110px 110px 100px 60px;
  gap:10px; padding:10px 14px; border-bottom:1px solid var(--border);
  align-items:center; font-size:12px; }
.mat-mens-row:last-child { border-bottom:none; }
.mat-mens-row.head { background:var(--s2); color:var(--text-3);
  font-size:10px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; }
.mat-mens-mes { color:var(--text); font-weight:500; }
.mat-mens-valor { font-family:'JetBrains Mono',monospace; color:var(--text); }

/* Pill de turma no detalhe do aluno */
.turma-pill { display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600;
  background:rgba(91,142,240,.12); color:var(--blue);
  border:1px solid rgba(91,142,240,.2); white-space:nowrap; }

@media (max-width: 900px) {
  .form-row, .form-row-3 { grid-template-columns: 1fr; }
  .mat-row, .mat-row-head { grid-template-columns: 60px 1fr 100px 100px; }
  .mat-row > span:nth-child(5), .mat-row > span:nth-child(6),
  .mat-row-head > span:nth-child(5), .mat-row-head > span:nth-child(6) { display:none; }
  .mat-detail-grid { grid-template-columns: 1fr; }
  .mat-mens-row { grid-template-columns: 1fr 90px 70px; }
  .mat-mens-row > *:nth-child(4), .mat-mens-row > *:nth-child(5) { display:none; }
}

@media (max-width: 640px) {
  /* Scroll e padding bottom para bottom nav */
  .mat-content { padding:14px; gap:12px; padding-bottom:80px; }

  /* Topbar compacto */
  .mat-topbar { padding:12px 14px; gap:10px; }
  .mat-topbar h1 { font-size:15px; }
  .mat-topbar > div:first-child { flex:1; min-width:0; }
  .mat-actions { flex-shrink:0; }
  .mat-actions .btn-secondary { padding:7px 10px; font-size:12px; }
  .mat-actions .btn-primary   { padding:7px 12px; font-size:12px; }

  /* KPI cards: 1 coluna, compacto */
  .mat-cards { grid-template-columns:1fr; gap:8px; }
  .mat-card  { padding:12px 14px; flex-direction:row; align-items:center; justify-content:space-between; }
  .mat-card-value { font-size:18px; }

  /* Filtros: search em cima, select embaixo */
  .mat-filters { flex-direction:column; align-items:stretch; gap:8px; }
  .mat-filter-select { width:100%; min-width:unset; }
  .mat-search input { font-size:13px; }

  /* Quick filters menores */
  .mat-quick-filters { gap:5px; margin-top:8px; }
  .mat-qbtn { padding:4px 10px; font-size:11px; }

  /* Tabela mobile: só ID, nome, status, ações */
  .mat-row, .mat-row-head {
    grid-template-columns: 52px 1fr 80px 72px;
    padding:10px 12px; gap:6px;
  }
  .mat-row > span:nth-child(3),
  .mat-row > span:nth-child(4),
  .mat-row > span:nth-child(5),
  .mat-row > span:nth-child(6),
  .mat-row-head > span:nth-child(3),
  .mat-row-head > span:nth-child(4),
  .mat-row-head > span:nth-child(5),
  .mat-row-head > span:nth-child(6) { display:none; }

  .mat-id { font-size:11px; }
  .mat-aluno-nome { font-size:13px; }
  .mat-aluno-sub  { font-size:10px; }
  .aluno-avatar, .aluno-avatar-placeholder { width:28px; height:28px; font-size:11px; }

  /* Header da tabela */
  .mat-table-header { padding:11px 12px; }
  .mat-table-title  { font-size:13px; }

  /* Pad interno do filtro */
  .mat-table-wrap > div[style] { padding:12px !important; }
}
`;

/* ══════════════════════════════════════════════════
   MODAL: Nova / Editar Matrícula
   ══════════════════════════════════════════════════ */
function ModalMatricula({ aluno, alunosExistentes, onSave, onClose, turmas = [] }) {
  const isEdit = !!aluno;

  const [form, setForm] = useState({
    nome:                aluno?.nome                || "",
    documento:           aluno?.documento           || "",
    telefone:            aluno?.telefone            || "",
    email:               aluno?.email               || "",
    instagram:           aluno?.instagram           || "",
    dataNascimento:      aluno?.dataNascimento      || "",
    endereco:            aluno?.endereco            || "",
    responsavel:         aluno?.responsavel         || "",
    telefoneResponsavel: aluno?.telefoneResponsavel || "",
    valorMensalidade: aluno
      ? Number(aluno.valorMensalidade || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
    diaVencimento: aluno?.diaVencimento || "10",
    dataInicio:    aluno?.dataInicio    || new Date().toISOString().slice(0, 10),
    status:        aluno?.status        || "ativo",
    turma:         aluno?.turma         || "",
    observacoes:   aluno?.observacoes   || "",
  });
  const [erros, setErros] = useState({});

  /* ── Foto (base64) ── */
  const [fotoBase64, setFotoBase64] = useState(aluno?.foto || null);
  const [cropSrc, setCropSrc]       = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Selecione uma imagem válida."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Imagem muito grande. Máximo 10 MB."); return; }
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleCropConfirm = (base64) => {
    setFotoBase64(base64);
    setCropSrc(null);
  };

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(er => ({ ...er, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim() || form.nome.trim().length < 3)
      e.nome = "Nome completo é obrigatório (mínimo 3 caracteres).";
    const docDigits = onlyDigits(form.documento);
    if (!docDigits || docDigits.length < 5)
      e.documento = "Documento (CPF/RG) é obrigatório.";
    const telDigits = onlyDigits(form.telefone);
    if (!telDigits || telDigits.length < 10)
      e.telefone = "Telefone válido é obrigatório (com DDD).";
    const valor = parseValorInput(form.valorMensalidade);
    if (!valor || valor <= 0)
      e.valorMensalidade = "Valor deve ser maior que zero.";
    const dia = Number(form.diaVencimento);
    if (!dia || dia < 1 || dia > 28)
      e.diaVencimento = "Dia de vencimento deve ser entre 1 e 28.";
    if (!form.dataInicio)
      e.dataInicio = "Data de início é obrigatória.";

    /* Documento duplicado (exceto o próprio aluno em edição) */
    const duplicado = alunosExistentes.find(a =>
      a.docId !== aluno?.docId &&
      onlyDigits(a.documento) === docDigits
    );
    if (duplicado) e.documento = `Documento já cadastrado para ${duplicado.nome}.`;

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validar()) return;
    onSave({
      nome:                form.nome.trim(),
      documento:           form.documento.trim(),
      telefone:            form.telefone.trim(),
      email:               form.email.trim(),
      instagram:           form.instagram.trim().replace(/^@/, ""),
      dataNascimento:      form.dataNascimento,
      endereco:            form.endereco.trim(),
      responsavel:         form.responsavel.trim(),
      telefoneResponsavel: form.telefoneResponsavel.trim(),
      valorMensalidade:    parseValorInput(form.valorMensalidade),
      diaVencimento:       Number(form.diaVencimento),
      dataInicio:          form.dataInicio,
      status:              form.status,
      turma:               form.turma.trim(),
      observacoes:         form.observacoes.trim(),
      _fotoFile:           fotoBase64,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-xl">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar matrícula" : "Nova matrícula"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${aluno.nome}` : "Preencha os dados do aluno"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* — Foto — */}
          <div className="foto-picker-wrap">
            <div
              className="foto-picker-circle"
              onClick={() => fotoBase64 ? setViewerOpen(true) : fileInputRef.current?.click()}
              title={fotoBase64 ? "Ver foto" : "Adicionar foto"}
            >
              {fotoBase64
                ? <img src={fotoBase64} alt="Foto do aluno" />
                : <Camera size={24} color="var(--text-3)" />}
              <div className="foto-picker-overlay">
                {fotoBase64
                  ? <Search size={16} color="#fff" />
                  : <Camera size={18} color="#fff" />}
              </div>
            </div>
            <div className="foto-picker-info">
              <strong>Foto do aluno</strong>
              {fotoBase64
                ? <>Clique na foto para visualizar.<br />Altere ou remova pelo visualizador.</>
                : <>Clique para selecionar uma imagem.<br />Arraste para posicionar · máx. 10 MB</>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*"
              style={{ display: "none" }} onChange={handleFotoChange} />
          </div>

          {viewerOpen && fotoBase64 && (
            <FotoLightbox
              src={fotoBase64}
              onAlterar={() => { setViewerOpen(false); fileInputRef.current?.click(); }}
              onRemover={() => { setFotoBase64(null); setViewerOpen(false); }}
              onClose={() => setViewerOpen(false)}
            />
          )}

          {cropSrc && (
            <ModalCropFoto
              src={cropSrc}
              onConfirm={handleCropConfirm}
              onClose={() => setCropSrc(null)}
            />
          )}

          {/* — Dados pessoais — */}
          <div className="mat-section-title"><User size={14} /> Dados pessoais</div>

          <div className="form-group">
            <label className="form-label">Nome completo<span className="form-label-req">*</span></label>
            <input type="text" className={`form-input ${erros.nome ? "err" : ""}`}
              value={form.nome} onChange={(e) => set("nome", e.target.value)}
              placeholder="Nome completo do aluno" autoFocus />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Documento (CPF/RG)<span className="form-label-req">*</span></label>
              <input type="text" className={`form-input ${erros.documento ? "err" : ""}`}
                value={form.documento}
                onChange={(e) => set("documento", fmtCPF(e.target.value))}
                placeholder="000.000.000-00" maxLength={14} />
              {erros.documento && <div className="form-error">{erros.documento}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Data de nascimento</label>
              <input type="date" className="form-input"
                value={form.dataNascimento}
                onChange={(e) => set("dataNascimento", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefone<span className="form-label-req">*</span></label>
              <input type="text" className={`form-input ${erros.telefone ? "err" : ""}`}
                value={form.telefone}
                onChange={(e) => set("telefone", fmtTelefone(e.target.value))}
                placeholder="(62) 99999-9999" maxLength={15} />
              {erros.telefone && <div className="form-error">{erros.telefone}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input"
                value={form.email} onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
          </div>

          {/* Instagram — campo opcional */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><AtSign size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Instagram</label>
              <input type="text" className="form-input"
                value={form.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="@usuario (opcional)" />
            </div>
            <div className="form-group">
              <label className="form-label">Endereço</label>
              <input type="text" className="form-input"
                value={form.endereco} onChange={(e) => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro, cidade" />
            </div>
          </div>

          {/* — Responsável — */}
          <div className="mat-section-title" style={{ marginTop: 8 }}>
            <User size={14} /> Responsável (opcional, caso menor de idade)
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome do responsável</label>
              <input type="text" className="form-input"
                value={form.responsavel}
                onChange={(e) => set("responsavel", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone do responsável</label>
              <input type="text" className="form-input"
                value={form.telefoneResponsavel}
                onChange={(e) => set("telefoneResponsavel", fmtTelefone(e.target.value))}
                placeholder="(62) 99999-9999" maxLength={15} />
            </div>
          </div>

          {/* — Mensalidade — */}
          <div className="mat-section-title" style={{ marginTop: 8 }}>
            <CreditCard size={14} /> Dados da mensalidade
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Valor (R$)<span className="form-label-req">*</span></label>
              <input type="text" className={`form-input ${erros.valorMensalidade ? "err" : ""}`}
                value={form.valorMensalidade}
                onChange={(e) => set("valorMensalidade", fmtValorInput(e.target.value))}
                placeholder="0,00" />
              {erros.valorMensalidade && <div className="form-error">{erros.valorMensalidade}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Dia vencimento<span className="form-label-req">*</span></label>
              <input type="number" min={1} max={28}
                className={`form-input ${erros.diaVencimento ? "err" : ""}`}
                value={form.diaVencimento}
                onChange={(e) => set("diaVencimento", e.target.value)} />
              {erros.diaVencimento && <div className="form-error">{erros.diaVencimento}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Início<span className="form-label-req">*</span></label>
              <input type="date" className={`form-input ${erros.dataInicio ? "err" : ""}`}
                value={form.dataInicio}
                onChange={(e) => set("dataInicio", e.target.value)} />
              {erros.dataInicio && <div className="form-error">{erros.dataInicio}</div>}
            </div>
          </div>

          {isEdit && (
            <div className="form-group">
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.status}
                onChange={(e) => set("status", e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="trancado">Trancado</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Turma / Horário</label>
            {turmas.length > 0 ? (() => {
              /* Se o aluno tem uma turma que não está mais na lista (dado legado),
                 inclui como opção temporária para não perder a informação */
              const opts = turmas.includes(form.turma) || !form.turma
                ? turmas
                : [...turmas, form.turma];
              return (
                <select className="form-input" value={form.turma}
                  onChange={(e) => set("turma", e.target.value)}>
                  <option value="">— Selecione uma turma —</option>
                  {opts.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              );
            })() : (
              <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 13px",
                background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 9 }}>
                Nenhuma turma cadastrada. Configure em{" "}
                <span style={{ color: "var(--gold)" }}>⚙ Configurações</span>.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea"
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações livres sobre o aluno…" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit}>
            <CheckCircle size={14} /> {isEdit ? "Salvar alterações" : "Cadastrar aluno"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Detalhe do aluno (+ mensalidades)
   ══════════════════════════════════════════════════ */
function ModalDetalheAluno({
  aluno, mensalidades, config,
  onClose, onEditar, onExcluir, onGerarMensalidade,
  podeEditar, podeExcluir, onVerFoto,
}) {
  const cobrarWhatsApp = (mensAlvo) => {
    const numero = onlyDigits(aluno.telefone || aluno.telefoneResponsavel || "");
    if (!numero || numero.length < 10) {
      alert("Este aluno não tem telefone válido cadastrado.");
      return;
    }
    const alvo = mensAlvo || mensalidades
      .filter(m => Number(m.valorRestante || 0) > 0)
      .sort((a, b) => (a.dataVencimento || "").localeCompare(b.dataVencimento || ""))[0];

    const template = config?.mensagemWhatsApp || MSG_WHATSAPP_DEFAULT;
    let mesNome = "sua mensalidade";
    let valorFmt = fmtR$(aluno.valorMensalidade);
    if (alvo?.mesReferencia) {
      const [ano, mes] = alvo.mesReferencia.split("-");
      mesNome = `${MESES_PT[Number(mes) - 1]}/${ano}`;
      valorFmt = fmtR$(alvo.valorRestante ?? alvo.valorTotal ?? aluno.valorMensalidade);
    }
    const msg = template
      .replace(/\[nome\]/gi, primeiroNome(aluno.nome))
      .replace(/\[mes\]/gi, mesNome)
      .replace(/\[valor\]/gi, valorFmt);

    const url = `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const mensOrdenadas = useMemo(() =>
    [...mensalidades].sort((a, b) =>
      (b.mesReferencia || "").localeCompare(a.mesReferencia || "")
    ),
    [mensalidades]
  );

  const resumo = useMemo(() => {
    const abertas = mensalidades.filter(m => Number(m.valorRestante || 0) > 0);
    const pagas   = mensalidades.filter(m => Number(m.valorRestante || 0) <= 0);
    const totalAberto = abertas.reduce((s, m) => s + Number(m.valorRestante || 0), 0);
    const totalPago   = pagas.reduce((s, m) => s + Number(m.valorPago || m.valorTotal || 0), 0);
    const vencidas    = abertas.filter(m => statusMensalidade(m) === "vencida").length;
    return { abertas: abertas.length, pagas: pagas.length, totalAberto, totalPago, vencidas };
  }, [mensalidades]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-xl">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {aluno.foto
              ? <img src={aluno.foto} alt={aluno.nome}
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border-h)", flexShrink: 0, cursor: onVerFoto ? "zoom-in" : "default" }}
                  onClick={() => onVerFoto?.(aluno.foto)}
                  title="Ver foto"
                />
              : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--s3)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>{(aluno.nome || "?")[0].toUpperCase()}</div>}
            <div>
              <div className="modal-title">{aluno.nome}</div>
              <div className="modal-sub">
                {fmtIdSeq(aluno.idSeq)} · {aluno.documento || "—"} ·{" "}
                <span className={`mat-pill ${aluno.status === "ativo" ? "ok" : "neutral"}`}>
                  {aluno.status === "ativo" ? "Ativo" : aluno.status === "trancado" ? "Trancado" : "Inativo"}
                </span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="mat-detail-grid">
            <div className="mat-detail-item">
              <div className="mat-detail-label"><Phone size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Telefone</div>
              <div className="mat-detail-value">{aluno.telefone || "—"}</div>
            </div>
            <div className="mat-detail-item">
              <div className="mat-detail-label"><Mail size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Email</div>
              <div className="mat-detail-value">{aluno.email || "—"}</div>
            </div>
            {aluno.instagram && (
              <div className="mat-detail-item">
                <div className="mat-detail-label"><AtSign size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Instagram</div>
                <div className="mat-detail-value" style={{ color: "var(--blue)" }}>@{aluno.instagram}</div>
              </div>
            )}
            <div className="mat-detail-item">
              <div className="mat-detail-label"><DollarSign size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Mensalidade</div>
              <div className="mat-detail-value">{fmtR$(aluno.valorMensalidade)}</div>
            </div>
            <div className="mat-detail-item">
              <div className="mat-detail-label"><Calendar size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Vencimento</div>
              <div className="mat-detail-value">Todo dia {aluno.diaVencimento}</div>
            </div>
            {aluno.endereco && (
              <div className="mat-detail-item" style={{ gridColumn: "1 / -1" }}>
                <div className="mat-detail-label"><MapPin size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Endereço</div>
                <div className="mat-detail-value">{aluno.endereco}</div>
              </div>
            )}
            {(aluno.responsavel || aluno.telefoneResponsavel) && (
              <div className="mat-detail-item" style={{ gridColumn: "1 / -1" }}>
                <div className="mat-detail-label">Responsável</div>
                <div className="mat-detail-value">
                  {aluno.responsavel || "—"}
                  {aluno.telefoneResponsavel && ` · ${aluno.telefoneResponsavel}`}
                </div>
              </div>
            )}
            {aluno.observacoes && (
              <div className="mat-detail-item" style={{ gridColumn: "1 / -1" }}>
                <div className="mat-detail-label">Observações</div>
                <div className="mat-detail-value" style={{ whiteSpace: "pre-wrap" }}>{aluno.observacoes}</div>
              </div>
            )}
            {aluno.turma && (
              <div className="mat-detail-item">
                <div className="mat-detail-label">Turma / Horário</div>
                <div className="mat-detail-value">
                  <span className="turma-pill">{aluno.turma}</span>
                </div>
              </div>
            )}
          </div>

          {/* — Resumo mensalidades — */}
          <div className="mat-section-title"><FileText size={14} /> Mensalidades</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            <div className="mat-detail-item">
              <div className="mat-detail-label">Abertas</div>
              <div className="mat-detail-value" style={{ color: resumo.vencidas > 0 ? "var(--red)" : undefined }}>
                {resumo.abertas}{resumo.vencidas > 0 ? ` (${resumo.vencidas} vencidas)` : ""}
              </div>
            </div>
            <div className="mat-detail-item">
              <div className="mat-detail-label">Total em aberto</div>
              <div className="mat-detail-value">{fmtR$(resumo.totalAberto)}</div>
            </div>
            <div className="mat-detail-item">
              <div className="mat-detail-label">Pagas</div>
              <div className="mat-detail-value">{resumo.pagas}</div>
            </div>
            <div className="mat-detail-item">
              <div className="mat-detail-label">Total recebido</div>
              <div className="mat-detail-value">{fmtR$(resumo.totalPago)}</div>
            </div>
          </div>

          <div className="mat-mens-list">
            <div className="mat-mens-row head">
              <span>MÊS REFERÊNCIA</span>
              <span>VENCIMENTO</span>
              <span>VALOR</span>
              <span>STATUS</span>
              <span></span>
            </div>
            {mensOrdenadas.length === 0 ? (
              <div className="mat-empty">
                <Calendar size={24} color="var(--text-3)" />
                <p>Nenhuma mensalidade gerada ainda.</p>
              </div>
            ) : mensOrdenadas.map(m => {
              const st = statusMensalidade(m);
              const mesLabel = m.mesReferencia
                ? `${MESES_PT[Number(m.mesReferencia.split("-")[1]) - 1]}/${m.mesReferencia.split("-")[0]}`
                : "—";
              return (
                <div key={m.id} className="mat-mens-row">
                  <span className="mat-mens-mes" style={{ textTransform: "capitalize" }}>
                    {m.idSeqMens && <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-3)", marginRight: 6 }}>{m.idSeqMens}</span>}
                    {mesLabel}
                  </span>
                  <span>{fmtData(m.dataVencimento)}</span>
                  <span className="mat-mens-valor">
                    {fmtR$(st === "paga" ? (m.valorPago || m.valorTotal) : m.valorRestante)}
                  </span>
                  <span>
                    {st === "paga"    && <span className="mat-pill ok">Paga</span>}
                    {st === "pendente" && <span className="mat-pill neutral">Pendente</span>}
                    {st === "vencendo" && <span className="mat-pill warn">Vence em breve</span>}
                    {st === "vencida"  && <span className="mat-pill danger">Vencida</span>}
                  </span>
                  <span style={{ display: "flex", justifyContent: "flex-end" }}>
                    {st !== "paga" && (
                      <button className="btn-icon btn-icon-wpp"
                        onClick={() => cobrarWhatsApp(m)} title="Cobrar via WhatsApp">
                        <MessageCircle size={13} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {podeEditar && (
              <button className="btn-secondary" onClick={() => onGerarMensalidade(aluno)}>
                <Plus size={14} /> Gerar próxima mensalidade
              </button>
            )}
            <button className="btn-green" onClick={() => cobrarWhatsApp()}>
              <MessageCircle size={14} /> Cobrar mensalidade
            </button>
          </div>
        </div>

        <div className="modal-footer">
          {podeExcluir && (
            <button className="btn-danger" onClick={() => onExcluir(aluno)}>
              <Trash2 size={14} /> Excluir
            </button>
          )}
          {podeEditar && (
            <button className="btn-secondary" onClick={() => onEditar(aluno)}>
              <Edit2 size={14} /> Editar
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Configurações (template WhatsApp)
   Turmas são gerenciadas em Configurações → Matrículas
   ══════════════════════════════════════════════════ */
function ModalConfigMatriculas({ config, onSave, onClose }) {
  const [mensagem, setMensagem] = useState(config?.mensagemWhatsApp || MSG_WHATSAPP_DEFAULT);
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    setSalvando(true);
    try {
      await onSave({ mensagemWhatsApp: mensagem });
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">Configurações do módulo</div>
            <div className="modal-sub">Template de cobrança via WhatsApp</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Mensagem de cobrança</label>
            <textarea className="form-textarea" style={{ minHeight: 140 }}
              value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.6 }}>
              Variáveis disponíveis:<br />
              <code style={{ color: "var(--gold)" }}>[nome]</code> — primeiro nome do aluno<br />
              <code style={{ color: "var(--gold)" }}>[mes]</code> — mês da mensalidade (ex: "maio/2026")<br />
              <code style={{ color: "var(--gold)" }}>[valor]</code> — valor formatado (ex: "R$ 250,00")
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={salvando}>
            <CheckCircle size={14} /> {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Confirmar exclusão
   ══════════════════════════════════════════════════ */
function ModalExcluirAluno({ aluno, mensQtd, onConfirm, onClose }) {
  const [digitado, setDigitado] = useState("");
  return (
    <div className="modal-overlay modal-overlay-top" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Excluir aluno</div>
            <div className="modal-sub">Esta ação é permanente e não pode ser desfeita.</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
            Ao excluir <strong>{aluno.nome}</strong>, todas as <strong>{mensQtd}</strong> mensalidade(s)
            pendente(s) vinculadas também serão removidas de <em>A Receber</em>.
            As mensalidades já pagas (registradas em Vendas/Caixa) <strong>permanecem preservadas</strong>.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
            Digite <strong>EXCLUIR</strong> para confirmar:
          </p>
          <input type="text" className="form-input"
            value={digitado} onChange={(e) => setDigitado(e.target.value.toUpperCase())} />
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" disabled={digitado !== "EXCLUIR"} onClick={onConfirm}>
            <Trash2 size={14} /> Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════════════ */
export default function Alunos() {
  const { user, cargo, tenantUid, nomeUsuario } = useContext(AuthContext);

  const podeVer     = permMat(cargo, "ver");
  const podeCriar   = permMat(cargo, "criar");
  const podeEditar  = permMat(cargo, "editar");
  const podeExcluir = permMat(cargo, "excluir");

  const [alunos, setAlunos]           = useState([]);
  const [mensalidades, setMensalidades] = useState([]);
  const [config, setConfig]           = useState({ mensagemWhatsApp: MSG_WHATSAPP_DEFAULT });
  const [turmas, setTurmas]           = useState([]);
  const [loading, setLoading]         = useState(true);

  const [modalNovo, setModalNovo]     = useState(false);
  const [editando, setEditando]       = useState(null);
  const [detalhe, setDetalhe]         = useState(null);
  const [excluindo, setExcluindo]     = useState(null);
  const [modalConfig, setModalConfig] = useState(false);

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [turmaFilter, setTurmaFilter]   = useState("todas");
  const [sortDir, setSortDir]           = useState("asc");
  const [fotoVisualizando, setFotoVisualizando] = useState(null);

  const toggleSort = () => setSortDir(d => d === "asc" ? "desc" : "asc");

  /* ═══════════════════════════════════════════════════
     Firestore listeners — lê /clientes filtrando por perfis
     ═══════════════════════════════════════════════════ */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    setLoading(true);

    /* Query: apenas documentos com perfis contendo "aluno" */
    const alunosQuery = query(
      collection(db, "users", tenantUid, "clientes"),
      where("perfis", "array-contains", "aluno")
    );
    const arCol     = collection(db, "users", tenantUid, "a_receber");
    const configRef = doc(db, "users", tenantUid, "config", "matriculas");

    const unsub1 = onSnapshot(alunosQuery, (snap) => {
      setAlunos(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { fsError(err, "Alunos:alunos"); setLoading(false); });

    /* Escuta todas as a_receber e filtra em memória — evita índice composto */
    const unsub2 = onSnapshot(arCol, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMensalidades(all.filter(a => a.origem === "mensalidade"));
    }, fsSnapshotError("Alunos:aReceber"));

    getDoc(configRef).then(s => {
      if (s.exists()) {
        const data = s.data();
        setConfig({ mensagemWhatsApp: MSG_WHATSAPP_DEFAULT, ...data });
        setTurmas(Array.isArray(data.turmas) ? data.turmas : []);
      }
    }).catch(() => {});

    return () => { unsub1(); unsub2(); };
  }, [tenantUid]);

  /* ═══════════════════════════════════════════════════
     Salvar aluno (criar/editar) + mensalidade inicial
     ═══════════════════════════════════════════════════ */
  const handleSaveAluno = async (dados) => {
    if (!tenantUid) return;

    try {
      if (editando) {
        /* EDITAR */
        const { _fotoFile, ...dadosLimpos } = dados;
        if (_fotoFile !== undefined) dadosLimpos.foto = _fotoFile;

        const ref = doc(db, "users", tenantUid, "clientes", editando.docId);
        await updateDoc(ref, { ...dadosLimpos, atualizadoEm: new Date().toISOString() });

        /* Propaga mudanças de dia/valor para mensalidades em aberto */
        const mensDoAluno = mensalidades.filter(
          m => m.clienteId === editando.docId && Number(m.valorRestante || 0) > 0
        );
        const diaChanged   = Number(dados.diaVencimento)   !== Number(editando.diaVencimento);
        const valorChanged = Number(dados.valorMensalidade) !== Number(editando.valorMensalidade);

        if ((diaChanged || valorChanged) && mensDoAluno.length > 0) {
          const agora = new Date().toISOString();
          await Promise.all(mensDoAluno.map(m => {
            const updates = { dataAtualizacao: agora };
            if (diaChanged && m.mesReferencia) {
              const [ano, mes] = m.mesReferencia.split("-").map(Number);
              updates.dataVencimento = calcVencimento(
                ano, mes,
                Math.min(28, Math.max(1, Number(dados.diaVencimento)))
              );
            }
            if (valorChanged && Number(m.valorPago || 0) === 0) {
              updates.valorTotal    = Number(dados.valorMensalidade);
              updates.valorRestante = Number(dados.valorMensalidade);
              updates.descricao     = `Mensalidade ${m.mesReferencia} — ${dados.nome}`;
            }
            return updateDoc(doc(db, "users", tenantUid, "a_receber", m.id), updates);
          }));
        }

        await logAction({
          tenantUid, nomeUsuario, cargo,
          acao: LOG_ACAO.EDITAR, modulo: "Matrículas",
          descricao: `Editou aluno ${fmtIdSeq(editando.idSeq)} — ${dados.nome}`,
        });
        setEditando(null);
      } else {
        /* CRIAR */
        const docId = gerarDocIdAluno();
        const idSeq = proximoIdSeq(alunos);
        const agora = new Date().toISOString();
        const { _fotoFile: _ff, ...dadosCriar } = dados;
        if (_ff) dadosCriar.foto = _ff;

        /* Grava em /clientes com perfis: ["aluno"] */
        await setDoc(doc(db, "users", tenantUid, "clientes", docId), {
          docId,
          idSeq,
          idSeqFmt: fmtIdSeq(idSeq), // "A0001" — usado em Clientes.jsx e Relatórios
          perfis: ["aluno"],
          ...dadosCriar,
          criadoEm: agora,
          atualizadoEm: agora,
        });

        await gerarMensalidadeEmAberto({
          tenantUid,
          aluno: { docId, idSeq, ...dados },
          mensalidadesDoAluno: [],
        });

        await logAction({
          tenantUid, nomeUsuario, cargo,
          acao: LOG_ACAO.CRIAR, modulo: "Matrículas",
          descricao: `Matriculou ${fmtIdSeq(idSeq)} — ${dados.nome} — ${fmtR$(dados.valorMensalidade)}/mês`,
        });
        setModalNovo(false);
      }
    } catch (err) {
      fsError(err, "Alunos:salvar");
      alert("Erro ao salvar. Tente novamente.");
    }
  };

  /* ═══════════════════════════════════════════════════
     Gerar próxima mensalidade manualmente
     ═══════════════════════════════════════════════════ */
  const handleGerarMensalidade = async (aluno) => {
    if (!tenantUid) return;
    const doAluno = mensalidades.filter(m => m.clienteId === aluno.docId);
    try {
      const mensCriada = await gerarMensalidadeEmAberto({
        tenantUid,
        aluno,
        mensalidadesDoAluno: doAluno,
      });
      if (mensCriada) {
        await logAction({
          tenantUid, nomeUsuario, cargo,
          acao: LOG_ACAO.CRIAR, modulo: "Matrículas",
          descricao: `Gerou mensalidade ${mensCriada.mesReferencia} — ${aluno.nome} — ${fmtR$(mensCriada.valorTotal)}`,
        });
      }
    } catch (err) {
      fsError(err, "Alunos:mensalidade");
      alert("Erro ao gerar mensalidade.");
    }
  };

  /* ═══════════════════════════════════════════════════
     Excluir aluno — remove doc em /clientes + mensalidades em aberto
     ═══════════════════════════════════════════════════ */
  const handleExcluirAluno = async () => {
    if (!tenantUid || !excluindo) return;
    try {
      /* 1. Remove mensalidades em aberto (a_receber) */
      const abertas = mensalidades.filter(m => m.clienteId === excluindo.docId);
      await Promise.all(
        abertas.map(m => deleteDoc(doc(db, "users", tenantUid, "a_receber", m.id)))
      );
      /* 2. Remove o aluno de /clientes */
      await deleteDoc(doc(db, "users", tenantUid, "clientes", excluindo.docId));

      await logAction({
        tenantUid, nomeUsuario, cargo,
        acao: LOG_ACAO.EXCLUIR, modulo: "Matrículas",
        descricao: `Excluiu aluno ${fmtIdSeq(excluindo.idSeq)} — ${excluindo.nome} (${abertas.length} mensalidade(s) em aberto removidas)`,
      });
      setExcluindo(null);
      setDetalhe(null);
    } catch (err) {
      fsError(err, "Alunos:excluir");
      alert("Erro ao excluir aluno.");
    }
  };

  /* ═══════════════════════════════════════════════════
     Salvar configuração (template WhatsApp)
     ═══════════════════════════════════════════════════ */
  const handleSaveConfig = async (novaConfig) => {
    if (!tenantUid) return;
    try {
      await setDoc(
        doc(db, "users", tenantUid, "config", "matriculas"),
        { ...novaConfig, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );
      setConfig(c => ({ ...c, ...novaConfig }));
      if (Array.isArray(novaConfig.turmas)) setTurmas(novaConfig.turmas);
      await logAction({
        tenantUid, nomeUsuario, cargo,
        acao: LOG_ACAO.EDITAR, modulo: "Matrículas",
        descricao: "Atualizou configurações do módulo de Matrículas",
      });
    } catch (err) {
      fsError(err, "Alunos:config");
      alert("Erro ao salvar configurações.");
    }
  };

  /* ═══════════════════════════════════════════════════
     Derivados / filtros
     ═══════════════════════════════════════════════════ */
  const alunosComStatus = useMemo(() => {
    return alunos.map(a => {
      const suas   = mensalidades.filter(m => m.clienteId === a.docId);
      const abertas = suas.filter(m => Number(m.valorRestante || 0) > 0);
      const proxVenc = abertas
        .map(m => m.dataVencimento)
        .filter(Boolean)
        .sort()[0] || null;

      let situacao = "em_dia";
      if (abertas.some(m => statusMensalidade(m) === "vencida"))      situacao = "vencido";
      else if (abertas.some(m => statusMensalidade(m) === "vencendo")) situacao = "vencendo";
      else if (abertas.length === 0)                                   situacao = "em_dia";
      return { ...a, _situacao: situacao, _proxVenc: proxVenc, _totalAberto: abertas.reduce((s, m) => s + Number(m.valorRestante || 0), 0) };
    });
  }, [alunos, mensalidades]);

  const alunosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alunosComStatus.filter(a => {
      if (statusFilter !== "todos") {
        if (statusFilter === "ativos"   && a.status !== "ativo")       return false;
        if (statusFilter === "inativos" && a.status === "ativo")       return false;
        if (statusFilter === "em_dia"   && a._situacao !== "em_dia")   return false;
        if (statusFilter === "vencendo" && a._situacao !== "vencendo") return false;
        if (statusFilter === "vencidos" && a._situacao !== "vencido")  return false;
      }
      if (turmaFilter !== "todas") {
        if (turmaFilter === "__sem_turma__") {
          if (a.turma) return false;
        } else {
          if ((a.turma || "") !== turmaFilter) return false;
        }
      }
      if (!q) return true;
      return (
        a.nome?.toLowerCase().includes(q) ||
        onlyDigits(a.documento).includes(onlyDigits(q)) ||
        fmtIdSeq(a.idSeq).toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const cmp = (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [alunosComStatus, search, statusFilter, turmaFilter, sortDir]);

  const kpis = useMemo(() => {
    const total    = alunos.filter(a => a.status === "ativo").length;
    const emDia    = alunosComStatus.filter(a => a.status === "ativo" && a._situacao === "em_dia").length;
    const vencendo = alunosComStatus.filter(a => a.status === "ativo" && a._situacao === "vencendo").length;
    const vencidos = alunosComStatus.filter(a => a.status === "ativo" && a._situacao === "vencido").length;
    return { total, emDia, vencendo, vencidos };
  }, [alunos, alunosComStatus]);

  if (!tenantUid) {
    return <div className="mat-empty">Carregando autenticação…</div>;
  }
  if (!podeVer) {
    return (
      <div className="mat-empty" style={{ padding: 60 }}>
        <AlertCircle size={28} color="var(--text-3)" />
        <p>Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="mat-root">

        <header className="mat-topbar">
          <div>
            <h1>Módulo de Matrículas <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>v2.0</span></h1>
            <p>Gestão de alunos, mensalidades e cobrança integrada</p>
          </div>
          <div className="mat-actions">
            <button className="btn-secondary" onClick={() => setModalConfig(true)}>
              <Settings size={14} /> Configurações
            </button>
            {podeCriar && (
              <button className="btn-primary" onClick={() => setModalNovo(true)}>
                <Plus size={14} /> Nova matrícula
              </button>
            )}
          </div>
        </header>

        <div className="mat-content">
          {/* KPIs */}
          <div className="mat-cards">
            <div className="mat-card">
              <span className="mat-card-label">Total de alunos ativos</span>
              <span className="mat-card-value">{kpis.total}</span>
            </div>
            <div className="mat-card">
              <span className="mat-card-label">Em dia</span>
              <span className="mat-card-value ok" style={{ color: "var(--green)" }}>{kpis.emDia}</span>
            </div>
            <div className="mat-card">
              <span className="mat-card-label">Vencendo / Vencidos</span>
              <span className="mat-card-value split">
                <span className="warn">{kpis.vencendo}</span>
                <span className="sep">/</span>
                <span className="danger">{kpis.vencidos}</span>
              </span>
            </div>
          </div>

          {/* Tabela */}
          <div className="mat-table-wrap">
            <div className="mat-table-header">
              <div className="mat-table-title">
                <Users size={15} /> Alunos matriculados
                <span className="mat-table-badge">{alunosFiltrados.length}</span>
              </div>
            </div>

            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <div className="mat-filters">
                <div className="mat-search">
                  <Search size={14} />
                  <input type="text" placeholder="Buscar por nome, documento ou ID…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="mat-filter-select" value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="todos">Todos os status</option>
                  <option value="ativos">Ativos</option>
                  <option value="em_dia">Em dia</option>
                  <option value="vencendo">Vencendo</option>
                  <option value="vencidos">Vencidos</option>
                  <option value="inativos">Inativos/Trancados</option>
                </select>
                {turmas.length > 0 && (
                  <select className="mat-filter-select" value={turmaFilter}
                    onChange={(e) => setTurmaFilter(e.target.value)}>
                    <option value="todas">Todas as turmas</option>
                    {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__sem_turma__">Sem turma</option>
                  </select>
                )}
              </div>

              <div className="mat-quick-filters">
                <span style={{ fontSize: 11, color: "var(--text-3)", alignSelf: "center", marginRight: 2 }}>Filtro rápido:</span>
                <button
                  className={`mat-qbtn ${statusFilter === "todos" ? "active-neutral" : ""}`}
                  onClick={() => setStatusFilter("todos")}>
                  Todos
                </button>
                <button
                  className={`mat-qbtn ${statusFilter === "vencendo" ? "active-warn" : ""}`}
                  onClick={() => setStatusFilter(statusFilter === "vencendo" ? "todos" : "vencendo")}>
                  <Clock size={11} /> Pendentes ({kpis.vencendo})
                </button>
                <button
                  className={`mat-qbtn ${statusFilter === "vencidos" ? "active-danger" : ""}`}
                  onClick={() => setStatusFilter(statusFilter === "vencidos" ? "todos" : "vencidos")}>
                  <AlertCircle size={11} /> Vencidos ({kpis.vencidos})
                </button>
              </div>
            </div>

            <div className="mat-row-head">
              <span>ID</span>
              <span>
                <span className="mat-col-sort" onClick={toggleSort} title={sortDir === "asc" ? "Ordenar Z→A" : "Ordenar A→Z"}>
                  ALUNO
                  <span className="mat-sort-icon">{sortDir === "asc" ? "▲" : "▼"}</span>
                </span>
              </span>
              <span>DOCUMENTO</span>
              <span>MENSALIDADE</span>
              <span>VENCIMENTO</span>
              <span>STATUS</span>
              <span style={{ textAlign: "right" }}>AÇÕES</span>
            </div>

            {loading ? (
              <div className="mat-empty">Carregando alunos…</div>
            ) : alunosFiltrados.length === 0 ? (
              <div className="mat-empty">
                <Users size={28} color="var(--text-3)" />
                <p>Nenhum aluno encontrado.</p>
              </div>
            ) : alunosFiltrados.map(a => (
              <div key={a.docId} className="mat-row" onClick={() => setDetalhe(a)}>
                <span className="mat-id">{fmtIdSeq(a.idSeq)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {a.foto
                    ? <img src={a.foto} alt={a.nome} className="aluno-avatar"
                        style={{ cursor: "zoom-in" }}
                        onClick={(e) => { e.stopPropagation(); setFotoVisualizando(a.foto); }}
                        title="Ver foto"
                      />
                    : <div className="aluno-avatar-placeholder">{(a.nome || "?")[0].toUpperCase()}</div>}
                  <span>
                    <div className="mat-aluno-nome">{a.nome}</div>
                    {a.telefone && <div className="mat-aluno-sub">{a.telefone}</div>}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{a.documento || "—"}</span>
                <span className="mat-valor">{fmtR$(a.valorMensalidade)}</span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {a._proxVenc ? fmtData(a._proxVenc) : `Dia ${a.diaVencimento}`}
                </span>
                <span>
                  {a.status !== "ativo" ? (
                    <span className="mat-pill neutral">{a.status === "trancado" ? "Trancado" : "Inativo"}</span>
                  ) : a._situacao === "vencido"  ? <span className="mat-pill danger">Vencido</span>
                  :    a._situacao === "vencendo" ? <span className="mat-pill warn">Vencendo</span>
                  :                                 <span className="mat-pill ok">Em dia</span>}
                </span>
                <div className="mat-actions-cell" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon btn-icon-view" onClick={() => setDetalhe(a)} title="Ver detalhes">
                    <Search size={13} />
                  </button>
                  {podeEditar && (
                    <button className="btn-icon btn-icon-edit" onClick={() => setEditando(a)} title="Editar">
                      <Edit2 size={13} />
                    </button>
                  )}
                  {podeExcluir && (
                    <button className="btn-icon btn-icon-del" onClick={() => setExcluindo(a)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modais */}
      {modalNovo && (
        <ModalMatricula
          alunosExistentes={alunos}
          turmas={turmas}
          onSave={handleSaveAluno}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && (
        <ModalMatricula
          aluno={editando}
          alunosExistentes={alunos}
          turmas={turmas}
          onSave={handleSaveAluno}
          onClose={() => setEditando(null)}
        />
      )}
      {detalhe && (
        <ModalDetalheAluno
          aluno={detalhe}
          mensalidades={mensalidades.filter(m => m.clienteId === detalhe.docId)}
          config={config}
          onClose={() => setDetalhe(null)}
          onEditar={(a)     => { setDetalhe(null); setEditando(a); }}
          onExcluir={(a)    => { setDetalhe(null); setExcluindo(a); }}
          onGerarMensalidade={handleGerarMensalidade}
          podeEditar={podeEditar}
          podeExcluir={podeExcluir}
          onVerFoto={(foto) => setFotoVisualizando(foto)}
        />
      )}
      {excluindo && (
        <ModalExcluirAluno
          aluno={excluindo}
          mensQtd={mensalidades.filter(m => m.clienteId === excluindo.docId).length}
          onConfirm={handleExcluirAluno}
          onClose={() => setExcluindo(null)}
        />
      )}
      {modalConfig && (
        <ModalConfigMatriculas
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setModalConfig(false)}
        />
      )}

      {fotoVisualizando && (
        <FotoLightbox
          src={fotoVisualizando}
          readOnly
          onClose={() => setFotoVisualizando(null)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   LIGHTBOX: Visualizador de foto do aluno
   ══════════════════════════════════════════════════════════════════════ */
function FotoLightbox({ src, onAlterar, onRemover, onClose, readOnly = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="foto-lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={src} alt="Foto do aluno" className="foto-lightbox-img" />
      <div className="foto-lightbox-actions">
        <button className="btn-secondary" onClick={onClose}>
          <X size={14} /> Fechar
        </button>
        {!readOnly && (
          <>
            <button className="btn-secondary" onClick={onAlterar}>
              <Camera size={14} /> Alterar foto
            </button>
            <button className="btn-danger" onClick={onRemover}>
              <Trash2 size={14} /> Remover
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MODAL: Posicionar / cortar foto (drag + zoom → canvas → base64)
   ══════════════════════════════════════════════════════════════════════ */
function ModalCropFoto({ src, onConfirm, onClose }) {
  const SIZE     = 260;
  const OUT_SIZE = 400;

  const imgRef   = useRef(null);
  const stageRef = useRef(null);
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 });
  const dragRef  = useRef(null);

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    setImgNat({ w, h });
    const minScale = Math.max(SIZE / w, SIZE / h);
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup",   onMouseUp);
  };

  const touchRef = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = { startX: t.clientX, startY: t.clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 1 && touchRef.current) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - touchRef.current.startX;
      const dy = t.clientY - touchRef.current.startY;
      setOffset({ x: touchRef.current.ox + dx, y: touchRef.current.oy + dy });
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const minS  = Math.max(SIZE / imgNat.w, SIZE / imgNat.h);
    setScale(s => Math.min(6, Math.max(minS, s + delta)));
  };

  const imgStyle = () => {
    const w = imgNat.w * scale;
    const h = imgNat.h * scale;
    const left = (SIZE - w) / 2 + offset.x;
    const top  = (SIZE - h) / 2 + offset.y;
    return { width: w, height: h, left, top, transform: "none" };
  };

  const confirmar = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width  = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d");
    const scaledW = imgNat.w * scale;
    const scaledH = imgNat.h * scale;
    const left    = (SIZE - scaledW) / 2 + offset.x;
    const top     = (SIZE - scaledH) / 2 + offset.y;
    ctx.drawImage(img, -left / scale, -top / scale, SIZE / scale, SIZE / scale, 0, 0, OUT_SIZE, OUT_SIZE);
    const base64 = canvas.toDataURL("image/jpeg", 0.88);
    onConfirm(base64);
  };

  return (
    <div className="crop-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crop-box">
        <div className="crop-title">Posicionar foto</div>
        <div ref={stageRef} className="crop-stage" style={{ width: SIZE, height: SIZE }}
          onMouseDown={onMouseDown} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
          <img ref={imgRef} src={src} alt="" style={imgStyle()} onLoad={handleImgLoad} draggable={false} />
        </div>
        <div className="crop-hint">Arraste para reposicionar · Scroll para zoom</div>
        <div className="crop-zoom">
          <span style={{ fontSize: 10 }}>A</span>
          <input type="range" min={0.5} max={6} step={0.01}
            value={scale} onChange={(e) => setScale(Number(e.target.value))} />
          <span style={{ fontSize: 14 }}>A</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <div className="crop-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar}>
            <CheckCircle size={14} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HELPER: gera mensalidade em aberto (a_receber) para um aluno
   Grava clienteId (substitui alunoId). Retorna o objeto criado ou null.
   ══════════════════════════════════════════════════════════════════════ */
async function gerarMensalidadeEmAberto({ tenantUid, aluno, mensalidadesDoAluno }) {
  const { ano, mes } = proximoMesParaGerar(aluno, mensalidadesDoAluno);
  const mesRef = toMesRef(ano, mes);

  const jaExiste = mensalidadesDoAluno.some(m => m.mesReferencia === mesRef);
  if (jaExiste) return null;

  /* ID sequencial M0001, M0002… — lê todos para garantir unicidade */
  const arSnap = await getDocs(
    query(collection(db, "users", tenantUid, "a_receber"), where("origem", "==", "mensalidade"))
  );
  const maxSeq = arSnap.docs.reduce((max, d) => {
    const n = Number(String(d.data().idSeqMens || "M0000").replace(/\D/g, "")) || 0;
    return Math.max(max, n);
  }, 0);
  const idSeqMens = fmtIdSeqMens(maxSeq + 1);

  const dia = Math.min(28, Math.max(1, Number(aluno.diaVencimento) || 10));
  const dataVencimento = calcVencimento(ano, mes, dia);
  const valor = Number(aluno.valorMensalidade || 0);
  const agora = new Date().toISOString();

  const payload = {
    idSeqMens,
    origem:          "mensalidade",
    clienteId:       aluno.docId,      // referência ao documento em /clientes
    clienteIdSeq:    aluno.idSeq,
    mesReferencia:   mesRef,
    categoria:       "Mensalidade",
    descricao:       `Mensalidade ${mesRef} — ${aluno.nome}`,
    clienteNome:     aluno.nome,
    cliente:         aluno.nome,       // campo lido pelo RelatorioContasReceber no ranking
    valorTotal:      valor,
    valorPago:       0,
    valorRestante:   valor,
    dataVencimento,
    status:          "pendente",
    referenciaId:    aluno.docId,
    dataCriacao:     agora,
    dataAtualizacao: agora,
  };

  await addDoc(collection(db, "users", tenantUid, "a_receber"), payload);
  return payload;
}
